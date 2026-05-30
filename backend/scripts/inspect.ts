import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/config/firebase';

async function inspect() {
  console.log('=== QUESTIONS ===');
  const qSnapshot = await db.collection('questions').get();
  console.log(`Total questions: ${qSnapshot.size}`);
  qSnapshot.docs.slice(0, 3).forEach(doc => {
    const data = doc.data();
    console.log(`  id: ${data.id}, subject: "${data.subject}", question: "${data.question?.slice(0, 40)}..."`);
  });

  console.log('\n=== SUBJECTS ===');
  const sSnapshot = await db.collection('subjects').get();
  sSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  id: "${data.id}", name: "${data.name}"`);
  });

  console.log('\n=== MATERIALS ===');
  const mSnapshot = await db.collection('materials').get();
  mSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  id: "${data.id}", subject: "${data.subject}", filename: "${data.filename}"`);
  });

  process.exit(0);
}

inspect().catch(console.error);
