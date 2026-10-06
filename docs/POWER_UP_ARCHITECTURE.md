# AiSteth Academy — Power-Up System Architecture Specification

## 1. Executive Overview

This document specifies the frozen architectural design, data models, state lifecycle, persistence mechanisms, security constraints, and testing strategy for the **AiSteth Academy Power-Up System**.

The power-up system is designed as a pedagogical engagement and scaffolding framework within a clinical training assessment application. It contains **EXACTLY THREE** power-ups:

1. **50/50** (`FIFTY_FIFTY`): Unlocked at a 20-day streak. Eliminates exactly two incorrect options from a multiple-choice question.
2. **LEARN** (`LEARN`): Unlocked after 100 answered questions. Displays the canonical clinical learning objective associated with the active question.
3. **STREAK SHIELD** (`STREAK_SHIELD`): Unlocked at a 30-day streak. Automatically protects an active training streak when the trainee misses exactly one expected training calendar day.

> **Important**: HINT and RETRY have been permanently removed from the active architecture. Trainee answer submissions are final (0 XP for incorrect answers, no second attempts).

---

## 2. Power-Up Specification Matrix

| Power-Up | Type Key | Unlock Condition | Applicable Question Types | Scope / Lifecycle | Primary Pedagogical Effect |
|---|---|---|---|---|---|
| **50/50** | `FIFTY_FIFTY` | `currentStreak >= 20` | `MCQ` only | In-session, per-question (resets on question change) | Eliminates 2 incorrect options deterministically. Correct answer remains active. |
| **LEARN** | `LEARN` | `completedQuestionsCount >= 100` | All types with `learning_objective` | In-session, per-question (resets on question change) | Surfaces clinical learning objective as scaffolding without revealing answer. |
| **STREAK SHIELD** | `STREAK_SHIELD` | `currentStreak >= 30` | Universal (account-level) | Passive calendar evaluation (consumed upon protection) | Preserves streak across 1 missed calendar day. Consumed immediately. |

---

## 3. State Architecture: Account-Level vs. Question-Level

A strict separation of concerns is maintained between **Account-Level** progression state and **Question-Level** transient usage state.

```
+---------------------------------------------------------------------------------+
| ACCOUNT-LEVEL STATE (Persistent in Cloud Firestore & Local StorageRepository)   |
|                                                                                 |
| - totalXp: number                                                               |
| - currentStreak: number                                                         |
| - longestStreak: number                                                         |
| - completedSessionsCount: number                                                |
| - completedQuestionsCount: number                                               |
| - totalCorrectAnswersCount: number                                              |
| - streakShieldConsumed: boolean                                                 |
| - lastActiveDate: string (YYYY-MM-DD)                                           |
|                                                                                 |
| PowerUpService.calculateInventory(userStats) calculates:                        |
| -> FIFTY_FIFTY: isUnlocked = currentStreak >= 20                                 |
| -> LEARN: isUnlocked = completedQuestionsCount >= 100                           |
| -> STREAK_SHIELD: isUnlocked = currentStreak >= 30, isConsumed = streakShield...|
+---------------------------------------------------------------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
| QUESTION-LEVEL STATE (Session-Scoped Transient / In-Progress Persistence)      |
|                                                                                 |
| - fiftyFiftyEliminatedOptions: Record<number, string[]>                         |
|   (e.g., { 0: ['option_b', 'option_c'] })                                       |
| - learnClueRevealed: Record<number, boolean>                                    |
|   (e.g., { 0: true })                                                           |
|                                                                                 |
| Lifecycle Rules:                                                                |
| 1. Evaluated per question index.                                                |
| 2. Persisted to DailySessionData to survive page refreshes while in-session.    |
| 3. Resets for subsequent questions (each question has independent usage).       |
| 4. Cannot be used more than once per individual question.                       |
+---------------------------------------------------------------------------------+
```

---

## 4. Power-Up Service & Business Rules

Centralized logic is encapsulated in [`src/services/PowerUpService.ts`](../src/services/PowerUpService.ts):

### 4.1 50/50 Elimination Algorithm
* **Input**: Question (`QuestionItem`), account stats (`UserStats`), already-used flag (`boolean`).
* **Eligibility**: `currentStreak >= 20`, question type must be `'MCQ'`, must not have been already used on current question.
* **Algorithm**:
  1. Identifies all 4 options: `option_a`, `option_b`, `option_c`, `option_d`.
  2. Filters out the `correct_answer` (e.g., if correct is `option_a`, pool is `['option_b', 'option_c', 'option_d']`).
  3. Deterministically selects exactly two options to eliminate (e.g., the first two from the incorrect pool).
  4. The correct answer is **never** eliminated under any circumstances.
  5. The trainee must still select and submit their chosen answer.
  6. 50/50 does not award XP, does not alter answer correctness, and does not automatically submit.

### 4.2 LEARN Scaffolding Algorithm
* **Input**: Question (`QuestionItem`), account stats (`UserStats`), already-used flag (`boolean`).
* **Eligibility**: `completedQuestionsCount >= 100`, question must contain non-empty `learning_objective`, not already used on current question.
* **Behavior**:
  1. Retrieves canonical `question.learning_objective`.
  2. Displays objective in a dedicated educational card.
  3. Does not reveal the correct option.
  4. Does not alter XP, submission state, or question count.

### 4.3 STREAK SHIELD Protection Algorithm
* **Input**: `lastActiveDateStr`, `currentStreak`, `isConsumed`.
* **Eligibility**: `currentStreak >= 30` and `streakShieldConsumed === false`.
* **Calculation** (in `StorageRepository.computeStreak`):
  * **Consecutive day** (delta = 1 day): `newStreak = currentStreak + 1`, `shieldWasConsumed = false`.
  * **Exactly 1 missed day** (delta = 2 days):
    * If `currentStreak >= 30` and `!isConsumed`: `newStreak = currentStreak + 1`, `shieldWasConsumed = true`.
    * If `currentStreak < 30` or `isConsumed`: streak breaks -> `newStreak = 1`.
  * **2 or more consecutive missed days** (delta >= 3 days): streak breaks regardless -> `newStreak = 1`.

---

## 5. Cloud Firestore Architecture & Lifecycle

The application operates on the **Firebase Spark Tier (Client-Authoritative with Strict Security Rule Constraints)**.

```
Firebase Hosting (SPA)
        |
        v
React + Vite + PWA
        |
        +---> Firebase Authentication (Username -> synthetic email)
        |
        +---> Cloud Firestore (Direct client SDK writes bounded by security rules)
```

### 5.1 Document Schemas
* **`users/{uid}`**:
  Contains user profile and `learningState`:
  ```json
  {
    "uid": "USER_UID",
    "username": "trainee_01",
    "role": "TRAINEE",
    "organizationId": "org_rbsk_national",
    "learningState": {
      "totalXp": 125,
      "currentStreak": 21,
      "longestStreak": 21,
      "currentLevel": 2,
      "completedSessionsCount": 5,
      "completedQuestionsCount": 50,
      "totalCorrectAnswersCount": 42,
      "streakShieldActive": false,
      "streakShieldConsumed": false,
      "lastActiveDate": "2026-10-06"
    }
  }
  ```

* **`users/{uid}/dailySessions/{sessionId}`**:
  Created at session start via `SessionService.startDailySession()`:
  ```json
  {
    "sessionId": "daily_2026-10-06_12345",
    "userId": "USER_UID",
    "date": "2026-10-06",
    "status": "IN_PROGRESS",
    "totalQuestions": 10,
    "completedQuestionsCount": 0,
    "correctCount": 0,
    "totalXpEarned": 0,
    "powerUpsUsed": {
      "FIFTY_FIFTY": ["Q_MCQ_01"],
      "LEARN": ["Q_MCQ_01"]
    },
    "currentQuestionIndex": 0,
    "streakShieldProtected": false,
    "version": "1.0.0"
  }
  ```

* **`users/{uid}/attempts/{attemptId}`**:
  Strictly append-only attempt record created on answer submission via `SessionService.recordAttempt()`:
  ```json
  {
    "attemptId": "att_12345_abc",
    "dailySessionId": "daily_2026-10-06_12345",
    "userId": "USER_UID",
    "questionId": "Q_MCQ_01",
    "category": "DEVICE_HANDLING",
    "questionType": "MCQ",
    "userAnswerPayload": { "type": "MCQ", "selected_option": "option_a" },
    "result": "CORRECT",
    "awardedXp": 5,
    "responseTimeMs": 3200,
    "powerUpsActive": ["FIFTY_FIFTY"]
  }
  ```

### 5.2 Security Rules Constraints (`firestore.rules`)
Firestore security rules enforce mathematical boundaries on client writes:
* `totalXp <= oldXp + 200` (prevents arbitrary XP inflation).
* `currentStreak <= oldStreak + 1` (prevents skipping streak days).
* `completedSessionsCount <= oldSessions + 1` (prevents skipping sessions).
* `attempts` are **strictly append-only** (`allow update: if false; allow delete: if false`).
* `dailySessions` require exactly 10 questions (`questionIds.size() == 10`).
* **Completed Session Locking**: `dailySessions/{sessionId}` allows updates ONLY when `resource.data.status != 'COMPLETED' && resource.data.status != 'REVIEW_COMPLETED' && resource.data.status != 'REVIEW_VIEWED'`. Once completed, any client update to the session document is strictly rejected by Firestore Security Rules (`PERMISSION_DENIED`).

### 5.3 Idempotency & Duplicate-Finalization Safeguards
To prevent double-clicks, network retries, or browser refreshes from duplicating user progression:
1. **Pre-Check**: `SessionService.finalizeSession()` inspects the target `dailySessions/{sessionId}` document in Firestore. If the session already holds a terminal status (`COMPLETED`, `REVIEW_COMPLETED`, `REVIEW_VIEWED`) or `reviewViewed === true`, finalization aborts immediately with zero progression writes.
2. **Atomic Transition Gate**: The session document is transitioned to `REVIEW_COMPLETED` first. If this write fails or is rejected by Firestore security rules (because the session is already locked), the progression update to `users/{uid}` is strictly aborted.
3. **In-Memory Concurrency Guard**: An in-flight `finalizingSessionIds` Set prevents multiple concurrent invocations within the same runtime.
4. **Local Repository Guard**: `StorageRepository.saveSession()` checks if `session.sessionId` is already stored in local storage before recalculating cumulative `userStats`. Duplicate saves update session data but never re-increment stats.

---

## 6. Authentication & Cross-Device Hydration

On trainee sign-in via `AuthService.loginWithUsername()`:
1. Firebase Auth signs in with `${username}@aisteth.internal`.
2. Fetches `users/{uid}` profile and `learningState` from Cloud Firestore.
3. Maps `learningState` into local `UserStats` model via `StorageRepository.saveUserStats()`.
4. Calculates power-up eligibility dynamically from the hydrated state.
5. **Cross-Device Guarantee**: Logging in on Device B or a freshly installed PWA instantly restores `50/50`, `LEARN`, and `STREAK SHIELD` unlock statuses directly from the cloud.

---

## 7. Verification & Testing Strategy

A complete verification harness validates the architecture across multiple levels:

1. **Unit & Boundary Tests** (`tests/HomeScreenProgressionAndPowerUps.test.ts`):
   * 50/50: 19 streak (locked) vs 20 streak (unlocked).
   * LEARN: 99 questions (locked) vs 100 questions (unlocked).
   * STREAK SHIELD: 29 streak (locked) vs 30 streak (unlocked).
   * Isolation: Streak does not unlock LEARN; questions do not unlock 50/50.
2. **Behavioral & Removal Tests** (`tests/PowerUpsAndProfileInteractive.test.ts`):
   * 50/50 eliminates exactly 2 incorrect options, never correct answer.
   * Feedback drawer has no retry button or retry callback.
   * STREAK SHIELD Cases A through F.
3. **Comprehensive Audit Tests** (`tests/PowerUpAuditExecution.test.ts`):
   * All 3 power-ups verified under elevated vs zero states.
   * HINT and RETRY confirmed completely absent.
4. **Live Cloud DEV Verification** (`scripts/verify_live_dev.js`):
   * Real end-to-end execution against `aisteth-academy-dev` using QA account `powerup_qa_test`.
   * Proves login, profile retrieval, cloud state hydration, session creation, attempt creation, session finalization, cross-refresh persistence, and cross-device logout/login sync.
