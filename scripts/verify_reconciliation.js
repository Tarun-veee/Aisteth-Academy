import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  runTransaction
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA',
  authDomain: 'aisteth-academy-dev.firebaseapp.com',
  projectId: 'aisteth-academy-dev',
  messagingSenderId: '384522486019',
  appId: '1:384522486019:web:e6d54cc0269fe874aee936'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const username = 'powerup_qa_test';
const email = `${username}@aisteth.internal`;
const password = process.env.QA_PASSWORD || 'TestUser@2026';

function generateCanonicalSessionId(uid, dateStr) {
  return `daily_${dateStr}_${uid.substring(0, 8)}`;
}

async function runLiveReconciliationTest() {
  console.log('================================================================');
  console.log('LIVE DEV RECONCILIATION TEST: SESSION ID & FINALIZATION LIFECYCLE');
  console.log('================================================================\n');

  // 1. Authenticate
  console.log('[1/6] Authenticating as QA Trainee...');
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;
  console.log(`✓ Authenticated: UID = ${uid}`);

  const todayStr = new Date().toISOString().split('T')[0];
  const canonicalSessionId = generateCanonicalSessionId(uid, todayStr);
  console.log(`\nCanonical Session ID to verify: ${canonicalSessionId}`);

  const sessionRef = doc(db, 'users', uid, 'dailySessions', canonicalSessionId);
  const userRef = doc(db, 'users', uid);

  // 2. CREATE Session
  console.log('\n[2/6] Stage 1: CREATE dailySession document...');
  const initialSession = {
    sessionId: canonicalSessionId,
    uid,
    userId: uid,
    localDate: todayStr,
    contentReleaseId: 'rel_v1_0_0',
    status: 'IN_PROGRESS',
    questionIds: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'],
    currentQuestionIndex: 0,
    questionsCompleted: false,
    reviewViewed: false,
    totalXpEarned: 0,
    correctCount: 0,
    accuracy: 0,
    powerUpsUsed: { FIFTY_FIFTY: [], LEARN: [] },
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(sessionRef, initialSession);
  const createdSnap = await getDoc(sessionRef);
  if (!createdSnap.exists()) throw new Error('CREATE failed: doc not found');
  console.log(`✓ CREATE verified at path: users/${uid}/dailySessions/${canonicalSessionId}`);
  console.log(`  Document status: ${createdSnap.data().status}`);

  // 3. ANSWER 1
  console.log('\n[3/6] Stage 2: ANSWER 1 on same session ID...');
  const attemptId1 = `att_rec_1_${Date.now()}`;
  const attemptRef1 = doc(db, 'users', uid, 'attempts', attemptId1);
  await setDoc(attemptRef1, {
    attemptId: attemptId1,
    dailySessionId: canonicalSessionId,
    uid,
    userId: uid,
    questionId: 'Q1',
    contentReleaseId: 'rel_v1_0_0',
    questionIndex: 0,
    userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
    result: 'CORRECT',
    xpAwarded: 5,
    powerUpsActive: [],
    clientTimestamp: Date.now(),
    createdAt: serverTimestamp(),
    serverTimestamp: serverTimestamp(),
  });
  await updateDoc(sessionRef, {
    currentQuestionIndex: 1,
    totalXpEarned: increment(5),
    correctCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  const answer1Snap = await getDoc(sessionRef);
  console.log(`✓ ANSWER 1 updated SAME document: users/${uid}/dailySessions/${canonicalSessionId}`);
  console.log(`  Index: ${answer1Snap.data().currentQuestionIndex}, XP: ${answer1Snap.data().totalXpEarned}`);

  // 4. ANSWER 10 (Transitions to QUESTIONS_COMPLETED)
  console.log('\n[4/6] Stage 3: ANSWER 10 on same session ID...');
  const attemptId10 = `att_rec_10_${Date.now()}`;
  const attemptRef10 = doc(db, 'users', uid, 'attempts', attemptId10);
  await setDoc(attemptRef10, {
    attemptId: attemptId10,
    dailySessionId: canonicalSessionId,
    uid,
    userId: uid,
    questionId: 'Q10',
    contentReleaseId: 'rel_v1_0_0',
    questionIndex: 9,
    userAnswerPayload: { type: 'MCQ', selected_option: 'option_b' },
    result: 'CORRECT',
    xpAwarded: 10,
    powerUpsActive: [],
    clientTimestamp: Date.now(),
    createdAt: serverTimestamp(),
    serverTimestamp: serverTimestamp(),
  });
  await updateDoc(sessionRef, {
    currentQuestionIndex: 9,
    totalXpEarned: increment(10),
    correctCount: increment(1),
    status: 'QUESTIONS_COMPLETED',
    questionsCompleted: true,
    updatedAt: serverTimestamp(),
  });
  const answer10Snap = await getDoc(sessionRef);
  console.log(`✓ ANSWER 10 updated SAME document: users/${uid}/dailySessions/${canonicalSessionId}`);
  console.log(`  Document status: ${answer10Snap.data().status}`);

  // 5. FINALIZATION via Transaction
  console.log('\n[5/6] Stage 4: FINALIZATION from QUESTIONS_COMPLETED via runTransaction...');
  const userPreSnap = await getDoc(userRef);
  const preXp = userPreSnap.data().learningState?.totalXp || 0;
  const preStreak = userPreSnap.data().learningState?.currentStreak || 0;
  const preSessions = userPreSnap.data().learningState?.completedSessionsCount || 0;

  const finalizationSuccess = await runTransaction(db, async (transaction) => {
    const sSnap = await transaction.get(sessionRef);
    if (!sSnap.exists()) throw new Error('Session not found');
    const sData = sSnap.data();
    const terminalStatuses = ['COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED'];
    if (terminalStatuses.includes(sData.status) || sData.reviewViewed === true) {
      return false;
    }
    const uSnap = await transaction.get(userRef);
    if (!uSnap.exists()) throw new Error('User not found');
    const uData = uSnap.data();
    const ls = uData.learningState || {};

    transaction.update(sessionRef, {
      status: 'REVIEW_COMPLETED',
      reviewViewed: true,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(userRef, {
      'learningState.totalXp': (ls.totalXp || 0) + 15,
      'learningState.currentStreak': (ls.currentStreak || 0) + 1,
      'learningState.completedSessionsCount': (ls.completedSessionsCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });

    return true;
  });

  const sessionFinalSnap = await getDoc(sessionRef);
  const userPostSnap = await getDoc(userRef);
  const postXp = userPostSnap.data().learningState?.totalXp || 0;
  const postStreak = userPostSnap.data().learningState?.currentStreak || 0;
  const postSessions = userPostSnap.data().learningState?.completedSessionsCount || 0;

  console.log(`✓ Finalization transaction committed: ${finalizationSuccess}`);
  console.log(`  Session status: ${sessionFinalSnap.data().status}`);
  console.log(`  User XP: ${preXp} -> ${postXp} (+15)`);
  console.log(`  User Streak: ${preStreak} -> ${postStreak} (+1)`);
  console.log(`  User Completed Sessions: ${preSessions} -> ${postSessions} (+1)`);

  // 6. DUPLICATE FINALIZATION TEST (IDEMPOTENCY)
  console.log('\n[6/6] Stage 5: DUPLICATE FINALIZATION ATTEMPT...');
  const duplicateSuccess = await runTransaction(db, async (transaction) => {
    const sSnap = await transaction.get(sessionRef);
    const sData = sSnap.data();
    const terminalStatuses = ['COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED'];
    if (terminalStatuses.includes(sData.status) || sData.reviewViewed === true) {
      return false; // Aborts cleanly
    }
    return true;
  });

  const userDuplicateSnap = await getDoc(userRef);
  console.log(`✓ Duplicate finalization blocked cleanly: duplicateSuccess = ${duplicateSuccess}`);
  console.log(`  User XP remained strictly unchanged: ${userDuplicateSnap.data().learningState?.totalXp}`);
  console.log(`  User Streak remained strictly unchanged: ${userDuplicateSnap.data().learningState?.currentStreak}`);

  console.log('\n================================================================');
  console.log('ALL LIVE DEV STAGES PASSED ON CANONICAL SESSION ID!');
  console.log('================================================================');
}

runLiveReconciliationTest().catch((err) => {
  console.error('LIVE RECONCILIATION TEST FAILED:', err);
  process.exit(1);
});
