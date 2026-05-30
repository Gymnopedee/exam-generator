import { MODELS, generateContentWithRetry } from '../services/gemini';
import { Type, Schema } from '@google/genai';
import { db } from '../config/firebase';

export async function processDocumentAndGenerateQuestions(documentText: string, subject: string, questionCount: number = 10) {
  try {
    console.log(`[Pipeline] Starting single-shot ${questionCount}-question generation...`);
    
    const prompt = `당신은 대한민국 최고의 ${subject} 일타 강사 및 수능/내신 출제 위원입니다.
제공된 텍스트를 철저히 분석하여, 학생들의 실력을 테스트할 수 있는 객관식(4지 선다) 문제 ${questionCount}개를 "한 번에" 생성해 주세요.

[필수 요구사항]
1. 문제 유형(type)은 'multiple_choice'로 고정할 것.
2. 각 문제의 난이도(difficulty)는 '상', '중', '하'로 배분할 것.
3. 선택지(choices)는 반드시 4개여야 하며, 매력적인 오답을 포함할 것.
4. 정답(answer)은 0부터 3 사이의 숫자로 기입할 것. (예: 1번이 정답이면 0, 4번이 정답이면 3)
5. 해설(explanation)은 정답인 이유와 오답인 이유를 아주 명확하게 설명할 것.
6. 절대로 원본 텍스트를 통째로 복사해서 출력하지 말 것. 오직 JSON 배열만 출력할 것.`;

    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          type: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          choices: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.NUMBER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "type", "difficulty", "choices", "answer", "explanation"]
      }
    };

    const response = await generateContentWithRetry({
      model: MODELS.PRO, 
      contents: [
        { role: 'user', parts: [{ text: prompt + "\\n\\n[원본 텍스트]\\n" + documentText }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      }
    });

    const responseText = response.text || '[]';
    let generatedQuestions = JSON.parse(responseText);
    
    console.log(`[Pipeline] Successfully generated ${generatedQuestions.length} questions in one shot. Saving to Firestore...`);
    
    const batch = db.batch();
    const questionsRef = db.collection('questions');
    
    const finalQuestions = generatedQuestions.map((q: any) => {
      const docRef = questionsRef.doc();
      const finalQ = {
        ...q,
        id: docRef.id,
        subject: subject,
        createdAt: new Date().toISOString()
      };
      batch.set(docRef, finalQ);
      return finalQ;
    });
    
    await batch.commit();
    console.log('[Pipeline] Finished successfully.');
    return finalQuestions;

  } catch (error) {
    console.error('[Pipeline Error]', error);
    throw error;
  }
}
