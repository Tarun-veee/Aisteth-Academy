import admin from 'firebase-admin';
import { ENV } from './env.js';

import fs from 'fs';
import path from 'path';

// Automatic credentials fallback for local development if not already specified in environment
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const candidateKeyPaths = [
    'C:\\Users\\I Health Highway\\Downloads\\TARUN PROJECT\\credentials\\aisteth-key.json',
    path.resolve(process.cwd(), '../credentials/aisteth-key.json'),
    path.resolve(process.cwd(), 'credentials/aisteth-key.json'),
    path.resolve(process.cwd(), '../../credentials/aisteth-key.json'),
  ];
  for (const candidate of candidateKeyPaths) {
    if (fs.existsSync(candidate)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = candidate;
      break;
    }
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: ENV.FIREBASE_PROJECT_ID,
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
