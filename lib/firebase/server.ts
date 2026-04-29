import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(), // This uses GCP metadata / GOOGLE_APPLICATION_CREDENTIALS
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'talent-482612' // fallback to the provisioned project
    });
  } catch (error) {
    console.error('Firebase Admin init error', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
