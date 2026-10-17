/**
 * AiSteth Academy - Learning Engine Finite State Machine (Phase 2)
 *
 * Implements deterministic branching, single-reattempt remediation loop,
 * authoritative XP calculation boundaries, and unsolved-question tracking.
 *
 * Product Rules (Approved Gate 2):
 * - Decision 1 (Option A): Exactly ONE re-attempt permitted after successful Follow-Up.
 *   - Incorrect Main -> branch to linked Follow-Up.
 *   - Correct Follow-Up (0 XP) -> route back to Main for one re-attempt.
 *   - Correct Main Re-attempt -> 10 XP (if total < 310 & uncompleted), mark completed, advance.
 *   - Incorrect Main Re-attempt -> 0 XP, log to Unsolved Questions Bucket, advance to next Main.
 *   - Incorrect Follow-Up -> 0 XP, log to Unsolved Questions Bucket, advance to next Main.
 * - Decision 2 (Option A):
 *   - 10 XP per uncompleted Main question if total < 310 (including on permitted re-attempt).
 *   - 0 XP if total >= 310 or already in ledger.
 *   - Follow-Ups, incorrect answers, and finalization award 0 XP.
 */

import { BranchState } from '../models/session.model.js';
import { ProgressionService, XpAwardCalculationResult } from './ProgressionService.js';

export type LearningEnginePhase =
  | 'IDLE'
  | 'PRESENTING_MAIN'
  | 'MAIN_FEEDBACK'
  | 'PRESENTING_FOLLOW_UP'
  | 'FOLLOW_UP_FEEDBACK'
  | 'REATTEMPTING_MAIN'
  | 'REATTEMPT_FEEDBACK'
  | 'QUESTIONS_COMPLETED';

export interface UnsolvedQuestionPayload {
  mainQuestionId: string;
  followUpQuestionId: string;
  topic?: string;
  difficultyRank?: number;
  reason: 'FOLLOW_UP_FAILED' | 'REATTEMPT_FAILED';
  timestamp: number;
}

export interface SessionStepHistory {
  questionId: string;
  questionType: 'Primary' | 'Follow-Up';
  branchState: BranchState;
  isReattempt: boolean;
  isCorrect: boolean;
  awardedXp: number;
  timestamp: number;
}

export interface LearningSessionContext {
  sessionId: string;
  uid: string;
  phase: LearningEnginePhase;
  branchState: BranchState;
  currentMainIndex: number;
  totalMainQuestions: number;
  mainQuestionIds: string[];
  activeQuestionId: string;
  activeFollowUpQuestionId: string | null;
  isReattempt: boolean;
  correctCount: number;
  totalXpEarnedInSession: number;
  questionsCompleted: boolean;
  unsolvedQuestionsToLog: UnsolvedQuestionPayload[];
  newlyCompletedMainQuestionIds: string[];
  history: SessionStepHistory[];
  lastEvaluation?: {
    isCorrect: boolean;
    awardedXp: number;
    feedbackMessage: string;
  };
}

export interface InitSessionParams {
  sessionId: string;
  uid: string;
  mainQuestionIds: string[];
  currentMainIndex?: number;
  branchState?: BranchState;
  activeQuestionId?: string;
  activeFollowUpQuestionId?: string | null;
  isReattempt?: boolean;
  correctCount?: number;
  totalXpEarnedInSession?: number;
  questionsCompleted?: boolean;
  newlyCompletedMainQuestionIds?: string[];
  history?: SessionStepHistory[];
}

export type LearningEngineEvent =
  | { type: 'START_SESSION' }
  | {
      type: 'SUBMIT_MAIN_ANSWER';
      questionId: string;
      isCorrect: boolean;
      linkedFollowUpId?: string | null;
      userTotalXp: number;
      lifetimeCompletedQuestionIds?: string[];
    }
  | { type: 'CONTINUE_FROM_MAIN_FEEDBACK' }
  | {
      type: 'SUBMIT_FOLLOW_UP_ANSWER';
      questionId: string;
      isCorrect: boolean;
      topic?: string;
      difficultyRank?: number;
    }
  | { type: 'CONTINUE_FROM_FOLLOW_UP_FEEDBACK' }
  | {
      type: 'SUBMIT_REATTEMPT_ANSWER';
      questionId: string;
      isCorrect: boolean;
      topic?: string;
      difficultyRank?: number;
      userTotalXp: number;
      lifetimeCompletedQuestionIds?: string[];
    }
  | { type: 'CONTINUE_FROM_REATTEMPT_FEEDBACK' };

export class LearningEngineStateMachine {
  private context: LearningSessionContext;

  constructor(params: InitSessionParams) {
    if (!params.sessionId) throw new Error('sessionId is required for LearningEngineStateMachine');
    if (!params.uid) throw new Error('uid is required for LearningEngineStateMachine');
    if (!Array.isArray(params.mainQuestionIds) || params.mainQuestionIds.length === 0) {
      throw new Error('mainQuestionIds must be a non-empty array');
    }

    const currentIndex = params.currentMainIndex ?? 0;
    const branchState = params.branchState ?? 'MAIN';
    const total = params.mainQuestionIds.length;
    const isCompleted = params.questionsCompleted ?? (currentIndex >= total);

    let initialPhase: LearningEnginePhase = 'IDLE';
    if (isCompleted) {
      initialPhase = 'QUESTIONS_COMPLETED';
    } else if (branchState === 'FOLLOW_UP') {
      initialPhase = 'PRESENTING_FOLLOW_UP';
    } else if (branchState === 'REATTEMPT_MAIN') {
      initialPhase = 'REATTEMPTING_MAIN';
    } else {
      initialPhase = currentIndex === 0 && !params.activeQuestionId ? 'IDLE' : 'PRESENTING_MAIN';
    }

    const activeQuestion = params.activeQuestionId
      ? params.activeQuestionId
      : (branchState === 'FOLLOW_UP' && params.activeFollowUpQuestionId)
      ? params.activeFollowUpQuestionId
      : params.mainQuestionIds[Math.min(currentIndex, total - 1)];

    this.context = {
      sessionId: params.sessionId,
      uid: params.uid,
      phase: initialPhase,
      branchState,
      currentMainIndex: currentIndex,
      totalMainQuestions: total,
      mainQuestionIds: [...params.mainQuestionIds],
      activeQuestionId: activeQuestion,
      activeFollowUpQuestionId: params.activeFollowUpQuestionId ?? null,
      isReattempt: params.isReattempt ?? false,
      correctCount: params.correctCount ?? 0,
      totalXpEarnedInSession: params.totalXpEarnedInSession ?? 0,
      questionsCompleted: isCompleted,
      unsolvedQuestionsToLog: [],
      newlyCompletedMainQuestionIds: params.newlyCompletedMainQuestionIds ?? [],
      history: params.history ? [...params.history] : [],
    };
  }

  getContext(): Readonly<LearningSessionContext> {
    return JSON.parse(JSON.stringify(this.context));
  }

  transition(event: LearningEngineEvent): LearningSessionContext {
    if (this.context.questionsCompleted && this.context.phase === 'QUESTIONS_COMPLETED') {
      throw new Error('Session is already completed. No further transitions permitted.');
    }

    switch (event.type) {
      case 'START_SESSION':
        return this.handleStartSession();

      case 'SUBMIT_MAIN_ANSWER':
        return this.handleSubmitMainAnswer(event);

      case 'CONTINUE_FROM_MAIN_FEEDBACK':
        return this.handleContinueFromMainFeedback();

      case 'SUBMIT_FOLLOW_UP_ANSWER':
        return this.handleSubmitFollowUpAnswer(event);

      case 'CONTINUE_FROM_FOLLOW_UP_FEEDBACK':
        return this.handleContinueFromFollowUpFeedback();

      case 'SUBMIT_REATTEMPT_ANSWER':
        return this.handleSubmitReattemptAnswer(event);

      case 'CONTINUE_FROM_REATTEMPT_FEEDBACK':
        return this.handleContinueFromReattemptFeedback();

      default:
        throw new Error(`Unknown event type: ${(event as any).type}`);
    }
  }

  private handleStartSession(): LearningSessionContext {
    if (this.context.phase !== 'IDLE') {
      // Idempotent start if already active
      return this.getContext();
    }
    this.context.phase = 'PRESENTING_MAIN';
    this.context.branchState = 'MAIN';
    this.context.activeQuestionId = this.context.mainQuestionIds[this.context.currentMainIndex];
    this.context.isReattempt = false;
    return this.getContext();
  }

  private handleSubmitMainAnswer(
    event: Extract<LearningEngineEvent, { type: 'SUBMIT_MAIN_ANSWER' }>
  ): LearningSessionContext {
    if (this.context.phase !== 'PRESENTING_MAIN' && this.context.phase !== 'IDLE') {
      throw new Error(`Invalid transition: Cannot submit main answer while in phase '${this.context.phase}'.`);
    }

    const expectedQuestionId = this.context.mainQuestionIds[this.context.currentMainIndex];
    if (event.questionId !== expectedQuestionId) {
      throw new Error(
        `Question mismatch: Expected main question '${expectedQuestionId}' at index ${this.context.currentMainIndex}, received '${event.questionId}'.`
      );
    }

    this.context.phase = 'MAIN_FEEDBACK';

    if (event.isCorrect) {
      // Main answer is correct!
      const xpResult: XpAwardCalculationResult = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: event.userTotalXp,
        questionId: event.questionId,
        lifetimeCompletedQuestionIds: event.lifetimeCompletedQuestionIds,
        isCorrect: true,
      });

      this.context.correctCount += 1;
      this.context.totalXpEarnedInSession += xpResult.awardedXp;
      if (xpResult.isNewlyCompleted && !this.context.newlyCompletedMainQuestionIds.includes(event.questionId)) {
        this.context.newlyCompletedMainQuestionIds.push(event.questionId);
      }

      this.context.lastEvaluation = {
        isCorrect: true,
        awardedXp: xpResult.awardedXp,
        feedbackMessage: 'Correct diagnosis! Excellent work.',
      };

      this.context.history.push({
        questionId: event.questionId,
        questionType: 'Primary',
        branchState: 'MAIN',
        isReattempt: false,
        isCorrect: true,
        awardedXp: xpResult.awardedXp,
        timestamp: Date.now(),
      });
    } else {
      // Main answer is incorrect!
      this.context.lastEvaluation = {
        isCorrect: false,
        awardedXp: 0,
        feedbackMessage: 'Incorrect diagnosis. Let\'s practice with a targeted remedial follow-up.',
      };

      this.context.history.push({
        questionId: event.questionId,
        questionType: 'Primary',
        branchState: 'MAIN',
        isReattempt: false,
        isCorrect: false,
        awardedXp: 0,
        timestamp: Date.now(),
      });

      // Prepare remedial branch link
      this.context.activeFollowUpQuestionId = event.linkedFollowUpId ?? null;
    }

    return this.getContext();
  }

  private handleContinueFromMainFeedback(): LearningSessionContext {
    if (this.context.phase !== 'MAIN_FEEDBACK') {
      throw new Error(`Invalid transition: Cannot continue from main feedback while in phase '${this.context.phase}'.`);
    }

    const lastEval = this.context.lastEvaluation;
    if (lastEval && lastEval.isCorrect) {
      // Correct main question -> advance to next Main question
      return this.advanceToNextMainQuestion();
    } else {
      // Incorrect main question -> branch to remedial follow-up
      if (this.context.activeFollowUpQuestionId) {
        this.context.branchState = 'FOLLOW_UP';
        this.context.phase = 'PRESENTING_FOLLOW_UP';
        this.context.activeQuestionId = this.context.activeFollowUpQuestionId;
        this.context.isReattempt = false;
        return this.getContext();
      } else {
        // Safe fail-safe: if no remedial follow-up configured, advance to next main question
        return this.advanceToNextMainQuestion();
      }
    }
  }

  private handleSubmitFollowUpAnswer(
    event: Extract<LearningEngineEvent, { type: 'SUBMIT_FOLLOW_UP_ANSWER' }>
  ): LearningSessionContext {
    if (this.context.phase !== 'PRESENTING_FOLLOW_UP') {
      throw new Error(`Invalid transition: Cannot submit follow-up while in phase '${this.context.phase}'.`);
    }

    if (this.context.activeFollowUpQuestionId && event.questionId !== this.context.activeFollowUpQuestionId) {
      throw new Error(
        `Question mismatch: Expected follow-up '${this.context.activeFollowUpQuestionId}', received '${event.questionId}'.`
      );
    }

    this.context.phase = 'FOLLOW_UP_FEEDBACK';

    // Follow-up questions always award 0 XP (remedial learning only)
    this.context.history.push({
      questionId: event.questionId,
      questionType: 'Follow-Up',
      branchState: 'FOLLOW_UP',
      isReattempt: false,
      isCorrect: event.isCorrect,
      awardedXp: 0,
      timestamp: Date.now(),
    });

    if (event.isCorrect) {
      // Follow-up answered correctly -> learner earns one re-attempt on the original Main question
      this.context.lastEvaluation = {
        isCorrect: true,
        awardedXp: 0,
        feedbackMessage: 'Great job understanding the practical concept! Now let\'s re-attempt the primary question.',
      };
    } else {
      // Follow-up answered incorrectly -> remediation failed; log to Unsolved Questions Bucket
      const parentMainId = this.context.mainQuestionIds[this.context.currentMainIndex];
      this.context.unsolvedQuestionsToLog.push({
        mainQuestionId: parentMainId,
        followUpQuestionId: event.questionId,
        topic: event.topic,
        difficultyRank: event.difficultyRank,
        reason: 'FOLLOW_UP_FAILED',
        timestamp: Date.now(),
      });

      this.context.lastEvaluation = {
        isCorrect: false,
        awardedXp: 0,
        feedbackMessage: 'Review needed. This clinical concept has been saved to your Unsolved Questions for future practice.',
      };
    }

    return this.getContext();
  }

  private handleContinueFromFollowUpFeedback(): LearningSessionContext {
    if (this.context.phase !== 'FOLLOW_UP_FEEDBACK') {
      throw new Error(`Invalid transition: Cannot continue from follow-up feedback while in phase '${this.context.phase}'.`);
    }

    const lastEval = this.context.lastEvaluation;
    if (lastEval && lastEval.isCorrect) {
      // Follow-up was correct -> Route back to original Main question for exactly ONE re-attempt
      const mainQuestionId = this.context.mainQuestionIds[this.context.currentMainIndex];
      this.context.phase = 'REATTEMPTING_MAIN';
      this.context.branchState = 'REATTEMPT_MAIN';
      this.context.activeQuestionId = mainQuestionId;
      this.context.isReattempt = true;
      return this.getContext();
    } else {
      // Follow-up was incorrect -> Remediation loop ends; advance to next Main question
      return this.advanceToNextMainQuestion();
    }
  }

  private handleSubmitReattemptAnswer(
    event: Extract<LearningEngineEvent, { type: 'SUBMIT_REATTEMPT_ANSWER' }>
  ): LearningSessionContext {
    if (this.context.phase !== 'REATTEMPTING_MAIN') {
      throw new Error(`Invalid transition: Cannot submit re-attempt while in phase '${this.context.phase}'.`);
    }

    const expectedMainId = this.context.mainQuestionIds[this.context.currentMainIndex];
    if (event.questionId !== expectedMainId) {
      throw new Error(
        `Question mismatch: Expected re-attempt for '${expectedMainId}', received '${event.questionId}'.`
      );
    }

    this.context.phase = 'REATTEMPT_FEEDBACK';

    if (event.isCorrect) {
      // Re-attempt solved correctly! Under Decision 2 Option A: award 10 XP if under 310 XP threshold
      const xpResult: XpAwardCalculationResult = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: event.userTotalXp,
        questionId: event.questionId,
        lifetimeCompletedQuestionIds: event.lifetimeCompletedQuestionIds,
        isCorrect: true,
      });

      this.context.correctCount += 1;
      this.context.totalXpEarnedInSession += xpResult.awardedXp;
      if (xpResult.isNewlyCompleted && !this.context.newlyCompletedMainQuestionIds.includes(event.questionId)) {
        this.context.newlyCompletedMainQuestionIds.push(event.questionId);
      }

      this.context.lastEvaluation = {
        isCorrect: true,
        awardedXp: xpResult.awardedXp,
        feedbackMessage: 'Excellent re-attempt! You have successfully mastered this diagnostic concept.',
      };

      this.context.history.push({
        questionId: event.questionId,
        questionType: 'Primary',
        branchState: 'REATTEMPT_MAIN',
        isReattempt: true,
        isCorrect: true,
        awardedXp: xpResult.awardedXp,
        timestamp: Date.now(),
      });
    } else {
      // Re-attempt failed! Exactly one re-attempt permitted; log to Unsolved Questions Bucket
      const followUpId = this.context.activeFollowUpQuestionId || 'unknown_follow_up';
      this.context.unsolvedQuestionsToLog.push({
        mainQuestionId: event.questionId,
        followUpQuestionId: followUpId,
        topic: event.topic,
        difficultyRank: event.difficultyRank,
        reason: 'REATTEMPT_FAILED',
        timestamp: Date.now(),
      });

      this.context.lastEvaluation = {
        isCorrect: false,
        awardedXp: 0,
        feedbackMessage: 'Concept still needs reinforcement. Saved to your Unsolved Questions for further review.',
      };

      this.context.history.push({
        questionId: event.questionId,
        questionType: 'Primary',
        branchState: 'REATTEMPT_MAIN',
        isReattempt: true,
        isCorrect: false,
        awardedXp: 0,
        timestamp: Date.now(),
      });
    }

    return this.getContext();
  }

  private handleContinueFromReattemptFeedback(): LearningSessionContext {
    if (this.context.phase !== 'REATTEMPT_FEEDBACK') {
      throw new Error(`Invalid transition: Cannot continue from reattempt feedback while in phase '${this.context.phase}'.`);
    }

    // Re-attempt is concluded (whether correct or incorrect); advance to next Main question
    return this.advanceToNextMainQuestion();
  }

  private advanceToNextMainQuestion(): LearningSessionContext {
    const nextIndex = this.context.currentMainIndex + 1;
    this.context.currentMainIndex = nextIndex;
    this.context.branchState = 'MAIN';
    this.context.activeFollowUpQuestionId = null;
    this.context.isReattempt = false;

    if (nextIndex >= this.context.totalMainQuestions) {
      // Session questions finished!
      this.context.phase = 'QUESTIONS_COMPLETED';
      this.context.questionsCompleted = true;
      this.context.activeQuestionId = '';
    } else {
      this.context.phase = 'PRESENTING_MAIN';
      this.context.activeQuestionId = this.context.mainQuestionIds[nextIndex];
    }

    return this.getContext();
  }
}
