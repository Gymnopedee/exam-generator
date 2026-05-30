import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { processDocumentAndGenerateQuestions } from './agents/pipeline';
import { ai, generateContentWithRetry } from './services/gemini';
import { db } from './config/firebase';

dotenv.config();

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

// Existing text-based generate endpoint
app.post('/api/generate', async (req, res) => {
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

// New PDF upload endpoint (MVP RAG via Gemini File API)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const subject = req.body.subject || '사회문화';
    const questionCount = parseInt(req.body.questionCount || '10', 10);
    
    console.log(`[Upload] Uploading ${req.file.originalname} to Gemini...`);
    const fileResponse = await ai.files.upload({
      file: req.file.path,
      config: { mimeType: req.file.mimetype }
    });

    console.log(`[Upload] File uploaded. URI: ${fileResponse.name}`);
    
    // For MVP, we'll extract text from Gemini directly and pass it to the pipeline
    const textExtraction = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: [
        { fileData: { fileUri: fileResponse.uri || '', mimeType: fileResponse.mimeType || '' } },
        { text: "이 문서의 텍스트 내용을 모두 추출해서 그대로 출력해줘." }
      ]
    });

    const extractedText = textExtraction.text || '';
    console.log(`[Upload] Text extracted (${extractedText.length} chars). Starting pipeline...`);

    const result = await processDocumentAndGenerateQuestions(extractedText, subject, questionCount);

    // Save Material metadata to Firestore only if pipeline succeeds
    const materialRef = db.collection('materials').doc();
    await materialRef.set({
      id: materialRef.id,
      filename: req.file.originalname,
      subject,
      createdAt: new Date().toISOString(),
      status: 'completed'
    });

    res.json({ success: true, materialId: materialRef.id, questions: result });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
  }
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

app.post('/api/subjects', async (req, res) => {
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

app.put('/api/subjects/:id', async (req, res) => {
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

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await db.collection('subjects').doc(req.params.id).delete();
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
