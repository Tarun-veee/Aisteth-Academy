/**
 * AiSteth Academy — Cloud Firestore Content Seeding Script
 * Specification: v2.7.0-SPARK-SPEC
 *
 * Purpose: Ingests the authoritative 20-question clinical questionnaire from AI_limitation.json
 *          into Cloud Firestore (/contentReleases/rel_v1_0_0 and subcollections) and initializes /appConfig/global.
 * Input:   AI_limitation.json (authoritative Module 1 questionnaire)
 * Output:  /contentReleases/rel_v1_0_0, /contentReleases/rel_v1_0_0/questions/{id}, /appConfig/global
 * Usage:   npm run seed:content  (or: node scripts/seed_content.js)
 * Note:    Requires Google Cloud Application Default Credentials (ADC) or service account credentials.
 */

import fs from 'fs';
import path from 'path';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'aisteth-academy-dev';

async function seedContent() {
  console.log(`Starting content seeding for ${projectId}...`);

  let initializeApp, getApps, getFirestore, FieldValue;
  try {
    const appModule = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');
    initializeApp = appModule.initializeApp;
    getApps = appModule.getApps;
    getFirestore = firestoreModule.getFirestore;
    FieldValue = firestoreModule.FieldValue;
  } catch (err) {
    console.error('Content seeding requires firebase-admin to be installed for administrative database writes.');
    console.error('Install via: npm install -D firebase-admin');
    process.exit(1);
  }

  // Initialize Admin SDK with Project ID
  if (getApps().length === 0) {
    initializeApp({ projectId });
  }

  const db = getFirestore();

  // 1. Read AI_limitation.json
  const rawData = fs.readFileSync(path.resolve('AI_limitation.json'), 'utf-8');
  const parsed = JSON.parse(rawData);
  const questions = parsed.questions || [];

  console.log(`Found ${questions.length} questions in AI_limitation.json.`);

  if (questions.length !== 20) {
    throw new Error(`Expected exactly 20 questions, but found ${questions.length}!`);
  }

  // 2. Seed /contentReleases/rel_v1_0_0
  const releaseRef = db.doc('contentReleases/rel_v1_0_0');
  await releaseRef.set({
    releaseId: 'rel_v1_0_0',
    title: 'Module 1: AI Limitation & Clinical Decision Making',
    audience: 'RBSK',
    totalQuestions: 20,
    status: 'PUBLISHED',
    version: '1.0.0',
    createdAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('Successfully seeded /contentReleases/rel_v1_0_0 document.');

  // 3. Seed 20 question documents in subcollection
  const batch = db.batch();
  for (const q of questions) {
    const qRef = releaseRef.collection('questions').doc(q.Question_ID);
    batch.set(qRef, {
      questionId: q.Question_ID,
      Question_ID: q.Question_ID,
      topic: q.Topic,
      Topic: q.Topic,
      questionType: q.Question_Type,
      Question_Type: q.Question_Type,
      difficultyRank: q.Difficulty_Rank,
      Difficulty_Rank: q.Difficulty_Rank,
      followUpFor: q.Follow_Up_For || null,
      Follow_Up_For: q.Follow_Up_For || null,
      audience: q.Audience,
      Audience: q.Audience,
      question: q.Question,
      Question: q.Question,
      option_a: q.Option_A,
      Option_A: q.Option_A,
      option_b: q.Option_B,
      Option_B: q.Option_B,
      option_c: q.Option_C,
      Option_C: q.Option_C,
      option_d: q.Option_D,
      Option_D: q.Option_D,
      correct: q.Correct,
      Correct: q.Correct,
      explanation: q.Explanation,
      Explanation: q.Explanation,
      action: q.Action,
      Action: q.Action,
      medGemmaTag: q.MedGemma_Tag,
      MedGemma_Tag: q.MedGemma_Tag,
      category: 'HEART_RECORDING',
      type: 'MCQ',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  console.log(`Successfully committed batch of ${questions.length} question documents into /contentReleases/rel_v1_0_0/questions.`);

  // 4. Seed /appConfig/global
  const appConfigRef = db.doc('appConfig/global');
  await appConfigRef.set({
    activeContentReleaseId: 'rel_v1_0_0',
    defaultOrganizationId: 'org_rbsk_national',
    minimumSupportedAppVersion: '1.0.0',
    maintenanceMode: false,
    sessionConfig: {
      questionCount: 10,
      selectionPolicy: 'CONTENT_DRIVEN_BALANCED',
      xpRewards: {
        MCQ: 5,
        TRUE_FALSE: 5,
        PRACTICAL: 10,
        COMPLETION_BONUS: 10,
      }
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'seed_script',
  }, { merge: true });
  console.log('Successfully seeded /appConfig/global document.');

  console.log('Content seeding completed successfully!');
}

seedContent().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
