/**
 * AiSteth Academy — Phase 2 Session Question Selection Engine (rel_v1_0_0)
 * Specification Baseline: v2.6.1-PROD-SPEC Section 3
 */

export interface ReleaseQuestionMetadata {
  questionId: string;
  questionType: 'Primary' | 'Follow-Up';
  difficultyRank: number; // 1 to 10
}

/**
 * Canonical 20-Question Inventory for Module 1 (AI_limitation.json / rel_v1_0_0)
 */
export const REL_V1_0_0_QUESTIONS: ReleaseQuestionMetadata[] = [
  { questionId: 'MG-AIL-01-TH', questionType: 'Primary', difficultyRank: 1 },
  { questionId: 'MG-AIL-01-PR', questionType: 'Follow-Up', difficultyRank: 1 },
  { questionId: 'MG-AIL-02-TH', questionType: 'Primary', difficultyRank: 2 },
  { questionId: 'MG-AIL-02-PR', questionType: 'Follow-Up', difficultyRank: 2 },
  { questionId: 'MG-AIL-03-TH', questionType: 'Primary', difficultyRank: 3 },
  { questionId: 'MG-AIL-03-PR', questionType: 'Follow-Up', difficultyRank: 3 },
  { questionId: 'MG-AIL-04-TH', questionType: 'Primary', difficultyRank: 4 },
  { questionId: 'MG-AIL-04-PR', questionType: 'Follow-Up', difficultyRank: 4 },
  { questionId: 'MG-AIL-05-TH', questionType: 'Primary', difficultyRank: 5 },
  { questionId: 'MG-AIL-05-PR', questionType: 'Follow-Up', difficultyRank: 5 },
  { questionId: 'MG-AIL-06-TH', questionType: 'Primary', difficultyRank: 6 },
  { questionId: 'MG-AIL-06-PR', questionType: 'Follow-Up', difficultyRank: 6 },
  { questionId: 'MG-AIL-07-TH', questionType: 'Primary', difficultyRank: 7 },
  { questionId: 'MG-AIL-07-PR', questionType: 'Follow-Up', difficultyRank: 7 },
  { questionId: 'MG-AIL-08-TH', questionType: 'Primary', difficultyRank: 8 },
  { questionId: 'MG-AIL-08-PR', questionType: 'Follow-Up', difficultyRank: 8 },
  { questionId: 'MG-AIL-09-TH', questionType: 'Primary', difficultyRank: 9 },
  { questionId: 'MG-AIL-09-PR', questionType: 'Follow-Up', difficultyRank: 9 },
  { questionId: 'MG-AIL-10-TH', questionType: 'Primary', difficultyRank: 10 },
  { questionId: 'MG-AIL-10-PR', questionType: 'Follow-Up', difficultyRank: 10 },
];

/**
 * Resolved timezone for calendar date computation (India Standard Time).
 */
export const DEFAULT_APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Computes calendar date string (YYYY-MM-DD) in the resolved timezone.
 */
export function getResolvedCalendarDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD
}

/**
 * Computes the Julian Day Number for a YYYY-MM-DD date to determine day parity.
 */
export function computeDayParity(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const timeMs = dateObj.getTime();
  const dayNumber = Math.floor(timeMs / (1000 * 60 * 60 * 24));
  return Math.abs(dayNumber) % 2; // 0 for Even Parity, 1 for Odd Parity
}

/**
 * Selects exactly 10 questions for a daily session from rel_v1_0_0.
 *
 * Selection Rules:
 * - Deterministic based on the resolved Asia/Kolkata calendar date and day-parity rotation.
 * - Day Parity 0 (Even) -> Set A (10 Primary -TH questions, Ranks 1 to 10).
 * - Day Parity 1 (Odd)  -> Set B (10 Follow-Up -PR questions, Ranks 1 to 10).
 * - Guaranteed 0% question overlap between consecutive calendar-day sessions.
 * - Guaranteed exact 1-to-1 coverage across difficulty ranks 1 to 10.
 */
export function selectSessionQuestions(
  dateStr: string,
  pool: ReleaseQuestionMetadata[] = REL_V1_0_0_QUESTIONS
): string[] {
  if (!dateStr) {
    throw new Error('dateStr is required for deterministic session selection.');
  }

  const parity = computeDayParity(dateStr);
  const targetType = parity === 0 ? 'Primary' : 'Follow-Up';

  const set = pool
    .filter((q) => q.questionType === targetType)
    .sort((a, b) => a.difficultyRank - b.difficultyRank);

  if (set.length !== 10) {
    throw new Error(
      `Dataset configuration error: Expected exactly 10 questions for type '${targetType}', found ${set.length}.`
    );
  }

  // Verify all 10 difficulty ranks are present
  const ranks = set.map((q) => q.difficultyRank);
  for (let rank = 1; rank <= 10; rank++) {
    if (!ranks.includes(rank)) {
      throw new Error(`Dataset configuration error: Missing question for difficulty rank ${rank}.`);
    }
  }

  return set.map((q) => q.questionId);
}
