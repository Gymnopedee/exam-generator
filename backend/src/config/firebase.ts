import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Requires GOOGLE_APPLICATION_CREDENTIALS or process.env variables)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // This will try to use the environment variable
    // Or you can pass service account directly if configured in env
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
