import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  selectDailyMainQuestions,
  validateFollowUpLineage,
  AUTHORITATIVE_TOPIC_SEQUENCE,
  AUTHORITATIVE_MAIN_QUESTION_IDS,
  selectSessionQuestions,
  computeDayParity,
} from '../src/domain/rules/sessionSelection.js';
import { FirestoreQuestionRepository } from '../src/infrastructure/firestore/FirestoreQuestionRepository.js';

describe('Phase 2 — Stage 2: Question Selection & Follow-Up Lineage Suite', () => {
  // Load authoritative dataset directly from source
  const datasetPath = path.resolve(__dirname, '../../src/data/all_topics_questions.json');
  const rawDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const authoritativeQuestions: any[] = rawDataset.questions;

  describe('1. Authoritative Main-Question Selection Engine', () => {
    it('selects exactly 10 Main questions in deterministic topic & rank order for a new learner (empty ledger)', () => {
      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: [],
        count: 10,
      });

      expect(result.selectedQuestionIds.length).toBe(10);
      expect(result.totalEligibleCount).toBe(310);
      expect(result.remainingUncompletedCount).toBe(300);
      expect(result.isCurriculumCompleted).toBe(false);

      // Verify exact curriculum progression: Topic 1 (Ai Abnormal) ranks 1 to 10
      expect(result.selectedQuestionIds).toEqual([
        'MG-AIA-01-TH',
        'MG-AIA-02-TH',
        'MG-AIA-03-TH',
        'MG-AIA-04-TH',
        'MG-AIA-05-TH',
        'MG-AIA-06-TH',
        'MG-AIA-07-TH',
        'MG-AIA-08-TH',
        'MG-AIA-09-TH',
        'MG-AIA-10-TH',
      ]);
    });

    it('strictly excludes questions already present in lifetimeCompletedQuestionIds and advances sequentially', () => {
      // Learner has completed all 10 questions of Topic 1 (Ai Abnormal)
      const completedTopic1 = [
        'MG-AIA-01-TH',
        'MG-AIA-02-TH',
        'MG-AIA-03-TH',
        'MG-AIA-04-TH',
        'MG-AIA-05-TH',
        'MG-AIA-06-TH',
        'MG-AIA-07-TH',
        'MG-AIA-08-TH',
        'MG-AIA-09-TH',
        'MG-AIA-10-TH',
      ];

      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: completedTopic1,
        count: 10,
      });

      expect(result.selectedQuestionIds.length).toBe(10);
      expect(result.totalEligibleCount).toBe(300);
      expect(result.remainingUncompletedCount).toBe(290);
      // Next batch is exactly Topic 2 (AI limitation) ranks 1 to 10
      expect(result.selectedQuestionIds).toEqual([
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
      ]);
    });

    it('skips non-contiguous completed questions deterministically without skipping uncompleted ones', () => {
      // Learner completed questions 1, 3, 5 of Topic 1
      const completedPartial = ['MG-AIA-01-TH', 'MG-AIA-03-TH', 'MG-AIA-05-TH'];

      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: completedPartial,
        count: 5,
      });

      expect(result.selectedQuestionIds.length).toBe(5);
      // Expected: 02, 04, 06, 07, 08 of Topic 1
      expect(result.selectedQuestionIds).toEqual([
        'MG-AIA-02-TH',
        'MG-AIA-04-TH',
        'MG-AIA-06-TH',
        'MG-AIA-07-TH',
        'MG-AIA-08-TH',
      ]);
    });

    it('handles fewer than 10 remaining questions gracefully by returning exactly the remaining count', () => {
      // Learner completed 306 out of 310 questions; only 4 remain in Topic 31 (Thrill)
      const allExcept4 = AUTHORITATIVE_MAIN_QUESTION_IDS.slice(0, 306);

      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: allExcept4 as string[],
        count: 10,
      });

      expect(result.selectedQuestionIds.length).toBe(4);
      expect(result.totalEligibleCount).toBe(4);
      expect(result.remainingUncompletedCount).toBe(0);
      expect(result.isCurriculumCompleted).toBe(false);
      expect(result.selectedQuestionIds).toEqual([
        'MG-THR-07-TH',
        'MG-THR-08-TH',
        'MG-THR-09-TH',
        'MG-THR-10-TH',
      ]);
    });

    it('handles fully completed curriculum safely without fabricating questions or throwing errors', () => {
      // All 310 questions completed
      const allCompleted = [...AUTHORITATIVE_MAIN_QUESTION_IDS];

      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: allCompleted,
        count: 10,
      });

      expect(result.selectedQuestionIds).toEqual([]);
      expect(result.selectedQuestions).toEqual([]);
      expect(result.totalEligibleCount).toBe(0);
      expect(result.remainingUncompletedCount).toBe(0);
      expect(result.isCurriculumCompleted).toBe(true);
    });

    it('never selects Follow-Up questions as Main questions even if pool contains mixed types', () => {
      const result = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: [],
        count: 10,
      });

      // Every single selected question must have question_type === 'Primary' and end in '-TH'
      result.selectedQuestions.forEach((q: any) => {
        expect(q.Question_Type).toBe('Primary');
        expect(q.Question_ID.endsWith('-TH')).toBe(true);
      });
      expect(result.selectedQuestionIds.some((id) => id.endsWith('-PR'))).toBe(false);
    });

    it('produces reproducible, deterministic selections for identical inputs', () => {
      const run1 = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: ['MG-AIA-01-TH', 'MG-AIA-02-TH'],
        count: 10,
      });
      const run2 = selectDailyMainQuestions({
        pool: authoritativeQuestions,
        lifetimeCompletedQuestionIds: ['MG-AIA-01-TH', 'MG-AIA-02-TH'],
        count: 10,
      });

      expect(run1.selectedQuestionIds).toEqual(run2.selectedQuestionIds);
    });

    it('applies stable lexical tie-breaker when topics and difficulty ranks are equal', () => {
      const syntheticTiedPool = [
        { Question_ID: 'MG-BBB-01-TH', Topic: 'Ai Abnormal', Question_Type: 'Primary', Difficulty_Rank: 1 },
        { Question_ID: 'MG-AAA-01-TH', Topic: 'Ai Abnormal', Question_Type: 'Primary', Difficulty_Rank: 1 },
        { Question_ID: 'MG-CCC-01-TH', Topic: 'Ai Abnormal', Question_Type: 'Primary', Difficulty_Rank: 1 },
      ];

      const result = selectDailyMainQuestions({
        pool: syntheticTiedPool,
        lifetimeCompletedQuestionIds: [],
        count: 3,
      });

      // Tie-breaker must sort lexically by ID: AAA, BBB, CCC
      expect(result.selectedQuestionIds).toEqual(['MG-AAA-01-TH', 'MG-BBB-01-TH', 'MG-CCC-01-TH']);
    });
  });

  describe('2. Authoritative Dataset Follow-Up Lineage Verification', () => {
    it('validates 100% 1:1 lineage fidelity across the entire 620-question curriculum', () => {
      const report = validateFollowUpLineage(authoritativeQuestions);

      expect(report.isValid).toBe(true);
      expect(report.totalQuestions).toBe(620);
      expect(report.mainQuestionCount).toBe(310);
      expect(report.followUpQuestionCount).toBe(310);
      expect(report.validLineagePairsCount).toBe(310);
      expect(report.errors).toHaveLength(0);
      expect(report.warnings).toHaveLength(0);
    });

    it('detects missing parent reference error in synthetic malformed dataset', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: null },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'MISSING_PARENT_REFERENCE')).toBe(true);
    });

    it('detects non-existent parent reference error in synthetic dataset', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'NON_EXISTENT' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'PARENT_NOT_FOUND')).toBe(true);
    });

    it('detects parent that is not of type Primary in synthetic dataset', () => {
      const brokenPool = [
        { Question_ID: 'F_PARENT', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'NONE' },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'F_PARENT' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'PARENT_NOT_PRIMARY')).toBe(true);
    });

    it('detects cross-topic parent link in synthetic dataset', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Different Topic', Difficulty_Rank: 1, Follow_Up_For: 'M1' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'TOPIC_MISMATCH')).toBe(true);
    });

    it('detects difficulty rank mismatch in synthetic dataset', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 5, Follow_Up_For: 'M1' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'DIFFICULTY_RANK_MISMATCH')).toBe(true);
    });

    it('detects duplicate parent linkages (two follow-ups pointing to one parent)', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'M1' },
        { Question_ID: 'F2', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'M1' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'DUPLICATE_PARENT_LINK')).toBe(true);
    });

    it('detects orphan Primary questions without any remedial follow-up', () => {
      const brokenPool = [
        { Question_ID: 'M1', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 1 },
        { Question_ID: 'M2_ORPHAN', Question_Type: 'Primary', Topic: 'Ai Abnormal', Difficulty_Rank: 2 },
        { Question_ID: 'F1', Question_Type: 'Follow-Up', Topic: 'Ai Abnormal', Difficulty_Rank: 1, Follow_Up_For: 'M1' },
      ];

      const report = validateFollowUpLineage(brokenPool);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'ORPHAN_MAIN_QUESTION' && e.mainQuestionId === 'M2_ORPHAN')).toBe(true);
    });
  });

  describe('3. Repository Integration & Backward Compatibility', () => {
    it('FirestoreQuestionRepository.getDailyMainQuestions integrates seamlessly', async () => {
      const repo = new FirestoreQuestionRepository();
      const dailyQuestions = await repo.getDailyMainQuestions([], 10);

      expect(dailyQuestions.length).toBe(10);
      expect(dailyQuestions[0].question_id).toBe('MG-AIA-01-TH');
      expect(dailyQuestions[9].question_id).toBe('MG-AIA-10-TH');
    });

    it('preserves legacy selectSessionQuestions day-parity behavior for existing tests', () => {
      const parity0 = selectSessionQuestions('2026-10-08'); // Even
      expect(parity0.length).toBe(10);
      expect(computeDayParity('2026-10-08')).toBe(0);
    });
  });

  describe('4. Authoritative Dataset Immutability Checksum Verification', () => {
    it('confirms the authoritative dataset file has NOT been modified', () => {
      const fileBytes = fs.readFileSync(datasetPath);
      const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');

      // Exact verified Phase 1.1 SHA-256 hash
      expect(hash).toBe('34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a');
    });
  });
});
