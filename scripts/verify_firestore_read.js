/**
 * AiSteth Academy — Safe Read-Only Firestore Connectivity Verification
 * 
 * Invariants:
 * 1. Strict Target Project Guard: Only executes against 'aisteth-academy-dev'
 * 2. Zero Writes: Performs only read operations (get()), zero mutations
 * 3. Secret Protection: Never prints keys, tokens, or credentials
 */

import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('../backend/node_modules/firebase-admin');

const EXPECTED_PROJECT_ID = 'aisteth-academy-dev';
const DEMO_UID = 'Mm1TrJPtd0ZUhPgwjehmndpD8E12'; // powerup_qa_test

console.log('================================================================');
console.log('AiSteth Academy — Safe Read-Only Firestore Connectivity Check');
console.log('================================================================\n');

// 1. Guard Project ID
const projectId = process.env.FIREBASE_PROJECT_ID || EXPECTED_PROJECT_ID;
if (projectId !== EXPECTED_PROJECT_ID) {
  console.error(`[GUARD BLOCKED] Aborting. Target project is '${projectId}', expected '${EXPECTED_PROJECT_ID}'.`);
  process.exit(1);
}
console.log(`✓ Confirmed Target Project ID: ${projectId}`);

// 2. Check Credential Environment
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath) {
  if (fs.existsSync(credPath)) {
    console.log(`✓ GOOGLE_APPLICATION_CREDENTIALS detected and file exists.`);
  } else {
    console.warn(`⚠ GOOGLE_APPLICATION_CREDENTIALS is set to '${credPath}', but the file was not found.`);
  }
} else {
  console.log(`ℹ GOOGLE_APPLICATION_CREDENTIALS not set; checking Application Default Credentials (ADC)...`);
}

// 3. Initialize Firebase Admin (Read-Only Test)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: EXPECTED_PROJECT_ID,
  });
}

const db = admin.firestore();

async function runReadOnlyCheck() {
  try {
    console.log(`\nAttempting read-only document fetch for authorized demo user (/users/${DEMO_UID})...`);
    const docRef = db.doc(`users/${DEMO_UID}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      console.log(`✓ [SUCCESS] Connected to Firestore (${EXPECTED_PROJECT_ID})! Document does not exist yet.`);
    } else {
      const data = snap.data();
      console.log(`✓ [SUCCESS] Connected to Firestore (${EXPECTED_PROJECT_ID})!`);
      console.log(`  - Trainee Username: ${data?.username || 'N/A'}`);
      console.log(`  - Role: ${data?.role || 'N/A'}`);
      console.log(`  - Current Level: ${data?.learningState?.currentLevel ?? 'N/A'}`);
      console.log(`  - Total XP: ${data?.learningState?.totalXp ?? 'N/A'}`);
    }

    console.log('\n✓ READ-ONLY VERIFICATION COMPLETE: Connectivity is healthy. Zero database writes performed.');
    process.exit(0);
  } catch (err) {
    console.error(`\n✗ [CONNECTIVITY FAILED] Firestore read failed:`);
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

runReadOnlyCheck();
