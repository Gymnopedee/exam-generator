import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({});

async function test() {
  try {
    fs.writeFileSync('dummy.txt', 'This is a test document.');
    const uploadResult = await ai.files.upload({ file: 'dummy.txt', config: { mimeType: 'text/plain' } });

    const textExtraction1 = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        uploadResult,
        "What is in this document?"
      ]
    });
    console.log("Method 4:", textExtraction1.text);
    
    fs.unlinkSync('dummy.txt');
  } catch(e: any) {
    console.error("ERROR:", e.message);
  }
}
test();
