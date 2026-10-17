import { Question, MCQQuestion, QuestionCategory, DifficultyLevel, SafeQuestionDTO } from '../../domain/models/question.model.js';
import { UnsolvedQuestionDoc } from '../../domain/models/session.model.js';
import { CANONICAL_31_TOPIC_SEQUENCE, normalizeToCanonicalTopic } from '../../domain/rules/sessionSelection.js';

export class DataIntegrityError extends Error {
  statusCode = 500;
  constructor(message: string) {
    super(`Data integrity error: ${message}`);
    this.name = 'DataIntegrityError';
  }
}

export function toSafeQuestionDTO(q: Question): SafeQuestionDTO {
  if (!q || typeof q !== 'object') {
    throw new DataIntegrityError('Question entity is null or not an object.');
  }

  // 1. Question ID validation
  const qId = q.question_id;
  if (typeof qId !== 'string' || qId.length === 0) {
    throw new DataIntegrityError('Missing or empty question identifier.');
  }

  const matchesProductionId = /^(L[1-5]|MG)(-[A-Z0-9_]+)+-(TH|PR)$/.test(qId);
  const matchesMockId = /^(q[0-9]+|dummy_[0-9]+|test_[0-9]+)$/.test(qId);
  if (!matchesProductionId && !matchesMockId) {
    throw new DataIntegrityError(`Malformed question identifier format '${qId}'.`);
  }

  // 2. Lineage & Suffix Agreement
  const isPrimary = qId.endsWith('-TH') || (!qId.endsWith('-PR') && q.question_type === 'Primary');
  const isFollowUp = qId.endsWith('-PR') || q.question_type === 'Follow-Up';

  if (qId.endsWith('-TH') && q.question_type === 'Follow-Up') {
    throw new DataIntegrityError(`Question identifier '${qId}' suffix -TH conflicts with Follow-Up question type.`);
  }
  if (qId.endsWith('-PR') && q.question_type === 'Primary') {
    throw new DataIntegrityError(`Question identifier '${qId}' suffix -PR conflicts with Primary question type.`);
  }

  const followUpFor = q.follow_up_for !== undefined ? q.follow_up_for : ((q as any).Follow_Up_For ?? null);

  if (isPrimary) {
    if (followUpFor !== null) {
      throw new DataIntegrityError(`Primary question '${qId}' must have follow_up_for: null, received '${followUpFor}'.`);
    }
  } else {
    if (typeof followUpFor !== 'string' || followUpFor.length === 0) {
      throw new DataIntegrityError(`Follow-Up question '${qId}' must reference a non-empty parent identifier.`);
    }
  }

  // 3. Topic validation against Canonical 31 Sequence
  const rawTopic = q.topic || (q as any).Topic;
  if (typeof rawTopic !== 'string' || rawTopic.length === 0) {
    throw new DataIntegrityError(`Question '${qId}' has missing or empty topic.`);
  }
  const canonicalTopic = normalizeToCanonicalTopic(rawTopic);
  if (!canonicalTopic || !CANONICAL_31_TOPIC_SEQUENCE.includes(canonicalTopic)) {
    throw new DataIntegrityError(`Question '${qId}' topic '${rawTopic}' is not in the canonical 31 curriculum.`);
  }

  // 4. Category validation
  const category = q.category;
  const validCategories: QuestionCategory[] = [
    'DEVICE_HANDLING',
    'HEART_RECORDING',
    'QUALITY_ASSESSMENT',
    'OPERATING_PROCEDURE',
    'ANATOMICAL_PLACEMENT'
  ];
  if (!validCategories.includes(category)) {
    throw new DataIntegrityError(`Question '${qId}' has unrecognized category '${category}'.`);
  }

  // 5. Difficulty validation
  const validDifficulties: DifficultyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  if (!validDifficulties.includes(q.difficulty)) {
    throw new DataIntegrityError(`Question '${qId}' has unrecognized difficulty '${q.difficulty}'.`);
  }

  // 6. Question Stem validation (Verbatim preservation - no trimming)
  if (typeof q.question !== 'string' || q.question.length === 0) {
    throw new DataIntegrityError(`Question '${qId}' has empty question stem.`);
  }

  // 7. Options validation (Verbatim preservation - no trimming)
  const mcq = q as MCQQuestion;
  if (
    typeof mcq.option_a !== 'string' || mcq.option_a.length === 0 ||
    typeof mcq.option_b !== 'string' || mcq.option_b.length === 0 ||
    typeof mcq.option_c !== 'string' || mcq.option_c.length === 0 ||
    typeof mcq.option_d !== 'string' || mcq.option_d.length === 0
  ) {
    throw new DataIntegrityError(`Question '${qId}' is missing one or more MCQ option strings.`);
  }

  return {
    questionId: qId,
    question_id: qId,
    type: q.type,
    topic: canonicalTopic,
    category,
    difficulty: q.difficulty,
    question: q.question,
    options: {
      option_a: mcq.option_a,
      option_b: mcq.option_b,
      option_c: mcq.option_c,
      option_d: mcq.option_d,
    },
    option_a: mcq.option_a,
    option_b: mcq.option_b,
    option_c: mcq.option_c,
    option_d: mcq.option_d,
    questionType: isPrimary ? 'Primary' : 'Follow-Up',
    followUpFor,
    medGemmaTag: q.medGemma_tag || (q as any).MedGemma_Tag || undefined,
  };
}

export interface TodayQuestionsResponseDTO {
  questions: SafeQuestionDTO[];
  date?: string;
}

export interface QuestionDetailsResponseDTO {
  question: SafeQuestionDTO;
}

export interface UnsolvedQuestionItemDTO {
  record: UnsolvedQuestionDoc;
  mainQuestion: Question;
  followUpQuestion: Question | null;
}

export interface GetUnsolvedQuestionsResponseDTO {
  success: boolean;
  unsolvedQuestions: UnsolvedQuestionItemDTO[];
  totalCount: number;
}

export interface UpdateUnsolvedQuestionRequestDTO {
  reviewStatus?: 'UNREVIEWED' | 'IN_REVIEW' | 'REVIEWED' | 'BOOKMARKED';
  reviewNotes?: string;
  isResolved?: boolean;
}

export interface UpdateUnsolvedQuestionResponseDTO {
  success: boolean;
  updatedRecord: UnsolvedQuestionDoc;
}
