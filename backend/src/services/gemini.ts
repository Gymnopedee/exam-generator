import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set in the environment variables.");
}

// Initialize the new Google Gen AI SDK client
export const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const MODELS = {
  // We can use gemini-2.5-pro or gemini-2.5-flash as default 
  // since the prompt asked for MVP with Gemini 2.5
  // Note: Changed PRO to gemini-2.5-flash due to Free Tier quota limit of 0 for pro
  PRO: 'gemini-2.5-flash',
  FLASH: 'gemini-2.5-flash',
};

// Helper function to retry API calls on 503 Service Unavailable errors
export async function generateContentWithRetry(params: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const is503 = error?.status === 'UNAVAILABLE' || error?.status === 503 || (error?.message && error.message.includes('503'));
      if (is503 && i < retries - 1) {
        const delay = (i + 1) * 2000; // 2s, 4s, 6s...
        console.log(`[Gemini API] 503 High Demand Error. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
