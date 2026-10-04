/**
 * AiSteth Academy - Session Generator Contract
 * Interface for generating daily session question sets.
 * Future phases will replace DummySessionGenerator with LeitnerSpacedRepetitionEngine.
 */

import { Question } from '../models/question.types';
import { StoredSessionRecord } from '../models/session.types';

export interface ISessionGenerator {
  /**
   * Generates a batch of questions for a learning session.
   * @param allQuestions Complete question bank
   * @param userHistory Previous session performance records (for future Leitner scheduling)
   * @param count Desired question count
   */
  generateSession(
    allQuestions: Question[],
    userHistory?: StoredSessionRecord[],
    count?: number
  ): Question[];
}

export class DummySessionGenerator implements ISessionGenerator {
  generateSession(
    allQuestions: Question[],
    _userHistory?: StoredSessionRecord[],
    count: number = 10
  ): Question[] {
    if (allQuestions.length <= count) {
      return [...allQuestions];
    }

    // Ensure all 5 question types are well represented
    const groupedByType: Record<string, Question[]> = {};
    allQuestions.forEach((q) => {
      if (!groupedByType[q.type]) groupedByType[q.type] = [];
      groupedByType[q.type].push(q);
    });

    const result: Question[] = [];
    const types = Object.keys(groupedByType);

    // Round-robin selection across question types
    let index = 0;
    while (result.length < count && result.length < allQuestions.length) {
      const currentType = types[index % types.length];
      const available = groupedByType[currentType];
      if (available && available.length > 0) {
        const item = available.shift()!;
        result.push(item);
      }
      index++;
    }

    // If still need more, pick remaining from anywhere
    if (result.length < count) {
      const usedIds = new Set(result.map((q) => q.question_id));
      const leftovers = allQuestions.filter((q) => !usedIds.has(q.question_id));
      for (const q of leftovers) {
        if (result.length >= count) break;
        result.push(q);
      }
    }

    return result;
  }
}
