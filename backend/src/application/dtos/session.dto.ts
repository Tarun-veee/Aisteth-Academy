import { DailySessionDoc, UserStats } from '../../domain/models/session.model.js';
import { Question, AnswerEvaluationResult, UserAnswerPayload, SafeQuestionDTO } from '../../domain/models/question.model.js';

export interface TodaySessionResponseDTO {
  session: DailySessionDoc;
  questions: SafeQuestionDTO[];
}

export interface RecordAttemptRequestDTO {
  sessionId: string;
  questionId: string;
  questionIndex: number;
  userAnswerPayload: UserAnswerPayload;
  powerUpsActive?: string[];
  idempotencyKey?: string;
  selectedOption?: any;
  branchState?: import('../../domain/models/session.model.js').BranchState;
  /** @deprecated Discarded at runtime — completion is strictly server-authoritative */
  isSessionComplete?: boolean;
}

export interface RecordAttemptResponseDTO {
  success: boolean;
  attemptId: string;
  evaluation: AnswerEvaluationResult;
  questionIndex?: number;
  branchState?: import('../../domain/models/session.model.js').BranchState;
  result?: 'CORRECT' | 'INCORRECT';
  xpAwarded?: number;
  isSessionComplete?: boolean;
  status?: import('../../domain/models/session.model.js').DailySessionStatus;
  questionsCompleted?: boolean;
  currentQuestionIndex?: number;
  totalXpEarned?: number;
  correctCount?: number;
  activeFollowUpQuestionId?: string | null;
}

export interface FinalizeSessionRequestDTO {
  sessionId: string;
  totalXpEarned?: number;
  correctCount?: number;
  totalQuestions?: number;
}

export interface FinalizeSessionResponseDTO {
  success: boolean;
  alreadyFinalized: boolean;
  updatedStats?: UserStats;
}
