import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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

// ── Initialize once ───────────────────────────────────────────────────────────

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID');
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: getCredential(), projectId });
}

// ── Firestore with named database support ─────────────────────────────────────
// CRITICAL: settings() must only be called once, before any Firestore operation.
// We use a module-level flag to guarantee this even across Next.js hot reloads.

const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

function getFirestore(): FirebaseFirestore.Firestore {
  const db = admin.firestore();

  // Only call settings() if using a named database AND it hasn't been called yet
  if (databaseId && databaseId !== '(default)') {
    try {
      db.settings({ databaseId });
    } catch {
      // settings() already called — safe to ignore on hot reload
    }
  }

  return db;
}

export const adminDb   = getFirestore();
export const adminAuth = admin.auth();