import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

let initialized = false;

function getCredential(): admin.credential.Credential {
  // Method 1: Base64-encoded JSON
  if (process.env.FIREBASE_ADMIN_SDK_BASE64) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_ADMIN_SDK_BASE64, 'base64'
      ).toString('utf-8');
      return admin.credential.cert(JSON.parse(decoded));
    } catch {
      throw new Error('FIREBASE_ADMIN_SDK_BASE64 could not be decoded');
    }
  }

  // Method 2: service-account-key.json in project root
  const keyFilePath = path.resolve(process.cwd(), 'service-account-key.json');
  if (fs.existsSync(keyFilePath)) {
    try {
      const raw = fs.readFileSync(keyFilePath, 'utf-8');
      console.log('Firebase Admin: using service-account-key.json');
      return admin.credential.cert(JSON.parse(raw));
    } catch (err: any) {
      throw new Error(`Failed to parse service-account-key.json: ${err.message}`);
    }
  }

  // Method 3: Application Default Credentials (Cloud Run)
  console.log('Firebase Admin: using application default credentials');
  return admin.credential.applicationDefault();
}

function initializeAdmin() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Don't throw at build time — only warn
  if (!projectId) {
    console.warn('Firebase Admin: no project ID found — skipping initialization');
    return;
  }

  try {
    admin.initializeApp({ credential: getCredential(), projectId });
    initialized = true;
    console.log(`Firebase Admin: initialized for project ${projectId}`);
  } catch (error: any) {
    throw new Error(`Firebase Admin init failed: ${error.message}`);
  }
}

function getAdminDb(): FirebaseFirestore.Firestore {
  initializeAdmin();
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
  const db = admin.firestore();
  if (databaseId && databaseId !== '(default)') {
    try {
      db.settings({ databaseId });
    } catch {
      // Already set — ignore
    }
  }
  return db;
}

function getAdminAuth(): admin.auth.Auth {
  initializeAdmin();
  return admin.auth();
}

export const adminDb = new Proxy({} as FirebaseFirestore.Firestore, {
  get(_, prop) {
    return (getAdminDb() as any)[prop];
  },
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    return (getAdminAuth() as any)[prop];
  },
});