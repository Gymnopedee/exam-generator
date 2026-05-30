import { ai, MODELS, generateContentWithRetry } from '../services/gemini';
import { Type, Schema } from '@google/genai';

export class QuestionGenerator {
  static async generateQuestions(concepts: any, count: number = 5) {
    const prompt = `주어진 핵심 개념과 키워드를 바탕으로 고등학생 내신 대비용 문제를 생성하라.
총 ${count}문제를 생성하되, 객관식(multiple_choice), OX(ox), 빈칸(blank), 서술형(essay) 유형을 골고루 포함하라.
난이도는 하(low), 중(medium), 상(high) 중에서 적절히 배분하라.`;

    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          type: { type: Type.STRING }, // multiple_choice, ox, blank, essay
          difficulty: { type: Type.STRING }, // low, medium, high, suneung
          choices: { type: Type.ARRAY, items: { type: Type.STRING } }, // 객관식일 경우
          answer: { type: Type.STRING }, // 정답 (객관식은 번호, OX는 O/X 등)
          explanation: { type: Type.STRING }, // 해설
          concepts: { type: Type.ARRAY, items: { type: Type.STRING } } // 관련 개념
        },
        required: ["question", "type", "difficulty", "answer", "explanation"]
      }
    };

    const response = await generateContentWithRetry({
      model: MODELS.PRO,
      contents: [
        { role: 'user', parts: [{ text: prompt + "\\n\\n[개념 데이터]\\n" + JSON.stringify(concepts) }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      }
    });

    const responseText = response.text || '[]';
    return JSON.parse(responseText);
  }
}
