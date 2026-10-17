/**
 * AiSteth Academy — Question Selection & Lineage Validation Engine (Phase 2)
 *
 * Implements authoritative Main-question selection from the 310-question curriculum,
 * deterministic curriculum progression ordering, tie-breaking, ledger filtering,
 * safe boundary handling, and follow-up relationship validation.
 */

import { Question } from '../models/question.model.js';

export interface ReleaseQuestionMetadata {
  questionId: string;
  questionType: 'Primary' | 'Follow-Up';
  difficultyRank: number; // 1 to 10
}

/**
 * Authoritative 31 Clinical Topic Sequence (as ordered in all_topics_questions.json)
 */
export const AUTHORITATIVE_TOPIC_SEQUENCE = [
  'Ai Abnormal',
  'AI limitation',
  'AiSteth',
  'Anaemia flow',
  'Apex',
  'ASHA role',
  'CHD basics',
  'Chorea',
  'Continuous Murmur',
  'Cyanosis',
  'Diastolic',
  'DEIC',
  'Echocardiogram',
  'Exercise Intolerance',
  'Family History',
  'Feeding Red Flags',
  'Fever Flow Murmur',
  'Five Points',
  'Innocent Murmur',
  'Llsb',
  'Murmur Not Diagnosis',
  'Noise Quality',
  'Position Change',
  'Rbsk Condition',
  'Rhd Age',
  'Rhd Basics',
  'Secondary Prevention',
  'Sore Throat History',
  'Sore Throat Prevention',
  'Systolic Timing',
  'Thrill',
] as const;

/**
 * Authoritative Canonical 31-Topic Curriculum Sequence (Five-Level Curriculum Order)
 *
 * Level 1 — Foundations:
 * 1. ASHA role, 2. AiSteth, 3. Echo role (Echocardiogram), 4. CHD basics,
 * 5. Innocent murmur, 6. Murmur not diagnosis, 7. AI limitation
 *
 * Level 2 — Recognizing Basic Clinical Signs:
 * 8. Fever flow murmur, 9. Family history, 10. Feeding red flags,
 * 11. Exercise intolerance, 12. Cyanosis, 13. Apex, 14. Five points,
 * 15. LLSB, 16. Position change, 17. Noise quality
 *
 * Level 3 — Murmur Interpretation:
 * 18. Systolic timing, 19. Diastolic, 20. Continuous murmur, 21. Thrill, 22. AI abnormal
 *
 * Level 4 — Conditions and Clinical Reasoning:
 * 23. RHD basics, 24. RHD age, 25. Chorea, 26. Sore throat history, 27. RBSK condition
 *
 * Level 5 — Field Workflows and Prevention:
 * 28. Anaemia flow, 29. Sore throat prevention, 30. Secondary prevention, 31. DEIC
 */
export const CANONICAL_31_TOPIC_SEQUENCE: readonly string[] = [
  // Level 1 — Foundations
  'ASHA role',
  'AiSteth',
  'Echocardiogram',
  'CHD basics',
  'Innocent Murmur',
  'Murmur Not Diagnosis',
  'AI limitation',

  // Level 2 — Recognizing Basic Clinical Signs
  'Fever Flow Murmur',
  'Family History',
  'Feeding Red Flags',
  'Exercise Intolerance',
  'Cyanosis',
  'Apex',
  'Five Points',
  'Llsb',
  'Position Change',
  'Noise Quality',

  // Level 3 — Murmur Interpretation
  'Systolic Timing',
  'Diastolic',
  'Continuous Murmur',
  'Thrill',
  'Ai Abnormal',

  // Level 4 — Conditions and Clinical Reasoning
  'Rhd Basics',
  'Rhd Age',
  'Chorea',
  'Sore Throat History',
  'Rbsk Condition',

  // Level 5 — Field Workflows and Prevention
  'Anaemia flow',
  'Sore Throat Prevention',
  'Secondary Prevention',
  'DEIC',
] as const;

const TOPIC_CANONICAL_MAP = new Map<string, string>();
CANONICAL_31_TOPIC_SEQUENCE.forEach((canonical) => {
  TOPIC_CANONICAL_MAP.set(canonical.toLowerCase(), canonical);
  TOPIC_CANONICAL_MAP.set(canonical.toLowerCase().replace(/[^a-z0-9]/g, ''), canonical);
});
// Canonical aliases
TOPIC_CANONICAL_MAP.set('echo role', 'Echocardiogram');
TOPIC_CANONICAL_MAP.set('echorole', 'Echocardiogram');

export function normalizeToCanonicalTopic(topic: string): string {
  if (!topic) return '';
  const exact = CANONICAL_31_TOPIC_SEQUENCE.find((t) => t === topic);
  if (exact) return exact;
  const lower = topic.toLowerCase();
  if (TOPIC_CANONICAL_MAP.has(lower)) return TOPIC_CANONICAL_MAP.get(lower)!;
  const alphaNum = lower.replace(/[^a-z0-9]/g, '');
  if (TOPIC_CANONICAL_MAP.has(alphaNum)) return TOPIC_CANONICAL_MAP.get(alphaNum)!;
  return topic;
}

/**
 * Authoritative 310 Foundational Main (Primary) Question IDs in curriculum progression order.
 * 10 questions per topic (ranks 1 to 10) across all 31 topics.
 */
export const AUTHORITATIVE_MAIN_QUESTION_IDS: readonly string[] = [
  'MG-AIA-01-TH','MG-AIA-02-TH','MG-AIA-03-TH','MG-AIA-04-TH','MG-AIA-05-TH','MG-AIA-06-TH','MG-AIA-07-TH','MG-AIA-08-TH','MG-AIA-09-TH','MG-AIA-10-TH',
  'MG-AIL-01-TH','MG-AIL-02-TH','MG-AIL-03-TH','MG-AIL-04-TH','MG-AIL-05-TH','MG-AIL-06-TH','MG-AIL-07-TH','MG-AIL-08-TH','MG-AIL-09-TH','MG-AIL-10-TH',
  'MG-AIS-01-TH','MG-AIS-02-TH','MG-AIS-03-TH','MG-AIS-04-TH','MG-AIS-05-TH','MG-AIS-06-TH','MG-AIS-07-TH','MG-AIS-08-TH','MG-AIS-09-TH','MG-AIS-10-TH',
  'MG-ANA-01-TH','MG-ANA-02-TH','MG-ANA-03-TH','MG-ANA-04-TH','MG-ANA-05-TH','MG-ANA-06-TH','MG-ANA-07-TH','MG-ANA-08-TH','MG-ANA-09-TH','MG-ANA-10-TH',
  'MG-APE-01-TH','MG-APE-02-TH','MG-APE-03-TH','MG-APE-04-TH','MG-APE-05-TH','MG-APE-06-TH','MG-APE-07-TH','MG-APE-08-TH','MG-APE-09-TH','MG-APE-10-TH',
  'MG-ASH-01-TH','MG-ASH-02-TH','MG-ASH-03-TH','MG-ASH-04-TH','MG-ASH-05-TH','MG-ASH-06-TH','MG-ASH-07-TH','MG-ASH-08-TH','MG-ASH-09-TH','MG-ASH-10-TH',
  'MG-CHD-01-TH','MG-CHD-02-TH','MG-CHD-03-TH','MG-CHD-04-TH','MG-CHD-05-TH','MG-CHD-06-TH','MG-CHD-07-TH','MG-CHD-08-TH','MG-CHD-09-TH','MG-CHD-10-TH',
  'MG-CHO-01-TH','MG-CHO-02-TH','MG-CHO-03-TH','MG-CHO-04-TH','MG-CHO-05-TH','MG-CHO-06-TH','MG-CHO-07-TH','MG-CHO-08-TH','MG-CHO-09-TH','MG-CHO-10-TH',
  'MG-CON-01-TH','MG-CON-02-TH','MG-CON-03-TH','MG-CON-04-TH','MG-CON-05-TH','MG-CON-06-TH','MG-CON-07-TH','MG-CON-08-TH','MG-CON-09-TH','MG-CON-10-TH',
  'MG-CYA-01-TH','MG-CYA-02-TH','MG-CYA-03-TH','MG-CYA-04-TH','MG-CYA-05-TH','MG-CYA-06-TH','MG-CYA-07-TH','MG-CYA-08-TH','MG-CYA-09-TH','MG-CYA-10-TH',
  'MG-DIA-01-TH','MG-DIA-02-TH','MG-DIA-03-TH','MG-DIA-04-TH','MG-DIA-05-TH','MG-DIA-06-TH','MG-DIA-07-TH','MG-DIA-08-TH','MG-DIA-09-TH','MG-DIA-10-TH',
  'MG-DEI-01-TH','MG-DEI-02-TH','MG-DEI-03-TH','MG-DEI-04-TH','MG-DEI-05-TH','MG-DEI-06-TH','MG-DEI-07-TH','MG-DEI-08-TH','MG-DEI-09-TH','MG-DEI-10-TH',
  'MG-ECH-01-TH','MG-ECH-02-TH','MG-ECH-03-TH','MG-ECH-04-TH','MG-ECH-05-TH','MG-ECH-06-TH','MG-ECH-07-TH','MG-ECH-08-TH','MG-ECH-09-TH','MG-ECH-10-TH',
  'MG-EXE-01-TH','MG-EXE-02-TH','MG-EXE-03-TH','MG-EXE-04-TH','MG-EXE-05-TH','MG-EXE-06-TH','MG-EXE-07-TH','MG-EXE-08-TH','MG-EXE-09-TH','MG-EXE-10-TH',
  'MG-FAM-01-TH','MG-FAM-02-TH','MG-FAM-03-TH','MG-FAM-04-TH','MG-FAM-05-TH','MG-FAM-06-TH','MG-FAM-07-TH','MG-FAM-08-TH','MG-FAM-09-TH','MG-FAM-10-TH',
  'MG-FEE-01-TH','MG-FEE-02-TH','MG-FEE-03-TH','MG-FEE-04-TH','MG-FEE-05-TH','MG-FEE-06-TH','MG-FEE-07-TH','MG-FEE-08-TH','MG-FEE-09-TH','MG-FEE-10-TH',
  'MG-FEV-01-TH','MG-FEV-02-TH','MG-FEV-03-TH','MG-FEV-04-TH','MG-FEV-05-TH','MG-FEV-06-TH','MG-FEV-07-TH','MG-FEV-08-TH','MG-FEV-09-TH','MG-FEV-10-TH',
  'MG-FIV-01-TH','MG-FIV-02-TH','MG-FIV-03-TH','MG-FIV-04-TH','MG-FIV-05-TH','MG-FIV-06-TH','MG-FIV-07-TH','MG-FIV-08-TH','MG-FIV-09-TH','MG-FIV-10-TH',
  'MG-INN-01-TH','MG-INN-02-TH','MG-INN-03-TH','MG-INN-04-TH','MG-INN-05-TH','MG-INN-06-TH','MG-INN-07-TH','MG-INN-08-TH','MG-INN-09-TH','MG-INN-10-TH',
  'MG-LLS-01-TH','MG-LLS-02-TH','MG-LLS-03-TH','MG-LLS-04-TH','MG-LLS-05-TH','MG-LLS-06-TH','MG-LLS-07-TH','MG-LLS-08-TH','MG-LLS-09-TH','MG-LLS-10-TH',
  'MG-MUR-01-TH','MG-MUR-02-TH','MG-MUR-03-TH','MG-MUR-04-TH','MG-MUR-05-TH','MG-MUR-06-TH','MG-MUR-07-TH','MG-MUR-08-TH','MG-MUR-09-TH','MG-MUR-10-TH',
  'MG-NOI-01-TH','MG-NOI-02-TH','MG-NOI-03-TH','MG-NOI-04-TH','MG-NOI-05-TH','MG-NOI-06-TH','MG-NOI-07-TH','MG-NOI-08-TH','MG-NOI-09-TH','MG-NOI-10-TH',
  'MG-POS-01-TH','MG-POS-02-TH','MG-POS-03-TH','MG-POS-04-TH','MG-POS-05-TH','MG-POS-06-TH','MG-POS-07-TH','MG-POS-08-TH','MG-POS-09-TH','MG-POS-10-TH',
  'MG-RBS-01-TH','MG-RBS-02-TH','MG-RBS-03-TH','MG-RBS-04-TH','MG-RBS-05-TH','MG-RBS-06-TH','MG-RBS-07-TH','MG-RBS-08-TH','MG-RBS-09-TH','MG-RBS-10-TH',
  'MG-RHD-01-TH','MG-RHD-02-TH','MG-RHD-03-TH','MG-RHD-04-TH','MG-RHD-05-TH','MG-RHD-06-TH','MG-RHD-07-TH','MG-RHD-08-TH','MG-RHD-09-TH','MG-RHD-10-TH',
  'MG-RHB-01-TH','MG-RHB-02-TH','MG-RHB-03-TH','MG-RHB-04-TH','MG-RHB-05-TH','MG-RHB-06-TH','MG-RHB-07-TH','MG-RHB-08-TH','MG-RHB-09-TH','MG-RHB-10-TH',
  'MG-SEC-01-TH','MG-SEC-02-TH','MG-SEC-03-TH','MG-SEC-04-TH','MG-SEC-05-TH','MG-SEC-06-TH','MG-SEC-07-TH','MG-SEC-08-TH','MG-SEC-09-TH','MG-SEC-10-TH',
  'MG-SOH-01-TH','MG-SOH-02-TH','MG-SOH-03-TH','MG-SOH-04-TH','MG-SOH-05-TH','MG-SOH-06-TH','MG-SOH-07-TH','MG-SOH-08-TH','MG-SOH-09-TH','MG-SOH-10-TH',
  'MG-SOP-01-TH','MG-SOP-02-TH','MG-SOP-03-TH','MG-SOP-04-TH','MG-SOP-05-TH','MG-SOP-06-TH','MG-SOP-07-TH','MG-SOP-08-TH','MG-SOP-09-TH','MG-SOP-10-TH',
  'MG-SYS-01-TH','MG-SYS-02-TH','MG-SYS-03-TH','MG-SYS-04-TH','MG-SYS-05-TH','MG-SYS-06-TH','MG-SYS-07-TH','MG-SYS-08-TH','MG-SYS-09-TH','MG-SYS-10-TH',
  'MG-THR-01-TH','MG-THR-02-TH','MG-THR-03-TH','MG-THR-04-TH','MG-THR-05-TH','MG-THR-06-TH','MG-THR-07-TH','MG-THR-08-TH','MG-THR-09-TH','MG-THR-10-TH',
];

export const DEFAULT_APP_TIMEZONE = 'Asia/Kolkata';

export interface SelectDailyQuestionsParams {
  pool: (Question | Record<string, any>)[];
  lifetimeCompletedQuestionIds?: string[];
  count?: number; // Default 10, max 10
}

export interface SelectDailyQuestionsResult {
  selectedQuestionIds: string[];
  selectedQuestions: Question[];
  remainingUncompletedCount: number;
  isCurriculumCompleted: boolean;
  totalEligibleCount: number;
}

/**
 * Extracts question ID consistently from domain model or raw record.
 */
function getQuestionId(q: Record<string, any>): string {
  return q.question_id || q.Question_ID || q.questionId || '';
}

/**
 * Extracts topic consistently from domain model or raw record.
 */
function getTopic(q: Record<string, any>): string {
  return q.topic || q.Topic || '';
}

/**
 * Extracts difficulty rank consistently (1 to 10).
 */
function getDifficultyRank(q: Record<string, any>): number {
  return Number(q.difficulty_rank ?? q.Difficulty_Rank ?? q.difficultyRank ?? 1);
}

/**
 * Checks whether a record is a Primary (Main) question.
 */
function isPrimaryQuestion(q: Record<string, any>): boolean {
  const t = q.question_type || q.Question_Type || q.questionType;
  return t === 'Primary';
}

/**
 * Deterministically selects up to 10 uncompleted Main questions for a daily session.
 *
 * Sorting Rules (Deterministic Curriculum Progression):
 * 1. Primary: Topic sequence matching AUTHORITATIVE_TOPIC_SEQUENCE index (0 to 30).
 * 2. Secondary: Difficulty Rank ascending (1 to 10).
 * 3. Tie-breaker: Question ID lexical ascending (localeCompare).
 *
 * Boundary Rules:
 * - Excludes any question ID present in lifetimeCompletedQuestionIds.
 * - Never includes Follow-Up questions.
 * - Never fabricates replacement questions or duplicates.
 * - If fewer than 10 remain, returns all remaining uncompleted questions.
 * - If 0 remain, returns empty selection and isCurriculumCompleted: true.
 */
export function selectDailyMainQuestions(params: SelectDailyQuestionsParams): SelectDailyQuestionsResult {
  const { pool, lifetimeCompletedQuestionIds, count = 10 } = params;

  if (!Array.isArray(pool)) {
    throw new Error('selectDailyMainQuestions: pool must be an array of questions.');
  }

  const requestedCount = Math.max(1, Math.min(10, count));
  const completedSet = new Set((lifetimeCompletedQuestionIds || []).filter(Boolean));

  // 1. Filter exclusively for Primary questions not yet in learner ledger
  const eligiblePrimaries = pool.filter((q) => {
    if (!isPrimaryQuestion(q)) return false;
    const qId = getQuestionId(q);
    return qId !== '' && !completedSet.has(qId);
  });

  const totalEligibleCount = eligiblePrimaries.length;

  if (totalEligibleCount === 0) {
    return {
      selectedQuestionIds: [],
      selectedQuestions: [],
      remainingUncompletedCount: 0,
      isCurriculumCompleted: true,
      totalEligibleCount: 0,
    };
  }

  // 2. Deterministic sorting
  const topicIndexMap = new Map<string, number>();
  AUTHORITATIVE_TOPIC_SEQUENCE.forEach((topic, idx) => topicIndexMap.set(topic, idx));

  const sorted = [...eligiblePrimaries].sort((a, b) => {
    const topicA = getTopic(a);
    const topicB = getTopic(b);
    const indexA = topicIndexMap.has(topicA) ? topicIndexMap.get(topicA)! : 999;
    const indexB = topicIndexMap.has(topicB) ? topicIndexMap.get(topicB)! : 999;

    // 1. Topic sequence order
    if (indexA !== indexB) {
      return indexA - indexB;
    }

    // Fallback topic alphabetical sort if unlisted
    if (indexA === 999 && topicA !== topicB) {
      return topicA.localeCompare(topicB);
    }

    // 2. Difficulty Rank (1 to 10)
    const rankA = getDifficultyRank(a);
    const rankB = getDifficultyRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 3. Stable Tie-breaker: Question ID lexical ascending
    const idA = getQuestionId(a);
    const idB = getQuestionId(b);
    return idA.localeCompare(idB);
  });

  // 3. Select up to requestedCount questions
  const selected = sorted.slice(0, requestedCount) as Question[];
  const selectedQuestionIds = selected.map((q) => getQuestionId(q));
  const remainingUncompletedCount = Math.max(0, totalEligibleCount - selected.length);

  return {
    selectedQuestionIds,
    selectedQuestions: selected,
    remainingUncompletedCount,
    isCurriculumCompleted: false,
    totalEligibleCount,
  };
}

export interface SelectAdaptiveDailyQuestionsParams {
  pool: (Question | Record<string, any>)[];
  topicQueue?: string[];
  lifetimeCompletedQuestionIds?: string[];
  count?: number; // Default 10, max 10
}

export interface SelectAdaptiveDailyQuestionsResult {
  selectedQuestionIds: string[];
  selectedQuestions: Question[];
  selectedTopics: string[];
  remainingUncompletedCount: number;
  isCurriculumCompleted: boolean;
  totalEligibleCount: number;
  exhaustedTopics: string[];
}

/**
 * Selects up to 10 independent Primary questions across distinct topics
 * governed by the user's persistent 31-topic round-robin queue.
 *
 * Requirements enforced:
 * 1. 10 independent slots belong to 10 distinct topics (same-session uniqueness).
 * 2. Questions chosen are uncompleted Primary questions for that topic (lowest difficulty rank ascending).
 * 3. Fallback policy: When a topic has no eligible uncompleted questions, it is marked exhausted
 *    and the engine advances to the next topic in the queue. Mastered/completed questions are NEVER
 *    silently reused, preserving curriculum completion semantics and zero XP inflation.
 * 4. Preserves topic queue ordering.
 */
export function selectAdaptiveQueueDailyQuestions(
  params: SelectAdaptiveDailyQuestionsParams
): SelectAdaptiveDailyQuestionsResult {
  const { pool, topicQueue, lifetimeCompletedQuestionIds, count = 10 } = params;

  if (!Array.isArray(pool)) {
    throw new Error('selectAdaptiveQueueDailyQuestions: pool must be an array of questions.');
  }

  const requestedCount = Math.max(1, Math.min(10, count));
  const completedSet = new Set((lifetimeCompletedQuestionIds || []).filter(Boolean));

  // Build clean, deduplicated topicQueue starting with user's queue or CANONICAL_31_TOPIC_SEQUENCE
  const queueToProcess: string[] = [];
  const seenTopics = new Set<string>();

  if (Array.isArray(topicQueue) && topicQueue.length > 0) {
    for (const t of topicQueue) {
      const canonical = normalizeToCanonicalTopic(t);
      if (canonical && !seenTopics.has(canonical)) {
        queueToProcess.push(canonical);
        seenTopics.add(canonical);
      }
    }
  }

  // Ensure all 31 canonical topics are present in the queue
  for (const t of CANONICAL_31_TOPIC_SEQUENCE) {
    if (!seenTopics.has(t)) {
      queueToProcess.push(t);
      seenTopics.add(t);
    }
  }

  // Group pool Primary questions by canonical topic
  const topicPrimaryMap = new Map<string, { uncompleted: Question[]; completed: Question[] }>();
  for (const t of CANONICAL_31_TOPIC_SEQUENCE) {
    topicPrimaryMap.set(t, { uncompleted: [], completed: [] });
  }

  let totalEligiblePrimaries = 0;

  for (const q of pool) {
    if (!isPrimaryQuestion(q)) continue;
    const rawTopic = getTopic(q);
    const canonicalTopic = normalizeToCanonicalTopic(rawTopic);
    const qId = getQuestionId(q);
    if (!qId) continue;

    if (!topicPrimaryMap.has(canonicalTopic)) {
      topicPrimaryMap.set(canonicalTopic, { uncompleted: [], completed: [] });
    }

    const group = topicPrimaryMap.get(canonicalTopic)!;
    if (completedSet.has(qId)) {
      group.completed.push(q as Question);
    } else {
      group.uncompleted.push(q as Question);
      totalEligiblePrimaries++;
    }
  }

  // Sort each topic's questions: difficulty rank ascending, then lexical question_id tie-breaker
  for (const group of topicPrimaryMap.values()) {
    const comparator = (a: Question, b: Question) => {
      const rankA = getDifficultyRank(a);
      const rankB = getDifficultyRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return getQuestionId(a).localeCompare(getQuestionId(b));
    };
    group.uncompleted.sort(comparator);
    group.completed.sort(comparator);
  }

  // Select up to requestedCount questions, strictly 1 per distinct topic
  const selectedQuestions: Question[] = [];
  const selectedQuestionIds: string[] = [];
  const selectedTopics: string[] = [];
  const exhaustedTopics: string[] = [];

  for (const topic of queueToProcess) {
    if (selectedQuestions.length >= requestedCount) break;

    const group = topicPrimaryMap.get(topic);
    if (!group || group.uncompleted.length === 0) {
      // Topic has no eligible uncompleted Primary questions (all completed or none exist)
      exhaustedTopics.push(topic);
      // DO NOT silently reuse a completed question! Continue to next topic in queue.
      continue;
    }

    // Pick lowest difficulty rank uncompleted question
    const chosenQuestion = group.uncompleted[0];
    selectedQuestions.push(chosenQuestion);
    selectedQuestionIds.push(getQuestionId(chosenQuestion));
    selectedTopics.push(topic);
  }

  const remainingUncompletedCount = Math.max(0, totalEligiblePrimaries - selectedQuestions.length);
  const isCurriculumCompleted = totalEligiblePrimaries === 0;

  return {
    selectedQuestionIds,
    selectedQuestions,
    selectedTopics,
    remainingUncompletedCount,
    isCurriculumCompleted,
    totalEligibleCount: totalEligiblePrimaries,
    exhaustedTopics,
  };
}

export interface LineageValidationError {
  code:
    | 'MISSING_PARENT_REFERENCE'
    | 'PARENT_NOT_FOUND'
    | 'PARENT_NOT_PRIMARY'
    | 'CHILD_NOT_FOLLOW_UP'
    | 'TOPIC_MISMATCH'
    | 'DIFFICULTY_RANK_MISMATCH'
    | 'DUPLICATE_PARENT_LINK'
    | 'ORPHAN_MAIN_QUESTION';
  mainQuestionId?: string;
  followUpQuestionId?: string;
  message: string;
}

export interface FollowUpLineageValidationResult {
  isValid: boolean;
  totalQuestions: number;
  mainQuestionCount: number;
  followUpQuestionCount: number;
  validLineagePairsCount: number;
  errors: LineageValidationError[];
  warnings: string[];
}

/**
 * Validates 1:1 Primary to Follow-Up relationships across a dataset.
 *
 * Enforces:
 * - Every Follow-Up has non-null Follow_Up_For referencing an existing Primary question.
 * - Parent question is verified Primary.
 * - Topic matches between parent and follow-up.
 * - Difficulty rank matches between parent and follow-up.
 * - Exactly one Follow-Up points to each Primary question (zero duplicate parents).
 * - Every Primary question has exactly one Follow-Up referencing it (zero orphan primaries).
 */
export function validateFollowUpLineage(questions: (Question | Record<string, any>)[]): FollowUpLineageValidationResult {
  if (!Array.isArray(questions)) {
    throw new Error('validateFollowUpLineage: questions must be an array.');
  }

  const errors: LineageValidationError[] = [];
  const warnings: string[] = [];

  const questionMap = new Map<string, Record<string, any>>();
  const mainQuestions = new Map<string, Record<string, any>>();
  const followUpQuestions: Record<string, any>[] = [];

  for (const q of questions) {
    const qId = getQuestionId(q);
    questionMap.set(qId, q);
    const rec = q as Record<string, any>;
    const qType = rec.question_type || rec.Question_Type || rec.questionType;

    if (qType === 'Primary') {
      mainQuestions.set(qId, q);
    } else if (qType === 'Follow-Up') {
      followUpQuestions.push(q);
    }
  }

  const parentUsageMap = new Map<string, string[]>(); // parentId -> followUpIds[]
  let validPairs = 0;

  for (const fu of followUpQuestions) {
    const fuId = getQuestionId(fu);
    const parentId = fu.follow_up_for || fu.Follow_Up_For || fu.followUpFor || null;

    if (!parentId) {
      errors.push({
        code: 'MISSING_PARENT_REFERENCE',
        followUpQuestionId: fuId,
        message: `Follow-Up question '${fuId}' has null or empty parent reference (Follow_Up_For).`,
      });
      continue;
    }

    const parent = questionMap.get(parentId);
    if (!parent) {
      errors.push({
        code: 'PARENT_NOT_FOUND',
        followUpQuestionId: fuId,
        mainQuestionId: parentId,
        message: `Follow-Up question '${fuId}' references non-existent parent '${parentId}'.`,
      });
      continue;
    }

    const parentType = parent.question_type || parent.Question_Type || parent.questionType;
    if (parentType !== 'Primary') {
      errors.push({
        code: 'PARENT_NOT_PRIMARY',
        followUpQuestionId: fuId,
        mainQuestionId: parentId,
        message: `Parent question '${parentId}' of follow-up '${fuId}' is not of type 'Primary' (found '${parentType}').`,
      });
      continue;
    }

    // Verify Topic consistency
    const fuTopic = getTopic(fu);
    const parentTopic = getTopic(parent);
    if (fuTopic !== parentTopic) {
      errors.push({
        code: 'TOPIC_MISMATCH',
        followUpQuestionId: fuId,
        mainQuestionId: parentId,
        message: `Cross-topic parent link: Follow-Up '${fuId}' (${fuTopic}) references parent '${parentId}' (${parentTopic}).`,
      });
    }

    // Verify Difficulty Rank consistency
    const fuRank = getDifficultyRank(fu);
    const parentRank = getDifficultyRank(parent);
    if (fuRank !== parentRank) {
      errors.push({
        code: 'DIFFICULTY_RANK_MISMATCH',
        followUpQuestionId: fuId,
        mainQuestionId: parentId,
        message: `Difficulty rank mismatch: Follow-Up '${fuId}' (rank ${fuRank}) references parent '${parentId}' (rank ${parentRank}).`,
      });
    }

    // Track duplicate parent references
    const existingChildren = parentUsageMap.get(parentId) || [];
    existingChildren.push(fuId);
    parentUsageMap.set(parentId, existingChildren);

    if (fuTopic === parentTopic && fuRank === parentRank) {
      validPairs++;
    }
  }

  // Detect duplicate parent linkages
  for (const [parentId, childIds] of parentUsageMap.entries()) {
    if (childIds.length > 1) {
      errors.push({
        code: 'DUPLICATE_PARENT_LINK',
        mainQuestionId: parentId,
        message: `Primary question '${parentId}' is referenced by multiple follow-ups: ${childIds.join(', ')}.`,
      });
    }
  }

  // Detect orphan Primary questions without any Follow-Up
  for (const [mainId] of mainQuestions.entries()) {
    if (!parentUsageMap.has(mainId)) {
      errors.push({
        code: 'ORPHAN_MAIN_QUESTION',
        mainQuestionId: mainId,
        message: `Primary question '${mainId}' has no linked remedial follow-up question.`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    totalQuestions: questions.length,
    mainQuestionCount: mainQuestions.size,
    followUpQuestionCount: followUpQuestions.length,
    validLineagePairsCount: validPairs,
    errors,
    warnings,
  };
}

// -------------------------------------------------------------
// Legacy Day-Parity Question Selection (Preserved for Backward Compatibility)
// -------------------------------------------------------------

export const REL_V1_0_0_QUESTIONS: ReleaseQuestionMetadata[] = [
  { questionId: 'MG-AIL-01-TH', questionType: 'Primary', difficultyRank: 1 },
  { questionId: 'MG-AIL-01-PR', questionType: 'Follow-Up', difficultyRank: 1 },
  { questionId: 'MG-AIL-02-TH', questionType: 'Primary', difficultyRank: 2 },
  { questionId: 'MG-AIL-02-PR', questionType: 'Follow-Up', difficultyRank: 2 },
  { questionId: 'MG-AIL-03-TH', questionType: 'Primary', difficultyRank: 3 },
  { questionId: 'MG-AIL-03-PR', questionType: 'Follow-Up', difficultyRank: 3 },
  { questionId: 'MG-AIL-04-TH', questionType: 'Primary', difficultyRank: 4 },
  { questionId: 'MG-AIL-04-PR', questionType: 'Follow-Up', difficultyRank: 4 },
  { questionId: 'MG-AIL-05-TH', questionType: 'Primary', difficultyRank: 5 },
  { questionId: 'MG-AIL-05-PR', questionType: 'Follow-Up', difficultyRank: 5 },
  { questionId: 'MG-AIL-06-TH', questionType: 'Primary', difficultyRank: 6 },
  { questionId: 'MG-AIL-06-PR', questionType: 'Follow-Up', difficultyRank: 6 },
  { questionId: 'MG-AIL-07-TH', questionType: 'Primary', difficultyRank: 7 },
  { questionId: 'MG-AIL-07-PR', questionType: 'Follow-Up', difficultyRank: 7 },
  { questionId: 'MG-AIL-08-TH', questionType: 'Primary', difficultyRank: 8 },
  { questionId: 'MG-AIL-08-PR', questionType: 'Follow-Up', difficultyRank: 8 },
  { questionId: 'MG-AIL-09-TH', questionType: 'Primary', difficultyRank: 9 },
  { questionId: 'MG-AIL-09-PR', questionType: 'Follow-Up', difficultyRank: 9 },
  { questionId: 'MG-AIL-10-TH', questionType: 'Primary', difficultyRank: 10 },
  { questionId: 'MG-AIL-10-PR', questionType: 'Follow-Up', difficultyRank: 10 },
];

export function getResolvedCalendarDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function computeDayParity(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const timeMs = dateObj.getTime();
  const dayNumber = Math.floor(timeMs / (1000 * 60 * 60 * 24));
  return Math.abs(dayNumber) % 2;
}

export function selectSessionQuestions(
  dateStr: string,
  pool: ReleaseQuestionMetadata[] = REL_V1_0_0_QUESTIONS
): string[] {
  if (!dateStr) {
    throw new Error('dateStr is required for deterministic session selection.');
  }

  const parity = computeDayParity(dateStr);
  const targetType = parity === 0 ? 'Primary' : 'Follow-Up';

  const set = pool
    .filter((q) => q.questionType === targetType)
    .sort((a, b) => a.difficultyRank - b.difficultyRank);

  if (set.length !== 10) {
    throw new Error(
      `Dataset configuration error: Expected exactly 10 questions for type '${targetType}', found ${set.length}.`
    );
  }

  return set.map((q) => q.questionId);
}
