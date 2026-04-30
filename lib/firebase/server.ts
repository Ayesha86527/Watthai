import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

let initialized = false;

function getCredential(): admin.credential.Credential {
  // Method 1: Base64-encoded JSON (most reliable across all platforms)
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

  // Method 2: Key file on disk (best for local dev on Windows)
  // Looks for service-account-key.json in project root
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

  // Method 3: Application Default Credentials (Cloud Run — no config needed)
  console.log('Firebase Admin: using application default credentials');
  return admin.credential.applicationDefault();
}

function initializeAdmin() {
  if (initialized || admin.apps.length > 0) return;

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  }

  try {
    admin.initializeApp({ credential: getCredential(), projectId });
    initialized = true;
    console.log(`Firebase Admin: initialized for project ${projectId}`);
  } catch (error: any) {
    throw new Error(`Firebase Admin init failed: ${error.message}`);
  }
}

initializeAdmin();

// Named Firestore database support
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

const _db = admin.firestore();
if (databaseId && databaseId !== '(default)') {
  _db.settings({ databaseId });
}

export const adminDb = _db;
export const adminAuth = admin.auth();