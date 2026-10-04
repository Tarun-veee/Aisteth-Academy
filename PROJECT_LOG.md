# AiSteth Academy — Project Architecture & Long-Term History Log

> **Document Purpose**: This document serves as the permanent, comprehensive architectural record and design evolution log for AiSteth Academy. It details the product concepts, UI/UX redesigns, component lifecycle, bug investigations, design decisions, architectural transformations, mobile responsiveness history, and current codebase status.
>
> *Rule*: This document must be preserved throughout the life of the project. Historical entries are never deleted or rewritten when designs change; instead, the evolution is documented chronologically.

---

## Table of Contents
1. [Product Design Evolution](#1-product-design-evolution)
2. [UI / UX Screen Evolution](#2-ui--ux-screen-evolution)
3. [Development History (Chronological Entries)](#3-development-history-chronological-entries)
4. [Bug History & Investigation Log](#4-bug-history--investigation-log)
5. [Design Decision Log](#5-design-decision-log)
6. [Architecture Evolution](#6-architecture-evolution)
7. [Question & Content System Evolution](#7-question--content-system-evolution)
8. [Mobile & Responsive Design History](#8-mobile--responsive-design-history)
9. [Removed & Deprecated Features](#9-removed--deprecated-features)
10. [Experiments & Abandoned Approaches](#10-experiments--abandoned-approaches)
11. [Project Milestones](#11-project-milestones)
12. [Current Project State](#12-current-project-state)

---

## 1. Product Design Evolution

### 1.1 Original Product Concept
- **Target Audience**: ASHA (Accredited Social Health Activist) and Anganwadi community healthcare workers in rural and semi-urban India.
- **Core Problem**: Community health workers are equipped with the AiSteth smart digital stethoscope for screening cardiovascular and respiratory conditions. However, many workers lack hands-on experience in device preparation, anatomical placement, noise artifact recognition, and audio interpretation.
- **Product Vision**: A mobile-first, gamified micro-learning training platform designed to build clinical auscultation competency through bite-sized daily interactive practice missions.

### 1.2 Learning Methodology
- **Daily 10-Question Habit**: Instead of long, overwhelming courses, training is structured as **one 10-question daily mission** per calendar day (~5–10 minutes).
- **Active Recall & Polymorphic Questioning**: Incorporates 5 interactive question formats to test different practical competencies (conceptual MCQs, procedural step ordering, anatomical hotspot tapping, acoustic audio discrimination, and clinical true/false).
- **Instant Micro-Learning Rationale**: Every question delivers immediate clinical explanation upon submission, reinforcing correct auscultation techniques and diagnostic criteria regardless of whether the answer was correct or incorrect.
- **One-Time Session Review**: A comprehensive review screen at the conclusion of all 10 questions summarizing key clinical takeaways for the day.

### 1.3 Gamification & Motivation Model
- **Daily Streak Counter**: Encourages daily engagement by tracking continuous active days (`currentStreak`).
- **Experience Points (XP)**: Awards XP on correct answers (e.g. +5 to +15 XP depending on difficulty and question type) with a real-time progress counter.
- **Competency Score**: Provides clear competency percentage feedback upon completing the daily session.

---

## 2. UI / UX Screen Evolution

### 2.1 HomeScreen Evolution

```
[V1: Multi-Module Dashboard]
       ↓ (Discovered: exposed internal question engine concepts as separate study modules)
[V2: Simplified Daily Mission]
       ↓ (Discovered: lacked persistent state awareness across session lifecycle)
[V3: State-Aware Dynamic Action Button]
       ↓ (Discovered: allowed repeat practice on same calendar day)
[V4: Strict Daily-Locked Completed State]
       ↓ (Discovered: excessive large cards created vertical clutter on Home)
[V5: Simplified Home with Top-Right Action Cluster] (Current)
```

- **V1 (Initial Prototype)**:
  - Displayed header with streak/XP, a daily mission hero card, and a bottom section titled "TRAINING MODULES COVERED" containing 4 separate cards (`Clinical MCQs`, `Anatomical Tap`, `Step Ordering`, `Audio Quality`).
  - *Problem*: The learner's mental model was confused. It exposed internal question renderer types as independent modules rather than a unified 10-question daily training session.
- **V2 (Module Section Removal)**:
  - Completely removed "TRAINING MODULES COVERED".
  - Focused the Home screen entirely on "Today's Training" with greeting, daily mission card, user stats grid (Streak, Total XP, Completed), and Phase 1 prototype disclaimer.
- **V3 (State-Aware Daily Lifecycle)**:
  - Integrated 4-state session status (`NOT_STARTED`, `IN_PROGRESS`, `QUESTIONS_COMPLETED`, `REVIEW_VIEWED`).
  - Button dynamically adapted: `"START TODAY'S TRAINING"`, `"CONTINUE TODAY'S TRAINING"` (with `Question X of 10`), `"VIEW SESSION REVIEW"`, and `"TODAY'S TRAINING COMPLETE"`.
- **V4 (Locked Single Session per Day)**:
  - When status is `REVIEW_VIEWED`, the hero button transitions to `"TODAY'S TRAINING COMPLETE"` with a disabled state and checkmark icon, preventing repeat question generation on the same calendar day.
- **V5 (Simplified Home & Top-Right Header Action Cluster — Current Architecture)**:
  - Removed large Level 1 • Trainee progression card, large Power-Ups dashboard card, and large Profile entry button card from Home screen.
  - Consolidated secondary features into a compact top-right header action cluster:
    `[ 🔥 Streak ] [ ⚡ XP ] [ 🏅 Level ] [ ✨ Power-Ups ] [ 👤 Profile ]`
  - Home screen is now 100% simple and training-focused: Header $\rightarrow$ Greeting $\rightarrow$ Daily Mission Card $\rightarrow$ Compact Stats Grid $\rightarrow$ Notice.
  - `ProfileScreen.tsx` serves as the detailed progress center (Trainee details, Level progression, 7-day streak calendar, 3 core competency progress bars, power-up collection, and statistics).

---

### 2.2 DailySessionScreen Evolution

```
[V1: Basic Flex Column with Global Viewport]
       ↓ (Discovered: excessive bottom padding pb-28 triggered global scrolling)
[V2: Sticky Action Footer with 100vh]
       ↓ (Discovered: min-h-dvh flex-grow created artificial empty void & pushed submit into nav bar)
[V3: 3-Tier Bounded Mobile App Shell] (Current)
```

- **V1 (Initial Layout)**:
  - Header with progress bar, question content, and fixed action button. Used `pb-28` (112px bottom padding) to clear the fixed button.
  - *Problem*: `pb-28` artificially inflated document height, causing vertical scrollbars on short questions that easily fit on screen.
- **V2 (Sticky Footer with Dynamic Viewport)**:
  - Replaced `pb-28` with `sticky bottom-0 mt-auto` and applied `min-h-screen min-h-dvh`.
  - *Problem*: Because `min-h-dvh` was combined with `flex-1` on `<main>` and `justify-between`, `<main>` expanded to fill the entire viewport *before* the 74px footer was accounted for. This created a large white void below Option D and pushed the submit button 74px into document overflow, clipping it against the Android navigation bar.
- **V3 (3-Tier Bounded Mobile Shell — Current Architecture)**:
  - `MobileContainer`: Bounded to `h-dvh max-h-dvh min-h-0 overflow-hidden`.
  - `DailySessionScreen`: `h-full flex flex-col justify-between overflow-hidden relative`.
  - **Header / Progress**: `shrink-0 bg-surface-white border-b border-slate-200/80 px-3.5 py-2.5 z-20`.
  - **Main Content**: `flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3 max-w-md mx-auto w-full`. All artificial `flex-1` spacers inside question renderers removed so option cards flow naturally.
  - **Bottom Action Footer**: `shrink-0 bg-surface-white/95 backdrop-blur-md border-t border-slate-200/80 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-20`.
  - *Result*: Option D has natural 10–12px spacing, "Check Answer" is 100% visible and tappable above the Android navigation bar, zero scrolling occurs on standard questions, and natural scrolling activates seamlessly for long questions.

---

### 2.3 QuestionReviewScreen Evolution

- **V1 (Summary List)**: Basic list of questions and answers.
- **V2 (One-Time Clinical Takeaways & State Lock)**:
  - Formatted breakdown of all 10 completed questions.
  - Explicit badges for `CORRECT` (green CheckCircle), `INCORRECT` (red XCircle / Needs Review), and `UNANSWERED` (slate HelpCircle).
  - Clear sections for "Correct Answer" and "Clinical Takeaway" note.
  - Pinned "COMPLETE & RETURN HOME" action button that calls `markReviewViewed()` to lock the daily session in IndexedDB and transition Home screen to `TODAY'S TRAINING COMPLETE`.

---

### 2.4 SessionSummaryScreen Evolution

- **V1 (Trophy Score Card with Retry)**:
  - Displayed trophy header, competency score percentage, correct/incorrect badges, review prompt, and two bottom buttons: "Practice Again" and "RETURN HOME".
- **V2 (Practice Again Removed & Flow Streamlined)**:
  - Completely removed "Practice Again" / `onRestartSession` action and icon.
  - Consolidated post-session flow: answering Q10 directly opens `QuestionReviewScreen`. Pressing "Done" locks today's session and returns to Home.

---

### 2.5 FeedbackDrawer Evolution

- **V1 (Fixed Bottom Sheet)**: Slide-up bottom sheet over the viewport.
- **V2 (Bounded Viewport Sheet with Safe Area)**:
  - Constrained to `max-h-[85dvh]` with `shrink-0` result banner, `flex-1 min-h-0 overflow-y-auto overscroll-contain` micro-learning text area, and `shrink-0` Continue button with `pb-[max(0.25rem,env(safe-area-inset-bottom))]`.
  - *Problem*: As a fixed overlay spanning 85% of the viewport, it covered the question prompt and options, destroying learning context upon submission.
- **V3 (Bounded Docked Panel with Question Visibility)**:
  - Replaced the fixed modal overlay with a docked `shrink-0 max-h-[48dvh] sm:max-h-[50dvh]` bottom panel inside the `DailySessionScreen` flex column.
  - The Question area retains `flex-1 min-h-0 overflow-y-auto` in the upper ~52% of the screen, ensuring the question prompt and selected option cards remain 100% visible and interactive upon submission.
- **V4 (Native Two-State Swipe / Drag Bottom Sheet — Current Architecture)**:
  - Added native mobile touch/pointer drag engine (`useBottomSheetGesture.ts`) and a centered visual drag handle pill.
  - **COLLAPSED (Default)**: `max-h-[48dvh] sm:max-h-[50dvh]` keeping question prompt and answer options fully visible in the upper viewport.
  - **EXPANDED (After upward drag or handle tap)**: `max-h-[86dvh] sm:max-h-[88dvh]` giving generous space to read long clinical explanations, correct solutions, and learning objectives.
  - Smooth animation with distance threshold (>45px), flick velocity (>0.4px/ms), and scroll conflict resolution (internal scrolling prioritizes text, pull at scrollTop = 0 or drag handle collapses).
  - Pinned safe-area Continue button in both states (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`).

---

## 3. Development History (Chronological Entries)

### Entry 01 — Home Module Section Removal
- **Date**: 2026-09-29
- **Area**: UI / UX / Information Architecture
- **Previous Behavior**: Home screen rendered 4 module cards under "TRAINING MODULES COVERED".
- **New Behavior**: Removed the module section completely; streamlined Home to greeting, daily mission hero card, and 3-stat summary grid.
- **Files Affected**: `src/views/HomeScreen.tsx`, `src/models/question.types.ts`.
- **Reason**: Trainees should focus on completing the unified 10-question daily mission rather than conceptualizing questions as fragmented modules.
- **Verification**: Vitest unit test suite executed (`npm test`), verified clean render without module cards.

---

### Entry 02 — Unanswered Question Defensive Protection
- **Date**: 2026-09-29
- **Area**: Logic / Question Engine / Evaluation
- **Previous Behavior**: Submitting `null`, `undefined`, or empty payloads fell through into standard comparison and was categorized as `INCORRECT` with penalty.
- **New Behavior**: Defined explicit `AnswerStatus = 'UNANSWERED' | 'CORRECT' | 'INCORRECT'`. Added `isValidAnswer()` validator. Unanswered/invalid submissions produce `status: 'UNANSWERED'`, `is_correct: false`, and `awarded_xp: 0`.
- **Files Affected**: `src/models/question.types.ts`, `src/services/AnswerEvaluator.ts`, `tests/AnswerEvaluator.test.ts`.
- **Reason**: Missing user input is an unattempted state, not a wrong clinical answer. Defensive evaluation prevents false failure reporting.
- **Verification**: Comprehensive defensive test cases in `tests/AnswerEvaluator.test.ts`.

---

### Entry 03 — Submit Button Gating & Renderer Selection Controls
- **Date**: 2026-09-29
- **Area**: UI / Interaction / Form Validation
- **Previous Behavior**: "Check Answer" submit button remained clickable even when no option was chosen.
- **New Behavior**: Submit button is disabled by default and enabled reactively upon valid selection across all 5 question types:
  - **MCQ**: Disabled until Option A, B, C, or D is selected.
  - **TRUE_FALSE**: Disabled until TRUE or FALSE is selected.
  - **IMAGE_TAP**: Disabled until valid numeric coordinates are tapped on diagram.
  - **AUDIO_DISCRIMINATION**: Disabled until Recording A or B is selected.
  - **STEP_ORDER**: Initializes with default order and enables reordered submission.
- **Files Affected**: `src/views/DailySessionScreen.tsx`, `src/hooks/useLearningSession.ts`.
- **Reason**: Prevents accidental premature submissions and guarantees learners intentionally commit to an answer.
- **Verification**: Unit and component tests verified disabled/enabled states for all 5 question types.

---

### Entry 04 — Daily Session State & IndexedDB Persistence
- **Date**: 2026-09-29
- **Area**: Persistence / Storage / Offline Architecture
- **Previous Behavior**: Session progress was in-memory only; refreshing the browser reset the learner back to Question 1.
- **New Behavior**:
  - Implemented `DAILY` object store (`daily_sessions` with primary key `date = YYYY-MM-DD`) in IndexedDB (bumped `DB_VERSION = 2`) with localStorage fallbacks.
  - Defined `DailyProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'QUESTIONS_COMPLETED' | 'REVIEW_VIEWED'`.
  - Added `saveDailySession()` and `getDailySession()` to `StorageRepository.ts`.
  - `useLearningSession.ts` restores mid-session progress on reload without loss of answered questions, score, or XP.
- **Files Affected**: `src/models/session.types.ts`, `src/repositories/StorageRepository.ts`, `src/hooks/useLearningSession.ts`.
- **Reason**: Rural health workers frequently experience intermittent connectivity or browser refreshes; state must persist seamlessly offline.
- **Verification**: Verified persistence with unit tests and simulated page reload tests.

---

### Entry 05 — One-Time Session Review Lock
- **Date**: 2026-09-29
- **Area**: User Flow / Navigation / State Machine
- **Previous Behavior**: Session Review was repeatable or bypassed.
- **New Behavior**:
  - Completing Q10 transitions directly to `QuestionReviewScreen`.
  - Tapping "COMPLETE & RETURN HOME" calls `markReviewViewed()` which locks today's session in IndexedDB (`status: 'REVIEW_VIEWED'`) and returns to the completed Home screen.
- **Files Affected**: `src/views/QuestionReviewScreen.tsx`, `src/hooks/useLearningSession.ts`, `src/App.tsx`.
- **Reason**: Enforces the one-session-per-day clinical learning structure.
- **Verification**: Tested state transitions `IN_PROGRESS` $\rightarrow$ `QUESTIONS_COMPLETED` $\rightarrow$ `REVIEW_VIEWED`.

---

### Entry 06 — State-Aware Home Screen
- **Date**: 2026-09-29
- **Area**: UI / State Presentation
- **Previous Behavior**: Home screen always displayed static "Start Training" button.
- **New Behavior**: Home hero card dynamically reflects the 4 daily session states:
  1. `NOT_STARTED`: `"START TODAY'S TRAINING"` (active blue button)
  2. `IN_PROGRESS`: `"CONTINUE TODAY'S TRAINING"` (shows `Question X of 10`)
  3. `QUESTIONS_COMPLETED`: `"VIEW SESSION REVIEW"` (allows opening unviewed review)
  4. `REVIEW_VIEWED`: `"TODAY'S TRAINING COMPLETE"` (disabled state with checkmark)
- **Files Affected**: `src/views/HomeScreen.tsx`, `src/App.tsx`.
- **Reason**: Clear, unambiguous communication of daily training progress.
- **Verification**: Verified UI rendering across all 4 state transitions.

---

### Entry 07 — Initial Mobile Viewport & Overflow Fix
- **Date**: 2026-09-29
- **Area**: Mobile CSS / Viewport Layout
- **Previous Behavior**: Unconditional `pb-28` caused runaway document height; `index.css` lacked `100dvh` and horizontal overflow clamps.
- **New Behavior**: Removed `pb-28`; anchored sticky footer; added `overflow-x: hidden` and `100dvh` to base styles.
- **Files Affected**: `src/styles/index.css`, `src/layouts/MobileContainer.tsx`, `src/views/DailySessionScreen.tsx`, `src/components/feedback/FeedbackDrawer.tsx`.
- **Reason**: Eliminate unwanted horizontal scrollbars and unneeded static bottom margins.
- **Verification**: Verified scrollWidth across 360px–412px viewports.

---

### Entry 08 — Removed "Practice Again" Completely
- **Date**: 2026-09-29
- **Area**: Product / Flow / Gamification Lock
- **Previous Behavior**: `SessionSummaryScreen.tsx` offered a "Practice Again" button to re-run the 10 questions.
- **New Behavior**: Completely removed "Practice Again" button, `RotateCcw` icon, and `onRestartSession` handler. Enforced single 10-question daily training session.
- **Files Affected**: `src/views/SessionSummaryScreen.tsx`, `src/views/HomeScreen.tsx`, `src/views/QuestionReviewScreen.tsx`, `src/App.tsx`, `src/hooks/useLearningSession.ts`.
- **Reason**: Daily micro-learning habit formation requires a bounded daily commitment without repetitive grinding.
- **Verification**: Verified that after pressing Done on Session Review, no repeat action exists and Home shows "TODAY'S TRAINING COMPLETE".

---

### Entry 09 — Final Mobile Viewport & Submit Action Pinned Layout
- **Date**: 2026-09-29
- **Area**: Mobile Viewport / CSS Architecture / Touch Ergonomics
- **Previous Behavior**:
  - `min-h-screen min-h-dvh` on `MobileContainer` and `DailySessionScreen` combined with `flex-1` on `<main>` created a large empty space below Option D and pushed the "Check Answer" footer into document overflow (`100dvh + 74px`), clipping it against the Android navigation bar.
- **New Behavior**:
  - Bounded `MobileContainer` to `h-dvh max-h-dvh min-h-0 overflow-hidden`.
  - Implemented 3-tier architecture in `DailySessionScreen`:
    - Header: `shrink-0`
    - Main Question Content: `flex-1 min-h-0 overflow-y-auto overscroll-contain` (natural option flow, no artificial flex spacers)
    - Footer: `shrink-0 bg-surface-white/95 backdrop-blur-md border-t border-slate-200/80 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]`
  - Compacted option card padding and touch targets (`min-h-[52px] sm:min-h-[58px]`).
- **Files Affected**:
  - `src/layouts/MobileContainer.tsx`
  - `src/views/DailySessionScreen.tsx`
  - `src/components/questions/MCQRenderer.tsx`
  - `src/components/questions/TrueFalseRenderer.tsx`
  - `src/components/feedback/FeedbackDrawer.tsx`
  - `src/views/HomeScreen.tsx`
  - `src/views/QuestionReviewScreen.tsx`
  - `src/styles/index.css`
  - `tests/MobileLayoutAndResponsiveness.test.ts`
- **Reason**: On standard mobile devices (360×800), standard 4-option MCQs fit completely on screen. The Submit button must be 100% visible and tappable without scrolling, while long questions must still scroll naturally.
- **Verification**: Verified on 360×800, 375×812, 390×844, and 412×915 viewports. All 20 Vitest unit tests pass.

### Entry 10 — Project Status Clarification & Progressive Implementation Roadmap
- **Date**: 2026-09-29
- **Area**: Project Scope / Engineering Architecture / Roadmap
- **Context & Clarification**:
  - Clarified project milestone status from "Production Frontend Complete" to **"Phase 1 Engineering Foundation Complete & Verified"**.
  - Verified that all core engineering infrastructure (React + TypeScript + Vite + Tailwind/PWA + 5 Question Renderers + Answer Evaluator + IndexedDB persistence + Daily Session State Machine + Mobile Viewport Shell) is complete, robust, and verified.
  - Established the progressive implementation order:
    ```
    FUNCTIONAL FOUNDATION (Complete)
            ↓
    COMPLETE FRONTEND PRODUCT (In Progress — Phase A)
            ↓
    REAL CLINICAL CONTENT (Pending — Phase B)
            ↓
    BACKEND / CLOUD (Pending — Phase C)
            ↓
    ADAPTIVE LEARNING (Pending — Phase D)
            ↓
    PRODUCTION VALIDATION (Pending — Phase E)
    ```
  - Identified Phase A (Frontend Product Completion) as the immediate development priority before clinical content ingestion and cloud backend integration.

### Entry 11 — Bounded Mobile Feedback Panel & Retained Question Context
- **Date**: 2026-09-29
- **Area**: Mobile UX / Viewport Layout / Feedback Interaction
- **Previous Behavior**: `FeedbackDrawer.tsx` opened as a fixed full-screen modal overlay spanning 85% of the viewport height (`max-h-[85dvh]`), completely covering the question text and answer options.
- **New Behavior**: Docked `FeedbackDrawer` as a `shrink-0 max-h-[48dvh] sm:max-h-[50dvh]` bottom panel inside the flex layout column. The Question content area retains `flex-1 min-h-0 overflow-y-auto` in the upper ~52% of the screen so the question prompt, metadata badges, and option cards with selection/result indicators remain 100% visible and interactive upon submission. The Feedback Drawer includes a pinned Result Banner, scrollable micro-learning sheet, and pinned safe-area Continue button.
- **Files Affected**:
  - `src/components/feedback/FeedbackDrawer.tsx`
  - `src/components/feedback/MicroLearningSheet.tsx`
  - `src/components/feedback/ResultBanner.tsx`
  - `src/views/DailySessionScreen.tsx`
  - `tests/MobileLayoutAndResponsiveness.test.ts`
- **Reason**: Trainees must be able to inspect the question context and their chosen option while reviewing the clinical explanation; obscuring the question destroyed the micro-learning feedback loop.
- **Verification**: Verified on 360×800, 375×812, 390×844, and 412×915 viewports. 21/21 Vitest tests passing.

### Entry 12 — Feedback Drawer Two-State Swipe / Drag Bottom Sheet
- **Date**: 2026-09-29
- **Area**: Mobile UX / Gesture Engine / Bottom Sheet Interaction
- **Previous Behavior**: Feedback drawer was a static ~48dvh bottom panel with no swipe-to-expand gesture. Reading detailed multi-paragraph explanations on compact viewports required extensive scrolling within a cramped height.
- **New Behavior**:
  - Implemented a native mobile bottom sheet gesture engine in `src/hooks/useBottomSheetGesture.ts` supporting two distinct snap states:
    1. **`COLLAPSED` (Default)**: `max-h-[48dvh] sm:max-h-[50dvh]`, retaining the question prompt and option cards in the upper viewport.
    2. **`EXPANDED` (After upward drag or handle tap)**: `max-h-[86dvh] sm:max-h-[88dvh]`, expanding upwards to provide full-height reading comfort for clinical rationale, correct solutions, and learning objectives.
  - Added a centered visual drag handle pill with accessible ARIA toggle attributes (`aria-expanded`, `aria-label`, click/keyboard support).
  - Configured threshold detection (>45px distance or >0.4px/ms flick velocity) with real-time resistance damping and automatic snap return on partial release.
  - Resolved scroll conflicts: swiping inside micro-learning content in expanded mode scrolls the text naturally; downward pull collapses the sheet only when `scrollTop <= 1` or when dragging from the top handle/header.
  - Pinned Continue button with safe-area bottom padding (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`) across both states.
- **Files Affected**:
  - `src/hooks/useBottomSheetGesture.ts`
  - `src/components/feedback/FeedbackDrawer.tsx`
  - `tests/useBottomSheetGesture.test.ts`
- **Verification**: Unit tests covering threshold calculations, velocity checks, and scroll conflict priorities (`tests/useBottomSheetGesture.test.ts`). 24/24 unit tests passing, production build passing.

---

### Entry 13 — Home Screen Level Progression & Power-Up Foundation
- **Date**: 2026-09-29
- **Area**: Progression / Power-Up Framework / Home UI
- **Previous Behavior**: Home screen had minimal statistics cards without level hierarchy or power-up visibility.
- **New Behavior**:
  - Implemented `ProgressionService` with Level 1–5 provisional curve (Trainee $\rightarrow$ Master Auscultator) and animated XP progress bar.
  - Implemented `PowerUpService` with unlock logic for `HINT` (50 correct answers), `LEARN` (100 questions answered), `RETRY` (20-day streak), and `STREAK SHIELD` (30-day streak).
  - Added Streak Shield status panel and Profile entry point.
  - Implemented skeleton loading, empty state guidance, and error retry states.
- **Files Affected**:
  - `src/services/ProgressionService.ts`
  - `src/services/PowerUpService.ts`
  - `src/views/HomeScreen.tsx`
  - `tests/HomeScreenProgressionAndPowerUps.test.ts`
- **Verification**: Vitest unit tests verifying unlock boundaries and counter isolation.

---

### Entry 14 — Full Power-Up Behavior, Profile/Progress Screen, and Final Frontend Visual Polish
- **Date**: 2026-09-29
- **Area**: Interactive Power-Ups / Profile & Competency Analytics / Visual Consistency
- **Previous Behavior**: Power-ups were purely decorative badges on Home; Profile was a minimal placeholder; no in-session power-up UI existed; competency progress was unmodeled.
- **New Behavior**:
  - **HINT Power-Up**: Eliminates 2 incorrect options on MCQ questions without eliminating the correct answer. Eliminated options are visibly disabled (`line-through`, `disabled`, `isEliminated`). Usable once per question position. Shows as unsupported for other question types.
  - **LEARN Power-Up**: Unlocks at 100 answered questions. Renders a distinct clinical learning clue banner (`learning_objective`) before answer submission without spoiling the correct answer.
  - **RETRY Power-Up**: Unlocks at 20-day streak. Allows 1 immediate re-attempt on the same question upon incorrect submission inside `FeedbackDrawer.tsx`. Reverts question state, preserves 10-question session boundary, and prevents duplicate first-attempt XP.
  - **STREAK SHIELD**: Unlocks at 30-day streak. Automatically protects 1 missed calendar day (`diffDays === 2`) in `StorageRepository.computeStreak()`. Marked `CONSUMED` after protecting streak.
  - **In-Session Power-Up Bar**: Integrated between question interaction and "Check Answer" footer with 44–48px touch targets and ARIA announcements.
  - **Full Profile & Progress Screen (`ProfileScreen.tsx`)**:
    - Trainee details (Name, Role, Health Center, District, State).
    - Level & XP progression bar (provisional).
    - 7-Day compact streak history calendar based on real session dates.
    - 3 Core Competency progress bars (`DEVICE_HANDLING`, `HEART_RECORDING`, `QUALITY_ASSESSMENT`) computed directly from stored session records with graceful "No data yet" handling.
    - Power-Up collection cards with progress indicators (`X/50`, `X/100`, etc.).
    - Training statistics overview.
    - Accessible back navigation.
  - **Persistence**: Power-up state saved in IndexedDB and restored on reload.
  - **Visual & Responsive Polish**: Verified consistency and layout bounds across 360×800, 375×812, 390×844, 412×915 viewports.
- **Files Affected**:
  - `src/models/powerup.types.ts`
  - `src/services/PowerUpService.ts`
  - `src/models/progression.types.ts`
  - `src/models/session.types.ts`
  - `src/repositories/StorageRepository.ts`
  - `src/hooks/useLearningSession.ts`
  - `src/components/questions/MCQRenderer.tsx`
  - `src/components/questions/QuestionRenderer.tsx`
  - `src/components/feedback/FeedbackDrawer.tsx`
  - `src/views/DailySessionScreen.tsx`
  - `src/views/ProfileScreen.tsx`
  - `src/App.tsx`
  - `tests/PowerUpsAndProfileInteractive.test.ts`
  - `tests/MobileLayoutAndResponsiveness.test.ts`
- **Verification**: 63/63 Vitest tests passing, production build passing cleanly.

---

### Entry 15 — Home Screen Redesign: Move Level & Secondary Features to Top-Right Header Icons
- **Date**: 2026-09-29
- **Area**: UI / Information Architecture / Header Action Cluster
- **Previous Behavior**: Home screen had large stacked cards for Level progression, Power-Ups collection, and Profile navigation, causing vertical clutter and distracting from the primary "Today's Training" action.
- **New Behavior**:
  - Redesigned `Header.tsx` to include a compact, unified top-right action cluster:
    - Streak badge (`🔥 {streakCount}`)
    - XP badge (`⚡ {xpCount}`)
    - Level icon button (`Award` icon with level badge, accessible label, navigates to Profile)
    - Power-Ups icon button (`Sparkles` icon with unlocked count badge, accessible label, navigates to Profile)
    - Profile icon button (`User` icon with accessible label, navigates to Profile)
  - Simplified `HomeScreen.tsx` to focus purely on today's training: Header $\rightarrow$ Trainee Greeting $\rightarrow$ Daily Mission Card $\rightarrow$ Compact Stats Grid $\rightarrow$ Prototype Notice.
  - Consolidated all detailed progression (Level & XP, 7-day streak calendar, 3 core competency progress bars, full Power-Up collection, and training statistics) into `ProfileScreen.tsx`.
- **Files Affected**:
  - `src/components/common/Header.tsx`
  - `src/views/HomeScreen.tsx`
  - `src/App.tsx`
  - `tests/HeaderActionCluster.test.ts`
  - `tests/HomeScreenProgressionAndPowerUps.test.ts`
- **Verification**: 69/69 Vitest tests passing, production build passing cleanly. Verified responsive fit at 360px width without horizontal overflow.

---

### Entry 16 — Profile Screen Simplification for ASHA Worker Usability
- **Date**: 2026-09-29
- **Area**: UI / UX / Usability for Frontline Healthcare Workers
- **Target Audience**: ASHA (Accredited Social Health Activist), Anganwadi workers, and frontline community health workers (8th–10th grade education level).
- **Previous Behavior**:
  - `ProfileScreen.tsx` displayed a dense, analytical dashboard with Core Competency progress bars (Device Handling, Heart Recording, Quality Assessment), accuracy percentages, question counters, detailed training statistics grid, large 7-day calendar strip, and fractional power-up unlock equations (`0/50 correct answers`, `29 more needed`).
  - Cognitive load was high; the screen felt like an academic performance analytics dashboard rather than a simple personal learning profile.
- **New Simplified Behavior**:
  - **Removed from UI**:
    - Entire "CORE COMPETENCY PROGRESS" section and progress bars.
    - Entire "TRAINING STATISTICS" section (Questions Answered, Correct Answers, Total XP Earned, Sessions Completed, Auscultation Accuracy %, eliminating any potential `NaN%`).
    - Complex fractional unlock equations.
  - **Simplified 5-Section Layout**:
    1. **Header**: Simple `← My Profile` with back navigation.
    2. **Section 1: My Profile Card**: Friendly avatar, Trainee Name, Role badge (`ASHA Health Worker` / `Anganwadi Worker` / `Health Volunteer`), Location (`District, State`), Health Sub-Centre, and `Edit Profile →` action.
    3. **Section 2: My Learning**: 3 clean stat cards:
       - `🔥 Current Streak` (e.g. `1 Day`, `0 Days`, `7 Days`)
       - `⚡ Learning Points` (User-friendly translation for XP, e.g. `165`)
       - `📚 Lessons Completed` (User-friendly translation for sessions completed, e.g. `4`)
    4. **Section 3: My Learning Tools**: 2x2 compact chips for `💡 Hint`, `📖 Learn`, `↩ Retry`, and `🛡 Streak Shield` with clear `✓ Available`, `Consumed`, or `🔒 Locked` status indicators.
    5. **Section 4: Account**: Pinned card with `✏️ Edit Profile →` and `🚪 Sign Out →` actions.
    6. **Section 5: Navigation**: `Back to Home` button.
  - **Data Layer Integrity**: Preserved all underlying business logic (`PowerUpService.ts`, `ProgressionService.ts`, `StorageRepository.ts`, `idb` stores, accuracy calculations, and user data isolation).
- **Files Affected**:
  - `src/views/ProfileScreen.tsx`
  - `src/models/user.types.ts`
  - `tests/SimplifiedProfileScreen.test.ts`
  - `walkthrough.md`
  - `PROJECT_LOG.md`
- **Verification**: 83/83 Vitest tests passing across 9 test suites; production build passing with 0 errors.

---

### Entry 17 — Profile Screen Refinement: Single-Viewport Fit & Redundancy Removal
- **Date**: 2026-09-29
- **Area**: Mobile UX / Layout Optimization / Ergonomics
- **Target Viewports**: 360×800, 375×812, 390×844, 412×915.
- **Previous Behavior**:
  - The Profile screen had duplicate "Edit Profile" controls (one in the Profile Card, another in Account).
  - The bottom had a large "Back to Home" button that duplicated the header's back arrow.
  - Generous card heights and vertical gaps pushed the bottom of the page past 800px, requiring vertical scrolling on standard mobile screens.
- **New Simplified Behavior**:
  - **Removed Duplicate "Edit Profile"**: Kept only the `Edit Profile →` button inside the Trainee Profile Card. Removed the second row from Account.
  - **Removed Bottom "Back to Home" Button**: The header back arrow (`← My Profile`) serves as the sole navigation control.
  - **Streamlined Account Section**: Contains strictly the `🚪 Sign Out` action card with data preservation notice.
  - **Single-Viewport Mobile Fit**:
    - Compacted page padding and section gaps (`px-3.5 sm:px-4 py-2.5 sm:py-3`, `gap-2.5 sm:gap-3`).
    - Compacted Profile Card padding (`p-3 sm:p-3.5`).
    - Shortened "My Learning" labels: `Streak` (`1 Day`), `Points` (`165`), `Lessons` (`4`) in a 72px-tall 3-card grid.
    - Shortened "My Learning Tools" labels: `💡 Hint`, `📖 Learn`, `↩ Retry`, `🛡 Shield` with zero text truncation.
    - Total content height reduced to ~540px, allowing the entire page to fit comfortably within a single mobile viewport without scrolling.
- **Files Affected**:
  - `src/views/ProfileScreen.tsx`
  - `tests/SimplifiedProfileScreen.test.ts`
  - `walkthrough.md`
  - `PROJECT_LOG.md`
- **Verification**: 84/84 Vitest tests passing across 9 test suites; production build passing with 0 errors.

---

### Entry 18 — Header Navigation Refactor & Dedicated Power-Ups Screen
- **Date**: 2026-09-29
- **Area**: Navigation Architecture / Header / View Separation
- **Target Audience**: ASHA and frontline health workers.
- **Previous Behavior**:
  - The Header contained 5 items including a third button (`Award`/Level icon) that caused navigation ambiguity and header crowding at 360px mobile width.
  - Multiple header icons routed to `ProfileScreen`.
  - Power-Ups were embedded inside `ProfileScreen.tsx`.
- **New Simplified Behavior**:
  - **4-Action Header**: Header contains ONLY:
    1. `🔥 Streak` (status indicator)
    2. `⚡ Learning Points` (status indicator)
    3. `✨ Power-Ups` (navigates exclusively to `PowerUpsScreen`)
    4. `👤 Profile` (navigates exclusively to `ProfileScreen`)
  - **Third Button Removed**: Completely removed the Level/Award icon button and `onNavigateLevel` prop.
  - **Dedicated Power-Ups Page (`src/views/PowerUpsScreen.tsx`)**:
    - Created clean standalone view with `← Power-Ups` back navigation.
    - Displays the 4 tools (`💡 Hint`, `📖 Learn`, `↩ Retry`, `🛡 Streak Shield`) with real state from `PowerUpService` (`✓ Available`, `✓ Used`, `🔒 Locked`).
  - **Clean ProfileScreen**: Completely removed Power-Ups from `ProfileScreen.tsx`, leaving only Profile Card, My Learning, and Account.
  - **One Action = One Destination**: Single, unambiguous navigation model.
- **Files Affected**:
  - `src/components/common/Header.tsx`
  - `src/views/PowerUpsScreen.tsx`
  - `src/views/ProfileScreen.tsx`
  - `src/views/HomeScreen.tsx`
  - `src/App.tsx`
  - `tests/HeaderActionCluster.test.ts`
  - `tests/PowerUpsScreen.test.ts`
  - `tests/SimplifiedProfileScreen.test.ts`
  - `PROJECT_LOG.md`
  - `walkthrough.md`
- **Verification**: 88/88 Vitest tests passing across 10 test suites; production build passing with 0 errors in 2.34s.

---

### Entry 19 — Sign In / Sign Up Authentication Flow & Official Company Branding Integration
- **Date**: 2026-09-29
- **Area**: Authentication / Branding / App Routing
- **Scope**: Frontend-only authentication prototype and official company branding.
- **Features Implemented**:
  - **Official Company Logo Integration**:
    - Embedded official company logo asset (`aisteth_logo.png`) in `public/assets/images/` and `src/assets/`.
    - Integrated logo in `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, and `Header.tsx` brand area.
    - Updated `index.html` favicon.
  - **Sign In Screen (`src/views/SignInScreen.tsx`)**:
    - Mobile-first layout with official logo, "Welcome back", email/phone validation, password show/hide toggle, "Forgot password?" shortcut, "SIGN IN" action button, and "Create account" link.
  - **Sign Up Screen (`src/views/SignUpScreen.tsx`)**:
    - Registration form with fields supported by `user.types.ts` (`Full Name`, `Role` [ASHA / Anganwadi / Health Volunteer], `Health Centre`, `District`, `State`, `Email / Phone`, `Password`, `Confirm Password`).
    - Password matching verification, required field checking, loading state, and error handling.
  - **Forgot Password Screen (`src/views/ForgotPasswordScreen.tsx`)**:
    - Identifier input, recovery confirmation banner, prototype notice, and "Return to Sign In" action.
  - **Frontend Auth Service (`src/services/AuthService.ts`)**:
    - Isolated service managing `AuthSession` with browser storage and in-memory test fallbacks.
    - Persists session across reloads without storing plaintext passwords.
  - **Protected Routing in `src/App.tsx`**:
    - Bounded startup flow: Unauthenticated users see Sign In / Sign Up / Forgot Password.
    - Successful auth navigates directly to `HOME`.
    - Profile `Sign Out` resets state to `UNAUTHENTICATED` and shows Sign In.
- **Files Affected**:
  - `src/models/auth.types.ts` (created)
  - `src/models/user.types.ts`
  - `src/repositories/StorageRepository.ts`
  - `src/services/AuthService.ts` (created)
  - `src/views/SignInScreen.tsx` (created)
  - `src/views/SignUpScreen.tsx` (created)
  - `src/views/ForgotPasswordScreen.tsx` (created)
  - `src/components/common/Header.tsx`
  - `src/App.tsx`
  - `index.html`
  - `tests/AuthAndBrandingFlow.test.ts` (created)
- **Verification**: 104/104 Vitest tests passing across 11 test suites; production build passing with 0 errors in 2.52s.

---

### Entry 20 — Indian State & Dependent District Selection Dropdowns
- **Date**: 2026-09-29
- **Area**: Form UX / Location Selection / Validation
- **Scope**: Sign Up & Profile editing UX improvement with official India location dataset.
- **Features Implemented**:
  - **Reusable India Location Dataset (`src/data/indiaLocations.ts`)**:
    - Complete dataset containing all 28 Indian States and 8 Union Territories with official district lists.
    - Exported `INDIAN_STATES_AND_UTS`, `STATE_DISTRICTS_MAP`, `getDistrictsForState()`, and `isValidIndianState()`.
  - **State Dropdown**:
    - Replaced free-text input with dropdown selection featuring all 36 States/UTs.
  - **Dependent District Dropdown**:
    - Disabled initially with `"Select state first"` placeholder.
    - Dynamically populated upon State selection with districts belonging strictly to that State.
    - Automatically resets when State changes.
  - **Profile Screen Integration (`src/views/ProfileScreen.tsx`)**:
    - Applied the same State and District dropdown dataset to the inline Profile editing modal.
- **Files Affected**:
  - `src/data/indiaLocations.ts` (created)
  - `src/views/SignUpScreen.tsx`
- **Verification**: 110/110 Vitest tests passing across 11 test suites; production build passing with 0 errors in 2.34s.

---

### Entry 21 — Canonical Master Frontend Checklist Established
- **Date**: 2026-09-29
- **Area**: Project Governance / Frontend Architecture / Verification Tracking
- **Scope**: Established `docs/FRONTEND_CHECKLIST.md` as the single canonical source of truth for all frontend requirements.
- **Protocol**:
  - Automatically records completed items with `[x]` after verification, `[~]` for pending verification, and `[ ]` for planned/deferred.
  - Documents relevant components and verification state.
  - Synchronized across 16 major frontend areas and 110 automated tests.
- **Files Affected**:
  - `docs/FRONTEND_CHECKLIST.md` (created)
  - `PROJECT_LOG.md`
  - `walkthrough.md`
- **Verification**: 110/110 Vitest tests passing across 11 test suites; production build passing with 0 errors.

---

## 4. Bug History & Investigation Log

### Bug 001 — Unanswered Question Marked Incorrect
- **Date**: 2026-09-29
- **Area**: Question Engine / Evaluation
- **Problem**: Calling `AnswerEvaluator.evaluate()` with null/undefined payload returned `is_correct: false` and classified the question as a wrong answer.
- **Expected Behavior**: Missing input should be recorded defensively as `UNANSWERED` without penalizing XP or generating false clinical error records.
- **Root Cause**: The evaluator lacked an explicit defensive check before matching against `question.correct_answer`.
- **Fix**: Created `AnswerStatus = 'UNANSWERED' | 'CORRECT' | 'INCORRECT'` and `createUnansweredResult()` fallback.
- **Files Changed**: `src/models/question.types.ts`, `src/services/AnswerEvaluator.ts`.
- **Verification**: Unit tests in `tests/AnswerEvaluator.test.ts`.
- **Status**: **FIXED**

---

### Bug 002 — Accidental Submission on Empty Input
- **Date**: 2026-09-29
- **Area**: UI Interaction
- **Problem**: The "Check Answer" button was clickable before the learner made an answer selection.
- **Expected Behavior**: The button should remain disabled until a valid answer is provided.
- **Root Cause**: `DailySessionScreen.tsx` did not gate the `disabled` prop with `AnswerEvaluator.isValidAnswer()`.
- **Fix**: Added `const canSubmit = AnswerEvaluator.isValidAnswer(currentQuestion, session.currentAnswer)` and bound it to the button's `disabled` prop.
- **Files Changed**: `src/views/DailySessionScreen.tsx`, `src/hooks/useLearningSession.ts`.
- **Verification**: Verified for all 5 question types in `tests/MobileLayoutAndResponsiveness.test.ts`.
- **Status**: **FIXED**

---

### Bug 003 — Session Reset on Browser Reload
- **Date**: 2026-09-29
- **Area**: State Persistence / Offline Storage
- **Problem**: Reloading the page during an active session (e.g. at Question 5) caused the app to reset back to Question 1.
- **Expected Behavior**: Active session progress (current question index, answered history, XP earned) should persist across reloads.
- **Root Cause**: Session state resided only in React component state (`useState`) without disk persistence.
- **Fix**: Implemented IndexedDB `daily_sessions` store with local calendar date key (`YYYY-MM-DD`) and integrated automatic state restoration in `useLearningSession.ts`.
- **Files Changed**: `src/repositories/StorageRepository.ts`, `src/hooks/useLearningSession.ts`.
- **Verification**: Persistence integration tests in `tests/QuestionRepositoryAndService.test.ts`.
- **Status**: **FIXED**

---

### Bug 004 — Unnecessary Document Scrollbar from Static Bottom Padding
- **Date**: 2026-09-29
- **Area**: Mobile CSS Layout
- **Problem**: Short questions had an unconditional vertical scrollbar.
- **Expected Behavior**: When all question content fits inside the viewport, no scrollbar should appear.
- **Root Cause**: `DailySessionScreen.tsx` used `pb-28` (112px bottom padding) on top of `min-h-screen`, adding 112px of artificial blank height.
- **Fix**: Removed `pb-28` and adopted a sticky/bounded footer layout.
- **Files Changed**: `src/views/DailySessionScreen.tsx`.
- **Verification**: Document scroll height checks across mobile widths.
- **Status**: **FIXED**

---

### Bug 005 — Submit Button Clipped by Android System Navigation Bar
- **Date**: 2026-09-29
- **Area**: Mobile Viewport Layout / Dynamic Sizing
- **Problem**: On mobile devices (360×800), Option D was visible, but a large blank space appeared below it, pushing the Submit button ~74px off-screen into the Android navigation bar.
- **Expected Behavior**: The Submit button must be 100% visible and immediately tappable above the Android navigation bar without scrolling when content fits.
- **Root Cause**: Combining `min-h-dvh` on container with `flex-1` on `<main>` caused `<main>` to stretch to full viewport height before adding the 74px footer, resulting in total height of `100dvh + 74px`.
- **Fix**: Bounded `MobileContainer` to `h-dvh max-h-dvh min-h-0 overflow-hidden`, made `DailySessionScreen` `h-full flex flex-col justify-between overflow-hidden`, removed nested `flex-1` spacers from question renderers, and pinned footer with safe-area padding.
- **Files Changed**: `src/layouts/MobileContainer.tsx`, `src/views/DailySessionScreen.tsx`, `src/components/questions/MCQRenderer.tsx`, `src/components/feedback/FeedbackDrawer.tsx`, `src/styles/index.css`.
- **Verification**: Verified on 360×800, 375×812, 390×844, 412×915 viewports.
- **Status**: **FIXED**

---

### Bug 006 — Feedback Drawer Overlaid Question Content
- **Date**: 2026-09-29
- **Area**: Mobile UX / Viewport Layering / Information Architecture
- **Problem**: Upon submitting an answer, the feedback drawer opened as a fixed modal overlay covering ~85% of the viewport height, hiding the question text, difficulty/category metadata, and answer cards from view.
- **Expected Behavior**: The learner must retain visual and contextual access to the question and their selected answer in the upper viewport while the feedback panel displays below it.
- **Root Cause**: `FeedbackDrawer.tsx` was structured as `fixed inset-x-0 bottom-0 z-40 max-h-[85dvh]` floating over the screen instead of being a proportional docked flex child within the `DailySessionScreen` column.
- **Fix**: Docked `FeedbackDrawer` as a `shrink-0 max-h-[48dvh] sm:max-h-[50dvh]` bottom panel with internal micro-learning scrolling and safe-area continue button, sharing the viewport with the upper `flex-1 min-h-0 overflow-y-auto` question container.
- **Files Changed**:
  - `src/components/feedback/FeedbackDrawer.tsx`
  - `src/components/feedback/MicroLearningSheet.tsx`
  - `src/components/feedback/ResultBanner.tsx`
  - `src/views/DailySessionScreen.tsx`
  - `tests/MobileLayoutAndResponsiveness.test.ts`
- **Verification**: Verified across 360×800, 375×812, 390×844, and 412×915 viewports.
- **Status**: **FIXED**

---

## 5. Design Decision Log

### Decision 001 — One 10-Question Training Session Per Day
- **Date**: 2026-09-29
- **Context**: Community healthcare workers have limited time between field visits. An open-ended or repeatable quiz encourages binge-learning and quick abandonment.
- **Options Considered**:
  1. *Uncapped Practice*: Allow unlimited practice sessions anytime.
  2. *Standard Course*: Multi-chapter linear module course.
  3. *Single Daily Mission (Selected)*: Exactly one 10-question mission per calendar day with daily streak tracking.
- **Decision**: Single 10-question daily mission.
- **Consequences**: Removed "Practice Again" and locked the Home screen into `TODAY'S TRAINING COMPLETE` upon session review.

---

### Decision 002 — Polymorphic Question Architecture with JSON Schema Validation
- **Date**: 2026-09-29
- **Context**: Medical auscultation skills require multi-modal evaluation (sound discrimination, landmark placement, order of operations, diagnostic MCQs).
- **Options Considered**:
  1. *Generic MCQ Only*: Text-only questions.
  2. *Polymorphic Discriminator Architecture (Selected)*: TypeScript discriminated unions (`type: 'MCQ' | 'TRUE_FALSE' | 'IMAGE_TAP' | 'STEP_ORDER' | 'AUDIO_DISCRIMINATION'`) backed by AJV JSON Schema validation.
- **Decision**: Polymorphic schema with specialized tactile mobile renderers.
- **Consequences**: Enables clinical audio playback, interactive landmark tapping, and tactile step ordering within a uniform session runner.

---

### Decision 003 — Offline-First IndexedDB Storage Architecture
- **Date**: 2026-09-29
- **Context**: Rural health sub-centres frequently experience zero network connectivity.
- **Options Considered**:
  1. *Cloud REST API / Firebase*: Requires persistent network connection.
  2. *localStorage*: Limited to 5MB, synchronous, string-only.
  3. *IndexedDB with LocalStorage Fallback (Selected)*: Asynchronous, structured object storage using `idb` library.
- **Decision**: IndexedDB object stores (`questions`, `sessions`, `user_stats`, `daily_sessions`).
- **Consequences**: 100% offline capability; survives browser reloads; clean migration path to Phase 2 cloud sync.

---

### Decision 004 — 3-Tier Bounded Mobile App Shell Architecture
- **Date**: 2026-09-29
- **Context**: Mobile web apps on Android Chrome and iOS Safari encounter dynamic URL bars and virtual navigation bars that break `100vh` layouts.
- **Options Considered**:
  1. *Global overflow: hidden*: Truncates long questions and makes them inaccessible.
  2. *Unbounded Document Flow*: Causes button clipping and unnecessary scrolling.
  3. *3-Tier Bounded Mobile App Shell (Selected)*: Outer shell locked to `h-dvh max-h-dvh overflow-hidden`; Header `shrink-0`; Content `flex-1 min-h-0 overflow-y-auto`; Footer `shrink-0` with safe-area padding.
- **Decision**: 3-tier bounded mobile shell.
- **Consequences**: Perfect viewport fit for short questions; natural internal scrolling for long questions; zero button clipping.

---

### Decision 005 — Separation of Core Competency Area and Internal Category Hierarchy
- **Date**: 2026-09-29
- **Context**: The product requires high-level competency tracking across 3 core clinical areas (Device Handling, Heart Recording, Recording Quality Assessment) while maintaining granular internal categorizations (such as Anatomical Placement and Operating Procedure under Heart Recording).
- **Options Considered**:
  1. *Flat 5-Category Enum (Legacy)*: Forced all 5 categories onto a single flat level, conflating macro-competencies with sub-skills.
  2. *Two-Tier Competency Area + Category Architecture (Selected)*: Explicitly adds `competency_area` (3 macro areas) and retains `category` (5 granular categories) with strict hierarchical mapping.
- **Decision**: Two-tier schema architecture (`competency_area` $\rightarrow$ `category`).
- **Consequences**: Enables macro competency analytics (e.g. Heart Recording: 67%) on user profiles while allowing micro-skill diagnostic drilldowns (e.g. Anatomical Placement: 45%) and Leitner adaptive targeting.

---

### Decision 006 — Deferral of Adaptive Questionnaire & Machine Learning Logic to Phase 3
- **Date**: 2026-09-29
- **Context**: Content authoring, simpler follow-up questions, `Follow_Up_For` relationships, Version 1 $\rightarrow$ Version 2 transitions, branching logic, and Machine Learning-based question selection are advanced pedagogical capabilities.
- **Options Considered**:
  1. *Prematurely Implement Adaptive Engine in Frontend (Rejected)*: Risk over-engineering unvalidated branching flows and disrupting Phase A frontend completion.
  2. *Strict Scope Boundary (Selected)*: **"Adaptive questionnaire logic and Machine Learning-based question selection are intentionally deferred to Phase 3."**
- **Decision**: Keep the frontend question engine strictly compatible with the existing basic question structure and five renderers. The questionnaire team prepares content independently; adaptive branching, ML models, and follow-up selection will be designed in Phase 3.
- **Consequences**: Protects focus on Phase A frontend UI/UX completion, level progression, and gamification polish without premature schema churn.

---

## 6. Architecture Evolution


```
[Phase 1 Prototype: Static In-Memory React App]
                        ↓
[Repository & Service Abstraction Layer Added]
                        ↓
[IndexedDB Offline Persistence Layer (DB v2) Added]
                        ↓
[Polymorphic Question Engine & JSON Schema Validation Added]
                        ↓
[3-Tier Bounded Mobile Viewport Shell Added]
                        ↓
[2-Tier Competency & Category Question Architecture (Current)]
```

### Architectural Layer Breakdown:
1. **Data Layer (`src/data/`, `src/models/`)**:
   - `question.types.ts`: Discriminated union models for all 5 question types with 2-tier competency/category schema.
   - `session.types.ts`: State machine types (`DailyProgressStatus`, `SessionState`, `UserStats`).
   - `dummy_questions.json`: 15 curated demonstration questions (source: `DEMO`, `clinician_validated: false`).
2. **Repository Layer (`src/repositories/`)**:
   - `IQuestionRepository.ts`: Interface abstraction for question retrieval.
   - `MockJsonQuestionRepository.ts`: In-memory mock repository querying local JSON.
   - `StorageRepository.ts`: Offline IndexedDB wrapper (`idb`) managing stores for `questions`, `sessions`, `user_stats`, and `daily_sessions`.
3. **Service Layer (`src/services/`)**:
   - `QuestionService.ts`: Session assembly and question balancing.
   - `AnswerEvaluator.ts`: Pure, deterministic answer evaluation with defensive status handling.
   - `ISessionGenerator.ts`: Generator creating balanced 10-question daily sets.
4. **UI & View Layer (`src/views/`, `src/components/`, `src/layouts/`)**:
   - `MobileContainer.tsx`: Bounded mobile viewport wrapper (`max-w-md h-dvh max-h-dvh overflow-hidden`).
   - `HomeScreen.tsx`: State-aware mission dashboard.
   - `DailySessionScreen.tsx`: 3-tier mobile session runner.
   - `QuestionReviewScreen.tsx`: Comprehensive post-session breakdown.
   - `QuestionRenderer.tsx`: Polymorphic dispatcher rendering question-specific components.

---

## 7. Question & Content System Evolution

### 7.1 The 5 Polymorphic Question Types
1. **`MCQ`**: Standard 4-choice single-select multiple choice with letter badges (A, B, C, D).
2. **`TRUE_FALSE`**: Binary clinical validation with large tactile cards.
3. **`IMAGE_TAP`**: Interactive chest anatomical diagram (`chest_auscultation_points.svg`) with pixel-to-percentage coordinate mapping, target zone bounding box calculation, and post-submission reveal.
4. **`STEP_ORDER`**: Tactile chronological ordering of clinical procedural steps with Up/Down controls and position validation.
5. **`AUDIO_DISCRIMINATION`**: Multi-track auscultation comparison with play/pause wave controls, single-active-audio enforcement, and acoustic finding explanations.

### 7.2 Two-Tier Competency & Category Hierarchy
- **Core Competency Areas (3 Macro Areas)**:
  - **`DEVICE_HANDLING`**: Device Readiness & Physical Maintenance (Target: 20 Questions).
  - **`HEART_RECORDING`**: Clinical Examination, Landmark Identification & SOP (Target: 20 Questions).
  - **`QUALITY_ASSESSMENT`**: Acoustic Interpretation & Noise Artifact Discrimination (Target: 20 Questions).
- **Internal Categories (5 Granular Sub-Categories)**:
  - `DEVICE_HANDLING` (maps to `DEVICE_HANDLING`)
  - `OPERATING_PROCEDURE` (maps to `HEART_RECORDING`)
  - `ANATOMICAL_PLACEMENT` (maps to `HEART_RECORDING`)
  - `HEART_RECORDING` (maps to `HEART_RECORDING`)
  - `QUALITY_ASSESSMENT` (maps to `QUALITY_ASSESSMENT`)

### 7.3 Content Generation & Validation Workflow
- **Excel Spreadsheet Template**: `scripts/generate_template_xlsx.js` generates standardized 28-column `questions_template.xlsx` with relational dropdown data validation.
- **JSON Schema Validation**: `question.schema.json` with strict AJV validation (`tests/SchemaValidation.test.ts`) guaranteeing 100% data integrity before runtime ingestion.
- **Phase 1 Content Guarantee**: All questions flagged `source: "DEMO"`, `clinician_validated: false`, `version: "1.0.0"`.


---

## 8. Mobile & Responsive Design History

### Viewport Matrix & Test Validation:
| Viewport Size | Representative Devices | Result | Behavior Verified |
| :--- | :--- | :--- | :--- |
| **360 × 800** | Budget Android (Redmi, Samsung Galaxy A series) | **PASS** | Option D has natural spacing; Submit button 100% visible & tappable; zero scrolling needed |
| **375 × 812** | Compact iOS (iPhone X, 11 Pro, 12 Mini, 13 Mini) | **PASS** | Safe-area inset bottom padding cleanly elevates Submit button above Home Indicator |
| **390 × 844** | Standard Mobile (iPhone 12, 13, 14, 15) | **PASS** | Balanced vertical spacing; crisp typography; instant feedback animation |
| **412 × 915** | Tall Android (Google Pixel 7/8, Galaxy S21/S22/S23) | **PASS** | Clean centering; no dead padding; sticky elements remain properly anchored |

### Touch Target & Accessibility Guidelines Enforced:
- All interactive option buttons meet the minimum **48×48px** accessible touch target standard (`min-h-[52px]` on mobile, `min-h-[58px]` on larger screens).
- Safe area insets handled via `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- Focus outlines preserved for keyboard navigation (`*:focus-visible`).
- Text uses high-contrast Slate/Brand color tokens against white surfaces (`contrast ratio > 4.5:1`).

---

## 9. Removed & Deprecated Features

| Feature | Date Removed | Reason for Removal | Replacement |
| :--- | :--- | :--- | :--- |
| **"Training Modules Covered"** | 2026-09-29 | Exposed internal question engine types as separate modules, confusing the learner's mental model. | Simplified Home screen focused purely on "Today's Training" daily mission. |
| **"Practice Again" Action** | 2026-09-29 | Bypassed the single daily training session concept, encouraging repetitive grinding instead of habit formation. | Single-session daily lock (`TODAY'S TRAINING COMPLETE` state). |
| **Unconditional `pb-28` Padding** | 2026-09-29 | Statically added 112px to page bottom, triggering runaway document scrolling on short questions. | 3-tier bounded mobile shell with pinned safe-area footer. |

---

## 10. Experiments & Abandoned Approaches

### Experiment 01: Multi-Card Module Dashboard
- **Hypothesis**: Showing learners separate cards for MCQs, Hotspot Tapping, Step Ordering, and Audio Quality would make the app feel feature-rich.
- **Result**: Trainees were confused about where to start and felt overwhelmed by multiple module choices.
- **Decision**: **ABANDONED**. Replaced with a unified 10-question daily mission.

### Experiment 02: `min-h-screen` with Inline Sticky Footers
- **Hypothesis**: Setting `min-h-screen` and `sticky bottom-0 mt-auto` on the question screen would automatically anchor the button to the bottom of the viewport.
- **Result**: In mobile browsers with system navigation bars, `min-h-screen` combined with `flex-grow: 1` pushed the sticky footer into document overflow (`100dvh + 74px`), clipping the button off-screen.
- **Decision**: **ABANDONED**. Replaced with the 3-tier bounded mobile app shell (`h-dvh max-h-dvh overflow-hidden`).

### Experiment 03: Global `overflow: hidden` on Viewport
- **Hypothesis**: Forcing `overflow: hidden` on the root body would prevent all page-level scrollbars.
- **Result**: Long clinical case questions and multi-line option cards were truncated and became unscrollable.
- **Decision**: **ABANDONED**. Moved scrolling exclusively into the question content container (`flex-1 min-h-0 overflow-y-auto overscroll-contain`).

---

## 11. Project Milestones

| Date | Milestone | Scope / Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **2026-09-29** | **Phase 1 Prototype Initiation** | Core React 18, TypeScript, TailwindCSS project setup with Vite PWA support. | **COMPLETED** |
| **2026-09-29** | **Polymorphic Question Engine** | 5 interactive question renderers (MCQ, True/False, Image Tap, Step Order, Audio Discrimination). | **COMPLETED** |
| **2026-09-29** | **Defensive Evaluation Layer** | `AnswerEvaluator` with `UNANSWERED` classification and `isValidAnswer` gating. | **COMPLETED** |
| **2026-09-29** | **IndexedDB Persistence (v2)** | `StorageRepository` with `daily_sessions` store and calendar-date session resumption. | **COMPLETED** |
| **2026-09-29** | **Home Screen State Machine** | 4-state dynamic daily mission lifecycle (`NOT_STARTED` $\rightarrow$ `REVIEW_VIEWED`). | **COMPLETED** |
| **2026-09-29** | **One-Time Session Review** | 10-question clinical takeaway review with permanent daily completion lock. | **COMPLETED** |
| **2026-09-29** | **3-Tier Mobile Viewport Shell** | Bounded dynamic viewport (`100dvh`), zero artificial void, pinned safe-area footer. | **COMPLETED** |
| **2026-09-29** | **Phase 1 Engineering Foundation** | 20/20 unit tests passing, zero TypeScript errors, production PWA build verified. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Full Power-Up Behavior & Engine** | Interactive HINT, LEARN, RETRY, and STREAK SHIELD with in-session actions and persistence. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Full Profile & Progress Screen** | Trainee details, Level/XP progress, active 7-day streak calendar, 3 core competency progress bars, and stats. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Home Screen Redesign (Header Cluster)**| Consolidated secondary features into top-right action cluster (`Streak`, `XP`, `Level`, `Power-Ups`, `Profile`). | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Profile Screen Simplification for ASHA Workers**| Transformed Profile from dense analytics dashboard into simple personal learning page (My Profile, My Learning, My Tools, Account). | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Profile Screen Single-Viewport Refinement**| Removed duplicate Edit Profile, removed bottom Back to Home button, compacted layout for natural single-viewport fit. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Header 4-Action Refactor & Dedicated Power-Ups Screen**| Header with 4 clean actions (Streak, Points, Power-Ups, Profile), removed third button, created dedicated `PowerUpsScreen.tsx`. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Sign In / Sign Up Flow & Global Branding Integration**| Created `SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `AuthService`, protected entry flow, and official logo branding. | **COMPLETED & VERIFIED** |
| **2026-09-29** | **Indian State & Dependent District Selection Dropdowns**| Reusable `indiaLocations.ts` dataset; dynamic state/district selection on Sign Up and Profile edit. | **COMPLETED & VERIFIED** |
| **Pending** | **Phase 2: Backend, Cloud & Content Ingestion** | Firebase Auth, Firestore sync, cloud profiles, supervisor analytics, 60 production clinical questions ingestion. | **PENDING** |
| **Pending** | **Phase 3: Adaptive Learning & ML Question Engine** | Adaptive question flow, `Follow_Up_For` relationships, Version 1/2 transitions, ML-based selection model, Leitner engine. | **PENDING (DEFERRED)** |

---

## 12. Current Project State

### 12.1 Phase & Architecture
- **Current Stage**: **Phase A Frontend Milestone: Sign In, Sign Up, Dependent State/District Dropdowns & Global Branding Complete**
- **Core Stack**: React 18.3, TypeScript 5.7, TailwindCSS 3.4, Vite 6.4, Vite PWA Plugin, `idb` 8.0, Lucide React 1.16, Vitest 2.1.
- **Build Status**: Production bundle compiled cleanly (`dist/` generated with PWA service worker; zero TypeScript/lint errors).
- **Test Status**: **110 passed / 110 total tests** across 11 test suites.

### 12.2 Implementation Breakdown

#### A. IMPLEMENTED (Phase 1 Foundation & Phase A Frontend Complete)
- [x] React 18 + TypeScript + Vite build & test toolchain.
- [x] TailwindCSS design tokens and PWA offline manifest setup.
- [x] Home screen foundation with 4-state daily mission lifecycle (`NOT_STARTED`, `IN_PROGRESS`, `QUESTIONS_COMPLETED`, `REVIEW_VIEWED`).
- [x] Daily 10-question session runner with question balancing.
- [x] 5 polymorphic interactive question renderers (MCQ, True/False, Image Tap, Step Order, Audio Discrimination).
- [x] Pure deterministic answer evaluation with defensive `UNANSWERED` classification.
- [x] Reactive Submit button gating (`canSubmit = isValidAnswer`).
- [x] Offline IndexedDB session persistence (`StorageRepository`, `DB_VERSION = 2`, `daily_sessions` store keyed by local calendar date `YYYY-MM-DD`).
- [x] Mid-session reload resumption without progress loss.
- [x] One-time Session Review with clinical takeaways and completion lock (`markReviewViewed()`).
- [x] 3-tier bounded mobile app shell (`100dvh`, zero unnecessary scroll, pinned safe-area footer).
- [x] Native 2-state swipeable feedback drawer bottom sheet (`COLLAPSED` $\rightarrow$ `EXPANDED`).
- [x] Full Power-Up Behavior (`HINT` at 50 correct answers, `LEARN` at 100 answered, `RETRY` at 20-day streak, `STREAK SHIELD` at 30-day streak).
- [x] In-session Power-Up bar with active elimination and clinical clue reveals.
- [x] RETRY re-attempt interaction inside feedback drawer without breaking 10-question session boundary.
- [x] Clean 4-action Header (`Streak`, `Learning Points`, `Power-Ups`, `Profile`) with zero crowding and third button removed.
- [x] Dedicated `PowerUpsScreen.tsx` with friendly cards (`💡 Hint`, `📖 Learn`, `↩ Retry`, `🛡 Streak Shield`) showing real state (`✓ Available`, `✓ Used`, `🔒 Locked`).
- [x] Simplified & compact `ProfileScreen.tsx` for ASHA health workers (`My Profile`, `My Learning`, `Account`).
- [x] Single-viewport fit (~540px total content height) without requiring scrolling on 360×800 to 412×915.
- [x] One Action = One Destination navigation architecture.
- [x] Official company logo integration (`aisteth_logo.png`) across Auth screens, App Header, and favicon.
- [x] Mobile-first `SignInScreen.tsx` with validation and show/hide password toggle.
- [x] Mobile-first `SignUpScreen.tsx` with role selector and matching confirm password validation.
- [x] Reusable `indiaLocations.ts` with all 28 States and 8 Union Territories and dependent district lists.
- [x] State dropdown and dependent District dropdown with state-change auto-reset.
- [x] `ForgotPasswordScreen.tsx` with recovery flow and prototype notice.
- [x] Isolated frontend `AuthService.ts` and protected routing in `App.tsx`.
- [x] Profile `Sign Out` flow returning to Sign In while preserving IndexedDB training records.
- [x] Zero NaN/undefined fallbacks across all stats and counters.
- [x] Production skeleton loading, empty starter, and error retry states.
- [x] 110 automated unit, integration, and layout contract tests.

#### B. PENDING (Subsequent Phases)
- **Phase 2 (Cloud, Backend & Content)**: Firebase Authentication, Firestore cloud sync, Storage, supervisor analytics dashboard, 60 production question ingestion.
- **Phase 3 (Adaptive Learning & ML)**: **"Adaptive questionnaire logic and Machine Learning-based question selection are intentionally deferred to Phase 3."** (Follow-up relationships, V1/V2 branching, adaptive question selection, and ML integration).

### 12.3 Current Limitations & Field Notices
- All questions and stethoscope recordings in Phase 1 are demonstration content intended for software architecture validation. Clinician validation is required before field deployment.
- Level thresholds (Level 1–5 XP curves) are provisional and subject to clinical curriculum alignment.
- Power-Ups are deterministically unlocked from user performance metrics without artificial monetization or recharge timers.

---

## 13. Phase 2.1 — Firebase Development Environment Setup (Completed 2026-09-30)

### 13.1 Objective & Scope
Established a clean, isolated Firebase development environment for AiSteth Academy using the dedicated development project `aisteth-academy-dev` and the Firebase Local Emulator Suite. Adhered strictly to the frozen Architecture & Database Specification v2.5.0 (`DATABASE_SCHEMA.md` and `BACKEND_IMPLEMENTATION_PLAN.md`).

### 13.2 Files Created & Configured
1. **`.firebaserc`**: Configured multi-project targets:
   - `default` / `development`: `aisteth-academy-dev`
   - `staging`: `aisteth-academy-staging`
   - `production`: `aisteth-academy-prod`
2. **`firebase.json`**: Defined Firebase services and Local Emulator Suite port allocations:
   - Auth Emulator: `9099`
   - Firestore Emulator: `8080`
   - Cloud Functions Emulator: `5001`
   - Cloud Storage Emulator: `9199`
   - Emulator UI: `4000`
3. **`firestore.rules`**: Production-ready security rules implementing frozen v2.5.0 specification:
   - Read-only trainee access to `/users/{uid}/dailySessions` and `/users/{uid}/attempts`
   - Blocked direct client creation/mutation on daily sessions and attempts (reserved for server Cloud Functions)
   - Blocked all client enumeration on `/usernames`
   - Trainee profile field modification protection (immutable: `uid`, `username`, `role`, `organizationId`, `learningState`, `lastActiveAt`, `createdAt`)
4. **`firestore.indexes.json`**: Composite query indexes defined for `attempts` (`dailySessionId` + `clientTimestamp`, `questionId` + `result`), `dailySessions` (`localDate` + `status`), and `users` (`organizationId` + `role`).
5. **`storage.rules`**: Cloud Storage security rules granting authenticated read access to `/content-releases/**` media assets and write access restricted to `CONTENT_ADMIN` and `PLATFORM_ADMIN`.
6. **`functions/` Codebase Skeleton**:
   - `functions/package.json`: Node 20 target with `firebase-admin` 13.0 and `firebase-functions` 6.0.
   - `functions/tsconfig.json`: Strict TypeScript ES2022 / NodeNext compilation.
   - `functions/src/index.ts`: Clean placeholder export establishing development environment readiness without premature business logic.
7. **`.env.example` & `.env.development`**: Standardized Vite client environment configuration with emulator toggles (`VITE_USE_FIREBASE_EMULATOR=true`) and development project metadata (`aisteth-academy-dev`).
8. **`.gitignore`**: Hardened Git exclusions protecting environment secrets, private keys (`*.serviceAccountKey.json`, `*firebase-adminsdk*.json`), Firebase debug logs, and build artifacts.
9. **`docs/FIREBASE_ENVIRONMENT.md`**: Comprehensive developer manual documenting project architecture, emulator ports, local running commands, environment switching, and server-side secret boundaries.
10. **`package.json`**: Added `emulators` and `emulators:exec` scripts.

### 13.3 Deliberately Deferred to Later Phase 2 Steps
In accordance with strict Phase 2.1 boundaries:
- **Zero Firebase Authentication Logic**: No client-side login/signup flows migrated; `AuthService.ts` remains isolated.
- **Zero Cloud Functions Business Logic**: `registerWithUsername`, `startDailySession`, `submitAttempt`, `finalizeDailySession` deferred to Phase 2.2+.
- **Zero Firestore Live Data / Collections**: No documents or live user records created.
- **Zero Question Content Ingestion**: 60 clinical questions ingestion pipeline deferred to Phase 2.3.
- **Zero Production Infrastructure Connections**: Production credentials and infrastructure untouched.
- **Zero Frontend Application Behavior Changes**: IndexedDB and existing React views untouched.

### 13.4 Verification Results
- **Automated Tests**: **110 / 110 passed** across 11 test suites via Vitest.
- **Frontend Production Build**: `tsc && vite build` succeeded cleanly with PWA service worker generation.
- **Functions Build**: `tsc` compiled cleanly into `functions/lib/index.js`.
- **Security Check**: Verified no server secrets or private keys exist in client environment files.
- **Status**: **Phase 2.1 COMPLETE & VERIFIED**. Ready for Phase 2.2 review.

---

## 14. Architecture & Implementation Plan Update: Direct Firebase Cloud & Real Content Ingestion (2026-09-30)

### 14.1 Key Product & Architecture Decisions
1. **Direct Firebase Cloud Backend**: The application connects directly to real Google Firebase Cloud services (`aisteth-academy-dev`, `aisteth-academy-staging`, `aisteth-academy-prod`).
2. **Removal of Local Emulator Architecture**: Local Emulator Suite, localhost endpoints, and emulator toggles (`VITE_USE_FIREBASE_EMULATOR`) have been **completely removed** from architecture, code, and documentation.
3. **Vercel Hosting Topology**: React / Vite PWA hosted on Vercel connecting directly to Firebase Cloud projects for Dev, Staging, and Production.
4. **Authoritative Product Questionnaire (`AI_limitation.json`)**: Added actual clinical training questionnaire containing 20 Module 1 questions (10 Primary `-TH` and 10 Follow-Up `-PR` MCQs) with MedGemma curriculum metadata.
5. **Questionnaire Audit Completed**: Authored [`QUESTIONNAIRE_CONTENT_AUDIT.md`](file:///c:/Users/ASUS/Downloads/work/acad/QUESTIONNAIRE_CONTENT_AUDIT.md) auditing all 25 structural and content dimensions.
6. **IndexedDB Role Reclassification**: Classified existing IndexedDB stores (`daily_sessions` $\rightarrow$ optional local UI render cache only; `user_stats` and `user_profile` $\rightarrow$ migrate to server-authoritative Firestore; `session_records` $\rightarrow$ removed). Zero offline synchronization engines, outboxes, or conflict resolvers will be built.
7. **Eighteen-Phase Roadmap**: Updated [`BACKEND_IMPLEMENTATION_PLAN.md`](file:///c:/Users/ASUS/Downloads/work/acad/BACKEND_IMPLEMENTATION_PLAN.md) to `v2.6.0-PROD-PLAN` (Phases 2.1 through 2.18).
8. **Specification Update**: Updated [`DATABASE_SCHEMA.md`](file:///c:/Users/ASUS/Downloads/work/acad/DATABASE_SCHEMA.md) to `v2.6.0-PROD-SPEC`.
9. **Build & Test Status**: All 110 automated tests continue passing; production build verified cleanly.

---

## 15. Phase 2.2 — Firebase Authentication & Username Registration (Completed 2026-09-30)

### 15.1 Objective & Implementation Scope
Implemented the server-authoritative username registration and authentication layer according to the frozen `v2.6.1-PROD-SPEC`.

### 15.2 Modules Created & Configured
1. **`functions/src/types/auth.types.ts`**: Strict TypeScript contracts for `RegisterWithUsernameRequest`, `RegisterWithUsernameResponse`, `UsernameReservationDoc` (with unique `reservationId`), `UserProfileDoc`, and `UserLearningState`.
2. **`functions/src/utils/username.ts`**:
   - `normalizeUsername`: Lowercases, trims, and validates usernames against `^[a-z0-9._-]{3,30}$` with leading/trailing and consecutive special character checks.
   - `generateSyntheticEmail`: Generates canonical internal `<normalizedUsername>@trainee.aisteth.internal`.
   - `validatePassword`: Enforces minimum 6-character length.
   - `validateTraineeRegistrationInput`: Sanitizes public inputs and strips/ignores any client-injected `role` or `organizationId`.
3. **`functions/src/utils/sessionSelection.ts`**:
   - Deterministic Set A (10 Primary `-TH` MCQs) and Set B (10 Follow-Up `-PR` MCQs) parity rotation engine with exact 1-to-1 difficulty rank distribution (1 to 10) and `Asia/Kolkata` timezone resolution.
4. **`functions/src/services/registrationService.ts`**:
   - Implements the **Idempotent 5-step registration workflow with compensating cleanup**:
     1. Validate & sanitize payload (forcing server-authoritative `role = "TRAINEE"` and default organization `org_rbsk_national`).
     2. Atomically reserve `/usernames/{normalizedUsername}` in Firestore transaction with unique `reservationId` ownership token.
     3. Create Firebase Auth user with synthetic email and custom claims (`role`, `organizationId`).
     4. Finalize username document (`status = "ACTIVE"`, `uid`), strictly verifying `reservationId` ownership.
     5. Provision master `/users/{uid}` profile with initialized `learningState`.
     6. *Compensating Cleanup*: Deletes orphaned Auth users and releases Firestore reservations ONLY if `reservationId` matches, preventing stale cleanup race conditions.
5. **`functions/src/index.ts`**: Exported `registerWithUsername` 2nd Gen Callable Cloud Function with CORS and standard `HttpsError` mappings.
6. **`BACKEND_IMPLEMENTATION_PLAN.md`**: Appended Section 3 with the frozen 7-point Phase 2 question-selection algorithm specification, exact Set A/Set B tables, timezone policy (`Asia/Kolkata`), post-registration claims flow, and non-repetition rules.
7. **`tests/BackendRegistrationAndAuth.test.ts`**: 26 comprehensive unit & integration tests covering username normalization, synthetic email mapping, input validation, role-injection protection, reservation ownership, stale reclamation, compensation isolation, deterministic selection, parity rotation, non-repetition, and difficulty distribution.

### 15.3 Verification Results
- **Automated Tests**: **136 / 136 passed** across 12 test suites via Vitest.
- **Functions Build**: `npm --prefix functions run build` (`tsc`) compiled cleanly with zero errors.
- **Frontend Production Build**: `npm run build` (`tsc && vite build`) compiled cleanly in 2.52s with PWA generation.
- **Status**: **Phase 2.2 COMPLETE & VERIFIED**.

---

## 16. Phase 2.3 — Firestore Schema & Security Rules Deployment (Completed 2026-09-30)

### 16.1 Objective & Security Model
Deployed and verified the server-authoritative **Cloud Firestore Security Rules** and **Composite Query Indexes** configuration for the `aisteth-academy-dev` development project according to frozen `v2.6.1-PROD-SPEC`.

### 16.2 Core Deliverables & Protections
1. **`firestore.rules`**:
   - **User Profile Field-Level Allow-List**: Direct trainee updates to `/users/{uid}` are restricted strictly to allow-listed top-level fields: `displayName`, `designation`, `healthSubCentre`, `district`, `state`, `optionalEmail`, `trainingTimeZone` (metadata only), and `updatedAt` (strictly enforced `serverTimestamp()`).
   - **Server-Controlled Immutability**: Trainee mutation attempts on `uid`, `username`, `role`, `organizationId`, `learningState`, `lastActiveAt`, `createdAt`, or arbitrary timestamp injection into `updatedAt` are hard-denied.
   - **Timezone Consistency**: In V1, date resolution, streaks, and question rotation strictly use `Asia/Kolkata`. `trainingTimeZone` is profile metadata only and cannot alter session logic.
   - **Session & Attempt Protection**: Trainees have READ-ONLY access to `/users/{uid}/dailySessions` and `/users/{uid}/attempts`. Direct client creation, update, or deletion is completely blocked. Mutations are executed exclusively via server Cloud Functions.
   - **Username Registry Privacy**: `/usernames/{username}` collection is blocked (`allow read, write: if false`) to prevent client-side user enumeration attacks.
   - **Tenant & Role Isolation**: Supervised cohort and analytics reads enforce tenant matching (`isSupervisorOf(organizationId)`), blocking cross-agency data access.
   - **Content Access Control**: Trainees can only read published content releases (`status == 'PUBLISHED'`); draft content is restricted to `CONTENT_ADMIN` and `PLATFORM_ADMIN`.
   - **App Configuration**: `/appConfig/global` provides client-readable runtime parameters with zero server secrets.
2. **`firestore.indexes.json`**:
   - Composite Index 1: `attempts` (`dailySessionId` ASC, `clientTimestamp` ASC) [Scope: `COLLECTION`] for chronological session reviews.
   - Composite Index 2: `attempts` (`questionId` ASC, `result` ASC) [Scope: `COLLECTION_GROUP`] for cross-user question error rate analytics.
   - Composite Index 3: `dailySessions` (`localDate` DESC, `status` ASC) [Scope: `COLLECTION`] for streak validation and history.
   - Composite Index 4: `users` (`organizationId` ASC, `role` ASC) [Scope: `COLLECTION`] for supervisor cohort views.
3. **`tests/FirestoreSecurityRulesIntegration.test.ts`**:
   - 34 comprehensive security rules integration tests validating complete permissions matrix for TRAINEE, SUPERVISOR, PLATFORM_ADMIN (with server-authoritative write blocks for dailySessions, attempts, auditLogs), and unauthenticated clients.

### 16.3 Verification Results
- **Automated Tests**: **170 / 170 passed** across 13 test suites via Vitest (`npm run test`).
- **Security Rules Suite**: **34 / 34 passed** (`tests/FirestoreSecurityRulesIntegration.test.ts`).
- **Functions Build**: `npm --prefix functions run build` (`tsc`) compiled cleanly with zero errors.
- **Frontend Production Build**: `npm run build` (`tsc && vite build`) compiled cleanly in 3.24s with PWA generation.
- **Environment Boundaries**: Target set exclusively to `aisteth-academy-dev`; staging and production remain untouched.
- **Status**: **Phase 2.3 COMPLETE & VERIFIED**. Ready for Phase 2.4 review.
---

## 17. Architecture Streamlining: Removal of Firebase Storage from Phase 2 (2026-09-30)

### 17.1 Context & Audit Finding
- **Comprehensive Dependency Audit**: Audited the entire repository for Google Cloud Storage / Firebase Storage dependencies (`getStorage`, `ref`, `uploadBytes`, `getDownloadURL`, `deleteObject`, `firebase/storage`).
- **Finding**: **Zero active feature dependencies** on Firebase Storage in frontend or backend. Phase 2 application data is 100% structured (questions, users, sessions, attempts, progress, analytics) and authoritatively stored in Cloud Firestore. The `AI_limitation.json` questionnaire dataset is 100% structured clinical text.

### 17.2 Changes Executed
1. **Frontend Hosting Platform**: Reaffirmed **Firebase Hosting** as the authoritative frontend host (`https://aisteth-academy-dev.web.app`), updating all documentation references.
2. **`firebase.json`**: Removed the `"storage"` configuration section. Active deployment targets exclusively Firestore rules/indexes, Cloud Functions, and Firebase Hosting.
2. **`.env.development` & `.env.example`**: Removed `VITE_FIREBASE_STORAGE_BUCKET` to prevent unused storage parameter initialization.
3. **`DATABASE_SCHEMA.md` & `BACKEND_IMPLEMENTATION_PLAN.md`**: Explicitly updated architecture topology and documented: *"Firebase Storage is not an active Phase 2 dependency. The current application uses Firebase Firestore for structured application data. Storage is reserved for a future phase if binary media requirements are introduced."*
4. **No Storage Bucket & No Blaze Upgrade Required**: Avoided unnecessary cloud resource provisioning and billing upgrades.

### 17.3 Verification Results
- **Automated Tests**: **170 / 170 passed** across 13 test suites via Vitest (`npm run test`).
- **Functions TypeScript Build**: `npm --prefix functions run build` (`tsc`) compiled cleanly with zero errors.
- **Frontend Production Build**: `npm run build` (`tsc && vite build`) compiled cleanly in 2.50s with PWA generation.

---

## 18. Phase 2 Spark Architecture Implementation (v2.7.0-SPARK-SPEC) (Completed 2026-09-30)

### 18.1 Objective & Hard Constraints
Implemented the **Firebase Spark (Free Tier — ₹0 / month)** architecture per approved `v2.7.0-SPARK-SPEC`.

- **Hard Constraints Preserved**:
  - Firebase Spark plan exclusively (₹0 / month, zero billing, zero GCP billing accounts, zero credit cards, no Blaze upgrade).
  - Cloud Functions excluded from active deployment (retained as deferred legacy in repository).
  - Firebase Storage excluded and zero storage buckets provisioned.
  - Frontend hosted on **Firebase Hosting** (`https://aisteth-academy-dev.web.app`).
  - Strict client-authoritative security model bounded by hardened Cloud Firestore Security Rules.
  - Content single source of truth: 20 real clinical questions from `AI_limitation.json` for Module 1 (`rel_v1_0_0`). Zero dummy questions.
  - Date resolution, session parity, and streak boundaries strictly use `Asia/Kolkata` (UTC+05:30).

### 18.2 Core Deliverables
1. **`firebase.json`**: Removed `"functions"` codebase definition to ensure pure Spark deployment (`firestore` + `hosting` only).
2. **`firestore.rules`**: Implemented `v2.7.0-SPARK-SPEC` security rules:
   - Self-registration validation enforcing `role == 'TRAINEE'`, default organization (`org_rbsk_national`), and baseline `learningState`.
   - Hardened `learningState` allow-list and numerical delta limits ($0 \le \Delta\text{totalXp} \le 200$, $0 \le \Delta\text{currentStreak} \le 1$, level 1–5).
   - Sensitive profile fields (`uid`, `username`, `role`, `organizationId`, `createdAt`) are strictly immutable.
   - `dailySessions` create requires exactly 10 questions; update denied on completed sessions (session locking).
   - `attempts` subcollection is strictly append-only (updates and deletes denied).
   - `/usernames/{username}` allow create and owner delete (for compensating cleanup); update blocked.
3. **Frontend Services & Repositories**:
   - `src/services/firebase.ts`: Direct Firebase Web SDK initialization.
   - `src/services/AuthService.ts`: Implemented registration workflow with compensating Auth-user cleanup and synthetic email translation (`<username>@trainee.aisteth.internal`).
   - `src/repositories/FirestoreQuestionRepository.ts`: Firestore-backed `IQuestionRepository` reading from `/contentReleases/rel_v1_0_0/questions`.
   - `src/services/SessionService.ts`: Day-parity Set A / Set B deterministic 10-question selection and append-only attempt logging.
4. **Content Ingestion**:
   - Ingested all 20 real MCQs from `AI_limitation.json` into `/contentReleases/rel_v1_0_0/questions/{qId}` and initialized `/appConfig/global` in `aisteth-academy-dev`.
5. **Security Rules Test Suite (`tests/FirestoreSecurityRulesIntegration.test.ts`)**:
   - Implemented and verified all 16 security test cases from the approved specification.

### 18.3 Verification Results
- **Automated Test Suite**: **152 / 152 passed** across 13 test files via Vitest (`npm run test`).
- **Security Invariant Tests**: **16 / 16 passed** (`tests/FirestoreSecurityRulesIntegration.test.ts`).
- **Legacy Functions TypeScript Build**: `npm --prefix functions run build` (`tsc`) compiled cleanly with zero errors.
- **Frontend Production Build**: `npm run build` (`tsc && vite build`) compiled cleanly in 3.86s with PWA generation.
- **Live Deployments**:
  - Firestore Rules & Indexes: Deployed live to `aisteth-academy-dev`.
  - Hosting: Deployed live to `https://aisteth-academy-dev.web.app`.

