# AiSteth Academy — Power-Up Functionality Audit

## 1. Objective

The objective of this audit is to conduct an uncompromising, end-to-end functionality audit of the Power-Ups system within AiSteth Academy. The goal is to prove whether each power-up—**HINT**, **LEARN**, **RETRY**, and **STREAK SHIELD**—is genuinely functional end-to-end, partially functional, UI-only, broken, or not implemented.

This audit does **not** rely on visual UI presence (cards, badges, or buttons). Every power-up was tested from unlock evaluation, user interaction, state mutations, local storage persistence, to backend Firestore security rules and document writes.

---

## 2. Test Environment

* **Target Firebase Project**: `aisteth-academy-dev` (Google Cloud Project ID: `aisteth-academy-dev`, Web App ID: `1:384522486019:web:e6d54cc0269fe874aee936`)
* **Environment Tier**: Dedicated Development Environment (No production access or modifications)
* **Local Test Runtime**: Node.js `v24.14.1`, Vite `6.4.3`, Vitest `2.1.9`
* **Local Web Server**: `http://localhost:3000/`
* **Firestore Security Rules**: Active production-grade rules deployed under `firestore.rules` (v2 ruleset)

---

## 3. Test User

* **Username**: `powerup_qa_test`
* **Synthetic Auth Email**: `powerup_qa_test@aisteth.internal`
* **Auth UID**: `Mm1TrJPtd0ZUhPgwjehmndpD8E12`
* **Firebase Environment**: `aisteth-academy-dev`
* **Role**: `TRAINEE`
* **Organization**: `org_rbsk_national`
* **Purpose**: Dedicated non-production test account created exclusively for Power-Up functionality auditing.
* **Credentials**: Provisioned programmatically in Firebase DEV Auth and Firestore. *(Passwords excluded per security guidelines)*

---

## 4. Current Power-Up Architecture

The system defines four official power-ups in [`src/models/powerup.types.ts`](../src/models/powerup.types.ts) and [`src/services/PowerUpService.ts`](../src/services/PowerUpService.ts):

| Power-Up | Official Name | Unlock Condition | Primary Effect | Intended Scope |
|---|---|---|---|---|
| **HINT** | HINT | `totalCorrectAnswersCount >= 50` | Eliminates 2 incorrect options from an MCQ question | In-session active question |
| **LEARN** | LEARN | `completedQuestionsCount >= 100` | Reveals clinical diagnostic learning objective | In-session active question |
| **RETRY** | RETRY | `currentStreak >= 20` | Allows 1 re-attempt on an incorrectly answered question | Post-submission feedback |
| **STREAK SHIELD** | STREAK SHIELD | `currentStreak >= 30` | Automatically preserves active streak on 1 missed day | Passive progression |

### Execution Pipeline

1. **Unlock Evaluation**: [`PowerUpService.calculateInventory`](../src/services/PowerUpService.ts) deterministically compares user stats against unlock thresholds.
2. **Session State**: Managed by the custom React hook [`useLearningSession`](../src/hooks/useLearningSession.ts).
3. **In-Session UI**: [`DailySessionScreen`](../src/views/DailySessionScreen.tsx) renders the power-up toolbar, [`MCQRenderer`](../src/components/questions/MCQRenderer.tsx) renders eliminated options, and [`FeedbackDrawer`](../src/components/feedback/FeedbackDrawer.tsx) renders the retry action.
4. **Local Persistence**: [`StorageRepository`](../src/repositories/StorageRepository.ts) stores session progress in IndexedDB (`aisteth_academy_db`) stores `daily_sessions`, `user_stats`, and `session_records`.
5. **Backend Services**: [`SessionService`](../src/services/SessionService.ts) contains definitions for Firestore daily sessions and append-only attempts with `retryOfAttemptId`.

---

## 5. Source Code Findings

A complete audit of the codebase revealed several major architectural realities:

### 1. `SessionService.ts` is Completely Disconnected from the Active Frontend
* [`src/services/SessionService.ts`](../src/services/SessionService.ts) defines `startDailySession()`, `recordAttempt()`, and `finalizeSession()`, including schemas for `users/{uid}/dailySessions` and `users/{uid}/attempts`.
* **Finding**: `SessionService` is **never imported or invoked** anywhere in the active frontend application.
* [`src/hooks/useLearningSession.ts`](../src/hooks/useLearningSession.ts) interacts **solely** with `StorageRepository` (IndexedDB / localStorage).
* Consequently, **no session documents, attempt documents, or power-up usage records are ever written to Cloud Firestore by the frontend during daily learning**.

### 2. Slicing Out / Discarding History on RETRY
* When a user activates RETRY in [`src/hooks/useLearningSession.ts`](../src/hooks/useLearningSession.ts) (line 407):
  ```typescript
  // Remove the incorrect answer attempt from history so the re-attempt replaces it
  const updatedHistory = prev.history.slice(0, prev.currentIndex);
  ```
* **Finding**: The failed initial attempt is **deleted from memory** instead of being preserved in an append-only lineage. The claimed `retryOfAttemptId` link does not exist in client session state.

### 3. Firestore Security Rules Block Direct Elevation
* When attempting to write an elevated `learningState` (`totalCorrectAnswersCount: 50`, `completedQuestionsCount: 100`, `currentStreak: 30`) directly to Firestore `users/{uid}`, Firestore rejected the write with `PERMISSION_DENIED`.
* **Finding**: `firestore.rules` enforces delta clamps (`totalXp <= old + 200`, `currentStreak <= old + 1`, `completedSessionsCount <= old + 1`). This confirms that Firestore Security Rules are active and correctly prevent trainees from granting themselves arbitrary power-ups in the cloud database.

### 4. Client Progression Disconnect from Firestore
* When a user signs in via [`AuthService.loginWithUsername`](../src/services/AuthService.ts), it fetches the user profile from Firestore and writes `storageRepository.saveUserProfile(profile)`.
* **Finding**: `AuthService` **does not populate `storageRepository.saveUserStats`** from Firestore `learningState`. All user stats are read locally from IndexedDB. If a user logs in on a new device or browser, their local stats default to 0, locking all power-ups regardless of their Firestore profile.

---

## 6. HINT Test

* **Pre-requisite**: Test user elevated state with `totalCorrectAnswersCount: 50`.
* **Initial UI State**:
  * In `PowerUpsScreen`: HINT displays as **Available** with green badge and tagline *"Eliminates 2 incorrect options"*.
  * In `DailySessionScreen`: Pre-submission toolbar displays `[💡 HINT]` button as active/clickable.
* **Question Tested**: `DEMO_MCQ_001` (Type: `MCQ`, Difficulty: `BEGINNER`).
  * Option A (Correct): *"Ensure device power is on and battery indicator is green"*
  * Option B (Incorrect): *"Check the patient's height and weight record"*
  * Option C (Incorrect): *"Ensure the room temperature is below 20°C"*
  * Option D (Incorrect): *"Check the mobile SIM card balance"*
* **Action Executed**: Learner clicked `HINT`.
* **Observed Behavior**:
  1. `PowerUpService.getEliminatedOptions()` evaluated `sampleMCQ`.
  2. Exactly two incorrect options were eliminated: **Option B** and **Option C**.
  3. The correct answer (**Option A**) and **Option D** remained available.
  4. In `MCQRenderer`, Option B and Option C were styled with `line-through`, `opacity: 0.45`, dashed borders, and an `"Eliminated"` badge.
  5. Clicking Option B or Option C did not select them (`disabled={isSubmitted || isEliminated}`).
  6. The HINT button transformed to `HINT (Used)` with `opacity: 0.6` and `disabled=true`.
  7. Clicking HINT again did not trigger any action (`canUseHint` returned `reason: "HINT has already been used on this question"`).
  8. Learner selected Option A and clicked *"Check Answer"*. Answer was evaluated as `CORRECT` (+5 XP).
  9. Advanced to Question 2: `hintEliminatedOptions[1]` was empty. Eliminated options did not bleed into subsequent questions.
* **Persistence**:
  * `hintEliminatedOptions[0]: ['option_b', 'option_c']` persisted to IndexedDB `daily_sessions`.
  * Reloading the browser on Question 1 restored the eliminated state.
* **Verdict**: **FULLY FUNCTIONAL** *(In-Session MCQ elimination works as designed)*.

---

## 7. LEARN Test

* **Pre-requisite**: Test user elevated state with `completedQuestionsCount: 100`.
* **Initial UI State**:
  * In `PowerUpsScreen`: LEARN displays as **Available** with green badge and tagline *"Reveals clinical learning clue"*.
  * In `DailySessionScreen`: Pre-submission toolbar displays `[📖 LEARN]` button as active/clickable.
* **Question Tested**: `DEMO_MCQ_001`.
  * Learning Objective: *"Verify device readiness and power status prior to starting clinical examination."*
* **Action Executed**: Learner clicked `LEARN` before answering.
* **Observed Behavior**:
  1. `PowerUpService.canUseLearn()` verified `completedQuestionsCount >= 100` and extracted `currentQuestion.learning_objective`.
  2. A styled amber banner appeared at the top of the question container:
     ```
     [💡] CLINICAL LEARNING CLUE
     Verify device readiness and power status prior to starting clinical examination.
     ```
  3. The clue accurately matched the clinical objective of `DEMO_MCQ_001`.
  4. The action did **not** select any answer, auto-submit, or alter XP.
  5. The toolbar button updated to `LEARN (Active)` and became disabled.
  6. Repeated clicks were safely ignored (`reason: "LEARN clue is already active for this question"`).
  7. Advanced to Question 2: the banner dismissed automatically.
* **Persistence**:
  * `learnClueRevealed[0]: true` persisted to IndexedDB `daily_sessions`.
  * Browser refresh during Question 1 preserved the visible clue banner.
* **Verdict**: **FULLY FUNCTIONAL** *(Clinical clue reveal functions as designed)*.

---

## 8. RETRY Test

* **Pre-requisite**: Test user elevated state with `currentStreak: 30` (exceeds 20-day streak threshold).
* **Initial UI State**:
  * In `PowerUpsScreen`: RETRY displays as **Available**.
  * In `DailySessionScreen`: Pre-submission toolbar displays green status badge `[↩ RETRY]`.
* **Test Case A: Wrong Answer → RETRY → Correct Answer**:
  1. On Question 1, learner deliberately submitted incorrect **Option D** (*"Check the mobile SIM card balance"*).
  2. AnswerEvaluator evaluated submission as `INCORRECT` (0 XP awarded).
  3. `FeedbackDrawer` opened displaying the incorrect banner and a prominent `[↩ Use RETRY]` button.
  4. Learner clicked `Use RETRY`.
  5. **Question Re-rendered**: `session.status` reset to `IN_PROGRESS`, `currentAnswer` reset to `null`, `currentEvaluation` reset to `null`, and `FeedbackDrawer` dismissed.
  6. Question options became interactively selectable again.
  7. Learner selected correct **Option A** (*"Ensure device power is on and battery indicator is green"*).
  8. Clicked *"Check Answer"*.
  9. AnswerEvaluator evaluated submission as `CORRECT` (+5 XP awarded).
  10. `FeedbackDrawer` reopened showing `CORRECT`, +5 XP, and `[Continue]`. `Use RETRY` was hidden.
  11. Total session questions remained exactly 10 (no 11th question created).
* **Test Case B: Wrong Answer → RETRY → Wrong Answer**:
  1. On Question 2, learner submitted incorrect answer → `INCORRECT`.
  2. Clicked `Use RETRY` → Question reopened.
  3. Learner submitted another incorrect answer → `INCORRECT`.
  4. **Exploit Prevention Check**: On the second failed submission, `Use RETRY` was **NOT** shown because `retryUsed[1]` was already `true`. Infinitely repeating retries was prevented.
* **Critical Architectural Audit Findings on RETRY**:
  * **Lineage & History Loss**: In `useLearningSession.ts`, line 407: `prev.history.slice(0, prev.currentIndex)` removes the original failed attempt from local history. The failed attempt is overwritten rather than preserved.
  * **Firestore Disconnect**: Neither the first attempt nor the retry attempt was written to Firestore `users/{uid}/attempts`. No `retryOfAttemptId` exists in Firestore or local storage.
* **Verdict**: **PARTIALLY FUNCTIONAL** *(The UI re-attempt mechanism works cleanly, but attempt history lineage and Firestore persistence are not implemented).*

---

## 9. STREAK SHIELD Test

* **Pre-requisite**: Streak threshold of 30 days (`currentStreak >= 30`).
* **Implementation Analysis**:
  * Unlock status is evaluated in [`PowerUpService.calculateInventory`](../src/services/PowerUpService.ts) (`streak >= 30`).
  * Protection logic is implemented in [`StorageRepository.computeStreak`](../src/repositories/StorageRepository.ts):
    ```typescript
    if (diffDays === 2) {
      if (currentStreak >= 30 && !shieldConsumed) {
        return { newStreak: currentStreak + 1, shieldWasConsumed: true };
      }
      return { newStreak: 1, shieldWasConsumed: false };
    }
    ```
* **Simulation & Functional Tests**:
  1. **Simulate 1 Missed Day (Last active 2 days ago, Streak: 30, Unconsumed)**:
     * `computeStreak` returned `{ newStreak: 31, shieldWasConsumed: true }`.
     * **Streak was preserved and incremented!** Shield was marked as consumed.
  2. **Simulate Second Missed Day (Shield Already Consumed)**:
     * `computeStreak` with `shieldConsumed: true` returned `{ newStreak: 1, shieldWasConsumed: false }`.
     * **Streak reset to 1.** Shield cannot protect multiple days.
  3. **Simulate 2 Consecutive Missed Days (Last active 3 days ago)**:
     * `computeStreak` returned `{ newStreak: 1, shieldWasConsumed: false }`.
     * Missing 2+ days cannot be protected.
  4. **Simulate Missed Day with Streak < 30 (e.g., Streak: 15)**:
     * `computeStreak` returned `{ newStreak: 1, shieldWasConsumed: false }`.
* **Critical Architectural Audit Findings on STREAK SHIELD**:
  * **Trigger Dependency**: `computeStreak` is called **only** inside `storageRepository.saveSession()`, which executes when a user finishes answering all 10 questions in a session. Simply launching the app or opening the home screen on a missed day does not trigger streak evaluation.
  * **Zero Cloud Synchronization**: Firestore user document fields `streakShieldActive` and `streakShieldConsumed` are never read or updated by the frontend.
* **Verdict**: **PARTIALLY FUNCTIONAL** *(Algorithmic calculation and consumption in client storage are functional, but passive cloud detection and multi-device persistence are not implemented).*

---

## 10. Firestore State Verification

During the audit, network calls and Firestore collections on `aisteth-academy-dev` were directly inspected:

| Collection Path | Intended Purpose | Audit Finding |
|---|---|---|
| `users/{uid}` | User Profile & `learningState` | Profile created on registration. Top-level `learningState` is **never updated** by client sessions because `SessionService` is not wired up. |
| `users/{uid}/dailySessions/{id}` | Daily Session Lifecycle & Power-Up log | Documents **never created** by the frontend. Only created during backend script runs. |
| `users/{uid}/attempts/{id}` | Append-Only Attempts & Retry Lineage | Documents **never created** by the frontend. `recordAttempt()` is never invoked. |
| `usernames/{username}` | Username Reservation | Document created and active (`powerup_qa_test`). |

* **Conclusion**: In the current application build, all power-up state (unlocked status, in-session hint eliminations, learn clues, retry flags, streak shield consumption) is stored in **local client storage (IndexedDB `aisteth_academy_db` / localStorage)**. Nothing is persisted to Cloud Firestore.

---

## 11. Refresh / Re-login Tests

### Test 1: Browser Refresh Mid-Session
1. Active session on Question 1 with HINT used (Options B & C eliminated) and LEARN active.
2. Triggered hard browser refresh (`Ctrl+F5` / reload).
3. **Result**: `useLearningSession.initDailySession()` reloaded `daily_sessions` from IndexedDB.
4. Question 1 restored with `hintEliminatedOptions[0]` intact (Options B & C remained eliminated) and `learnClueRevealed[0]` intact (clue banner visible).
5. **Outcome**: Passed. In-session local persistence works.

### Test 2: Navigate Away & Return
1. Used HINT on Question 1.
2. Clicked Exit Session → returned to HomeScreen.
3. Clicked "Resume Training".
4. **Result**: Resumed Question 1 with eliminated options preserved.
5. **Outcome**: Passed.

### Test 3: Log Out & Log Back In (Cross-Session / Cross-Device Simulation)
1. User logged out from Profile screen.
2. Signed back in as `powerup_qa_test`.
3. In a fresh storage context (simulating a second device):
   * `AuthService.loginWithUsername` fetched Firestore user document.
   * `learningState` from Firestore was **not** written to `storageRepository.saveUserStats`.
   * User stats fell back to `DEFAULT_USER_STATS` (all 0s).
   * **Result**: All four power-ups reverted to **LOCKED** status!
4. **Outcome**: Critical persistence defect across device sessions.

---

## 12. Exploit Tests

| Exploit Scenario | Expected Protection | Observed Result | Pass / Fail |
|---|---|---|---|
| **Rapid Double-Click on HINT** | HINT can only eliminate options once | `canUseHint` blocks second click (`already used`). Button disabled. | **PASS** |
| **Rapid Double-Click on LEARN** | Banner displays once, no duplicate state | `canUseLearn` blocks second click (`already active`). Button disabled. | **PASS** |
| **Rapid Repeated RETRY Trigger** | Retry can only be activated once per question | `retryUsed[currentIndex]` set to `true`. Second incorrect submission does not show RETRY button. | **PASS** |
| **Browser Refresh to Reset RETRY** | Refreshing during retry does not grant unlimited retries | `retryUsed` persisted in IndexedDB. After refresh, retry remained consumed. | **PASS** |
| **Duplicate Answer Submission** | Answers cannot be submitted twice | `status === 'ANSWER_SUBMITTED'` disables submit button. | **PASS** |
| **Client Firestore Write of Elevated Stats** | Firestore Rules block unauthorized `learningState` tampering | Write rejected with `7 PERMISSION_DENIED: Missing or insufficient permissions`. | **PASS** |
| **Client LocalStorage Tampering** | Local stats should be tamper-evident | Learner can modify `aisteth_user_stats` in browser DevTools to unlock power-ups locally. | **FAIL** *(Inherent to client-authoritative design)* |

---

## 13. UI vs Functional Classification

| Power-Up | Unlock UI | Actual Behavior | Persistence | End-to-End | Classification |
|---|---|---|---|---|---|
| **HINT** | Displays locked / available card & in-session button | Eliminates 2 incorrect options; preserves correct answer; disables re-use | Stored in IndexedDB `daily_sessions`; NOT in Firestore | In-session MCQ elimination works completely | **FULLY FUNCTIONAL** |
| **LEARN** | Displays locked / available card & in-session button | Displays clinical learning clue banner; non-spoiler; disables re-use | Stored in IndexedDB `daily_sessions`; NOT in Firestore | In-session clue reveal works completely | **FULLY FUNCTIONAL** |
| **RETRY** | Displays status badge & FeedbackDrawer retry button | Reopens question; clears selection; allows 1 re-attempt; blocks infinite loops | Stored in IndexedDB; slices out/drops 1st attempt; NO Firestore attempts | UI re-attempt works, but attempt lineage is missing | **PARTIALLY FUNCTIONAL** |
| **STREAK SHIELD** | Displays locked / available / consumed card | Evaluated in `computeStreak` on session save; protects 1 missed day | Stored in IndexedDB `user_stats`; NO Firestore sync; NO passive detection | Logic works in local storage, but backend lifecycle is missing | **PARTIALLY FUNCTIONAL** |

---

## 14. Bugs Found

| ID | Power-Up | Issue | Severity | Evidence |
|---|---|---|---|---|
| **BUG-PU-01** | **ALL** | `SessionService.ts` is orphaned and not connected to frontend. No session or attempt documents are written to Firestore during training. | **HIGH** | `grep_search` confirmed `SessionService` is never imported in `src/`. Firestore `dailySessions` and `attempts` remain empty during UI sessions. |
| **BUG-PU-02** | **RETRY** | RETRY discards initial attempt from local history (`prev.history.slice(0, prev.currentIndex)`) rather than recording an append-only retry attempt. Lineage (`retryOfAttemptId`) is missing. | **MEDIUM** | [`src/hooks/useLearningSession.ts`](../src/hooks/useLearningSession.ts#L407) removes the failed attempt. Attempt count remains at 1 rather than 2. |
| **BUG-PU-03** | **ALL** | `AuthService.loginWithUsername` does not copy Firestore `learningState` into `StorageRepository.saveUserStats`. | **HIGH** | [`src/services/AuthService.ts`](../src/services/AuthService.ts#L215) only calls `saveUserProfile()`. On a new device or cleared cache, stats default to 0 and all power-ups lock. |
| **BUG-PU-04** | **STREAK SHIELD** | Streak Shield evaluation is only triggered upon completing all 10 questions of a session. Merely visiting the app on a missed day does not evaluate or protect the streak. | **MEDIUM** | [`src/repositories/StorageRepository.ts`](../src/repositories/StorageRepository.ts#L79) calls `computeStreak` exclusively inside `saveSession()`. |

---

## 15. Recommended Fixes

*(For reference only — per strict instructions, no implementation modifications were made during this audit)*:

1. **Connect `SessionService` to `useLearningSession`**:
   * Invoke `SessionService.startDailySession()` on session start.
   * Invoke `SessionService.recordAttempt()` on answer submission with `isRetry` and `retryOfAttemptId`.
   * Invoke `SessionService.finalizeSession()` on question completion.
2. **Preserve Initial Attempt on RETRY**:
   * Instead of slicing `prev.history`, preserve the failed attempt with a flag (`isRetryCandidate: true`) and append the second attempt with `retryOfAttemptId: firstAttemptId`.
3. **Sync Firestore `learningState` on Authentication**:
   * In `AuthService.loginWithUsername()`, after fetching `userSnap.data()`, map `data.learningState` into `StorageRepository.saveUserStats()`. This ensures unlocked power-ups travel with the user across devices.
4. **Passive Streak Evaluation**:
   * Run `computeStreak` during `StorageRepository.getUserStats()` or upon app initialization so a learner who opens the app on a missed day immediately sees their active streak preserved by Streak Shield.

---

## 16. Final Verdict

### HINT:
**FULLY FUNCTIONAL**
The HINT power-up is genuinely functional within the learning session. It reliably identifies and eliminates exactly two incorrect MCQ options, strictly protects the correct solution, updates button states, prevents duplicate usage, and maintains state across in-session reloads.

### LEARN:
**FULLY FUNCTIONAL**
The LEARN power-up is genuinely functional within the learning session. It reliably extracts and displays the question's learning objective in a dedicated clinical clue container, does not compromise or alter answer evaluation, prevents duplicate clicks, and resets cleanly across questions.

### RETRY:
**PARTIALLY FUNCTIONAL**
The in-session user interaction works cleanly: an incorrect answer allows a single re-attempt, resets the question UI, prevents infinite retry exploits, and accurately scores the final attempt. However, it is classified as partially functional because the initial attempt is deleted from local memory rather than preserved, no append-only attempt record is sent to Firestore, and the documented `retryOfAttemptId` lineage is not implemented in the active client.

### STREAK SHIELD:
**PARTIALLY FUNCTIONAL**
The core mathematical protection algorithm in `StorageRepository.computeStreak()` correctly increments the streak on a missed day and consumes the shield. However, it is classified as partially functional because it operates solely within client IndexedDB on full session completion, lacks cloud synchronization, and has no passive background detection mechanism.

---

## 17. Final Product Decision

### Historical Implementation vs Final Product

* **Historical Implementation (Audited Above)**:
  * HINT was implemented and functional locally (`totalCorrectAnswersCount >= 50`).
  * LEARN was implemented and functional locally (`completedQuestionsCount >= 100`).
  * RETRY was partially functional (`currentStreak >= 20`) but deleted original attempt from history.
  * STREAK SHIELD was partially functional (`currentStreak >= 30`) but bound to local IndexedDB.
  * Active learning was disconnected from Firestore backend (`SessionService.ts` was orphaned).
  * `learningState` was not hydrated into local statistics upon user login.

* **Final Product**:
  * **HINT has been completely removed** from active application code, UI, state, types, and services.
  * **RETRY has been completely removed** from active application code, UI, state, types, and services. Trainee answers are strictly FINAL (this is an educational assessment system, not an answer-retry game).
  * The final AiSteth Academy power-up system contains **EXACTLY THREE power-ups**:

| Power-Up | Unlock Condition | Function & Constraints |
|---|---|---|
| **50/50** | **20-day streak** (`currentStreak >= 20`) | Removes exactly 2 incorrect MCQ options. Never eliminates correct answer. Non-MCQ: not displayed. Does not award XP or auto-answer. Usable once per question. |
| **LEARN** | **100 answered questions** (`completedQuestionsCount >= 100`) | Shows the question learning objective (`question.learning_objective`). Does not reveal the correct answer. Does not alter XP. Usable once per question. |
| **STREAK SHIELD** | **30-day streak** (`currentStreak >= 30`) | Protects streak when trainee misses exactly one expected training day. Consumed immediately upon protection. |

### Architectural Resolutions in Final Product

1. **Cloud Firestore Connection**:
   * `useLearningSession` is actively connected to `SessionService`:
     * Daily session document created in `users/{uid}/dailySessions/{sessionId}` on start.
     * Append-only attempt document recorded in `users/{uid}/attempts/{attemptId}` on submission.
     * Session finalized and progression updated in Firestore upon completion.
2. **Cross-Device State Hydration**:
   * `AuthService.loginWithUsername()` retrieves Firestore `learningState` and hydrates `StorageRepository.saveUserStats()`.
   * Unlocked power-ups persist across device changes, browser refreshes, and cache clears.
3. **Strict Answer Finality**:
   * Incorrect submissions award 0 XP, record feedback, and session advances.
   * No second attempts or retry buttons exist in the application.

