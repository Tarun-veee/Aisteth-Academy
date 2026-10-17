/**
 * AiSteth Academy - Curriculum Dataset Validator
 * Performs schema, lineage, and integrity verification on the authoritative questionnaire dataset.
 * Distinguishes between hard validation errors and diagnostic content-review warnings.
 * Never automatically mutates or repairs relationships.
 */

export interface DatasetValidationIssue {
  type: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  questionId?: string;
  topic?: string;
}

export interface DatasetValidationResult {
  isValid: boolean;
  totalQuestions: number;
  totalTopics: number;
  primaryCount: number;
  followUpCount: number;
  errors: DatasetValidationIssue[];
  warnings: DatasetValidationIssue[];
}

export const REQUIRED_DATASET_FIELDS = [
  'Question_ID',
  'Topic',
  'Question_Type',
  'Difficulty_Rank',
  'Follow_Up_For',
  'Audience',
  'Question',
  'Option_A',
  'Option_B',
  'Option_C',
  'Option_D',
  'Correct',
  'Explanation',
  'Action',
  'MedGemma_Tag',
] as const;

export function validateQuestionDataset(rawQuestions: any[]): DatasetValidationResult {
  const errors: DatasetValidationIssue[] = [];
  const warnings: DatasetValidationIssue[] = [];

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    errors.push({
      type: 'ERROR',
      code: 'EMPTY_DATASET',
      message: 'Dataset must be a non-empty array of question objects.',
    });
    return {
      isValid: false,
      totalQuestions: 0,
      totalTopics: 0,
      primaryCount: 0,
      followUpCount: 0,
      errors,
      warnings,
    };
  }

  const idMap = new Map<string, any>();
  const parentReferenceCounts = new Map<string, string[]>();
  const topics = new Set<string>();
  let primaryCount = 0;
  let followUpCount = 0;

  // Pass 1: ID uniqueness, required fields, and type validity
  for (let index = 0; index < rawQuestions.length; index++) {
    const q = rawQuestions[index];
    const qId = q?.Question_ID !== undefined ? String(q.Question_ID).trim() : '';

    if (!qId) {
      errors.push({
        type: 'ERROR',
        code: 'EMPTY_QUESTION_ID',
        message: `Record at index ${index} has an empty or missing Question_ID.`,
      });
      continue;
    }

    if (idMap.has(qId)) {
      errors.push({
        type: 'ERROR',
        code: 'DUPLICATE_QUESTION_ID',
        questionId: qId,
        message: `Duplicate Question_ID '${qId}' found at index ${index}.`,
      });
    } else {
      idMap.set(qId, q);
    }

    if (q.Topic) {
      topics.add(String(q.Topic));
    }

    // Check required fields
    for (const field of REQUIRED_DATASET_FIELDS) {
      if (q[field] === undefined) {
        errors.push({
          type: 'ERROR',
          code: 'MISSING_REQUIRED_FIELD',
          questionId: qId,
          topic: q.Topic,
          message: `Question '${qId}' is missing required field '${field}'.`,
        });
      }
    }

    // Validate Question_Type
    if (q.Question_Type === 'Primary') {
      primaryCount++;
      if (q.Follow_Up_For !== null) {
        errors.push({
          type: 'ERROR',
          code: 'INVALID_PRIMARY_FOLLOW_UP',
          questionId: qId,
          topic: q.Topic,
          message: `Primary question '${qId}' must have Follow_Up_For set to null, but found '${q.Follow_Up_For}'.`,
        });
      }
      if (!qId.endsWith('-TH')) {
        warnings.push({
          type: 'WARNING',
          code: 'SUFFIX_MISMATCH',
          questionId: qId,
          topic: q.Topic,
          message: `Primary question '${qId}' does not use expected theoretical suffix '-TH'.`,
        });
      }
    } else if (q.Question_Type === 'Follow-Up') {
      followUpCount++;
      if (!qId.endsWith('-PR')) {
        warnings.push({
          type: 'WARNING',
          code: 'SUFFIX_MISMATCH',
          questionId: qId,
          topic: q.Topic,
          message: `Follow-Up question '${qId}' does not use expected practical suffix '-PR'.`,
        });
      }
    } else {
      errors.push({
        type: 'ERROR',
        code: 'INVALID_QUESTION_TYPE',
        questionId: qId,
        topic: q.Topic,
        message: `Question '${qId}' has invalid Question_Type '${q.Question_Type}'. Allowed values: 'Primary', 'Follow-Up'.`,
      });
    }
  }

  // Pass 2: Lineage references, hierarchy, and cross-topic verification
  for (const q of rawQuestions) {
    if (q.Question_Type !== 'Follow-Up') continue;

    const qId = q.Question_ID ? String(q.Question_ID).trim() : 'UNKNOWN';
    const parentId = q.Follow_Up_For !== undefined && q.Follow_Up_For !== null
      ? String(q.Follow_Up_For).trim()
      : null;

    if (!parentId) {
      errors.push({
        type: 'ERROR',
        code: 'MISSING_FOLLOW_UP_PARENT',
        questionId: qId,
        topic: q.Topic,
        message: `Follow-Up question '${qId}' has null or empty Follow_Up_For reference.`,
      });
      continue;
    }

    const parent = idMap.get(parentId);
    if (!parent) {
      errors.push({
        type: 'ERROR',
        code: 'NON_EXISTENT_PARENT',
        questionId: qId,
        topic: q.Topic,
        message: `Follow-Up question '${qId}' references non-existent parent ID '${parentId}'.`,
      });
      continue;
    }

    if (parent.Question_Type !== 'Primary') {
      errors.push({
        type: 'ERROR',
        code: 'PARENT_NOT_PRIMARY',
        questionId: qId,
        topic: q.Topic,
        message: `Follow-Up question '${qId}' references parent '${parentId}' which is not a Primary question (type: '${parent.Question_Type}').`,
      });
    }

    if (parent.Topic !== q.Topic) {
      errors.push({
        type: 'ERROR',
        code: 'CROSS_TOPIC_REFERENCE',
        questionId: qId,
        topic: q.Topic,
        message: `Follow-Up question '${qId}' (topic: '${q.Topic}') references parent '${parentId}' in different topic ('${parent.Topic}').`,
      });
    }

    // Track duplicate follow-ups referencing the same parent
    const existing = parentReferenceCounts.get(parentId) || [];
    existing.push(qId);
    parentReferenceCounts.set(parentId, existing);

    // Diagnostic rank check: warning if difficulty ranks differ
    if (parent.Difficulty_Rank !== undefined && q.Difficulty_Rank !== undefined) {
      if (Number(parent.Difficulty_Rank) !== Number(q.Difficulty_Rank)) {
        warnings.push({
          type: 'WARNING',
          code: 'RANK_MISMATCH',
          questionId: qId,
          topic: q.Topic,
          message: `Follow-Up question '${qId}' (rank ${q.Difficulty_Rank}) does not match parent '${parentId}' (rank ${parent.Difficulty_Rank}).`,
        });
      }
    }
  }

  // Report duplicate parent references
  for (const [parentId, childIds] of parentReferenceCounts.entries()) {
    if (childIds.length > 1) {
      errors.push({
        type: 'ERROR',
        code: 'DUPLICATE_FOLLOW_UP_FOR_PARENT',
        message: `Parent question '${parentId}' is referenced by ${childIds.length} follow-up questions: [${childIds.join(', ')}]. Curriculum requires 1:1 mapping.`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    totalQuestions: rawQuestions.length,
    totalTopics: topics.size,
    primaryCount,
    followUpCount,
    errors,
    warnings,
  };
}
