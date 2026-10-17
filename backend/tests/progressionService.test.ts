import { describe, it, expect } from 'vitest';
import {
  ProgressionService,
  MAX_LEVEL,
  FOUNDATIONAL_XP_THRESHOLD,
  XP_PER_MAIN_QUESTION,
  TOTAL_CURRICULUM_MAIN_QUESTIONS,
} from '../src/domain/rules/ProgressionService.js';
import { AUTHORITATIVE_MAIN_QUESTION_IDS } from '../src/domain/rules/sessionSelection.js';

describe('Phase 2 ProgressionService Unit Tests', () => {
  describe('Constants & Threshold Boundaries', () => {
    it('defines the approved Phase 2 constants', () => {
      expect(MAX_LEVEL).toBe(31);
      expect(FOUNDATIONAL_XP_THRESHOLD).toBe(310);
      expect(XP_PER_MAIN_QUESTION).toBe(10);
      expect(TOTAL_CURRICULUM_MAIN_QUESTIONS).toBe(310);
    });
  });

  describe('Level Calculation: level = min(31, floor(max(0, totalXp) / 10) + 1)', () => {
    it('calculates Level 1 for 0 XP', () => {
      expect(ProgressionService.calculateLevel(0)).toBe(1);
    });

    it('calculates Level 1 for XP between 0 and 9', () => {
      expect(ProgressionService.calculateLevel(1)).toBe(1);
      expect(ProgressionService.calculateLevel(5)).toBe(1);
      expect(ProgressionService.calculateLevel(9)).toBe(1);
    });

    it('calculates Level 2 for exactly 10 XP', () => {
      expect(ProgressionService.calculateLevel(10)).toBe(2);
      expect(ProgressionService.calculateLevel(19)).toBe(2);
    });

    it('calculates intermediate levels accurately', () => {
      expect(ProgressionService.calculateLevel(20)).toBe(3);
      expect(ProgressionService.calculateLevel(80)).toBe(9);
      expect(ProgressionService.calculateLevel(150)).toBe(16);
      expect(ProgressionService.calculateLevel(290)).toBe(30);
    });

    it('calculates Level 31 for 300 XP and higher', () => {
      expect(ProgressionService.calculateLevel(300)).toBe(31);
      expect(ProgressionService.calculateLevel(305)).toBe(31);
      expect(ProgressionService.calculateLevel(310)).toBe(31);
      expect(ProgressionService.calculateLevel(315)).toBe(31);
    });

    it('enforces Level 31 ceiling for legacy accounts with high historical XP', () => {
      expect(ProgressionService.calculateLevel(450)).toBe(31);
      expect(ProgressionService.calculateLevel(1200)).toBe(31);
    });

    it('handles negative numbers and NaN defensively by defaulting to Level 1', () => {
      expect(ProgressionService.calculateLevel(-50)).toBe(1);
      expect(ProgressionService.calculateLevel(NaN)).toBe(1);
    });
  });

  describe('Main Question XP Award Calculation (Decision 2 Option A)', () => {
    const uncompletedQuestionId = 'MG-AIL-01-TH';

    it('awards 10 XP when trainee XP is 0 and question is uncompleted', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 0,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(10);
      expect(result.updatedTotalXp).toBe(10);
      expect(result.isNewlyCompleted).toBe(true);
      expect(result.reason).toBe('AWARDED_UNDER_THRESHOLD');
    });

    it('awards 10 XP when trainee XP is 80 and question is uncompleted', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 80,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: ['MG-AIL-02-TH', 'MG-AIL-03-TH'],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(10);
      expect(result.updatedTotalXp).toBe(90);
      expect(result.isNewlyCompleted).toBe(true);
      expect(result.reason).toBe('AWARDED_UNDER_THRESHOLD');
    });

    it('awards full 10 XP when trainee is at 305 XP, reaching 315 XP (No fractional XP)', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 305,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(10);
      expect(result.updatedTotalXp).toBe(315);
      expect(result.isNewlyCompleted).toBe(true);
      expect(result.reason).toBe('AWARDED_UNDER_THRESHOLD');
    });

    it('awards 0 XP when trainee is already at 310 XP, but marks question completed', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 310,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(0);
      expect(result.updatedTotalXp).toBe(310);
      expect(result.isNewlyCompleted).toBe(true);
      expect(result.reason).toBe('THRESHOLD_REACHED_NO_XP');
    });

    it('awards 0 XP when trainee has historical XP > 310, preserving historical balance without reduction', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 450,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(0);
      expect(result.updatedTotalXp).toBe(450); // Historical 450 XP preserved!
      expect(result.isNewlyCompleted).toBe(true);
      expect(result.reason).toBe('THRESHOLD_REACHED_NO_XP');
    });

    it('awards 0 XP when question was already completed in the lifetime ledger', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 50,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [uncompletedQuestionId],
        isCorrect: true,
      });

      expect(result.awardedXp).toBe(0);
      expect(result.updatedTotalXp).toBe(50);
      expect(result.isNewlyCompleted).toBe(false);
      expect(result.reason).toBe('ALREADY_COMPLETED_NO_XP');
    });

    it('awards 0 XP when answer is incorrect, leaving total XP unchanged', () => {
      const result = ProgressionService.calculateMainQuestionXpAward({
        currentTotalXp: 100,
        questionId: uncompletedQuestionId,
        lifetimeCompletedQuestionIds: [],
        isCorrect: false,
      });

      expect(result.awardedXp).toBe(0);
      expect(result.updatedTotalXp).toBe(100);
      expect(result.isNewlyCompleted).toBe(false);
      expect(result.reason).toBe('INCORRECT_NO_XP');
    });
  });

  describe('Follow-Up & Finalization Zero XP Invariants', () => {
    it('always awards 0 XP for follow-up questions', () => {
      expect(ProgressionService.calculateFollowUpXpAward()).toBe(0);
    });

    it('always awards 0 XP for session finalization', () => {
      expect(ProgressionService.calculateSessionFinalizationXpAward()).toBe(0);
    });
  });

  describe('Curriculum Completion Milestone', () => {
    it('returns false when ledger is empty or undefined', () => {
      expect(ProgressionService.isCurriculumCompleted([])).toBe(false);
      expect(ProgressionService.isCurriculumCompleted(undefined)).toBe(false);
    });

    it('returns false when ledger contains 310 arbitrary IDs that do not match the curriculum', () => {
      const arbitraryList = Array.from({ length: 310 }, (_, i) => `ARBITRARY_ID_${i}`);
      expect(ProgressionService.isCurriculumCompleted(arbitraryList)).toBe(false);
    });

    it('returns false when only 309 of the 310 authoritative questions are completed', () => {
      const partialList = AUTHORITATIVE_MAIN_QUESTION_IDS.slice(0, 309);
      expect(ProgressionService.isCurriculumCompleted(partialList)).toBe(false);
    });

    it('returns true when ledger contains all 310 authoritative foundational Main questions', () => {
      expect(ProgressionService.isCurriculumCompleted([...AUTHORITATIVE_MAIN_QUESTION_IDS])).toBe(true);
    });

    it('returns true when all 310 authoritative questions are present alongside extra question IDs', () => {
      const withExtras = [...AUTHORITATIVE_MAIN_QUESTION_IDS, 'EXTRA_QUESTION_1', 'MG-AIA-01-PR'];
      expect(ProgressionService.isCurriculumCompleted(withExtras)).toBe(true);
    });

    it('handles duplicates safely and requires all 310 distinct authoritative questions', () => {
      // 310 items total, but one is duplicated so only 309 unique authoritative questions exist
      const withDuplicate = [
        ...AUTHORITATIVE_MAIN_QUESTION_IDS.slice(0, 309),
        AUTHORITATIVE_MAIN_QUESTION_IDS[0], // Duplicate first question instead of 310th
      ];
      expect(withDuplicate.length).toBe(310);
      expect(ProgressionService.isCurriculumCompleted(withDuplicate)).toBe(false);
    });

    it('allows validating against a custom authoritative subset', () => {
      const customAuthoritative = ['MG-AIA-01-TH', 'MG-AIA-02-TH', 'MG-AIA-03-TH'];
      expect(ProgressionService.isCurriculumCompleted(['MG-AIA-01-TH', 'MG-AIA-02-TH'], customAuthoritative)).toBe(false);
      expect(
        ProgressionService.isCurriculumCompleted(['MG-AIA-01-TH', 'MG-AIA-02-TH', 'MG-AIA-03-TH'], customAuthoritative)
      ).toBe(true);
    });
  });

  describe('Canonical XP Validity Boundary (isValidXp)', () => {
    it('accepts zero as a valid XP value', () => {
      expect(ProgressionService.isValidXp(0)).toBe(true);
    });

    it('accepts positive finite numbers', () => {
      expect(ProgressionService.isValidXp(1)).toBe(true);
      expect(ProgressionService.isValidXp(100)).toBe(true);
      expect(ProgressionService.isValidXp(310)).toBe(true);
      expect(ProgressionService.isValidXp(1200)).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(ProgressionService.isValidXp(-1)).toBe(false);
      expect(ProgressionService.isValidXp(-50)).toBe(false);
    });

    it('rejects non-numeric types', () => {
      expect(ProgressionService.isValidXp('100')).toBe(false);
      expect(ProgressionService.isValidXp('')).toBe(false);
      expect(ProgressionService.isValidXp(null)).toBe(false);
      expect(ProgressionService.isValidXp(undefined)).toBe(false);
      expect(ProgressionService.isValidXp({})).toBe(false);
      expect(ProgressionService.isValidXp([])).toBe(false);
      expect(ProgressionService.isValidXp(true)).toBe(false);
    });

    it('rejects NaN and non-finite numbers', () => {
      expect(ProgressionService.isValidXp(NaN)).toBe(false);
      expect(ProgressionService.isValidXp(Infinity)).toBe(false);
      expect(ProgressionService.isValidXp(-Infinity)).toBe(false);
    });
  });

  describe('Backward Compatibility with Provisional Progression Levels', () => {
    it('preserves legacy calculateProgression calculation for existing tests', () => {
      const prog = ProgressionService.calculateProgression(350);
      expect(prog.currentLevel.level).toBe(3);
      expect(prog.currentLevel.title).toBe('Practitioner');
      expect(prog.currentXp).toBe(350);
    });
  });
});
