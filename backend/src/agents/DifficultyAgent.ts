import { ai, MODELS, generateContentWithRetry } from '../services/gemini';
import { Type, Schema } from '@google/genai';

export class DifficultyAgent {
  static async evaluateDifficulty(questionObj: any) {
    const prompt = `주어진 문제의 인지적 요구 수준을 평가하여 난이도를 분류하라.
단순 암기라면 'low', 개념의 적용이라면 'medium', 복합적 추론이나 분석이 필요하다면 'high', 
실제 수능 기출 스타일의 복잡한 표/그래프 해석이나 긴 지문이 포함된 경우 'suneung'으로 분류하라.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        difficulty: { type: Type.STRING }, // low, medium, high, suneung
        reason: { type: Type.STRING }
      },
      required: ["difficulty", "reason"]
    };

    const response = await generateContentWithRetry({
      model: MODELS.PRO,
      contents: [
        { role: 'user', parts: [{ text: prompt + "\\n\\n[문제 데이터]\\n" + JSON.stringify(questionObj) }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    const responseText = response.text || '{}';
    return JSON.parse(responseText);
  }
}
