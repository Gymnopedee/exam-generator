import { ai, MODELS, generateContentWithRetry } from '../services/gemini';
import { Type, Schema } from '@google/genai';

export class ConceptExtractor {
  static async extractConcepts(documentText: string, subject: string = '사회문화') {
    const prompt = `당신은 고등학교 ${subject} 교사이다.
업로드된 방대한 자료를 분석하여 다음 내용을 "매우 간결하게 요약(핵심 키워드 위주)"하여 정리하라. 
절대로 원본 텍스트를 그대로 복사하거나 길게 서술하지 마라. (각 항목당 1~2줄 이내로 압축할 것)

1. 핵심 개념 요약
2. 중요 암기 요소
3. 시험 출제 가능 내용
4. 비교 개념
5. 빈칸 문제 후보
6. 서술형 문제 후보
를 정리하라.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        unit: { type: Type.STRING },
        concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        comparison: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              A: { type: Type.STRING },
              B: { type: Type.STRING }
            }
          }
        },
        essay_candidates: { type: Type.ARRAY, items: { type: Type.STRING } },
        blank_candidates: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["unit", "concepts", "keywords"]
    };

    const response = await generateContentWithRetry({
      model: MODELS.PRO,
      contents: [
        { role: 'user', parts: [{ text: prompt + "\\n\\n[자료 본문]\\n" + documentText }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    const responseText = response.text || '{}';
    return JSON.parse(responseText);
  }
}
