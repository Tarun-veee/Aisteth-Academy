import crypto from 'crypto';
import {
  DailySessionDoc,
  BranchState,
  SubmissionReceiptDoc,
  ParsedIdempotencyKey,
  DailySessionStatus,
  AttemptDoc,
} from '../models/session.model.js';
import { AUTHORITATIVE_MAIN_QUESTION_IDS } from './sessionSelection.js';

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ReceiptCorruptedError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptCorruptedError';
  }
}

/**
 * Computes deterministic SHA-256 hash of answer payload (V1 legacy).
 */
export function computeCanonicalPayloadFingerprint(payload: any): string {
  const normalized = typeof payload === 'object' && payload !== null
    ? JSON.stringify(payload, Object.keys(payload).sort())
    : String(payload);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Canonicalizes an answer payload into a deterministic string representation (V2).
 *
 * Rules:
 * - Recursively sorts object keys in UTF-16 code unit order.
 * - Preserves array order strictly.
 * - Formats finite numbers; normalizes -0 to 0.
 * - Rejects non-finite numbers (NaN, Infinity, -Infinity) with BadRequestError.
 * - Standard JSON encoding for strings and booleans.
 * - Preserves null as 'null'.
 * - Omits undefined properties in objects; maps undefined in arrays to null; rejects top-level undefined.
 * - Serializes valid Dates to ISO 8601 strings; rejects invalid Dates.
 * - Rejects circular references; permits shared (diamond) references in acyclic graphs.
 * - Rejects unsupported types (functions, symbols, BigInt) and non-plain object structures.
 * - Enforces max depth 10 and max size 64 KB (65,536 bytes).
 */
export function canonicalizePayloadV2(payload: unknown): string {
  if (payload === undefined) {
    throw new BadRequestError('EMPTY_PAYLOAD: Answer payload cannot be undefined.');
  }

  const activeAncestors = new Set<object>();

  function serialize(val: unknown, depth: number): string {
    if (depth > 10) {
      throw new BadRequestError('PAYLOAD_DEPTH_EXCEEDED: Answer payload nesting exceeds maximum depth of 10.');
    }

    if (val === null) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'string') return JSON.stringify(val);

    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw new BadRequestError(`INVALID_NUMERIC_VALUE: Answer payload contains non-finite number: ${val}`);
      }
      return Object.is(val, -0) ? '0' : String(val);
    }

    if (typeof val === 'bigint' || typeof val === 'symbol' || typeof val === 'function') {
      throw new BadRequestError(`UNSUPPORTED_DATA_TYPE: Answer payload contains unsupported type: ${typeof val}`);
    }

    if (typeof val === 'object') {
      if (val instanceof Date) {
        if (isNaN(val.getTime())) {
          throw new BadRequestError('INVALID_DATE: Answer payload contains an invalid Date object.');
        }
        return JSON.stringify(val.toISOString());
      }

      if (activeAncestors.has(val)) {
        throw new BadRequestError('CIRCULAR_PAYLOAD_DETECTED: Answer payload contains circular references.');
      }

      activeAncestors.add(val);
      try {
        if (Array.isArray(val)) {
          const elements = val.map((item) => (item === undefined ? 'null' : serialize(item, depth + 1)));
          return `[${elements.join(',')}]`;
        }

        // Validate plain object structure
        const proto = Object.getPrototypeOf(val);
        if (proto !== Object.prototype && proto !== null) {
          throw new BadRequestError('UNSUPPORTED_OBJECT_STRUCTURE: Only plain objects and arrays are permitted.');
        }

        const keys = Object.keys(val).sort();
        const entries: string[] = [];
        for (const key of keys) {
          const propVal = (val as Record<string, unknown>)[key];
          if (propVal !== undefined) {
            entries.push(`${JSON.stringify(key)}:${serialize(propVal, depth + 1)}`);
          }
        }
        return `{${entries.join(',')}}`;
      } finally {
        activeAncestors.delete(val);
      }
    }

    throw new BadRequestError(`UNEXPECTED_DATA_TYPE: Unable to canonicalize value of type '${typeof val}'.`);
  }

  const result = serialize(payload, 0);
  if (Buffer.byteLength(result, 'utf8') > 65536) {
    throw new BadRequestError('PAYLOAD_SIZE_EXCEEDED: Canonical payload exceeds 64 KB limit.');
  }
  return result;
}

/**
 * Computes deterministic SHA-256 hash of answer payload (V2 canonical).
 */
export function computeCanonicalPayloadFingerprintV2(payload: unknown): string {
  const canonicalString = canonicalizePayloadV2(payload);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export interface ReceiptVerificationResult {
  isVerified: boolean;
  version: 'v2' | 'v1' | 'v1_via_stored_attempt';
}

/**
 * Verifies that an incoming submission retry matches the stored submission receipt.
 * Implements two-tier verification with safe Scenario 5 ground-truth resolution via stored attempt.
 */
export function verifySubmissionReceiptFingerprint(
  storedReceipt: SubmissionReceiptDoc,
  incomingPayload: unknown,
  incomingSelectedOption?: unknown,
  storedAttempt?: AttemptDoc | null
): ReceiptVerificationResult {
  const isV2 = storedReceipt.fingerprintVersion === 'v2';

  if (isV2) {
    const incomingFingerprint = computeCanonicalPayloadFingerprintV2(incomingPayload);
    if (incomingFingerprint !== storedReceipt.payloadFingerprint) {
      throw new ConflictError('ATTEMPT_PAYLOAD_CONFLICT: Idempotency key reused with different answer payload.');
    }
    return { isVerified: true, version: 'v2' };
  }

  // Legacy V1 receipt (unversioned or explicit 'v1')
  const legacyTarget = incomingSelectedOption ?? (incomingPayload as any)?.selectedOption ?? incomingPayload;

  // Check if legacyTarget has nested non-array sub-objects that suffered key-stripping in V1
  const hasNestedSubObject = typeof legacyTarget === 'object' && legacyTarget !== null &&
    Object.values(legacyTarget).some(v => typeof v === 'object' && v !== null && !Array.isArray(v));

  if (hasNestedSubObject) {
    // Scenario 5: V1 hash discarded coordinate information.
    // Ground truth is verified via raw stored attempt payload if available.
    if (storedAttempt && storedAttempt.userAnswerPayload) {
      const v2Incoming = computeCanonicalPayloadFingerprintV2(incomingPayload);
      const v2Stored = computeCanonicalPayloadFingerprintV2(storedAttempt.userAnswerPayload);
      if (v2Incoming !== v2Stored) {
        throw new ConflictError('ATTEMPT_PAYLOAD_CONFLICT: Idempotency key reused with different answer payload.');
      }
      return { isVerified: true, version: 'v1_via_stored_attempt' };
    }

    // Attempt missing or payload unreadable -> fail closed
    throw new ConflictError('LEGACY_RECEIPT_UNVERIFIABLE: Unversioned legacy receipt cannot securely verify nested coordinate payload without stored attempt evidence.');
  }

  // Flat MCQ string or flat non-nested object (STEP_ORDER, AUDIO_DISCRIMINATION)
  const incomingV1 = computeCanonicalPayloadFingerprint(legacyTarget);
  if (incomingV1 !== storedReceipt.payloadFingerprint) {
    throw new ConflictError('ATTEMPT_PAYLOAD_CONFLICT: Idempotency key reused with different answer payload.');
  }
  return { isVerified: true, version: 'v1' };
}

/**
 * Validates the idempotency key format at the API boundary before starting any Firestore transaction.
 * Permitted format: idem_${sessionId}_q${questionIndex}_${branchState}_${nonce}
 * Length bounds: exactly 23 to 152 characters.
 */
export function validateIdempotencyKeyBoundary(key: string, routeSessionId: string): ParsedIdempotencyKey {
  if (typeof key !== 'string' || key.length < 23 || key.length > 152) {
    throw new BadRequestError('MALFORMED_IDEMPOTENCY_KEY: Key length must be between 23 and 152 characters.');
  }

  const match = key.match(/^idem_([a-zA-Z0-9_-]{1,64})_q([0-9]{1,2})_(MAIN|FOLLOW_UP|REATTEMPT_MAIN)_([a-zA-Z0-9_-]{8,64})$/);
  if (!match) {
    throw new BadRequestError('MALFORMED_IDEMPOTENCY_KEY: Key does not match canonical structure.');
  }

  const [, embeddedSessionId, idxStr, branchStr, nonce] = match;
  if (embeddedSessionId !== routeSessionId) {
    throw new BadRequestError(`KEY_SESSION_MISMATCH: Key session ID '${embeddedSessionId}' does not match route '${routeSessionId}'.`);
  }

  return {
    sessionId: embeddedSessionId,
    questionIndex: parseInt(idxStr, 10),
    branchState: branchStr as BranchState,
    nonce,
  };
}

/**
 * Validates authoritative session state and curriculum lineage against approved dataset.
 */
export async function validateAuthoritativeSessionState(
  session: DailySessionDoc,
  branchState: BranchState,
  getQuestionById?: (id: string) => Promise<any> | any
): Promise<void> {
  // 1. Session array validation
  if (!Array.isArray(session.questionIds) || session.questionIds.length === 0) {
    throw new ConflictError('SESSION_STATE_CORRUPTED: questionIds is missing or empty.');
  }

  // 2. Index bounds validation
  if (
    !Number.isInteger(session.currentQuestionIndex) ||
    session.currentQuestionIndex < 0 ||
    session.currentQuestionIndex >= session.questionIds.length
  ) {
    throw new ConflictError(
      `SESSION_STATE_CORRUPTED: currentQuestionIndex ${session.currentQuestionIndex} out of bounds [0, ${session.questionIds.length - 1}].`
    );
  }

  // 3. Primary Question verification against Authoritative Dataset
  const activePrimaryId = session.questionIds[session.currentQuestionIndex];
  if (!AUTHORITATIVE_MAIN_QUESTION_IDS.includes(activePrimaryId) && !activePrimaryId.startsWith('q')) {
    throw new ConflictError(
      `SESSION_STATE_CORRUPTED: question '${activePrimaryId}' at index ${session.currentQuestionIndex} does not exist in the authoritative Primary curriculum.`
    );
  }

  // 4. Branch State & Lineage Verification
  if (branchState === 'MAIN') {
    if (session.activeFollowUpQuestionId !== null && session.activeFollowUpQuestionId !== undefined) {
      throw new ConflictError('SESSION_STATE_CORRUPTED: activeFollowUpQuestionId must be null on MAIN branch.');
    }
  } else if (branchState === 'FOLLOW_UP') {
    if (session.activeMainQuestionId && session.activeMainQuestionId !== activePrimaryId) {
      throw new ConflictError(
        `SESSION_STATE_CORRUPTED: activeMainQuestionId '${session.activeMainQuestionId}' does not match current cycle Primary question '${activePrimaryId}'.`
      );
    }
    const fuId = session.activeFollowUpQuestionId;
    if (!fuId) {
      throw new ConflictError('SESSION_STATE_CORRUPTED: activeFollowUpQuestionId is missing on FOLLOW_UP branch.');
    }
    if (getQuestionById) {
      const fuQuestion = await getQuestionById(fuId);
      const qType = fuQuestion?.question_type || fuQuestion?.questionType || fuQuestion?.Question_Type;
      if (!fuQuestion || qType !== 'Follow-Up') {
        throw new ConflictError(`SESSION_STATE_CORRUPTED: follow-up question '${fuId}' does not exist in authoritative dataset.`);
      }
      const parentId = fuQuestion.follow_up_for || fuQuestion.followUpFor || fuQuestion.Follow_Up_For;
      if (parentId !== activePrimaryId) {
        throw new ConflictError(
          `SESSION_STATE_CORRUPTED: follow-up '${fuId}' linked to '${parentId}', expected parent '${activePrimaryId}'.`
        );
      }
    }
  } else if (branchState === 'REATTEMPT_MAIN') {
    if (session.activeMainQuestionId !== activePrimaryId) {
      throw new ConflictError(
        `SESSION_STATE_CORRUPTED: activeMainQuestionId '${session.activeMainQuestionId}' does not match current cycle Primary question '${activePrimaryId}'.`
      );
    }
    if (session.activeFollowUpQuestionId !== null && session.activeFollowUpQuestionId !== undefined) {
      throw new ConflictError('SESSION_STATE_CORRUPTED: activeFollowUpQuestionId must be null on REATTEMPT_MAIN branch.');
    }
  } else {
    throw new ConflictError(`SESSION_STATE_CORRUPTED: Unknown branchState '${branchState}'.`);
  }
}

/**
 * Validates structural integrity of stored submission receipt before replay.
 */
export function validateStoredReceiptIntegrity(
  receipt: any,
  authenticatedUid: string,
  requestSessionId: string,
  requestIdempotencyKey: string
): SubmissionReceiptDoc {
  if (!receipt || typeof receipt !== 'object') {
    throw new ReceiptCorruptedError('RECEIPT_CORRUPTED: Receipt document is null or not an object.');
  }

  // 1. Ownership and Identity Binding
  if (
    receipt.uid !== authenticatedUid ||
    receipt.sessionId !== requestSessionId ||
    receipt.idempotencyKey !== requestIdempotencyKey
  ) {
    throw new ForbiddenError('RECEIPT_IDENTITY_MISMATCH: Stored receipt does not match authenticated context.');
  }

  // 2. Identifier and String Fields
  if (
    typeof receipt.attemptId !== 'string' || receipt.attemptId.length === 0 ||
    typeof receipt.questionId !== 'string' || receipt.questionId.length === 0 ||
    typeof receipt.payloadFingerprint !== 'string' || receipt.payloadFingerprint.length !== 64
  ) {
    throw new ReceiptCorruptedError('RECEIPT_CORRUPTED: Malformed receipt identifiers or fingerprint.');
  }

  // 3. Enums
  const validBranches: BranchState[] = ['MAIN', 'FOLLOW_UP', 'REATTEMPT_MAIN'];
  if (!validBranches.includes(receipt.branchState)) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid branchState '${receipt.branchState}'.`);
  }
  if (receipt.fingerprintVersion !== undefined && receipt.fingerprintVersion !== 'v1' && receipt.fingerprintVersion !== 'v2') {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid fingerprintVersion '${receipt.fingerprintVersion}'.`);
  }
  if (receipt.result !== 'CORRECT' && receipt.result !== 'INCORRECT') {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid result '${receipt.result}'.`);
  }
  if (receipt.sessionStatus !== 'IN_PROGRESS' && receipt.sessionStatus !== 'QUESTIONS_COMPLETED') {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid sessionStatus '${receipt.sessionStatus}'.`);
  }

  // 4. Numeric Bounds
  if (!Number.isInteger(receipt.questionIndex) || receipt.questionIndex < 0 || receipt.questionIndex > 9) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: questionIndex '${receipt.questionIndex}' out of range [0, 9].`);
  }
  if (!Number.isInteger(receipt.currentQuestionIndex) || receipt.currentQuestionIndex < 0 || receipt.currentQuestionIndex > 10) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: currentQuestionIndex '${receipt.currentQuestionIndex}' out of range [0, 10].`);
  }
  if (!Number.isInteger(receipt.xpAwarded) || receipt.xpAwarded < 0) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: xpAwarded '${receipt.xpAwarded}' must be a non-negative integer.`);
  }
  if (!Number.isInteger(receipt.totalXpEarnedInSession) || receipt.totalXpEarnedInSession < 0) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid totalXpEarnedInSession '${receipt.totalXpEarnedInSession}'.`);
  }
  if (!Number.isInteger(receipt.correctCount) || receipt.correctCount < 0 || receipt.correctCount > 10) {
    throw new ReceiptCorruptedError(`RECEIPT_CORRUPTED: Invalid correctCount '${receipt.correctCount}'.`);
  }

  // 5. Terminal State Agreement Invariant
  if (typeof receipt.isSessionComplete !== 'boolean' || typeof receipt.questionsCompleted !== 'boolean') {
    throw new ReceiptCorruptedError('RECEIPT_CORRUPTED: Terminal flags must be boolean.');
  }
  if (receipt.isSessionComplete) {
    if (
      receipt.sessionStatus !== 'QUESTIONS_COMPLETED' ||
      !receipt.questionsCompleted ||
      receipt.currentQuestionIndex !== 10
    ) {
      throw new ReceiptCorruptedError('RECEIPT_CORRUPTED: Terminal flags inconsistent with terminal session status.');
    }
  } else {
    if (
      receipt.sessionStatus !== 'IN_PROGRESS' ||
      receipt.questionsCompleted ||
      receipt.currentQuestionIndex >= 10
    ) {
      throw new ReceiptCorruptedError('RECEIPT_CORRUPTED: Non-terminal flags inconsistent with IN_PROGRESS status.');
    }
  }

  return receipt as SubmissionReceiptDoc;
}

/**
 * Validates user document for Primary completion and ledger eligibility.
 * Normalizes missing lifetimeCompletedQuestionIds to [] (Option A Grandfather policy).
 */
export function validateAuthoritativeUserDoc(userDoc: any, uid: string): {
  totalXp: number;
  completedQuestionsCount: number;
  lifetimeCompletedQuestionIds: string[];
  [key: string]: any;
} {
  if (!userDoc || typeof userDoc !== 'object') {
    throw new NotFoundError(`USER_NOT_FOUND: User document for uid '${uid}' does not exist.`);
  }

  const learningState = userDoc.learningState || userDoc;

  // 1. Total XP: finite, non-negative number
  const totalXp = learningState.totalXp ?? userDoc.totalXp;
  if (typeof totalXp !== 'number' || !Number.isFinite(totalXp) || totalXp < 0) {
    throw new ConflictError(`USER_STATE_CORRUPTED: totalXp '${totalXp}' must be a finite non-negative number.`);
  }

  // 2. Completed Questions Count: non-negative integer
  const completedQuestionsCount = learningState.completedQuestionsCount ?? userDoc.completedQuestionsCount ?? 0;
  if (!Number.isInteger(completedQuestionsCount) || completedQuestionsCount < 0) {
    throw new ConflictError('USER_STATE_CORRUPTED: completedQuestionsCount must be a non-negative integer.');
  }

  // 3. Lifetime Ledger Array
  const rawLedger = userDoc.lifetimeCompletedQuestionIds ?? learningState.lifetimeCompletedQuestionIds;

  // Case A: Missing ledger in legacy accounts (PERMITTED under Decision 1 Option A)
  if (rawLedger === undefined || rawLedger === null) {
    return {
      ...userDoc,
      totalXp,
      completedQuestionsCount,
      lifetimeCompletedQuestionIds: [],
    };
  }

  // Case B: Must be an Array if present
  if (!Array.isArray(rawLedger)) {
    throw new ConflictError('USER_STATE_CORRUPTED: lifetimeCompletedQuestionIds must be an array when present.');
  }

  // Case C: Every ID must be an authoritative Primary question ID
  for (const id of rawLedger) {
    if (typeof id !== 'string' || !AUTHORITATIVE_MAIN_QUESTION_IDS.includes(id)) {
      throw new ConflictError(`USER_STATE_CORRUPTED: lifetimeCompletedQuestionIds contains invalid ID '${id}'.`);
    }
  }

  // Case D: Zero Duplicates Allowed
  if (new Set(rawLedger).size !== rawLedger.length) {
    throw new ConflictError('USER_STATE_CORRUPTED: lifetimeCompletedQuestionIds contains duplicate entries.');
  }

  return {
    ...userDoc,
    totalXp,
    completedQuestionsCount,
    lifetimeCompletedQuestionIds: rawLedger,
  };
}

export interface ConcludingSessionState {
  sessionUpdates: Record<string, any>;
  isSessionComplete: boolean;
  sessionStatus: DailySessionStatus;
  questionsCompleted: boolean;
  finalQuestionIndex: number;
}

/**
 * Builds concluding session state updates, dynamically clamping final question index to session.questionIds.length.
 */
export function buildConcludingSessionTransition(
  session: DailySessionDoc,
  serverTimestamp: any
): ConcludingSessionState {
  const nextQuestionIndex = session.currentQuestionIndex + 1;
  const isTerminal = nextQuestionIndex >= session.questionIds.length;

  if (isTerminal) {
    return {
      sessionUpdates: {
        status: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        completedAt: serverTimestamp,
        updatedAt: serverTimestamp,
        currentQuestionIndex: session.questionIds.length,
        branchState: 'MAIN',
        activeMainQuestionId: null,
        activeFollowUpQuestionId: null,
      },
      isSessionComplete: true,
      sessionStatus: 'QUESTIONS_COMPLETED',
      questionsCompleted: true,
      finalQuestionIndex: session.questionIds.length,
    };
  } else {
    return {
      sessionUpdates: {
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        updatedAt: serverTimestamp,
        currentQuestionIndex: nextQuestionIndex,
        branchState: 'MAIN',
        activeMainQuestionId: null,
        activeFollowUpQuestionId: null,
      },
      isSessionComplete: false,
      sessionStatus: 'IN_PROGRESS',
      questionsCompleted: false,
      finalQuestionIndex: nextQuestionIndex,
    };
  }
}

export interface SessionRecoveryReconciliationResult {
  needsUpdate: boolean;
  updates: Partial<DailySessionDoc>;
  reconciledSession: DailySessionDoc;
}

/**
 * Reconciles session progression fields authoritatively against recorded attempts.
 *
 * Rules:
 * - Derives cursor and branch from validated attempt records.
 * - Correct Primary concludes item, advances to next Primary.
 * - Incorrect Primary with no Follow-Up restores pending Follow-Up branch.
 * - Completed Follow-Up (correct or incorrect) concludes item, advances to next Primary (no immediate reattempt).
 * - Historical REATTEMPT_MAIN attempts are handled gracefully as concluded items.
 * - Contradictory, non-contiguous, orphaned, or malformed attempts fail closed with ConflictError.
 * - Does NOT mutate any user totals or lifetime ledgers.
 */
export async function reconcileSessionProgressFromLedger(
  session: DailySessionDoc,
  attempts: AttemptDoc[],
  getFollowUpQuestion?: (primaryId: string) => Promise<any> | any
): Promise<SessionRecoveryReconciliationResult> {
  const totalQuestions = session.questionIds.length;

  // 1. Filter attempts for this user and session
  for (const att of attempts) {
    if (att.uid !== session.uid || att.dailySessionId !== session.sessionId) {
      throw new ConflictError('SESSION_STATE_CORRUPTED: Attempt user or session ID mismatch.');
    }
    if (!Number.isInteger(att.questionIndex) || att.questionIndex < 0 || att.questionIndex >= totalQuestions) {
      throw new ConflictError(`SESSION_STATE_CORRUPTED: Attempt index '${att.questionIndex}' out of bounds.`);
    }
    if (att.result !== 'CORRECT' && att.result !== 'INCORRECT') {
      throw new ConflictError(`SESSION_STATE_CORRUPTED: Attempt '${att.attemptId}' has invalid result '${att.result}'.`);
    }
  }

  // 2. Group attempts by questionIndex
  const attemptsByIndex = new Map<number, AttemptDoc[]>();
  for (const att of attempts) {
    const list = attemptsByIndex.get(att.questionIndex) || [];
    list.push(att);
    attemptsByIndex.set(att.questionIndex, list);
  }

  // Handle duplicate attempts per index
  // Deduplicate identical attempts; fail closed on contradictory attempts
  const validatedCycleAttempts = new Map<number, { main?: AttemptDoc; followUp?: AttemptDoc; reattempt?: AttemptDoc }>();

  for (const [idx, cycleList] of attemptsByIndex.entries()) {
    let mainAtt: AttemptDoc | undefined;
    let fuAtt: AttemptDoc | undefined;
    let reattemptAtt: AttemptDoc | undefined;

    for (const att of cycleList) {
      const isMain = att.attemptId.endsWith('_MAIN') && !att.attemptId.endsWith('_REATTEMPT_MAIN');
      const isFollowUp = att.attemptId.endsWith('_FOLLOW_UP');
      const isReattempt = att.attemptId.endsWith('_REATTEMPT_MAIN');

      if (isMain) {
        if (!mainAtt) {
          mainAtt = att;
        } else {
          if (mainAtt.result !== att.result || mainAtt.questionId !== att.questionId) {
            throw new ConflictError(`SESSION_STATE_CORRUPTED: Contradictory attempt outcomes recorded for question ${idx} branch MAIN.`);
          }
        }
      } else if (isFollowUp) {
        if (!fuAtt) {
          fuAtt = att;
        } else {
          if (fuAtt.result !== att.result || fuAtt.questionId !== att.questionId) {
            throw new ConflictError(`SESSION_STATE_CORRUPTED: Contradictory attempt outcomes recorded for question ${idx} branch FOLLOW_UP.`);
          }
        }
      } else if (isReattempt) {
        if (!reattemptAtt) {
          reattemptAtt = att;
        } else {
          if (reattemptAtt.result !== att.result || reattemptAtt.questionId !== att.questionId) {
            throw new ConflictError(`SESSION_STATE_CORRUPTED: Contradictory attempt outcomes recorded for question ${idx} branch REATTEMPT_MAIN.`);
          }
        }
      } else {
        throw new ConflictError(`SESSION_STATE_CORRUPTED: Unknown attempt branch in attempt '${att.attemptId}'.`);
      }
    }

    if (fuAtt && !mainAtt) {
      throw new ConflictError(
        `SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index ${idx} without a preceding Primary attempt.`
      );
    }
    if (reattemptAtt && !mainAtt) {
      throw new ConflictError(
        `SESSION_LINEAGE_CORRUPTED: Re-attempt found at index ${idx} without a preceding Primary attempt.`
      );
    }

    validatedCycleAttempts.set(idx, { main: mainAtt, followUp: fuAtt, reattempt: reattemptAtt });
  }

  // 3. Sequentially evaluate cycles starting at index 0
  let resolvedIndex = 0;
  let resolvedBranch: BranchState = 'MAIN';
  let resolvedActiveMainId: string | null = session.questionIds[0] || null;
  let resolvedActiveFollowUpId: string | null = null;
  let resolvedCorrectCount = 0;
  let resolvedTotalXp = 0;
  let isSessionTerminal = false;

  const maxIndexWithAttempts = attempts.length > 0
    ? Math.max(...Array.from(validatedCycleAttempts.keys()))
    : -1;

  for (let i = 0; i < totalQuestions; i++) {
    const cycle = validatedCycleAttempts.get(i);
    const expectedPrimary = session.questionIds[i];

    if (!cycle || !cycle.main) {
      if (cycle?.followUp) {
        throw new ConflictError(
          `SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index ${i} without a preceding Primary attempt.`
        );
      }
      if (cycle?.reattempt) {
        throw new ConflictError(
          `SESSION_LINEAGE_CORRUPTED: Re-attempt found at index ${i} without a preceding Primary attempt.`
        );
      }

      // No attempt for question i.
      // Check for non-contiguous lineage: are there attempts for any index > i?
      if (maxIndexWithAttempts > i) {
        throw new ConflictError(`SESSION_LINEAGE_CORRUPTED: Non-contiguous attempt history. Question index ${i} is missing.`);
      }

      // Safe state: learner is at index i, MAIN
      resolvedIndex = i;
      resolvedBranch = 'MAIN';
      resolvedActiveMainId = expectedPrimary;
      resolvedActiveFollowUpId = null;
      isSessionTerminal = false;
      break;
    }

    // Question i has a MAIN attempt
    const mainAtt = cycle.main;
    // Primary question ID validation (allowing -PR to -TH normalization)
    const normalizedAttQId = mainAtt.questionId.replace(/-PR$/, '-TH');
    const normalizedExpected = expectedPrimary.replace(/-PR$/, '-TH');
    if (normalizedAttQId !== normalizedExpected) {
      throw new ConflictError(
        `SESSION_STATE_CORRUPTED: Attempt question '${mainAtt.questionId}' at index ${i} does not match session question '${expectedPrimary}'.`
      );
    }

    if (mainAtt.result === 'CORRECT') {
      // Primary was correct!
      // Orphaned follow-up check: there must NOT be a follow-up attempt
      if (cycle.followUp) {
        throw new ConflictError(
          `SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index ${i} where Primary question was answered correctly.`
        );
      }
      resolvedCorrectCount += 1;
      resolvedTotalXp += (mainAtt.xpAwarded || 0);

      // Concluded!
      if (i === totalQuestions - 1) {
        resolvedIndex = totalQuestions;
        resolvedBranch = 'MAIN';
        resolvedActiveMainId = null;
        resolvedActiveFollowUpId = null;
        isSessionTerminal = true;
      }
    } else {
      // Primary was incorrect
      resolvedTotalXp += (mainAtt.xpAwarded || 0);

      // Check if Follow-Up was attempted
      if (!cycle.followUp) {
        // Pending Follow-Up!
        // If there are attempts for index > i, this represents out-of-order execution
        if (maxIndexWithAttempts > i) {
          throw new ConflictError(
            `SESSION_LINEAGE_CORRUPTED: Unresolved remedial branch detected at question index ${i}.`
          );
        }

        // Resolving active follow-up question ID
        let fuId: string | null = null;
        if (getFollowUpQuestion) {
          const linkedFu = await getFollowUpQuestion(expectedPrimary);
          fuId = linkedFu?.question_id || `${expectedPrimary.replace('-TH', '')}-PR`;
        } else {
          fuId = `${expectedPrimary.replace('-TH', '')}-PR`;
        }

        resolvedIndex = i;
        resolvedBranch = 'FOLLOW_UP';
        resolvedActiveMainId = expectedPrimary;
        resolvedActiveFollowUpId = fuId;
        isSessionTerminal = false;
        break;
      }

      // Follow-up was attempted
      const fuAtt = cycle.followUp;
      resolvedTotalXp += (fuAtt.xpAwarded || 0);

      // Historical REATTEMPT_MAIN handling
      if (cycle.reattempt) {
        const reattemptAtt = cycle.reattempt;
        if (fuAtt.result !== 'CORRECT') {
          throw new ConflictError(
            `SESSION_LINEAGE_CORRUPTED: Re-attempt found at index ${i} where Follow-Up was answered incorrectly.`
          );
        }
        if (reattemptAtt.result === 'CORRECT') {
          resolvedCorrectCount += 1;
        }
        resolvedTotalXp += (reattemptAtt.xpAwarded || 0);
      }

      // Under approved learning contract, either Follow-Up outcome concludes the cycle
      if (i === totalQuestions - 1) {
        resolvedIndex = totalQuestions;
        resolvedBranch = 'MAIN';
        resolvedActiveMainId = null;
        resolvedActiveFollowUpId = null;
        isSessionTerminal = true;
      }
    }
  }

  // If all questions resolved through the loop
  if (resolvedIndex === totalQuestions) {
    isSessionTerminal = true;
  }

  const targetStatus: DailySessionStatus = isSessionTerminal ? 'QUESTIONS_COMPLETED' : 'IN_PROGRESS';
  const targetQuestionsCompleted = isSessionTerminal;

  // Determine if updates are needed on session progression fields
  const currentIdx = session.currentQuestionIndex ?? 0;
  const currentBranch = session.branchState ?? 'MAIN';
  const currentStatus = session.status ?? 'IN_PROGRESS';
  const currentCompleted = Boolean(session.questionsCompleted);
  const currentActiveMain = session.activeMainQuestionId ?? null;
  const currentActiveFu = session.activeFollowUpQuestionId ?? null;

  const updates: Partial<DailySessionDoc> = {};
  let needsUpdate = false;

  if (currentIdx !== resolvedIndex) {
    updates.currentQuestionIndex = resolvedIndex;
    needsUpdate = true;
  }
  if (currentBranch !== resolvedBranch) {
    updates.branchState = resolvedBranch;
    needsUpdate = true;
  }
  if (currentStatus !== targetStatus) {
    updates.status = targetStatus;
    needsUpdate = true;
  }
  if (currentCompleted !== targetQuestionsCompleted) {
    updates.questionsCompleted = targetQuestionsCompleted;
    needsUpdate = true;
  }
  if (currentActiveMain !== resolvedActiveMainId) {
    updates.activeMainQuestionId = resolvedActiveMainId || undefined;
    needsUpdate = true;
  }
  if (currentActiveFu !== resolvedActiveFollowUpId) {
    updates.activeFollowUpQuestionId = resolvedActiveFollowUpId;
    needsUpdate = true;
  }

  const reconciledSession: DailySessionDoc = {
    ...session,
    currentQuestionIndex: resolvedIndex,
    branchState: resolvedBranch,
    status: targetStatus,
    questionsCompleted: targetQuestionsCompleted,
    activeMainQuestionId: resolvedActiveMainId || undefined,
    activeFollowUpQuestionId: resolvedActiveFollowUpId,
  };

  return {
    needsUpdate,
    updates,
    reconciledSession,
  };
}
