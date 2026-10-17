import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  CANONICAL_31_TOPIC_SEQUENCE,
  normalizeToCanonicalTopic,
  selectAdaptiveQueueDailyQuestions,
} from '../src/domain/rules/sessionSelection.js';
import { Question } from '../src/domain/models/question.model.js';

describe('Adaptive Learning Engine — Persistent 31-Topic Queue & Selection Suite', () => {
  let allQuestions: Question[];

  beforeEach(() => {
    const datasetPath = path.resolve(__dirname, '../../src/data/all_topics_questions.json');
    const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    allQuestions = (raw.questions || raw).map((q: any) => ({
      question_id: q.Question_ID || q.question_id,
      topic: q.Topic || q.topic,
      difficulty_rank: q.Difficulty_Rank || q.difficulty_rank,
      question_type: q.Question_Type || q.question_type,
      follow_up_for: q.Follow_Up_For || q.follow_up_for || null,
      ...q,
    }));
  });

  describe('1. Canonical Curriculum Order Invariant', () => {
    it('has exactly 31 topics in the authoritative initial sequence', () => {
      expect(CANONICAL_31_TOPIC_SEQUENCE).toHaveLength(31);
    });

    it('matches the exact five-level sequence specified by the curriculum', () => {
      // Level 1: Foundations
      expect(CANONICAL_31_TOPIC_SEQUENCE[0]).toBe('ASHA role');
      expect(CANONICAL_31_TOPIC_SEQUENCE[1]).toBe('AiSteth');
      expect(CANONICAL_31_TOPIC_SEQUENCE[2]).toBe('Echocardiogram'); // Echo role
      expect(CANONICAL_31_TOPIC_SEQUENCE[3]).toBe('CHD basics');
      expect(CANONICAL_31_TOPIC_SEQUENCE[4]).toBe('Innocent Murmur');
      expect(CANONICAL_31_TOPIC_SEQUENCE[5]).toBe('Murmur Not Diagnosis');
      expect(CANONICAL_31_TOPIC_SEQUENCE[6]).toBe('AI limitation');

      // Level 2: Recognizing Basic Clinical Signs
      expect(CANONICAL_31_TOPIC_SEQUENCE[7]).toBe('Fever Flow Murmur');
      expect(CANONICAL_31_TOPIC_SEQUENCE[8]).toBe('Family History');
      expect(CANONICAL_31_TOPIC_SEQUENCE[9]).toBe('Feeding Red Flags');
      expect(CANONICAL_31_TOPIC_SEQUENCE[10]).toBe('Exercise Intolerance');
      expect(CANONICAL_31_TOPIC_SEQUENCE[11]).toBe('Cyanosis');
      expect(CANONICAL_31_TOPIC_SEQUENCE[12]).toBe('Apex');
      expect(CANONICAL_31_TOPIC_SEQUENCE[13]).toBe('Five Points');
      expect(CANONICAL_31_TOPIC_SEQUENCE[14]).toBe('Llsb');
      expect(CANONICAL_31_TOPIC_SEQUENCE[15]).toBe('Position Change');
      expect(CANONICAL_31_TOPIC_SEQUENCE[16]).toBe('Noise Quality');

      // Level 3: Murmur Interpretation
      expect(CANONICAL_31_TOPIC_SEQUENCE[17]).toBe('Systolic Timing');
      expect(CANONICAL_31_TOPIC_SEQUENCE[18]).toBe('Diastolic');
      expect(CANONICAL_31_TOPIC_SEQUENCE[19]).toBe('Continuous Murmur');
      expect(CANONICAL_31_TOPIC_SEQUENCE[20]).toBe('Thrill');
      expect(CANONICAL_31_TOPIC_SEQUENCE[21]).toBe('Ai Abnormal');

      // Level 4: Conditions and Clinical Reasoning
      expect(CANONICAL_31_TOPIC_SEQUENCE[22]).toBe('Rhd Basics');
      expect(CANONICAL_31_TOPIC_SEQUENCE[23]).toBe('Rhd Age');
      expect(CANONICAL_31_TOPIC_SEQUENCE[24]).toBe('Chorea');
      expect(CANONICAL_31_TOPIC_SEQUENCE[25]).toBe('Sore Throat History');
      expect(CANONICAL_31_TOPIC_SEQUENCE[26]).toBe('Rbsk Condition');

      // Level 5: Field Workflows and Prevention
      expect(CANONICAL_31_TOPIC_SEQUENCE[27]).toBe('Anaemia flow');
      expect(CANONICAL_31_TOPIC_SEQUENCE[28]).toBe('Sore Throat Prevention');
      expect(CANONICAL_31_TOPIC_SEQUENCE[29]).toBe('Secondary Prevention');
      expect(CANONICAL_31_TOPIC_SEQUENCE[30]).toBe('DEIC');
    });

    it('normalizes display and case variants to canonical dataset topics without loss', () => {
      expect(normalizeToCanonicalTopic('Echo role')).toBe('Echocardiogram');
      expect(normalizeToCanonicalTopic('echorole')).toBe('Echocardiogram');
      expect(normalizeToCanonicalTopic('innocent murmur')).toBe('Innocent Murmur');
      expect(normalizeToCanonicalTopic('AI abnormal')).toBe('Ai Abnormal');
      expect(normalizeToCanonicalTopic('LLSB')).toBe('Llsb');
      expect(normalizeToCanonicalTopic('RBSK condition')).toBe('Rbsk Condition');
    });
  });

  describe('2. Daily Session Selection & Same-Session Uniqueness', () => {
    it('selects exactly 10 distinct topics in initial queue order for a new learner', () => {
      const result = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
        lifetimeCompletedQuestionIds: [],
        count: 10,
      });

      expect(result.selectedQuestions).toHaveLength(10);
      expect(result.selectedTopics).toHaveLength(10);
      expect(new Set(result.selectedTopics).size).toBe(10);

      // Verify exact 10 topic order matches front of queue
      for (let i = 0; i < 10; i++) {
        expect(result.selectedTopics[i]).toBe(CANONICAL_31_TOPIC_SEQUENCE[i]);
      }

      // Verify all selected questions are Primary
      result.selectedQuestions.forEach((q: any) => {
        const type = q.question_type || q.Question_Type;
        expect(type).toBe('Primary');
      });
    });

    it('strictly guarantees no topic is duplicated in the same daily session', () => {
      const result = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
        lifetimeCompletedQuestionIds: ['MG-ASH-01-TH'],
        count: 10,
      });

      const uniqueTopics = new Set(result.selectedTopics);
      expect(uniqueTopics.size).toBe(result.selectedTopics.length);
    });

    it('picks the lowest rank uncompleted question for each selected topic', () => {
      // Learner already completed MG-ASH-01-TH and MG-AIS-01-TH
      const result = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
        lifetimeCompletedQuestionIds: ['MG-ASH-01-TH', 'MG-AIS-01-TH'],
        count: 10,
      });

      // For ASHA role, should pick rank 2 (MG-ASH-02-TH)
      const ashQuestion = result.selectedQuestions.find((q: any) => q.topic === 'ASHA role' || q.Topic === 'ASHA role');
      expect((ashQuestion as any).question_id).toBe('MG-ASH-02-TH');

      // For AiSteth, should pick rank 2 (MG-AIS-02-TH)
      const aisQuestion = result.selectedQuestions.find((q: any) => q.topic === 'AiSteth' || q.Topic === 'AiSteth');
      expect((aisQuestion as any).question_id).toBe('MG-AIS-02-TH');
    });
  });

  describe('3. Completed-Question Fallback & Topic Exhaustion', () => {
    it('advances to next queue topic and DOES NOT silently reuse a completed question when a topic is exhausted', () => {
      // Complete all 10 questions of ASHA role (MG-ASH-01-TH through MG-ASH-10-TH)
      const ashCompleted = Array.from({ length: 10 }, (_, i) => `MG-ASH-${String(i + 1).padStart(2, '0')}-TH`);

      const result = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
        lifetimeCompletedQuestionIds: ashCompleted,
        count: 10,
      });

      // ASHA role must be recorded as exhausted and NOT included in selectedTopics
      expect(result.exhaustedTopics).toContain('ASHA role');
      expect(result.selectedTopics).not.toContain('ASHA role');

      // Selection must still contain 10 distinct topics by advancing to topic 11 (Exercise Intolerance)
      expect(result.selectedTopics).toHaveLength(10);
      expect(result.selectedTopics[0]).toBe('AiSteth'); // Topic 2
      expect(result.selectedTopics[9]).toBe('Exercise Intolerance'); // Topic 11
      expect(new Set(result.selectedTopics).size).toBe(10);
    });

    it('surfaces curriculum completion state if all topics are exhausted without fabricating questions', () => {
      // Complete all 310 Primary questions
      const allPrimaryIds = allQuestions
        .filter((q: any) => (q.Question_Type || q.question_type) === 'Primary')
        .map((q: any) => q.Question_ID || q.question_id);

      const result = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
        lifetimeCompletedQuestionIds: allPrimaryIds,
        count: 10,
      });

      expect(result.isCurriculumCompleted).toBe(true);
      expect(result.remainingUncompletedCount).toBe(0);
      expect(result.selectedQuestions).toHaveLength(0);
      expect(result.exhaustedTopics).toHaveLength(31);
    });
  });

  describe('4. Topic Queue Rotation Simulation Across Cycles', () => {
    it('simulates multi-day round-robin progression covering all 31 topics over 4 days', () => {
      let currentQueue = [...CANONICAL_31_TOPIC_SEQUENCE];
      const completedIds: string[] = [];
      const topicsCoveredPerDay: string[][] = [];

      // Day 1
      const day1 = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: currentQueue,
        lifetimeCompletedQuestionIds: completedIds,
        count: 10,
      });
      topicsCoveredPerDay.push(day1.selectedTopics);
      expect(day1.selectedTopics).toHaveLength(10);

      // Rotate Day 1 topics to the back of the queue as they finish
      day1.selectedTopics.forEach((t) => {
        currentQueue = currentQueue.filter((x) => x !== t).concat(t);
      });

      // Day 2
      const day2 = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: currentQueue,
        lifetimeCompletedQuestionIds: completedIds,
        count: 10,
      });
      topicsCoveredPerDay.push(day2.selectedTopics);
      expect(day2.selectedTopics).toHaveLength(10);
      // Day 2 topics should be topics 11 to 20
      expect(day2.selectedTopics[0]).toBe('Exercise Intolerance');

      // Rotate Day 2 topics
      day2.selectedTopics.forEach((t) => {
        currentQueue = currentQueue.filter((x) => x !== t).concat(t);
      });

      // Day 3
      const day3 = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: currentQueue,
        lifetimeCompletedQuestionIds: completedIds,
        count: 10,
      });
      topicsCoveredPerDay.push(day3.selectedTopics);
      expect(day3.selectedTopics).toHaveLength(10);
      // Day 3 topics should be topics 21 to 30
      expect(day3.selectedTopics[0]).toBe('Thrill');

      // Rotate Day 3 topics
      day3.selectedTopics.forEach((t) => {
        currentQueue = currentQueue.filter((x) => x !== t).concat(t);
      });

      // Day 4: Should pick topic 31 (DEIC), then wrapped Day 1 topics
      const day4 = selectAdaptiveQueueDailyQuestions({
        pool: allQuestions,
        topicQueue: currentQueue,
        lifetimeCompletedQuestionIds: completedIds,
        count: 10,
      });
      topicsCoveredPerDay.push(day4.selectedTopics);
      expect(day4.selectedTopics[0]).toBe('DEIC');
      expect(day4.selectedTopics[1]).toBe('ASHA role');

      // Verify all 31 unique topics were introduced across the 4 days
      const allSampledTopics = new Set(topicsCoveredPerDay.flat());
      expect(allSampledTopics.size).toBe(31);
    });
  });
});
