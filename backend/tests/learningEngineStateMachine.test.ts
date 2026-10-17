import { describe, it, expect } from 'vitest';
import {
  LearningEngineStateMachine,
  InitSessionParams,
} from '../src/domain/rules/LearningEngineStateMachine.js';

describe('LearningEngineStateMachine Phase 2 Unit Tests', () => {
  const defaultMainQuestionIds = [
    'MG-AIL-01-TH',
    'MG-AIL-02-TH',
    'MG-AIL-03-TH',
    'MG-AIL-04-TH',
    'MG-AIL-05-TH',
    'MG-AIL-06-TH',
    'MG-AIL-07-TH',
    'MG-AIL-08-TH',
    'MG-AIL-09-TH',
    'MG-AIL-10-TH',
  ];

  const createDefaultMachine = (overrides?: Partial<InitSessionParams>) => {
    return new LearningEngineStateMachine({
      sessionId: 'daily_2026-10-09_testuser',
      uid: 'testuser_123',
      mainQuestionIds: defaultMainQuestionIds,
      ...overrides,
    });
  };

  describe('Instantiation & Validation', () => {
    it('initializes in IDLE phase with default initial state', () => {
      const machine = createDefaultMachine();
      const ctx = machine.getContext();

      expect(ctx.sessionId).toBe('daily_2026-10-09_testuser');
      expect(ctx.uid).toBe('testuser_123');
      expect(ctx.currentMainIndex).toBe(0);
      expect(ctx.branchState).toBe('MAIN');
      expect(ctx.phase).toBe('IDLE');
      expect(ctx.activeQuestionId).toBe('MG-AIL-01-TH');
      expect(ctx.isReattempt).toBe(false);
      expect(ctx.correctCount).toBe(0);
      expect(ctx.totalXpEarnedInSession).toBe(0);
      expect(ctx.questionsCompleted).toBe(false);
      expect(ctx.unsolvedQuestionsToLog).toEqual([]);
      expect(ctx.newlyCompletedMainQuestionIds).toEqual([]);
    });

    it('rejects initialization with missing required parameters', () => {
      expect(() => new LearningEngineStateMachine({ sessionId: '', uid: 'u1', mainQuestionIds: ['Q1'] })).toThrow(
        /sessionId is required/
      );
      expect(() => new LearningEngineStateMachine({ sessionId: 's1', uid: '', mainQuestionIds: ['Q1'] })).toThrow(
        /uid is required/
      );
      expect(() => new LearningEngineStateMachine({ sessionId: 's1', uid: 'u1', mainQuestionIds: [] })).toThrow(
        /mainQuestionIds must be a non-empty array/
      );
    });

    it('transitions from IDLE to PRESENTING_MAIN on START_SESSION', () => {
      const machine = createDefaultMachine();
      const ctx = machine.transition({ type: 'START_SESSION' });

      expect(ctx.phase).toBe('PRESENTING_MAIN');
      expect(ctx.branchState).toBe('MAIN');
      expect(ctx.activeQuestionId).toBe('MG-AIL-01-TH');
    });
  });

  describe('Linear Flow: Correct Main Answer on First Try', () => {
    it('evaluates correct answer, awards 10 XP under threshold, and records in newlyCompleted ledger', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      const feedbackCtx = machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: true,
        userTotalXp: 50,
        lifetimeCompletedQuestionIds: [],
        linkedFollowUpId: 'MG-AIL-01-PR',
      });

      expect(feedbackCtx.phase).toBe('MAIN_FEEDBACK');
      expect(feedbackCtx.correctCount).toBe(1);
      expect(feedbackCtx.totalXpEarnedInSession).toBe(10);
      expect(feedbackCtx.newlyCompletedMainQuestionIds).toContain('MG-AIL-01-TH');
      expect(feedbackCtx.lastEvaluation?.isCorrect).toBe(true);
      expect(feedbackCtx.lastEvaluation?.awardedXp).toBe(10);

      // Continuing advances to Main Question 2 (index 1)
      const nextCtx = machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });
      expect(nextCtx.phase).toBe('PRESENTING_MAIN');
      expect(nextCtx.currentMainIndex).toBe(1);
      expect(nextCtx.activeQuestionId).toBe('MG-AIL-02-TH');
      expect(nextCtx.branchState).toBe('MAIN');
      expect(nextCtx.isReattempt).toBe(false);
    });

    it('awards 0 XP if learner total XP is already >= 310, but still records completed question', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      const feedbackCtx = machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: true,
        userTotalXp: 310,
        lifetimeCompletedQuestionIds: [],
      });

      expect(feedbackCtx.totalXpEarnedInSession).toBe(0); // 0 XP awarded at threshold!
      expect(feedbackCtx.newlyCompletedMainQuestionIds).toContain('MG-AIL-01-TH'); // Recorded in ledger!
    });
  });

  describe('Branching Flow: Incorrect Main Answer', () => {
    it('awards 0 XP and branches to linked Follow-Up question', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      const feedbackCtx = machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: false,
        userTotalXp: 50,
        lifetimeCompletedQuestionIds: [],
        linkedFollowUpId: 'MG-AIL-01-PR',
      });

      expect(feedbackCtx.phase).toBe('MAIN_FEEDBACK');
      expect(feedbackCtx.correctCount).toBe(0);
      expect(feedbackCtx.totalXpEarnedInSession).toBe(0);
      expect(feedbackCtx.activeFollowUpQuestionId).toBe('MG-AIL-01-PR');
      expect(feedbackCtx.lastEvaluation?.isCorrect).toBe(false);

      // Continuing routes into remedial Follow-Up question at same index
      const branchCtx = machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });
      expect(branchCtx.phase).toBe('PRESENTING_FOLLOW_UP');
      expect(branchCtx.branchState).toBe('FOLLOW_UP');
      expect(branchCtx.activeQuestionId).toBe('MG-AIL-01-PR');
      expect(branchCtx.currentMainIndex).toBe(0); // Still on Question 1!
    });
  });

  describe('Remediation Path A: Correct Follow-Up -> Correct Main Re-attempt (Decision 1 & 2)', () => {
    it('completes full successful remediation cycle and awards 10 XP on successful re-attempt', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      // 1. Fail Main Question 1
      machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: false,
        userTotalXp: 100,
        linkedFollowUpId: 'MG-AIL-01-PR',
      });
      machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });

      // 2. Answer Follow-Up Correctly (0 XP)
      const fuFeedback = machine.transition({
        type: 'SUBMIT_FOLLOW_UP_ANSWER',
        questionId: 'MG-AIL-01-PR',
        isCorrect: true,
        topic: 'Aortic Insufficiency',
        difficultyRank: 1,
      });

      expect(fuFeedback.phase).toBe('FOLLOW_UP_FEEDBACK');
      expect(fuFeedback.lastEvaluation?.isCorrect).toBe(true);
      expect(fuFeedback.lastEvaluation?.awardedXp).toBe(0); // Follow-up awards 0 XP!

      // 3. Continue routes back to original Main question for exactly ONE re-attempt
      const reattemptCtx = machine.transition({ type: 'CONTINUE_FROM_FOLLOW_UP_FEEDBACK' });
      expect(reattemptCtx.phase).toBe('REATTEMPTING_MAIN');
      expect(reattemptCtx.branchState).toBe('REATTEMPT_MAIN');
      expect(reattemptCtx.isReattempt).toBe(true);
      expect(reattemptCtx.activeQuestionId).toBe('MG-AIL-01-TH');
      expect(reattemptCtx.currentMainIndex).toBe(0);

      // 4. Submit Re-attempt Answer (Correct!)
      // Decision 2 Option A: Re-attempt solved correctly awards 10 XP (if total < 310)
      const reattemptFeedback = machine.transition({
        type: 'SUBMIT_REATTEMPT_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: true,
        userTotalXp: 100,
        lifetimeCompletedQuestionIds: [],
        topic: 'Aortic Insufficiency',
        difficultyRank: 1,
      });

      expect(reattemptFeedback.phase).toBe('REATTEMPT_FEEDBACK');
      expect(reattemptFeedback.lastEvaluation?.isCorrect).toBe(true);
      expect(reattemptFeedback.lastEvaluation?.awardedXp).toBe(10);
      expect(reattemptFeedback.totalXpEarnedInSession).toBe(10);
      expect(reattemptFeedback.newlyCompletedMainQuestionIds).toContain('MG-AIL-01-TH');

      // 5. Continue advances to next Main Question (index 1)
      const nextCtx = machine.transition({ type: 'CONTINUE_FROM_REATTEMPT_FEEDBACK' });
      expect(nextCtx.phase).toBe('PRESENTING_MAIN');
      expect(nextCtx.currentMainIndex).toBe(1);
      expect(nextCtx.activeQuestionId).toBe('MG-AIL-02-TH');
      expect(nextCtx.branchState).toBe('MAIN');
      expect(nextCtx.isReattempt).toBe(false);
      expect(nextCtx.unsolvedQuestionsToLog).toHaveLength(0); // Not logged to unsolved because solved!
    });
  });

  describe('Remediation Path B: Correct Follow-Up -> Failed Main Re-attempt (Decision 1 Option A)', () => {
    it('strictly permits exactly ONE re-attempt, logs to Unsolved Questions Bucket, and advances', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      // Fail Main -> Pass Follow-up -> Reach Re-attempt
      machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: false,
        userTotalXp: 50,
        linkedFollowUpId: 'MG-AIL-01-PR',
      });
      machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });
      machine.transition({
        type: 'SUBMIT_FOLLOW_UP_ANSWER',
        questionId: 'MG-AIL-01-PR',
        isCorrect: true,
      });
      machine.transition({ type: 'CONTINUE_FROM_FOLLOW_UP_FEEDBACK' });

      // Submit Re-attempt Answer (Incorrect!)
      const reattemptFeedback = machine.transition({
        type: 'SUBMIT_REATTEMPT_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: false,
        topic: 'Aortic Insufficiency',
        difficultyRank: 1,
        userTotalXp: 50,
      });

      expect(reattemptFeedback.phase).toBe('REATTEMPT_FEEDBACK');
      expect(reattemptFeedback.lastEvaluation?.isCorrect).toBe(false);
      expect(reattemptFeedback.totalXpEarnedInSession).toBe(0);
      expect(reattemptFeedback.newlyCompletedMainQuestionIds).not.toContain('MG-AIL-01-TH');

      // Verified: Queued to Unsolved Questions Bucket with reason REATTEMPT_FAILED
      expect(reattemptFeedback.unsolvedQuestionsToLog).toHaveLength(1);
      expect(reattemptFeedback.unsolvedQuestionsToLog[0]).toMatchObject({
        mainQuestionId: 'MG-AIL-01-TH',
        followUpQuestionId: 'MG-AIL-01-PR',
        reason: 'REATTEMPT_FAILED',
        topic: 'Aortic Insufficiency',
        difficultyRank: 1,
      });

      // Continue MUST advance to next Main question. Unlimited loop is strictly forbidden!
      const nextCtx = machine.transition({ type: 'CONTINUE_FROM_REATTEMPT_FEEDBACK' });
      expect(nextCtx.phase).toBe('PRESENTING_MAIN');
      expect(nextCtx.currentMainIndex).toBe(1);
      expect(nextCtx.activeQuestionId).toBe('MG-AIL-02-TH');
      expect(nextCtx.branchState).toBe('MAIN');
      expect(nextCtx.isReattempt).toBe(false);
    });
  });

  describe('Remediation Path C: Failed Follow-Up (Decision 1 Option A)', () => {
    it('logs to Unsolved Questions Bucket and advances to next Main question', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      // Fail Main
      machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-01-TH',
        isCorrect: false,
        userTotalXp: 200,
        linkedFollowUpId: 'MG-AIL-01-PR',
      });
      machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });

      // Fail Follow-Up
      const fuFeedback = machine.transition({
        type: 'SUBMIT_FOLLOW_UP_ANSWER',
        questionId: 'MG-AIL-01-PR',
        isCorrect: false,
        topic: 'Aortic Insufficiency',
        difficultyRank: 1,
      });

      expect(fuFeedback.phase).toBe('FOLLOW_UP_FEEDBACK');
      expect(fuFeedback.lastEvaluation?.isCorrect).toBe(false);

      // Verified: Queued to Unsolved Questions Bucket with reason FOLLOW_UP_FAILED
      expect(fuFeedback.unsolvedQuestionsToLog).toHaveLength(1);
      expect(fuFeedback.unsolvedQuestionsToLog[0]).toMatchObject({
        mainQuestionId: 'MG-AIL-01-TH',
        followUpQuestionId: 'MG-AIL-01-PR',
        reason: 'FOLLOW_UP_FAILED',
      });

      // Continue advances directly to next Main question (index 1)
      const nextCtx = machine.transition({ type: 'CONTINUE_FROM_FOLLOW_UP_FEEDBACK' });
      expect(nextCtx.phase).toBe('PRESENTING_MAIN');
      expect(nextCtx.currentMainIndex).toBe(1);
      expect(nextCtx.activeQuestionId).toBe('MG-AIL-02-TH');
      expect(nextCtx.branchState).toBe('MAIN');
      expect(nextCtx.isReattempt).toBe(false);
    });
  });

  describe('Session Completion at Final Question', () => {
    it('marks session completed when 10th question is finished', () => {
      const machine = createDefaultMachine({
        currentMainIndex: 9, // Last question
        activeQuestionId: 'MG-AIL-10-TH',
      });

      machine.transition({
        type: 'SUBMIT_MAIN_ANSWER',
        questionId: 'MG-AIL-10-TH',
        isCorrect: true,
        userTotalXp: 150,
      });

      const completedCtx = machine.transition({ type: 'CONTINUE_FROM_MAIN_FEEDBACK' });
      expect(completedCtx.phase).toBe('QUESTIONS_COMPLETED');
      expect(completedCtx.questionsCompleted).toBe(true);
      expect(completedCtx.currentMainIndex).toBe(10);

      // Re-triggering throws completed error
      expect(() =>
        machine.transition({
          type: 'SUBMIT_MAIN_ANSWER',
          questionId: 'MG-AIL-10-TH',
          isCorrect: true,
          userTotalXp: 160,
        })
      ).toThrow(/Session is already completed/);
    });
  });

  describe('Interrupted Session Recovery', () => {
    it('restores state seamlessly from mid-follow-up session snapshot', () => {
      const machine = new LearningEngineStateMachine({
        sessionId: 'daily_2026-10-09_recovered',
        uid: 'user_456',
        mainQuestionIds: defaultMainQuestionIds,
        currentMainIndex: 3,
        branchState: 'FOLLOW_UP',
        activeFollowUpQuestionId: 'MG-AIL-04-PR',
        correctCount: 2,
        totalXpEarnedInSession: 20,
      });

      const ctx = machine.getContext();
      expect(ctx.phase).toBe('PRESENTING_FOLLOW_UP');
      expect(ctx.branchState).toBe('FOLLOW_UP');
      expect(ctx.currentMainIndex).toBe(3);
      expect(ctx.activeQuestionId).toBe('MG-AIL-04-PR');

      // Learner can resume and submit follow-up immediately
      const feedback = machine.transition({
        type: 'SUBMIT_FOLLOW_UP_ANSWER',
        questionId: 'MG-AIL-04-PR',
        isCorrect: true,
      });
      expect(feedback.phase).toBe('FOLLOW_UP_FEEDBACK');
    });

    it('restores state seamlessly from mid-reattempt session snapshot', () => {
      const machine = new LearningEngineStateMachine({
        sessionId: 'daily_2026-10-09_recovered_reattempt',
        uid: 'user_456',
        mainQuestionIds: defaultMainQuestionIds,
        currentMainIndex: 5,
        branchState: 'REATTEMPT_MAIN',
        activeQuestionId: 'MG-AIL-06-TH',
        isReattempt: true,
      });

      const ctx = machine.getContext();
      expect(ctx.phase).toBe('REATTEMPTING_MAIN');
      expect(ctx.branchState).toBe('REATTEMPT_MAIN');
      expect(ctx.isReattempt).toBe(true);
      expect(ctx.activeQuestionId).toBe('MG-AIL-06-TH');
    });
  });

  describe('Defensive Invariants & Sequencing Guards', () => {
    it('rejects submission with mismatched question ID', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      expect(() =>
        machine.transition({
          type: 'SUBMIT_MAIN_ANSWER',
          questionId: 'FORGED_QUESTION_ID',
          isCorrect: true,
          userTotalXp: 0,
        })
      ).toThrow(/Question mismatch: Expected main question 'MG-AIL-01-TH'/);
    });

    it('rejects follow-up submission when in main question phase', () => {
      const machine = createDefaultMachine();
      machine.transition({ type: 'START_SESSION' });

      expect(() =>
        machine.transition({
          type: 'SUBMIT_FOLLOW_UP_ANSWER',
          questionId: 'MG-AIL-01-PR',
          isCorrect: true,
        })
      ).toThrow(/Cannot submit follow-up while in phase 'PRESENTING_MAIN'/);
    });

    it('rejects re-attempt submission when in follow-up phase', () => {
      const machine = createDefaultMachine({
        branchState: 'FOLLOW_UP',
        activeFollowUpQuestionId: 'MG-AIL-01-PR',
      });

      expect(() =>
        machine.transition({
          type: 'SUBMIT_REATTEMPT_ANSWER',
          questionId: 'MG-AIL-01-TH',
          isCorrect: true,
          userTotalXp: 0,
        })
      ).toThrow(/Cannot submit re-attempt while in phase 'PRESENTING_FOLLOW_UP'/);
    });
  });
});
