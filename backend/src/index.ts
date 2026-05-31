import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processDocumentAndGenerateQuestions } from './agents/pipeline';
import { ai, generateContentWithRetry } from './services/gemini';
import { db } from './config/firebase';

dotenv.config();

// --- Admin Authentication Security Layer ---
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// 암호 서명 방식의 2시간 일회용 관리자 세션 토큰 생성
function generateAdminToken(): string {
  const payload = JSON.stringify({ role: 'admin', exp: Date.now() + 2 * 60 * 60 * 1000 });
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

// 토큰의 무결성 및 만료 여부 확인
function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payloadBase64, signature] = parts;
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('hex');
    
    if (signature !== expectedSignature) return false;
    
    const payload = JSON.parse(payloadStr);
    if (payload.role !== 'admin') return false;
    if (payload.exp < Date.now()) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

// Express 권한 제어 미들웨어
const adminAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (verifyAdminToken(token)) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized: 관리자 권한이 없거나 세션이 만료되었습니다.' });
  }
};

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  // 배포 시 FRONTEND_URL 환경변수에 Vercel URL 입력 (예: https://my-app.vercel.app)
  // 로컬 개발 시에는 모든 origin 허용
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Setup multer for temporary file storage
const upload = multer({ dest: 'uploads/' });

// Existing text-based generate endpoint - Protected by adminAuth
app.post('/api/generate', adminAuth, async (req, res) => {
  try {
    const { documentText, subject } = req.body;
    if (!documentText) {
      return res.status(400).json({ error: 'documentText is required' });
    }
    const result = await processDocumentAndGenerateQuestions(documentText, subject || '사회문화');
    res.json({ success: true, questions: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

interface UploadJob {
  id: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  filename: string;
  result?: any;
  error?: string;
}

const uploadJobs = new Map<string, UploadJob>();

// New PDF upload endpoint (MVP RAG via Gemini File API) - Protected by adminAuth
// 즉시 Job ID를 반환하고 백그라운드에서 실시간 진행도를 갱신하며 연산을 지속함
app.post('/api/upload', adminAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const subject = req.body.subject || '사회문화';
    const questionCount = parseInt(req.body.questionCount || '10', 10);
    
    // 고유 작업 ID 발행 및 풀 등록
    const jobId = crypto.randomUUID();
    const tempFilePath = req.file.path;
    const originalname = req.file.originalname;
    const mimetype = req.file.mimetype;

    uploadJobs.set(jobId, {
      id: jobId,
      progress: 5,
      status: 'pending',
      message: '서버가 파일을 수신했습니다. 업로드를 시작합니다.',
      filename: originalname
    });

    // 즉시 비동기로 응답 반환 (대기 이탈 방지!)
    res.json({ success: true, jobId });

    // 백그라운드 비동기 처리 시작
    (async () => {
      try {
        const job = uploadJobs.get(jobId);
        if (!job) return;

        // Step 1: Gemini File API 업로드 (15%)
        job.progress = 15;
        job.status = 'processing';
        job.message = '학습 자료를 AI 파싱 컨테이너에 안전하게 로드하고 있습니다...';
        uploadJobs.set(jobId, { ...job });

        console.log(`[Upload Job ${jobId}] Uploading to Gemini...`);
        const fileResponse = await ai.files.upload({
          file: tempFilePath,
          config: { mimeType: mimetype }
        });

        // Step 2: 텍스트 추출 진행 (45%)
        job.progress = 45;
        job.message = 'Gemini AI가 학습 자료의 본문 텍스트를 정밀 분석 및 추출하고 있습니다...';
        uploadJobs.set(jobId, { ...job });

        console.log(`[Upload Job ${jobId}] Extacting text...`);
        const textExtraction = await generateContentWithRetry({
          model: 'gemini-2.5-flash',
          contents: [
            { fileData: { fileUri: fileResponse.uri || '', mimeType: fileResponse.mimeType || '' } },
            { text: "이 문서의 텍스트 내용을 모두 추출해서 그대로 출력해줘." }
          ]
        });

        const extractedText = textExtraction.text || '';
        if (!extractedText.trim()) {
          throw new Error('학습 문서에서 텍스트를 추출할 수 없습니다. 파일 형식을 다시 확인해 주세요.');
        }

        // Step 3: AI 문제 생성 파이프라인 구동 (75%)
        job.progress = 75;
        job.message = '출제 위원 모드를 가동하여 본문 기반 맞춤형 시험 문제와 보기, 해설을 설계하고 있습니다...';
        uploadJobs.set(jobId, { ...job });

        console.log(`[Upload Job ${jobId}] Starting pipeline...`);
        const result = await processDocumentAndGenerateQuestions(extractedText, subject, questionCount);

        // Step 4: Firestore Metadata 저장 (95%)
        job.progress = 95;
        job.message = '생성된 문제들과 학습 자료 정보를 데이터베이스에 고속 연동 중입니다...';
        uploadJobs.set(jobId, { ...job });

        const materialRef = db.collection('materials').doc();
        await materialRef.set({
          id: materialRef.id,
          filename: originalname,
          subject,
          createdAt: new Date().toISOString(),
          status: 'completed'
        });

        // Step 5: 완료 (100%)
        job.progress = 100;
        job.status = 'completed';
        job.message = '🎉 맞춤 문제은행 구축이 성공적으로 끝났습니다! 잠시 후 화면을 새로고침합니다.';
        job.result = { materialId: materialRef.id, questions: result };
        uploadJobs.set(jobId, { ...job });
        console.log(`[Upload Job ${jobId}] Job completed successfully!`);

      } catch (err: any) {
        console.error(`[Upload Job ${jobId}] Job failed:`, err);
        const job = uploadJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.message = `에러 발생: ${err.message}`;
          job.error = err.message;
          uploadJobs.set(jobId, { ...job });
        }
      } finally {
        // 임시 리소스 파일 격리 제거
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    })();

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 실시간 진행도를 SSE(Server-Sent Events) 스트림으로 스트리밍하는 채널 개설
app.get('/api/upload/progress', (req, res) => {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  // SSE 연결을 위해 HTTP 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // 즉시 초기 연결 응답 반환
  res.write(`data: ${JSON.stringify({ status: 'connected', message: '진행 상태 채널 개설 완료' })}\n\n`);

  // 1초마다 메모리 작업 풀을 대조하여 실시간 전송
  const intervalId = setInterval(() => {
    const job = uploadJobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ status: 'failed', message: '작업 정보를 찾을 수 없습니다.' })}\n\n`);
      clearInterval(intervalId);
      res.end();
      return;
    }

    // 최신 상태 스트리밍
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    // 완료 또는 실패 감지 시 타이머 클리어 후 종료
    if (job.status === 'completed' || job.status === 'failed') {
      clearInterval(intervalId);
      // 스트림을 부드럽게 종료하기 전에 약간의 버퍼 후 전송 마감
      setTimeout(() => {
        try { res.end(); } catch (e) {}
      }, 500);
    }
  }, 1000);

  // 클라이언트가 임의로 브라우저 창을 닫아 연결을 끊을 시 리소스 정리
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Get materials list to check duplicates
app.get('/api/materials', async (req, res) => {
  try {
    const snapshot = await db.collection('materials').orderBy('createdAt', 'desc').get();
    const materials = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, materials });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Subject Management APIs ---
app.get('/api/subjects', async (req, res) => {
  try {
    const snapshot = await db.collection('subjects').get();
    const subjects = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, subjects });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', adminAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    
    // Check for duplicates
    const existing = await db.collection('subjects').where('name', '==', name).get();
    if (!existing.empty) {
      return res.status(400).json({ error: '이미 존재하는 과목입니다.' });
    }
    
    const docRef = db.collection('subjects').doc();
    const id = docRef.id;
    
    await docRef.set({ id, name, color: color || 'bg-gray-500' });
    res.json({ success: true, message: 'Subject created', id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get questions by subject — supports both ID-based and name-based lookup
app.get('/api/questions', async (req, res) => {
  try {
    const subjectId = req.query.subject as string;
    if (!subjectId) {
      return res.status(400).json({ error: 'Subject ID is required' });
    }

    // 1) subject 문서에서 이름 조회
    const subjectDoc = await db.collection('subjects').doc(subjectId).get();
    const subjectName = subjectDoc.exists ? subjectDoc.data()?.name : null;

    // 2) ID로 저장된 문제와 이름으로 저장된 문제를 모두 가져옴 (이전 데이터 호환)
    const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [
      db.collection('questions').where('subject', '==', subjectId).get()
    ];
    if (subjectName && subjectName !== subjectId) {
      queries.push(db.collection('questions').where('subject', '==', subjectName).get());
    }

    const snapshots = await Promise.all(queries);
    const seen = new Set<string>();
    const questions: any[] = [];
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          questions.push(doc.data());
        }
      }
    }

    res.json({ success: true, questions });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/subjects/:id', adminAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;
    
    await db.collection('subjects').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Subject updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', adminAuth, async (req, res) => {
  try {
    await db.collection('subjects').doc(req.params.id).delete();
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Admin Login & Verify Security APIs ---
app.post('/api/admin/login', (req, res) => {
  try {
    const { passcode } = req.body;
    const targetPasscode = process.env.ADMIN_PASSCODE || '7564'; // 환경 변수가 우선하고 없으면 기본 7564
    
    if (passcode === targetPasscode) {
      const token = generateAdminToken();
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, error: '올바르지 않은 관리자 패스코드입니다.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (verifyAdminToken(token)) {
      res.json({ success: true, message: '유효한 관리자 세션입니다.' });
    } else {
      res.status(401).json({ success: false, error: '유효하지 않거나 만료된 세션입니다.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Tutor Chat Endpoint using Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { question, myAnswer, correctAnswer, concept, explanation, chatHistory, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const systemPrompt = `너는 학생의 학습을 돕는 친절하고 똑똑한 AI 오답 코치야.
현재 학생은 자기가 틀린 시험 문제를 복습하며 너에게 질문하고 있어.

[틀린 문제 정보]
- 문제: ${question || '알 수 없음'}
- 학생이 작성한 오답: ${myAnswer || '선택 안 함'}
- 실제 정답: ${correctAnswer || '알 수 없음'}
- 단원/개념: ${concept || '일반 개념'}
- 출제 해설: ${explanation || '해설 없음'}

이 문제와 개념에 대해 학생이 다음과 같은 질문을 했어:
"${message}"

[이전 대화 맥락]
${(chatHistory || []).map((c: any) => `${c.role === 'user' ? '학생' : '코치'}: ${c.text}`).join('\n')}

[대답 수칙]
1. 고등학교 친절한 선생님처럼 따뜻하고 상냥한 해요체(존댓말)를 사용해줘.
2. 학생의 질문을 공감해주고 격려하면서 질문의 요지를 정확히 짚어줘.
3. 틀린 오답 지문이 왜 오답이고 정답 지문이 왜 정답인지, 핵심 개념을 비교하며 고등학생 눈높이에 맞게 아주 쉽게 명쾌하게 설명해줘.
4. 너무 긴 대답보다는 읽기 좋게 문단을 나누어 3-4문장 내외로 핵심 위주로 설명해줘.`;

    const result = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: [
        { text: systemPrompt }
      ]
    });

    const reply = result.text || '죄송해요, 답변을 생성하는 도중 오류가 발생했어요. 다시 한 번 질문해 주시겠어요?';
    res.json({ success: true, reply });
  } catch (error: any) {
    console.error('[Chat API Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Exam History APIs ---
app.post('/api/history', async (req, res) => {
  try {
    const { subjectId, subjectName, score, totalQuestions, correctRate, userId } = req.body;
    
    const historyRef = db.collection('exam_histories').doc();
    const historyData = {
      id: historyRef.id,
      subjectId,
      subjectName,
      score,
      totalQuestions,
      correctRate,
      userId: userId || 'anonymous_user',
      takenAt: new Date().toISOString()
    };
    
    await historyRef.set(historyData);
    res.json({ success: true, history: historyData });
  } catch (error: any) {
    console.error('[Save History Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'anonymous_user';
    
    // Firestore 복합 쿼리 인덱스 에러 방지를 위해, 안전하게 메모리 수준에서 정렬 처리 수행
    const snapshot = await db.collection('exam_histories')
      .where('userId', '==', userId)
      .get();
      
    const histories = snapshot.docs
      .map(doc => doc.data())
      .sort((a: any, b: any) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
      .slice(0, 10); // 최근 10개만 전달
      
    res.json({ success: true, histories });
  } catch (error: any) {
    console.error('[Get History Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
