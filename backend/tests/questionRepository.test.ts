import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreQuestionRepository, resolveQuestionDatasetPath } from '../src/infrastructure/firestore/FirestoreQuestionRepository.js';
import { validateQuestionDataset } from '../src/domain/rules/datasetValidator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 1: Question Model and Lineage Ingestion Mapping', () => {
  let repository: FirestoreQuestionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new FirestoreQuestionRepository('rel_v1_0_0');
  });

  describe('Isolated Unit Suite: mapFirestoreDocToQuestion & Lineage Mapping', () => {
    it('correctly maps and preserves Primary question metadata with null Follow_Up_For', () => {
      const rawPrimaryDoc = {
        Question_ID: 'MG-AIL-01-TH',
        Topic: 'AI limitation',
        Question_Type: 'Primary',
        Difficulty_Rank: 1,
        Follow_Up_For: null,
        Audience: 'RBSK',
        Question: 'Primary question text',
        Option_A: 'Option A',
        Option_B: 'Option B',
        Option_C: 'Option C',
        Option_D: 'Option D',
        Correct: 'A',
        Explanation: 'Explanation text',
        Action: 'Clinical action text',
        MedGemma_Tag: 'module1::ai_limitation::applied',
      };

      const mapped = repository.mapFirestoreDocToQuestion(rawPrimaryDoc);

      expect(mapped.question_id).toBe('MG-AIL-01-TH');
      expect(mapped.question_type).toBe('Primary');
      expect(mapped.Question_Type).toBe('Primary');
      expect(mapped.follow_up_for).toBeNull();
      expect(mapped.Follow_Up_For).toBeNull();
      expect(mapped.correct_answer).toBe('option_a');
      expect(mapped.type).toBe('MCQ');
      expect(mapped.topic).toBe('AI limitation');
      expect(mapped.difficulty_rank).toBe(1);
      expect(mapped.audience).toBe('RBSK');
      expect(mapped.learning_objective).toBe('Clinical action text');
      expect(mapped.tags).toContain('AI limitation');
      expect(mapped.tags).toContain('module1::ai_limitation::applied');
    });

    it('correctly maps and preserves Follow-Up question metadata linked to parent Primary question', () => {
      const rawFollowUpDoc = {
        Question_ID: 'MG-AIL-01-PR',
        Topic: 'AI limitation',
        Question_Type: 'Follow-Up',
        Difficulty_Rank: 1,
        Follow_Up_For: 'MG-AIL-01-TH',
        Audience: 'RBSK',
        Question: 'Remedial follow-up scenario text',
        Option_A: 'Option A',
        Option_B: 'Option B',
        Option_C: 'Option C',
        Option_D: 'Option D',
        Correct: 'D',
        Explanation: 'Remedial explanation text',
        Action: 'Clinical action text',
        MedGemma_Tag: 'module1::ai_limitation::applied',
      };

      const mapped = repository.mapFirestoreDocToQuestion(rawFollowUpDoc);

      expect(mapped.question_id).toBe('MG-AIL-01-PR');
      expect(mapped.question_type).toBe('Follow-Up');
      expect(mapped.Question_Type).toBe('Follow-Up');
      expect(mapped.follow_up_for).toBe('MG-AIL-01-TH');
      expect(mapped.Follow_Up_For).toBe('MG-AIL-01-TH');
      expect(mapped.correct_answer).toBe('option_d');
    });

    it('safely handles missing metadata by applying safe defaults (Primary, null follow-up)', () => {
      const docWithoutMetadata = {
        Question_ID: 'MG-LEGACY-01',
        Question: 'Legacy question text',
        Option_A: 'Option A',
        Option_B: 'Option B',
        Option_C: 'Option C',
        Option_D: 'Option D',
        Correct: 'B',
      };

      const mapped = repository.mapFirestoreDocToQuestion(docWithoutMetadata);

      expect(mapped.question_id).toBe('MG-LEGACY-01');
      expect(mapped.question_type).toBe('Primary');
      expect(mapped.Question_Type).toBe('Primary');
      expect(mapped.follow_up_for).toBeNull();
      expect(mapped.Follow_Up_For).toBeNull();
      expect(mapped.correct_answer).toBe('option_b');
    });

    it('preserves lineage metadata when document is already partially formatted with type and question_id', () => {
      const formattedDoc = {
        question_id: 'MG-AIL-02-PR',
        type: 'MCQ',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        question: 'Pre-formatted question',
        Question_Type: 'Follow-Up',
        Follow_Up_For: 'MG-AIL-02-TH',
      };

      const mapped = repository.mapFirestoreDocToQuestion(formattedDoc);

      expect(mapped.question_id).toBe('MG-AIL-02-PR');
      expect(mapped.question_type).toBe('Follow-Up');
      expect(mapped.follow_up_for).toBe('MG-AIL-02-TH');
    });

    it('handles isolated fixtures with missing or invalid lineage metadata without fabricating links', async () => {
      const fixtureQuestions = [
        {
          Question_ID: 'FIX-MAIN-01',
          Topic: 'Test Topic',
          Question_Type: 'Primary',
          Difficulty_Rank: 1,
          Follow_Up_For: null,
          Question: 'Main Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
        },
        {
          Question_ID: 'FIX-UNLINKED-PR',
          Topic: 'Test Topic',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: null, // Missing lineage metadata
          Question: 'Follow up with null parent',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'B',
        },
        {
          Question_ID: 'FIX-BROKEN-PR',
          Topic: 'Test Topic',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 2,
          Follow_Up_For: 'NON_EXISTENT_PARENT_ID', // Invalid lineage reference
          Question: 'Follow up with broken parent',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'C',
        },
      ];

      vi.spyOn(repository, 'getAllQuestions').mockResolvedValue(
        fixtureQuestions.map((q) => repository.mapFirestoreDocToQuestion(q))
      );

      // FIX-MAIN-01 has no follow-up referencing it (FIX-UNLINKED-PR has null parent)
      const resMain = await repository.getFollowUpQuestion('FIX-MAIN-01');
      expect(resMain).toBeNull();

      // Querying non-existent parent returns null
      const resNonExistent = await repository.getFollowUpQuestion('NON_EXISTENT_PARENT_ID');
      expect(resNonExistent?.question_id).toBe('FIX-BROKEN-PR'); // Returns the question explicitly pointing to it

      // Querying with empty string returns null
      const resEmpty = await repository.getFollowUpQuestion('');
      expect(resEmpty).toBeNull();
    });
  });

  describe('Integration Suite: Authoritative Dataset (src/data/all_topics_questions.json)', () => {
    it('verifies dataset file path resolution and JSON file existence', () => {
      const datasetPath = resolveQuestionDatasetPath();
      expect(fs.existsSync(datasetPath)).toBe(true);
      expect(datasetPath.endsWith('all_topics_questions.json')).toBe(true);
    });

    it('loads the entire actual questionnaire dataset of exactly 620 questions', async () => {
      repository.clearCache();
      const allQuestions = await repository.getAllQuestions();
      expect(allQuestions).toHaveLength(620);
    });

    it('verifies question ID uniqueness across all 620 questions in the actual dataset', async () => {
      const allQuestions = await repository.getAllQuestions();
      const idSet = new Set<string>();
      const duplicates: string[] = [];

      for (const q of allQuestions) {
        if (idSet.has(q.question_id)) {
          duplicates.push(q.question_id);
        } else {
          idSet.add(q.question_id);
        }
      }

      expect(duplicates).toHaveLength(0);
      expect(idSet.size).toBe(620);
    });

    it('verifies dataset structure: exactly 31 topics with 20 questions each (10 Primary, 10 Follow-Up)', async () => {
      const allQuestions = await repository.getAllQuestions();
      const topicGroups: Record<string, { primary: number; followUp: number }> = {};

      for (const q of allQuestions) {
        const topic = q.topic || 'UNKNOWN';
        if (!topicGroups[topic]) {
          topicGroups[topic] = { primary: 0, followUp: 0 };
        }
        if (q.question_type === 'Primary') {
          topicGroups[topic].primary += 1;
        } else if (q.question_type === 'Follow-Up') {
          topicGroups[topic].followUp += 1;
        }
      }

      const topics = Object.keys(topicGroups);
      expect(topics).toHaveLength(31);

      let totalPrimary = 0;
      let totalFollowUp = 0;

      for (const topic of topics) {
        expect(topicGroups[topic].primary).toBe(10);
        expect(topicGroups[topic].followUp).toBe(10);
        totalPrimary += topicGroups[topic].primary;
        totalFollowUp += topicGroups[topic].followUp;
      }

      expect(totalPrimary).toBe(310);
      expect(totalFollowUp).toBe(310);
    });

    it('verifies metadata mapping integrity for all questions in the actual dataset', async () => {
      const allQuestions = await repository.getAllQuestions();

      for (const q of allQuestions) {
        expect(q.question_id).toBeTruthy();
        expect(q.type).toBe('MCQ');
        expect(q.category).toBe('HEART_RECORDING');
        expect(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).toContain(q.difficulty);
        expect(q.question.length).toBeGreaterThan(0);
        expect(q.explanation.length).toBeGreaterThan(0);
        expect(q.learning_objective.length).toBeGreaterThan(0);
        expect(q.tags.length).toBeGreaterThan(0);
        expect(q.clinician_validated).toBe(true);
        expect(q.source).toBe('MEDGEMMA');
        expect(q.version).toBe('1.0.0');

        const mcq = q as any;
        expect(mcq.option_a.length).toBeGreaterThan(0);
        expect(mcq.option_b.length).toBeGreaterThan(0);
        expect(mcq.option_c.length).toBeGreaterThan(0);
        expect(mcq.option_d.length).toBeGreaterThan(0);
        expect(['option_a', 'option_b', 'option_c', 'option_d']).toContain(mcq.correct_answer);

        expect(['Primary', 'Follow-Up']).toContain(q.question_type);
        expect(q.difficulty_rank).toBeGreaterThanOrEqual(1);
        expect(q.difficulty_rank).toBeLessThanOrEqual(10);
      }
    });

    it('verifies parent-question references: all 310 follow-ups reference valid existing primary questions', async () => {
      const allQuestions = await repository.getAllQuestions();
      const primaryIds = new Set(allQuestions.filter((q) => q.question_type === 'Primary').map((q) => q.question_id));
      const followUps = allQuestions.filter((q) => q.question_type === 'Follow-Up');

      const nonNullParentReferences: string[] = [];
      const nullParentFollowUps: string[] = [];
      const brokenParentReferences: { followUpId: string; parentId: string }[] = [];

      for (const f of followUps) {
        if (f.follow_up_for) {
          nonNullParentReferences.push(f.follow_up_for);
          if (!primaryIds.has(f.follow_up_for)) {
            brokenParentReferences.push({ followUpId: f.question_id, parentId: f.follow_up_for });
          }
        } else {
          nullParentFollowUps.push(f.question_id);
        }
      }

      // Exactly 310 follow-ups have parent references (100% complete)
      expect(nonNullParentReferences).toHaveLength(310);
      // Zero broken references to non-existent questions
      expect(brokenParentReferences).toHaveLength(0);
      // Zero follow-ups with null parent in the corrected authoritative dataset
      expect(nullParentFollowUps).toHaveLength(0);
    });

    it('retrieves the correct follow-up for main questions across multiple clinical topics including corrected records', async () => {
      // Test across multiple distinct topics, including the 3 corrected topics
      const testCases = [
        { mainId: 'MG-AIL-01-TH', expectedFollowUpId: 'MG-AIL-01-PR' }, // AI limitation
        { mainId: 'MG-AIA-01-TH', expectedFollowUpId: 'MG-AIA-01-PR' }, // Ai Abnormal
        { mainId: 'MG-AIS-02-TH', expectedFollowUpId: 'MG-AIS-02-PR' }, // AiSteth
        { mainId: 'MG-CHD-05-TH', expectedFollowUpId: 'MG-CHD-05-PR' }, // CHD basics
        { mainId: 'MG-THR-03-TH', expectedFollowUpId: 'MG-THR-03-PR' }, // Thrill
        { mainId: 'MG-CYA-04-TH', expectedFollowUpId: 'MG-CYA-04-PR' }, // Cyanosis
        // Verified corrected relationships:
        { mainId: 'MG-NOI-01-TH', expectedFollowUpId: 'MG-NOI-01-PR' }, // Noise Quality (was null)
        { mainId: 'MG-FEV-02-TH', expectedFollowUpId: 'MG-FEV-02-PR' }, // Fever Flow Murmur rank 2
        { mainId: 'MG-FEV-05-TH', expectedFollowUpId: 'MG-FEV-05-PR' }, // Fever Flow Murmur rank 5
        { mainId: 'MG-FEV-10-TH', expectedFollowUpId: 'MG-FEV-10-PR' }, // Fever Flow Murmur rank 10
        { mainId: 'MG-INN-02-TH', expectedFollowUpId: 'MG-INN-02-PR' }, // Innocent Murmur rank 2
        { mainId: 'MG-INN-06-TH', expectedFollowUpId: 'MG-INN-06-PR' }, // Innocent Murmur rank 6
        { mainId: 'MG-INN-10-TH', expectedFollowUpId: 'MG-INN-10-PR' }, // Innocent Murmur rank 10
      ];

      for (const tc of testCases) {
        const followUp = await repository.getFollowUpQuestion(tc.mainId);
        expect(followUp).not.toBeNull();
        expect(followUp?.question_id).toBe(tc.expectedFollowUpId);
        expect(followUp?.follow_up_for).toBe(tc.mainId);
        expect(followUp?.question_type).toBe('Follow-Up');
      }
    });

    it('safely handles unreferenced primary questions without silently fabricating associations', async () => {
      const fixtureQuestions = [
        {
          Question_ID: 'MG-UNLINKED-01-TH',
          Topic: 'Test Topic',
          Question_Type: 'Primary',
          Difficulty_Rank: 1,
          Follow_Up_For: null,
          Question: 'Main Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
        },
        {
          Question_ID: 'MG-UNLINKED-01-PR',
          Topic: 'Test Topic',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: null, // unlinked
          Question: 'Follow up Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'B',
        },
      ];

      vi.spyOn(repository, 'getAllQuestions').mockResolvedValue(
        fixtureQuestions.map((q) => repository.mapFirestoreDocToQuestion(q))
      );

      // Querying unreferenced parent MUST return null and NOT guess or fabricate an association
      const followUp = await repository.getFollowUpQuestion('MG-UNLINKED-01-TH');
      expect(followUp).toBeNull();
    });

    it('returns null when querying follow-up for non-existent question ID', async () => {
      const followUp = await repository.getFollowUpQuestion('MG-NONEXISTENT-99-TH');
      expect(followUp).toBeNull();
    });

    it('retrieves individual questions by ID from the actual dataset', async () => {
      const q1 = await repository.getQuestionById('MG-AIL-01-TH');
      expect(q1).not.toBeNull();
      expect(q1?.question_id).toBe('MG-AIL-01-TH');
      expect(q1?.topic).toBe('AI limitation');

      const q2 = await repository.getQuestionById('MG-AIA-05-PR');
      expect(q2).not.toBeNull();
      expect(q2?.question_id).toBe('MG-AIA-05-PR');
      expect(q2?.follow_up_for).toBe('MG-AIA-05-TH');

      const nonExistent = await repository.getQuestionById('NON_EXISTENT_ID');
      expect(nonExistent).toBeNull();
    });

    it('generates session questions deterministically from the dataset', async () => {
      const sessionQuestions = await repository.getSessionQuestions('2026-10-06', 10);
      expect(sessionQuestions).toHaveLength(10);
      // All session questions must be from the dataset
      for (const q of sessionQuestions) {
        expect(q.question_id).toBeTruthy();
        expect(q.question.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Production Build Packaging & Fail-Fast Availability Suite', () => {
    it('verifies that the authoritative dataset is packaged into the dist build artifact', () => {
      // In production build, dist/data/all_topics_questions.json must exist
      const distDataPath = path.resolve(__dirname, '../dist/data/all_topics_questions.json');
      expect(fs.existsSync(distDataPath)).toBe(true);
      const content = fs.readFileSync(distDataPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.questions).toHaveLength(620);
    });

    it('strictly fails fast with an explicit error when dataset path does not exist', () => {
      const badRepo = new FirestoreQuestionRepository('rel_v1_0_0', '/non/existent/dataset/path.json');
      expect(() => badRepo.loadLocalDataset()).toThrow(/Specified dataset override path.*does not exist|Fatal: Dataset file does not exist/);
    });

    it('strictly fails fast with an explicit error when dataset contains malformed JSON', () => {
      const tempBadJsonPath = path.resolve(__dirname, 'temp_malformed.json');
      fs.writeFileSync(tempBadJsonPath, '{ questions: [ invalid json syntax');

      try {
        const badRepo = new FirestoreQuestionRepository('rel_v1_0_0', tempBadJsonPath);
        expect(() => badRepo.loadLocalDataset()).toThrow(/contains malformed JSON/);
      } finally {
        if (fs.existsSync(tempBadJsonPath)) fs.unlinkSync(tempBadJsonPath);
      }
    });

    it('strictly fails fast with an explicit error when dataset contains 0 questions', () => {
      const tempEmptyJsonPath = path.resolve(__dirname, 'temp_empty.json');
      fs.writeFileSync(tempEmptyJsonPath, JSON.stringify({ questions: [] }));

      try {
        const badRepo = new FirestoreQuestionRepository('rel_v1_0_0', tempEmptyJsonPath);
        expect(() => badRepo.loadLocalDataset()).toThrow(/contains 0 questions/);
      } finally {
        if (fs.existsSync(tempEmptyJsonPath)) fs.unlinkSync(tempEmptyJsonPath);
      }
    });

    it('never silently degrades to Firestore or returns empty array when dataset is broken in local mode', async () => {
      const badRepo = new FirestoreQuestionRepository('rel_v1_0_0', '/invalid/dataset.json');
      await expect(badRepo.getAllQuestions()).rejects.toThrow();
    });
  });

  describe('Deterministic Follow-Up Lookup & Disambiguation Semantics', () => {
    it('handles duplicate parent references in synthetic fixtures deterministically and logs diagnostic warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const duplicateFixtures = [
        {
          Question_ID: 'TEST-PARENT-01-TH',
          Topic: 'Test Topic',
          Question_Type: 'Primary',
          Difficulty_Rank: 2,
          Follow_Up_For: null,
          Question: 'Parent question',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
        },
        {
          Question_ID: 'TEST-CHILD-01-PR',
          Topic: 'Test Topic',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1, // rank mismatch
          Follow_Up_For: 'TEST-PARENT-01-TH',
          Question: 'Child rank 1',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'B',
        },
        {
          Question_ID: 'TEST-CHILD-02-PR',
          Topic: 'Test Topic',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 2, // rank match
          Follow_Up_For: 'TEST-PARENT-01-TH',
          Question: 'Child rank 2',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'C',
        },
      ];

      vi.spyOn(repository, 'getAllQuestions').mockResolvedValue(
        duplicateFixtures.map((q) => repository.mapFirestoreDocToQuestion(q))
      );

      const followUp = await repository.getFollowUpQuestion('TEST-PARENT-01-TH');

      // Warning was logged with candidate IDs
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[QuestionRepository] Duplicate parent reference detected')
      );
      // Deterministically selected rank-matched candidate (TEST-CHILD-02-PR with rank 2)
      expect(followUp).not.toBeNull();
      expect(followUp?.question_id).toBe('TEST-CHILD-02-PR');
      expect(followUp?.difficulty_rank).toBe(2);

      warnSpy.mockRestore();
    });

    it('strictly does NOT invent follow-up links for unreferenced primary questions or non-existent IDs', async () => {
      const followUp = await repository.getFollowUpQuestion('MG-NONEXISTENT-99-TH');
      expect(followUp).toBeNull();
    });

    it('safely handles empty, null, whitespace, and malformed query strings by returning null', async () => {
      expect(await repository.getFollowUpQuestion('')).toBeNull();
      expect(await repository.getFollowUpQuestion('   ')).toBeNull();
      expect(await repository.getFollowUpQuestion(null as any)).toBeNull();
      expect(await repository.getFollowUpQuestion(undefined as any)).toBeNull();
      expect(await repository.getFollowUpQuestion(123 as any)).toBeNull();
    });
  });

  describe('Dataset Schema & Lineage Validator Suite (Hard Errors & Content Warnings)', () => {
    it('verifies the authoritative dataset passes all hard validation checks with zero errors and zero warnings', () => {
      const datasetPath = resolveQuestionDatasetPath();
      const content = fs.readFileSync(datasetPath, 'utf-8');
      const parsed = JSON.parse(content);
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;

      const result = validateQuestionDataset(rawQuestions);

      expect(result.isValid).toBe(true);
      expect(result.totalQuestions).toBe(620);
      expect(result.totalTopics).toBe(31);
      expect(result.primaryCount).toBe(310);
      expect(result.followUpCount).toBe(310);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('detects empty or missing Question_ID values', () => {
      const bad = [{ Question_ID: '', Topic: 'T', Question_Type: 'Primary' }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_QUESTION_ID')).toBe(true);
    });

    it('detects duplicate Question_ID values', () => {
      const bad = [
        { Question_ID: 'DUP-01', Topic: 'T', Question_Type: 'Primary', Follow_Up_For: null },
        { Question_ID: 'DUP-01', Topic: 'T', Question_Type: 'Primary', Follow_Up_For: null },
      ];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_QUESTION_ID')).toBe(true);
    });

    it('detects invalid Question_Type values', () => {
      const bad = [{ Question_ID: 'Q-01', Topic: 'T', Question_Type: 'Tertiary' }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_QUESTION_TYPE')).toBe(true);
    });

    it('detects missing required fields', () => {
      const bad = [{ Question_ID: 'Q-01', Topic: 'T', Question_Type: 'Primary', Follow_Up_For: null }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('detects Primary questions with non-null Follow_Up_For', () => {
      const bad = [{
        Question_ID: 'Q-01-TH',
        Topic: 'T',
        Question_Type: 'Primary',
        Difficulty_Rank: 1,
        Follow_Up_For: 'SOME_PARENT',
        Audience: 'RBSK',
        Question: 'Q',
        Option_A: 'A',
        Option_B: 'B',
        Option_C: 'C',
        Option_D: 'D',
        Correct: 'A',
        Explanation: 'E',
        Action: 'Act',
        MedGemma_Tag: 'tag',
      }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PRIMARY_FOLLOW_UP')).toBe(true);
    });

    it('detects Follow-Up questions with null/empty Follow_Up_For', () => {
      const bad = [{
        Question_ID: 'Q-01-PR',
        Topic: 'T',
        Question_Type: 'Follow-Up',
        Difficulty_Rank: 1,
        Follow_Up_For: null,
        Audience: 'RBSK',
        Question: 'Q',
        Option_A: 'A',
        Option_B: 'B',
        Option_C: 'C',
        Option_D: 'D',
        Correct: 'A',
        Explanation: 'E',
        Action: 'Act',
        MedGemma_Tag: 'tag',
      }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FOLLOW_UP_PARENT')).toBe(true);
    });

    it('detects Follow-Up questions referencing non-existent parent IDs', () => {
      const bad = [{
        Question_ID: 'Q-01-PR',
        Topic: 'T',
        Question_Type: 'Follow-Up',
        Difficulty_Rank: 1,
        Follow_Up_For: 'NON_EXISTENT_PARENT_ID',
        Audience: 'RBSK',
        Question: 'Q',
        Option_A: 'A',
        Option_B: 'B',
        Option_C: 'C',
        Option_D: 'D',
        Correct: 'A',
        Explanation: 'E',
        Action: 'Act',
        MedGemma_Tag: 'tag',
      }];
      const result = validateQuestionDataset(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NON_EXISTENT_PARENT')).toBe(true);
    });

    it('detects Follow-Up questions referencing a parent that is not Primary', () => {
      const bad = [
        {
          Question_ID: 'Q-PARENT-PR',
          Topic: 'T',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: 'NON_EXISTENT',
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
        {
          Question_ID: 'Q-CHILD-PR',
          Topic: 'T',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: 'Q-PARENT-PR',
          Audience: 'RBSK',
          Question: 'Q2',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
      ];
      const result = validateQuestionDataset(bad);
      expect(result.errors.some((e) => e.code === 'PARENT_NOT_PRIMARY')).toBe(true);
    });

    it('detects cross-topic parent references', () => {
      const bad = [
        {
          Question_ID: 'Q-01-TH',
          Topic: 'Topic A',
          Question_Type: 'Primary',
          Difficulty_Rank: 1,
          Follow_Up_For: null,
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
        {
          Question_ID: 'Q-01-PR',
          Topic: 'Topic B',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: 'Q-01-TH',
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
      ];
      const result = validateQuestionDataset(bad);
      expect(result.errors.some((e) => e.code === 'CROSS_TOPIC_REFERENCE')).toBe(true);
    });

    it('detects duplicate follow-ups referencing the same parent', () => {
      const bad = [
        {
          Question_ID: 'Q-01-TH',
          Topic: 'Topic A',
          Question_Type: 'Primary',
          Difficulty_Rank: 1,
          Follow_Up_For: null,
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
        {
          Question_ID: 'Q-01-PR',
          Topic: 'Topic A',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 1,
          Follow_Up_For: 'Q-01-TH',
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
        {
          Question_ID: 'Q-02-PR',
          Topic: 'Topic A',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 2,
          Follow_Up_For: 'Q-01-TH',
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
      ];
      const result = validateQuestionDataset(bad);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_FOLLOW_UP_FOR_PARENT')).toBe(true);
    });

    it('flags rank mismatches as diagnostic warnings without failing validity', () => {
      const withRankMismatch = [
        {
          Question_ID: 'Q-01-TH',
          Topic: 'Topic A',
          Question_Type: 'Primary',
          Difficulty_Rank: 1,
          Follow_Up_For: null,
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
        {
          Question_ID: 'Q-01-PR',
          Topic: 'Topic A',
          Question_Type: 'Follow-Up',
          Difficulty_Rank: 5,
          Follow_Up_For: 'Q-01-TH',
          Audience: 'RBSK',
          Question: 'Q',
          Option_A: 'A',
          Option_B: 'B',
          Option_C: 'C',
          Option_D: 'D',
          Correct: 'A',
          Explanation: 'E',
          Action: 'Act',
          MedGemma_Tag: 'tag',
        },
      ];
      const result = validateQuestionDataset(withRankMismatch);
      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'RANK_MISMATCH')).toBe(true);
    });
  });
});

