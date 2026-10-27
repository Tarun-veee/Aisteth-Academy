import admin from 'firebase-admin';
import {
  ISessionRepository,
  FinalizeSessionParams,
  FinalizeSessionResult,
  RecordAttemptAtomicParams,
  RecordAttemptAtomicResult,
  UpdateUnsolvedQuestionParams,
} from '../../domain/interfaces/ISessionRepository.js';
import {
  DailySessionDoc,
  AttemptDoc,
  BranchState,
  SubmissionReceiptDoc,
  ParsedIdempotencyKey,
  DailySessionStatus,
  UnsolvedQuestionDoc,
} from '../../domain/models/session.model.js';
import {
  validateIdempotencyKeyBoundary,
  computeCanonicalPayloadFingerprint,
  computeCanonicalPayloadFingerprintV2,
  verifySubmissionReceiptFingerprint,
  validateAuthoritativeSessionState,
  validateStoredReceiptIntegrity,
  validateAuthoritativeUserDoc,
  buildConcludingSessionTransition,
  reconcileSessionProgressFromLedger,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../../domain/rules/sessionValidation.js';
import { defaultQuestionRepository } from './FirestoreQuestionRepository.js';
import { adminDb } from '../config/firebaseAdmin.js';
import { ProgressionService } from '../../domain/rules/ProgressionService.js';
import {
  CANONICAL_31_TOPIC_SEQUENCE,
  normalizeToCanonicalTopic,
  getResolvedCalendarDate,
  getElapsedDailyCycles,
} from '../../domain/rules/sessionSelection.js';

export class FirestoreSessionRepository implements ISessionRepository {
  async getUser(uid: string): Promise<any | null> {
    const snap = await adminDb.doc(`users/${uid}`).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data();
  }

  async updateUser(uid: string, updates: Record<string, any>): Promise<void> {
    await adminDb.doc(`users/${uid}`).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async getActiveDailySession(uid: string, targetCycleDate: string = getResolvedCalendarDate()): Promise<DailySessionDoc | null> {
    const userDoc = await this.getUser(uid);

    // 1. Check if user profile has an activeSessionId pointer for the target cycle
    if (userDoc?.activeSessionId) {
      const activeSession = await this.getDailySession(uid, userDoc.activeSessionId);
      if (
        activeSession &&
        activeSession.status === 'IN_PROGRESS' &&
        !activeSession.questionsCompleted &&
        activeSession.localDate === targetCycleDate
      ) {
        return activeSession;
      }
    }

    // 2. Query users/{uid}/dailySessions for active IN_PROGRESS session matching targetCycleDate
    try {
      const snap = await adminDb
        .collection(`users/${uid}/dailySessions`)
        .where('status', '==', 'IN_PROGRESS')
        .where('localDate', '==', targetCycleDate)
        .get();

      if (!snap.empty) {
        const validSessions = snap.docs
          .map((d) => d.data() as DailySessionDoc)
          .filter((s) => !s.questionsCompleted && s.localDate === targetCycleDate);

        if (validSessions.length > 0) {
          validSessions.sort((a, b) => (b.localDate || '').localeCompare(a.localDate || ''));
          return validSessions[0];
        }
      }
    } catch (e) {
      // Ignore query errors in offline/mock test environments
    }

    return null;
  }

  async getDailySession(uid: string, sessionId: string): Promise<DailySessionDoc | null> {
    const snap = await adminDb.doc(`users/${uid}/dailySessions/${sessionId}`).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as DailySessionDoc;
  }

  async createDailySession(session: DailySessionDoc): Promise<void> {
    const sessionRef = adminDb.doc(`users/${session.uid}/dailySessions/${session.sessionId}`);
    await sessionRef.set({
      ...session,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async createDailySessionIfNotExists(session: DailySessionDoc): Promise<{ session: DailySessionDoc; created: boolean }> {
    const sessionRef = adminDb.doc(`users/${session.uid}/dailySessions/${session.sessionId}`);
    const userRef = adminDb.doc(`users/${session.uid}`);

    if (typeof adminDb.runTransaction === 'function') {
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(sessionRef);
        if (snap && snap.exists) {
          return { session: snap.data() as DailySessionDoc, created: false };
        }

        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(sessionRef, {
          ...session,
          startedAt: serverTimestamp,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        });

        transaction.update(userRef, {
          activeSessionId: session.sessionId,
          activeSessionTopics: session.selectedTopics || [],
          updatedAt: serverTimestamp,
        });

        return { session, created: true };
      });
    }

    // Fallback for non-transactional mock environments
    const snap = await sessionRef.get();
    if (snap && snap.exists) {
      return { session: snap.data() as DailySessionDoc, created: false };
    }
    await this.createDailySession(session);
    await this.updateUser(session.uid, {
      activeSessionId: session.sessionId,
      activeSessionTopics: session.selectedTopics || [],
    });
    return { session, created: true };
  }

  async appendAttempt(attempt: AttemptDoc): Promise<void> {
    const attemptRef = adminDb.doc(`users/${attempt.uid}/attempts/${attempt.attemptId}`);
    await attemptRef.set({
      ...attempt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async updateSessionProgress(uid: string, sessionId: string, updates: Record<string, any>): Promise<void> {
    const sessionRef = adminDb.doc(`users/${uid}/dailySessions/${sessionId}`);
    const dataToUpdate: Record<string, any> = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (updates.xpAwarded) {
      dataToUpdate.totalXpEarned = admin.firestore.FieldValue.increment(updates.xpAwarded);
      delete dataToUpdate.xpAwarded;
    }

    if (updates.isCorrect) {
      dataToUpdate.correctCount = admin.firestore.FieldValue.increment(1);
      delete dataToUpdate.isCorrect;
    }


    await sessionRef.update(dataToUpdate);
  }

  async recordAttemptAtomic(params: RecordAttemptAtomicParams): Promise<RecordAttemptAtomicResult> {
    const {
      uid,
      sessionId,
      questionId,
      questionIndex,
      userAnswerPayload,
      evaluation,
      idempotencyKey,
      selectedOption,
    } = params;

    let parsedKey: ParsedIdempotencyKey | null = null;
    if (idempotencyKey) {
      parsedKey = validateIdempotencyKeyBoundary(idempotencyKey, sessionId);
    }
    const receiptRef = idempotencyKey
      ? adminDb.doc(`users/${uid}/dailySessions/${sessionId}/submissions/${idempotencyKey}`)
      : null;
    const sessionRef = adminDb.doc(`users/${uid}/dailySessions/${sessionId}`);
    const userRef = adminDb.doc(`users/${uid}`);

    return adminDb.runTransaction(async (transaction) => {
      // =========================================================================
      // PHASE 1: ALL TRANSACTION READS (Strictly Before Any Writes)
      // =========================================================================

      // 1.1 Receipt-First Lookup (when idempotencyKey is supplied)
      if (receiptRef && idempotencyKey) {
        const receiptSnap = await transaction.get(receiptRef);
        if (receiptSnap.exists) {
          const receipt = validateStoredReceiptIntegrity(
            receiptSnap.data(),
            uid,
            sessionId,
            idempotencyKey
          );

          // Scenario 3 & Scenario 5: Read and validate referenced attempt record
          const refAttemptRef = adminDb.doc(`users/${uid}/attempts/${receipt.attemptId}`);
          const refAttemptSnap = await transaction.get(refAttemptRef);
          if (!refAttemptSnap.exists) {
            throw new ConflictError(
              `RECEIPT_ATTEMPT_LINEAGE_BROKEN: Authoritative attempt record '${receipt.attemptId}' referenced by receipt was not found.`
            );
          }
          const storedAttempt = refAttemptSnap.data() as AttemptDoc;

          // Verify attempt belongs to user, session, question, index, branch
          if (
            storedAttempt.uid !== uid ||
            storedAttempt.dailySessionId !== sessionId ||
            storedAttempt.questionIndex !== receipt.questionIndex ||
            storedAttempt.questionId !== receipt.questionId
          ) {
            throw new ConflictError(
              `RECEIPT_ATTEMPT_LINEAGE_BROKEN: Attempt '${receipt.attemptId}' attributes do not match stored receipt context.`
            );
          }

          // Two-tier fingerprint verification (handles Scenario 2, Scenario 5, Scenario 6)
          verifySubmissionReceiptFingerprint(
            receipt,
            userAnswerPayload,
            selectedOption,
            storedAttempt
          );

          // Return exact historical result without any writes or session queries
          return {
            attemptId: receipt.attemptId,
            currentQuestionIndex: receipt.currentQuestionIndex,
            isSessionComplete: receipt.isSessionComplete,
            totalXpEarned: receipt.totalXpEarnedInSession,
            correctCount: receipt.correctCount,
            result: receipt.result,
            xpAwarded: receipt.xpAwarded,
            branchState: receipt.branchState,
            status: receipt.sessionStatus,
            questionsCompleted: receipt.questionsCompleted,
            activeFollowUpQuestionId: (receipt as any).activeFollowUpQuestionId || null,
          };
        }
      }

      // 1.2 Read Daily Session
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new NotFoundError(`Daily session ${sessionId} not found.`);
      }

      const sessionData = sessionSnap.data() as DailySessionDoc;

      // Terminal Session Protection (Reject new submissions if completed)
      const terminalStatuses = ['COMPLETED', 'QUESTIONS_COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED'];
      if (
        sessionData.questionsCompleted === true ||
        sessionData.status === 'QUESTIONS_COMPLETED' ||
        terminalStatuses.includes(sessionData.status)
      ) {
        throw new ConflictError('Daily session is already completed.');
      }

      // Active-step validation against authoritative session state
      if (parsedKey) {
        if (parsedKey.questionIndex !== (sessionData.currentQuestionIndex ?? 0)) {
          throw new ConflictError(
            `Question index mismatch: expected question index ${sessionData.currentQuestionIndex ?? 0}, but received ${parsedKey.questionIndex}.`
          );
        }
        const currentBranch = sessionData.branchState || 'MAIN';
        if (parsedKey.branchState !== currentBranch) {
          throw new ConflictError(
            `SESSION_BRANCH_STATE_MISMATCH: expected branch '${currentBranch}', but received '${parsedKey.branchState}'.`
          );
        }
      } else {
        const currentIndex = sessionData.currentQuestionIndex ?? 0;
        if (questionIndex !== currentIndex) {
          throw new ConflictError(
            `Question index mismatch: expected question index ${currentIndex}, but received ${questionIndex}.`
          );
        }
      }

      const branchState: BranchState = sessionData.branchState || 'MAIN';
      const currentIndex = sessionData.currentQuestionIndex ?? 0;

      // Auto-heal legacy odd-day session where questionIds erroneously contained -PR instead of -TH
      if (Array.isArray(sessionData.questionIds)) {
        sessionData.questionIds = sessionData.questionIds.map((id: string) => {
          if (id === sessionData.activeFollowUpQuestionId) return id;
          return id.replace(/-PR$/, '-TH');
        });
        if (branchState === 'FOLLOW_UP' && sessionData.activeFollowUpQuestionId) {
          sessionData.questionIds[currentIndex] = sessionData.activeFollowUpQuestionId;
        }
      }
      let effectiveQId = questionId;
      if (branchState === 'MAIN' && effectiveQId && effectiveQId.endsWith('-PR')) {
        effectiveQId = effectiveQId.replace(/-PR$/, '-TH');
      }

      const activePrimaryId = (branchState === 'FOLLOW_UP' || branchState === 'REATTEMPT_MAIN')
        ? (sessionData.activeMainQuestionId || ((sessionData.questionIds && sessionData.questionIds[currentIndex - 1]) || effectiveQId))
        : ((sessionData.questionIds && sessionData.questionIds[currentIndex]) || effectiveQId);
      const unsolvedRef = adminDb.doc(`users/${uid}/unsolvedQuestions/${activePrimaryId}`);

      // 1.3 Read userRef and unsolvedRef upfront (Strict Phase 1 read-before-write constraint)
      const userSnap = await transaction.get(userRef);
      const unsolvedSnap = await transaction.get(unsolvedRef);

      // =========================================================================
      // PHASE 2: IN-MEMORY VALIDATION & EVALUATION
      // =========================================================================

      // Authoritative session & lineage validation
      await validateAuthoritativeSessionState(sessionData, branchState, (id) =>
        defaultQuestionRepository.getQuestionById(id)
      );

      // Question sequencing validation
      if (Array.isArray(sessionData.questionIds) && sessionData.questionIds.length > 0) {
        const expectedQuestion = sessionData.questionIds[currentIndex];
        if (branchState === 'MAIN' && expectedQuestion && effectiveQId !== expectedQuestion) {
          throw new ConflictError(
            `Question sequence mismatch: expected question ${expectedQuestion} at index ${currentIndex}, but received ${effectiveQId}.`
          );
        }
        if (
          branchState === 'FOLLOW_UP' &&
          expectedQuestion &&
          effectiveQId !== expectedQuestion &&
          effectiveQId !== sessionData.activeFollowUpQuestionId
        ) {
          throw new ConflictError(
            `Question sequence mismatch: expected follow-up question ${sessionData.activeFollowUpQuestionId || expectedQuestion} at index ${currentIndex}, but received ${effectiveQId}.`
          );
        }
      }

      // Determine active question and correctness
      let activeQuestionId = activePrimaryId;
      if (branchState === 'FOLLOW_UP') {
        activeQuestionId = sessionData.activeFollowUpQuestionId || questionId;
      } else if (branchState === 'REATTEMPT_MAIN') {
        activeQuestionId = sessionData.activeMainQuestionId || activePrimaryId;
      }

      const isCorrect = Boolean(evaluation.is_correct);

      // User document validation and Primary completion eligibility
      let isEligiblePrimaryCompletion = false;
      let xpAwarded = 0;
      let validatedUserDoc: any = null;

      if (userSnap) {
        if (!userSnap.exists) {
          if (idempotencyKey) {
            throw new NotFoundError(`USER_NOT_FOUND: User profile ${uid} not found.`);
          } else {
            validatedUserDoc = {
              totalXp: 0,
              completedQuestionsCount: 0,
              lifetimeCompletedQuestionIds: [],
            };
            xpAwarded = evaluation.awarded_xp || 0;
          }
        } else {
          validatedUserDoc = validateAuthoritativeUserDoc(userSnap.data(), uid);

          const completionQuestionId = (branchState === 'MAIN' || branchState === 'REATTEMPT_MAIN')
            ? activePrimaryId
            : null;
          const isAlreadyInLedger = completionQuestionId !== null &&
            validatedUserDoc.lifetimeCompletedQuestionIds.includes(completionQuestionId);

          isEligiblePrimaryCompletion = (branchState === 'MAIN' || branchState === 'REATTEMPT_MAIN') &&
            isCorrect &&
            !isAlreadyInLedger;

          if (isEligiblePrimaryCompletion) {
            // Pre-award XP < 310 receives 10 XP; >= 310 receives 0 XP
            xpAwarded = validatedUserDoc.totalXp < 310 ? 10 : 0;
          } else {
            xpAwarded = 0;
          }
        }
      } else {
        xpAwarded = evaluation.awarded_xp || 0;
      }


      // Session progression metrics (Invariant B: correctCount tracks mastered Primaries)
      const totalQuestions = sessionData.questionIds?.length || 10;
      const oldXp = typeof sessionData.totalXpEarned === 'number' ? sessionData.totalXpEarned : 0;
      const oldCorrect = typeof sessionData.correctCount === 'number' ? sessionData.correctCount : 0;
      const newXp = oldXp + xpAwarded;

      const isPrimaryMastered = (branchState === 'MAIN' || branchState === 'REATTEMPT_MAIN') && isCorrect;
      const newCorrect = oldCorrect + (isPrimaryMastered ? 1 : 0);

      const isConcludingBranch =
        (branchState === 'MAIN' && isCorrect) ||
        (branchState === 'FOLLOW_UP') ||
        (branchState === 'REATTEMPT_MAIN');

      const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
      let sessionUpdates: Record<string, any>;
      let isSessionComplete = false;
      let targetQuestionIndex = currentIndex;
      let sessionStatus: DailySessionStatus = 'IN_PROGRESS';
      let questionsCompleted = false;

      if (isConcludingBranch) {
        const concludingState = buildConcludingSessionTransition(sessionData, serverTimestamp);
        sessionUpdates = {
          ...concludingState.sessionUpdates,
          totalXpEarned: newXp,
          correctCount: newCorrect,
        };
        isSessionComplete = concludingState.isSessionComplete;
        sessionStatus = concludingState.sessionStatus;
        questionsCompleted = concludingState.questionsCompleted;
        targetQuestionIndex = concludingState.finalQuestionIndex;
      } else if (branchState === 'MAIN' && !isCorrect) {
        // Remedial transition: branch to FOLLOW_UP
        const totalSessionSlots = sessionData.questionIds?.length || 10;
        const isFinalSlot = currentIndex >= totalSessionSlots - 1;

        if (isFinalSlot) {
          // Final sequence slot: cannot allocate an 11th slot for Follow-Up
          const concludingState = buildConcludingSessionTransition(sessionData, serverTimestamp);
          sessionUpdates = {
            ...concludingState.sessionUpdates,
            totalXpEarned: newXp,
            correctCount: newCorrect,
          };
          isSessionComplete = concludingState.isSessionComplete;
          sessionStatus = concludingState.sessionStatus;
          questionsCompleted = concludingState.questionsCompleted;
          targetQuestionIndex = concludingState.finalQuestionIndex;
        } else {
          // Assign Follow-Up to the next sequence position and keep total slots capped at 10
          const linkedFu = await defaultQuestionRepository.getFollowUpQuestion(activePrimaryId);
          const fuId = linkedFu?.question_id || `${activePrimaryId.replace('-TH', '')}-PR`;
          const nextIndex = currentIndex + 1;
          const currentQIds = Array.isArray(sessionData.questionIds) ? [...sessionData.questionIds] : [];
          const updatedQIds = [
            ...currentQIds.slice(0, nextIndex),
            fuId,
            ...currentQIds.slice(nextIndex),
          ].slice(0, 10);

          sessionUpdates = {
            status: 'IN_PROGRESS',
            questionsCompleted: false,
            branchState: 'FOLLOW_UP',
            activeMainQuestionId: activePrimaryId,
            activeFollowUpQuestionId: fuId,
            currentQuestionIndex: nextIndex,
            questionIds: updatedQIds,
            totalXpEarned: newXp,
            correctCount: newCorrect,
            updatedAt: serverTimestamp,
          };
          targetQuestionIndex = nextIndex;
        }
      } else {
        throw new ConflictError(`INVALID_SESSION_TRANSITION: Cannot transition from branch '${branchState}'.`);
      }

      sessionUpdates['questionIds'] = sessionUpdates['questionIds'] || sessionData.questionIds;


      // Topic queue rotation on concluding branch
      let shouldRotateTopic = false;
      let newTopicQueue: string[] | null = null;
      const alreadyRotatedIndices: number[] = Array.isArray(sessionData.rotatedQuestionIndices)
        ? sessionData.rotatedQuestionIndices
        : [];

      if (isConcludingBranch && !alreadyRotatedIndices.includes(currentIndex)) {
        shouldRotateTopic = true;
        const currentPrimaryQuestion = await defaultQuestionRepository.getQuestionById(activePrimaryId);
        const rawTopic = currentPrimaryQuestion?.topic || (currentPrimaryQuestion as any)?.Topic || '';
        const canonicalTopic = normalizeToCanonicalTopic(rawTopic);

        if (canonicalTopic) {
          const userData = userSnap.exists ? userSnap.data() : null;
          const userQueue: string[] = (Array.isArray(userData?.topicQueue) && userData.topicQueue.length > 0)
            ? userData.topicQueue
            : [...CANONICAL_31_TOPIC_SEQUENCE];

          // Rotate canonicalTopic to the tail of userQueue
          const filtered = userQueue.filter((t) => normalizeToCanonicalTopic(t) !== canonicalTopic);
          filtered.push(canonicalTopic);
          newTopicQueue = filtered;
        }
      }

      // =========================================================================
      // PHASE 3: ALL TRANSACTION WRITES (Atomic Commit or Rollback)
      // =========================================================================

      const attemptId = `att_${sessionId}_q${currentIndex}_${branchState}`;
      const attemptRef = adminDb.doc(`users/${uid}/attempts/${attemptId}`);
      const payloadFingerprint = computeCanonicalPayloadFingerprint(
        selectedOption ?? userAnswerPayload.selectedOption ?? userAnswerPayload
      );

      // 3.1 Write Attempt Document
      const attemptDoc: AttemptDoc = {
        attemptId,
        dailySessionId: sessionId,
        uid,
        userId: uid,
        questionId: activeQuestionId,
        contentReleaseId: sessionData.contentReleaseId || 'rel_v1_0_0',
        questionIndex: currentIndex,
        userAnswerPayload,
        result: isCorrect ? 'CORRECT' : 'INCORRECT',
        xpAwarded,
        clientTimestamp: Date.now(),
        createdAt: serverTimestamp,
        serverTimestamp,
      };
      transaction.set(attemptRef, attemptDoc);

      // 3.3 Update Session Document
      if (shouldRotateTopic) {
        sessionUpdates['rotatedQuestionIndices'] = admin.firestore.FieldValue.arrayUnion(currentIndex);
      }
      transaction.update(sessionRef, sessionUpdates);

      // 3.4 Conditionally Update User Document (Invariant A & Topic Queue)
      const userUpdates: Record<string, any> = {};
      if (isEligiblePrimaryCompletion && validatedUserDoc && userSnap && userSnap.exists) {
        const prevCompletions = validatedUserDoc.lifetimeCompletedQuestionIds?.length || 0;
        userUpdates['lifetimeCompletedQuestionIds'] = admin.firestore.FieldValue.arrayUnion(activePrimaryId);
        userUpdates['completedQuestionsCount'] = admin.firestore.FieldValue.increment(1);
        userUpdates['totalXp'] = admin.firestore.FieldValue.increment(xpAwarded);
        userUpdates['learningState.totalXp'] = admin.firestore.FieldValue.increment(xpAwarded);
        userUpdates['learningState.completedQuestionsCount'] = admin.firestore.FieldValue.increment(1);
      }
      if (newTopicQueue) {
        userUpdates['topicQueue'] = newTopicQueue;
      }
      if (isSessionComplete) {
        userUpdates['activeSessionId'] = null;
      }
      if (Object.keys(userUpdates).length > 0 && userSnap && userSnap.exists) {
        userUpdates['updatedAt'] = serverTimestamp;
        transaction.update(userRef, userUpdates);
      }

      // 3.5 Conditionally Upsert Unsolved Question Record (Invariant D)
      const isRemedialFailure =
        (branchState === 'FOLLOW_UP' && !isCorrect) ||
        (branchState === 'REATTEMPT_MAIN' && !isCorrect);

      if (isRemedialFailure && unsolvedSnap) {
        const reason = branchState === 'FOLLOW_UP' ? 'FOLLOW_UP_FAILED' : 'REATTEMPT_FAILED';
        const canonicalFollowUp = await defaultQuestionRepository.getFollowUpQuestion(activePrimaryId);
        const canonicalFollowUpId = canonicalFollowUp?.question_id || sessionData.activeFollowUpQuestionId;

        if (!canonicalFollowUpId) {
          throw new ConflictError(`CANONICAL_LINEAGE_CORRUPTED: Primary '${activePrimaryId}' has no authoritative follow-up.`);
        }

        if (!unsolvedSnap.exists) {
          transaction.set(unsolvedRef, {
            id: activePrimaryId,
            mainQuestionId: activePrimaryId,
            followUpQuestionId: canonicalFollowUpId,
            topic: canonicalFollowUp?.topic || '',
            difficultyRank: canonicalFollowUp?.difficulty_rank ?? 1,
            failCount: 1,
            initialReason: reason,
            lastFailedReason: reason,
            firstFailedSessionId: sessionId,
            lastFailedSessionId: sessionId,
            isResolved: false,
            reviewStatus: 'UNREVIEWED',
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
            firstFailedAt: serverTimestamp,
            lastFailedAt: serverTimestamp,
          });
        } else {
          transaction.update(unsolvedRef, {
            failCount: admin.firestore.FieldValue.increment(1),
            lastFailedReason: reason,
            lastFailedSessionId: sessionId,
            followUpQuestionId: canonicalFollowUpId,
            isResolved: false,
            lastFailedAt: serverTimestamp,
            updatedAt: serverTimestamp,
          });
        }
      }

      // 3.6 Conditionally Record Submission Receipt (Permanent Retained Idempotency Anchor)
      if (receiptRef && idempotencyKey) {
        const payloadFingerprint = computeCanonicalPayloadFingerprintV2(userAnswerPayload);
        const receiptDoc: SubmissionReceiptDoc = {
          idempotencyKey,
          uid,
          sessionId,
          questionId: activeQuestionId,
          questionIndex: currentIndex,
          branchState: (sessionUpdates.branchState as BranchState) || branchState,
          payloadFingerprint,
          fingerprintVersion: 'v2',
          result: isCorrect ? 'CORRECT' : 'INCORRECT',
          xpAwarded,
          currentQuestionIndex: targetQuestionIndex,
          totalXpEarnedInSession: newXp,
          correctCount: newCorrect,
          sessionStatus,
          isSessionComplete,
          questionsCompleted,
          attemptId,
          activeFollowUpQuestionId: sessionUpdates.activeFollowUpQuestionId || null,
          createdAt: serverTimestamp,
        } as any;
        transaction.set(receiptRef, receiptDoc);
      }

      return {
        attemptId,
        currentQuestionIndex: targetQuestionIndex,
        isSessionComplete,
        totalXpEarned: newXp,
        correctCount: newCorrect,
        result: isCorrect ? 'CORRECT' : 'INCORRECT',
        xpAwarded,
        branchState: (sessionUpdates.branchState as BranchState) || branchState,
        status: sessionStatus,
        questionsCompleted,
        activeFollowUpQuestionId: sessionUpdates.activeFollowUpQuestionId || null,
      };
    });
  }

  async finalizeSessionAtomic(params: FinalizeSessionParams): Promise<FinalizeSessionResult> {
    const { uid, sessionId, finalXpEarned, correctCount, totalQuestions, todayDateStr } = params;
    const sessionRef = adminDb.doc(`users/${uid}/dailySessions/${sessionId}`);
    const userRef = adminDb.doc(`users/${uid}`);

    return adminDb.runTransaction(async (transaction) => {
      // 1. Read daily session
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new Error(`Daily session ${sessionId} not found.`);
      }

      const sessionData = sessionSnap.data();
      const terminalStatuses = ['COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED'];
      if (terminalStatuses.includes(sessionData?.status) || sessionData?.reviewViewed === true) {
        return {
          success: false,
          alreadyFinalized: true
        };
      }

      // 2. Read user profile
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error(`User profile ${uid} not found.`);
      }

      const userData = userSnap.data();
      const currentLearningState = userData?.learningState || {};

      // Authoritative XP & question count: preserved from already-committed attempt updates
      const authoritativeTotalXp = typeof userData?.totalXp === 'number'
        ? userData.totalXp
        : (typeof currentLearningState.totalXp === 'number' ? currentLearningState.totalXp : 0);

      const authoritativeCompletedQuestions = typeof userData?.completedQuestionsCount === 'number'
        ? userData.completedQuestionsCount
        : (typeof currentLearningState.completedQuestionsCount === 'number' ? currentLearningState.completedQuestionsCount : 0);

      const oldStreak = currentLearningState.currentStreak || 0;
      const oldSessions = currentLearningState.completedSessionsCount || 0;
      const oldCorrect = currentLearningState.totalCorrectAnswersCount || 0;
      const oldLongest = currentLearningState.longestStreak || 0;
      const lastActiveDate = currentLearningState.lastActiveDate || null;

      let newStreak: number;
      if (lastActiveDate === todayDateStr) {
        // Multiple completions within the same learning cycle: preserve current streak (do not increment again)
        newStreak = oldStreak > 0 ? oldStreak : 1;
      } else {
        const elapsedCycles = getElapsedDailyCycles(lastActiveDate, todayDateStr);
        if (elapsedCycles === 1) {
          // Exactly one cycle elapsed (consecutive cycles): increment streak by 1
          newStreak = oldStreak + 1;
        } else {
          // Inactivity gap (> 1 cycle) or first time completion (NaN / missing): reset streak to 1
          newStreak = 1;
        }
      }

      // 3. Derive authoritative stats from server-verified session state
      const verifiedAttemptXp = typeof sessionData?.totalXpEarned === 'number'
        ? Math.max(0, sessionData.totalXpEarned)
        : 0;
      const verifiedCorrectCount = typeof sessionData?.correctCount === 'number'
        ? Math.max(0, sessionData.correctCount)
        : 0;
      const totalSessionQuestions = Array.isArray(sessionData?.questionIds)
        ? sessionData.questionIds.length
        : 10;
      const isCompleted = Boolean(
        sessionData?.questionsCompleted === true ||
        sessionData?.status === 'QUESTIONS_COMPLETED' ||
        (typeof sessionData?.currentQuestionIndex === 'number' && sessionData.currentQuestionIndex >= totalSessionQuestions)
      );

      // In Stage 3, session finalization awards 0 XP (no completion bonus, no re-awarding attempt XP)
      // Questions were already counted in recordAttemptAtomic; do not increment completedQuestionsCount again.
      const currentLevel = ProgressionService.calculateLevel(authoritativeTotalXp);

      const updatedLearningState = {
        totalXp: authoritativeTotalXp,
        currentStreak: isCompleted ? newStreak : oldStreak,
        longestStreak: isCompleted ? Math.max(oldLongest, newStreak) : oldLongest,
        lastActiveDate: isCompleted ? todayDateStr : lastActiveDate,
        completedSessionsCount: isCompleted ? oldSessions + 1 : oldSessions,
        completedQuestionsCount: authoritativeCompletedQuestions,
        totalCorrectAnswersCount: oldCorrect + verifiedCorrectCount,
        currentLevel,
      };

      const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

      // 4. Update session doc
      transaction.update(sessionRef, {
        status: 'REVIEW_COMPLETED',
        reviewViewed: true,
        totalXpEarned: verifiedAttemptXp,
        correctCount: verifiedCorrectCount,
        completedAt: sessionData?.completedAt || serverTimestamp,
        updatedAt: serverTimestamp,
      });

      // 5. Update user profile doc (syncing both root-level and nested learningState fields)
      transaction.update(userRef, {
        totalXp: authoritativeTotalXp,
        completedQuestionsCount: authoritativeCompletedQuestions,
        learningState: updatedLearningState,
        activeSessionId: null,
        updatedAt: serverTimestamp,
      });

      return {
        success: true,
        alreadyFinalized: false,
        updatedLearningState
      };
    });
  }

  async getUnsolvedQuestions(uid: string): Promise<UnsolvedQuestionDoc[]> {
    let snap: any;
    try {
      if (typeof (adminDb as any).collection === 'function') {
        snap = await adminDb.collection(`users/${uid}/unsolvedQuestions`).get();
      } else {
        snap = await adminDb.doc(`users/${uid}`).collection('unsolvedQuestions').get();
      }
    } catch {
      // In case collection() is mocked through adminDb.doc()
      snap = await adminDb.doc(`users/${uid}`).collection('unsolvedQuestions').get();
    }

    const results: UnsolvedQuestionDoc[] = [];
    if (snap && snap.docs && Array.isArray(snap.docs)) {
      snap.docs.forEach((doc: any) => {
        results.push(doc.data() as UnsolvedQuestionDoc);
      });
    } else if (snap && typeof snap.forEach === 'function') {
      snap.forEach((doc: any) => {
        results.push(doc.data() as UnsolvedQuestionDoc);
      });
    }

    // Sort by lastFailedAt descending (most recent first)
    results.sort((a, b) => {
      const timeA = a.lastFailedAt ? new Date(a.lastFailedAt).getTime() : 0;
      const timeB = b.lastFailedAt ? new Date(b.lastFailedAt).getTime() : 0;
      return timeB - timeA;
    });

    return results;
  }

  async updateUnsolvedQuestion(
    uid: string,
    questionId: string,
    updates: UpdateUnsolvedQuestionParams
  ): Promise<UnsolvedQuestionDoc> {
    const docRef = adminDb.doc(`users/${uid}/unsolvedQuestions/${questionId}`);
    const snap = await docRef.get();
    if (!snap || !snap.exists) {
      throw new NotFoundError(`Unsolved question '${questionId}' not found for user '${uid}'.`);
    }

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const dataToUpdate: Record<string, any> = {
      updatedAt: serverTimestamp,
    };

    if (updates.reviewStatus !== undefined) {
      dataToUpdate.reviewStatus = updates.reviewStatus;
      dataToUpdate.reviewedAt = serverTimestamp;
    }
    if (updates.reviewNotes !== undefined) {
      dataToUpdate.reviewNotes = updates.reviewNotes;
      dataToUpdate.reviewedAt = serverTimestamp;
    }
    if (updates.isResolved !== undefined) {
      dataToUpdate.isResolved = updates.isResolved;
    }

    await docRef.update(dataToUpdate);
    const updatedSnap = await docRef.get();
    return updatedSnap.data() as UnsolvedQuestionDoc;
  }

  async getSessionAttempts(uid: string, sessionId: string): Promise<AttemptDoc[]> {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('attempts')
      .where('dailySessionId', '==', sessionId)
      .get();

    return snap.docs.map((doc) => doc.data() as AttemptDoc);
  }

  async reconcileSessionProgressAtomic(uid: string, sessionId: string): Promise<DailySessionDoc> {
    const sessionRef = adminDb.doc(`users/${uid}/dailySessions/${sessionId}`);
    const attemptsQuery = adminDb
      .collection('users')
      .doc(uid)
      .collection('attempts')
      .where('dailySessionId', '==', sessionId);

    return adminDb.runTransaction(async (transaction) => {
      // 1. Transactional reads
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new NotFoundError(`Daily session ${sessionId} not found.`);
      }
      const session = sessionSnap.data() as DailySessionDoc;

      const attemptsSnap = await transaction.get(attemptsQuery);
      const attempts = attemptsSnap.docs.map((d) => d.data() as AttemptDoc);

      // 2. Authoritative reconciliation from attempt ledger
      const reconciliation = await reconcileSessionProgressFromLedger(
        session,
        attempts,
        (primaryId) => defaultQuestionRepository.getFollowUpQuestion(primaryId)
      );

      // 3. Conditional transactional update of session progression fields ONLY
      if (reconciliation.needsUpdate) {
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
        transaction.update(sessionRef, {
          ...reconciliation.updates,
          updatedAt: serverTimestamp,
        });
      }

      return reconciliation.reconciledSession;
    });
  }


}

export const defaultSessionRepository = new FirestoreSessionRepository();
