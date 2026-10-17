import { DailySessionDoc, AttemptDoc, BranchState, DailySessionStatus, UnsolvedQuestionDoc } from '../models/session.model.js';
import { UserLearningState } from '../models/user.model.js';
import { AnswerEvaluationResult } from '../models/question.model.js';

export interface FinalizeSessionParams {
  uid: string;
  sessionId: string;
  finalXpEarned?: number;
  correctCount?: number;
  totalQuestions?: number;
  todayDateStr: string;
}

export interface FinalizeSessionResult {
  success: boolean;
  alreadyFinalized: boolean;
  updatedLearningState?: UserLearningState;
}

export interface RecordAttemptAtomicParams {
  uid: string;
  sessionId: string;
  questionId: string;
  questionIndex: number;
  userAnswerPayload: Record<string, any>;
  evaluation: AnswerEvaluationResult;
  powerUpsActive?: string[];
  idempotencyKey?: string;
  selectedOption?: any;
}

export interface RecordAttemptAtomicResult {
  attemptId: string;
  currentQuestionIndex: number;
  isSessionComplete: boolean;
  totalXpEarned: number;
  correctCount: number;
  result?: 'CORRECT' | 'INCORRECT';
  xpAwarded?: number;
  branchState?: BranchState;
  status?: DailySessionStatus;
  questionsCompleted?: boolean;
  activeFollowUpQuestionId?: string | null;
}

export interface UpdateUnsolvedQuestionParams {
  reviewStatus?: 'UNREVIEWED' | 'IN_REVIEW' | 'REVIEWED' | 'BOOKMARKED';
  reviewNotes?: string;
  isResolved?: boolean;
}

export interface ISessionRepository {
  getDailySession(uid: string, sessionId: string): Promise<DailySessionDoc | null>;
  createDailySession(session: DailySessionDoc): Promise<void>;
  appendAttempt(attempt: AttemptDoc): Promise<void>;
  updateSessionProgress(uid: string, sessionId: string, updates: Record<string, any>): Promise<void>;
  recordAttemptAtomic(params: RecordAttemptAtomicParams): Promise<RecordAttemptAtomicResult>;
  finalizeSessionAtomic(params: FinalizeSessionParams): Promise<FinalizeSessionResult>;
  getUnsolvedQuestions(uid: string): Promise<UnsolvedQuestionDoc[]>;
  updateUnsolvedQuestion(uid: string, questionId: string, updates: UpdateUnsolvedQuestionParams): Promise<UnsolvedQuestionDoc>;
  getUser(uid: string): Promise<any | null>;
  updateUser(uid: string, updates: Record<string, any>): Promise<void>;
  getActiveDailySession(uid: string): Promise<DailySessionDoc | null>;
  getSessionAttempts(uid: string, sessionId: string): Promise<AttemptDoc[]>;
  reconcileSessionProgressAtomic(uid: string, sessionId: string): Promise<DailySessionDoc>;
}
