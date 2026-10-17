import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IQuestionRepository } from '../../domain/interfaces/IQuestionRepository.js';
import { Question, MCQQuestion } from '../../domain/models/question.model.js';
import { adminDb } from '../config/firebaseAdmin.js';
import { selectSessionQuestions, selectDailyMainQuestions, getResolvedCalendarDate } from '../../domain/rules/sessionSelection.js';

export type QuestionSourceMode = 'LOCAL_DATASET' | 'FIRESTORE';

export function resolveQuestionDatasetPath(overridePath?: string): string {
  if (overridePath) {
    if (fs.existsSync(overridePath)) return overridePath;
    throw new Error(`[QuestionRepository] Specified dataset override path '${overridePath}' does not exist.`);
  }

  if (process.env.QUESTION_DATASET_PATH) {
    if (fs.existsSync(process.env.QUESTION_DATASET_PATH)) {
      return process.env.QUESTION_DATASET_PATH;
    }
    throw new Error(
      `[QuestionRepository] QUESTION_DATASET_PATH environment variable is set to '${process.env.QUESTION_DATASET_PATH}', but file does not exist.`
    );
  }

  // 1. Check relative to executing module file (robust across arbitrary CWDs)
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const moduleCandidates = [
      // Packaged production build: backend/dist/data/all_topics_questions.json
      path.resolve(currentDir, '../../data/all_topics_questions.json'),
      // Running from backend/src in development: acad/src/data/all_topics_questions.json
      path.resolve(currentDir, '../../../../src/data/all_topics_questions.json'),
      // Running from backend/dist in monorepo: acad/src/data/all_topics_questions.json
      path.resolve(currentDir, '../../../../../src/data/all_topics_questions.json'),
      // Standalone backend root: backend/data/all_topics_questions.json
      path.resolve(currentDir, '../../../data/all_topics_questions.json'),
    ];
    for (const candidate of moduleCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Non-standard runtimes or URL resolution errors
  }

  // 2. Check relative to process.cwd() as secondary fallback
  const cwdCandidates = [
    path.resolve(process.cwd(), 'src/data/all_topics_questions.json'),
    path.resolve(process.cwd(), '../src/data/all_topics_questions.json'),
    path.resolve(process.cwd(), 'dist/data/all_topics_questions.json'),
    path.resolve(process.cwd(), 'data/all_topics_questions.json'),
  ];
  for (const candidate of cwdCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    '[QuestionRepository] Fatal: Authoritative curriculum dataset not found at src/data/all_topics_questions.json. Run backend build or specify QUESTION_DATASET_PATH.'
  );
}

export class FirestoreQuestionRepository implements IQuestionRepository {
  private cache: Question[] | null = null;
  private defaultReleaseId: string;
  private datasetPath?: string;
  private sourceMode: QuestionSourceMode;

  constructor(
    defaultReleaseId: string = 'rel_v1_0_0',
    datasetPath?: string,
    sourceMode: QuestionSourceMode = (process.env.QUESTION_SOURCE as QuestionSourceMode) || 'LOCAL_DATASET'
  ) {
    this.defaultReleaseId = defaultReleaseId;
    this.datasetPath = datasetPath;
    this.sourceMode = sourceMode;
  }

  clearCache(): void {
    this.cache = null;
  }

  loadLocalDataset(customPath?: string): Question[] {
    const filePath = resolveQuestionDatasetPath(customPath || this.datasetPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`[QuestionRepository] Fatal: Dataset file does not exist at '${filePath}'.`);
    }

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch (readErr) {
      throw new Error(
        `[QuestionRepository] Fatal: Failed to read dataset file at '${filePath}': ${(readErr as Error).message}`
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      throw new Error(
        `[QuestionRepository] Fatal: Dataset file at '${filePath}' contains malformed JSON: ${(parseErr as Error).message}`
      );
    }

    const rawQuestions: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    if (rawQuestions.length === 0) {
      throw new Error(`[QuestionRepository] Fatal: Dataset at '${filePath}' contains 0 questions.`);
    }

    return rawQuestions.map((q) => this.mapFirestoreDocToQuestion(q));
  }

  async loadFromFirestore(releaseId: string = this.defaultReleaseId): Promise<Question[]> {
    try {
      const snap = await adminDb.collection(`contentReleases/${releaseId}/questions`).get();
      const questions: Question[] = [];
      snap.forEach((docSnap) => {
        questions.push(this.mapFirestoreDocToQuestion(docSnap.data()));
      });
      return questions;
    } catch (err) {
      console.warn(`[QuestionRepository] Error loading questions from Firestore (${releaseId}):`, err);
      return [];
    }
  }

  mapFirestoreDocToQuestion(data: Record<string, any>): Question {
    const rawQuestionType = data.Question_Type || data.question_type || 'Primary';
    const normalizedQuestionType: 'Primary' | 'Follow-Up' =
      rawQuestionType === 'Follow-Up' || rawQuestionType === 'FOLLOW_UP' ? 'Follow-Up' : 'Primary';

    const followUpFor = data.Follow_Up_For !== undefined
      ? data.Follow_Up_For
      : (data.follow_up_for !== undefined ? data.follow_up_for : null);

    const topic = data.Topic || data.topic || 'AI limitation';
    const rank = Number(data.Difficulty_Rank || data.difficulty_rank || 1);
    const audience = data.Audience || data.audience || 'RBSK';
    const action = data.Action || data.action || '';
    const learningObjective = data.learning_objective || data.learningObjective || '';
    const medGemmaTag = data.MedGemma_Tag || data.medGemma_tag || data.medGemmaTag || '';

    if (data.type && data.question_id) {
      return {
        ...data,
        question_type: normalizedQuestionType,
        follow_up_for: followUpFor,
        Question_Type: normalizedQuestionType,
        Follow_Up_For: followUpFor,
        topic,
        Topic: topic,
        difficulty_rank: rank,
        Difficulty_Rank: rank,
        audience,
        Audience: audience,
        action,
        Action: action,
        learning_objective: learningObjective,
        medGemma_tag: medGemmaTag,
        MedGemma_Tag: medGemmaTag,
      } as Question;
    }

    const qId = data.Question_ID || data.question_id || 'UNKNOWN';
    const correctLetter = (data.Correct || data.correct || 'A').toUpperCase();
    const correctKey = `option_${correctLetter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';

    const mcq: MCQQuestion = {
      question_id: qId,
      type: 'MCQ',
      category: data.category || 'HEART_RECORDING',
      difficulty: rank <= 3 ? 'BEGINNER' : rank <= 7 ? 'INTERMEDIATE' : 'ADVANCED',
      question: data.Question || data.question || '',
      explanation: data.Explanation || data.explanation || '',
      learning_objective: learningObjective,
      action: action || undefined,
      Action: action || undefined,
      tags: [topic, medGemmaTag].filter(Boolean),
      clinician_validated: true,
      source: 'MEDGEMMA',
      version: '1.0.0',
      option_a: data.Option_A || data.option_a || '',
      option_b: data.Option_B || data.option_b || '',
      option_c: data.Option_C || data.option_c || '',
      option_d: data.Option_D || data.option_d || '',
      correct_answer: correctKey,
      question_type: normalizedQuestionType,
      follow_up_for: followUpFor,
      difficulty_rank: rank,
      Difficulty_Rank: rank,
      topic,
      Topic: topic,
      audience,
      Audience: audience,
      medGemma_tag: medGemmaTag,
    };

    return mcq;
  }

  async getFollowUpQuestion(mainQuestionId: string, releaseId: string = this.defaultReleaseId): Promise<Question | null> {
    if (!mainQuestionId || typeof mainQuestionId !== 'string' || mainQuestionId.trim() === '') {
      return null;
    }

    const allQuestions = await this.getAllQuestions(releaseId);

    // Look up strictly by explicit parent linkage (Follow_Up_For === mainQuestionId)
    // NEVER invent links via suffix matching or topic/rank similarity
    const matching = allQuestions.filter(
      (q) => q.follow_up_for === mainQuestionId || q.Follow_Up_For === mainQuestionId
    );

    if (matching.length === 0) {
      return null;
    }

    if (matching.length === 1) {
      return matching[0];
    }

    // Multiple follow-up questions explicitly reference the same parent.
    // 1. Log diagnostic warning with candidate IDs (not silent).
    console.warn(
      `[QuestionRepository] Duplicate parent reference detected: ${matching.length} follow-up questions (${matching.map((m) => m.question_id).join(', ')}) explicitly reference parent '${mainQuestionId}'. Applying deterministic disambiguation.`
    );

    // 2. Deterministic disambiguation:
    // If the parent question exists in the dataset, prefer the candidate matching the parent's difficulty rank.
    const parentQuestion = allQuestions.find((q) => q.question_id === mainQuestionId);
    if (parentQuestion && parentQuestion.difficulty_rank !== undefined) {
      const rankMatched = matching.find((m) => m.difficulty_rank === parentQuestion.difficulty_rank);
      if (rankMatched) {
        return rankMatched;
      }
    }

    // Stable tie-breaker: sort by difficulty_rank asc, then question_id asc
    const sorted = [...matching].sort((a, b) => {
      const rankDiff = (a.difficulty_rank || 0) - (b.difficulty_rank || 0);
      if (rankDiff !== 0) return rankDiff;
      return a.question_id.localeCompare(b.question_id);
    });

    return sorted[0];
  }

  async getAllQuestions(releaseId: string = this.defaultReleaseId): Promise<Question[]> {
    if (this.cache && this.cache.length > 0) {
      return [...this.cache];
    }

    // If explicit FIRESTORE source mode configured
    if (this.sourceMode === 'FIRESTORE') {
      const firestoreQuestions = await this.loadFromFirestore(releaseId);
      if (firestoreQuestions.length > 0) {
        this.cache = firestoreQuestions;
        return [...this.cache];
      }
      return [];
    }

    // Authoritative Local Dataset Mode (Default):
    // Must NOT silently degrade to Firestore or return an empty array if dataset is invalid.
    try {
      const localQuestions = this.loadLocalDataset();
      this.cache = localQuestions;
      return [...this.cache];
    } catch (err) {
      console.error('[QuestionRepository] Critical: Failed to load authoritative curriculum dataset:', err);
      throw err;
    }
  }

  async getQuestionById(questionId: string, releaseId: string = this.defaultReleaseId): Promise<Question | null> {
    if (!questionId) return null;

    if (this.cache) {
      const found = this.cache.find((q) => q.question_id === questionId);
      if (found) return found;
    }

    const all = await this.getAllQuestions(releaseId);
    if (all.length > 0) {
      const found = all.find((q) => q.question_id === questionId);
      return found || null;
    }

    try {
      const docSnap = await adminDb.doc(`contentReleases/${releaseId}/questions/${questionId}`).get();
      if (docSnap.exists) {
        return this.mapFirestoreDocToQuestion(docSnap.data()!);
      }
    } catch (err) {
      console.warn(`[FirestoreQuestionRepository] Error loading question ${questionId}:`, err);
    }

    return null;
  }

  async getSessionQuestions(dateStr: string = getResolvedCalendarDate(), count: number = 10): Promise<Question[]> {
    const selectedIds = selectSessionQuestions(dateStr);
    const all = await this.getAllQuestions();
    const map = new Map<string, Question>(all.map((q) => [q.question_id, q]));

    const result: Question[] = [];
    for (const qId of selectedIds) {
      const found = map.get(qId);
      if (found) {
        result.push(found);
      }
    }

    return result.length > 0 ? result.slice(0, count) : all.slice(0, count);
  }

  async getDailyMainQuestions(
    lifetimeCompletedQuestionIds?: string[],
    count: number = 10,
    releaseId: string = this.defaultReleaseId
  ): Promise<Question[]> {
    const all = await this.getAllQuestions(releaseId);
    const selection = selectDailyMainQuestions({
      pool: all,
      lifetimeCompletedQuestionIds,
      count,
    });
    return selection.selectedQuestions;
  }
}

// Clean architecture alias: LocalDatasetQuestionRepository
export { FirestoreQuestionRepository as LocalDatasetQuestionRepository };

export const defaultQuestionRepository = new FirestoreQuestionRepository();
