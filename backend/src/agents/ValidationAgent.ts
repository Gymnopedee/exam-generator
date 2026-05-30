import { ai, MODELS, generateContentWithRetry } from '../services/gemini';
import { Type, Schema } from '@google/genai';

export class ValidationAgent {
  static async validateQuestion(questionObj: any, sourceText: string) {
    const prompt = `당신은 출제 검토위원입니다. 생성된 문제가 원본 자료 내용과 부합하는지, 논리적 오류가 없는지, 정답이 확실한지 검증하라.
오류가 있다면 수정된 문제를 제시하고, 오류가 없다면 원본 문제를 그대로 반환하라. 중복되거나 너무 지엽적인 문제라면 승인하지 말라.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        is_approved: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        corrected_question: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            type: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            choices: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            concepts: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
      required: ["is_approved", "reason"]
    };

    const response = await generateContentWithRetry({
      model: MODELS.PRO,
      contents: [
        { role: 'user', parts: [{ text: prompt + "\\n\\n[문제 데이터]\\n" + JSON.stringify(questionObj) + "\\n\\n[원본 텍스트]\\n" + sourceText }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    const responseText = response.text || '{"is_approved": false, "reason": "Failed to validate"}';
    return JSON.parse(responseText);
  }
}
