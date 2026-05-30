import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/config/firebase';

async function cleanup() {
  console.log('Cleaning up materials collection...');
  const materialsSnapshot = await db.collection('materials').get();
  const batch1 = db.batch();
  materialsSnapshot.docs.forEach(doc => {
    batch1.delete(doc.ref);
  });
  await batch1.commit();
  console.log(`Deleted ${materialsSnapshot.size} materials.`);

  console.log('Cleaning up questions collection...');
  const questionsSnapshot = await db.collection('questions').get();
  const batch2 = db.batch();
  questionsSnapshot.docs.forEach(doc => {
    batch2.delete(doc.ref);
  });
  await batch2.commit();
  console.log(`Deleted ${questionsSnapshot.size} questions.`);

  console.log('Cleanup complete!');
  process.exit(0);
}

cleanup().catch(console.error);
