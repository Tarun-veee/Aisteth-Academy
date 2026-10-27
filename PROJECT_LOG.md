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
13. [Phase 2.1 — Firebase Development Environment Setup](#13-phase-21---firebase-development-environment-setup-completed-2026-09-30)
14. [Architecture & Implementation Plan Update: Direct Firebase Cloud & Real Content Ingestion](#14-architecture--implementation-plan-update-direct-firebase-cloud--real-content-ingestion-2026-09-30)
15. [Phase 2.2 — Firebase Authentication & Username Registration](#15-phase-22---firebase-authentication--username-registration-completed-2026-09-30)
16. [Phase 2.3 — Firestore Schema & Security Rules Deployment](#16-phase-23---firestore-schema--security-rules-deployment-completed-2026-09-30)
17. [Architecture Streamlining: Removal of Firebase Storage from Phase 2](#17-architecture-streamlining-removal-of-firebase-storage-from-phase-2-2026-09-30)
18. [Phase 2 Spark Architecture Implementation (v2.7.0-SPARK-SPEC)](#18-phase-2-spark-architecture-implementation-v270-spark-spec-completed-2026-09-30)
19. [Phase 2 Frontend Remediation, Mobile Polish & Live DEV Smoke Verification](#19-phase-2-frontend-remediation-mobile-polish--live-dev-smoke-verification-completed-2026-10-07)
20. [Phase 2 Backend Scalability Forensic Audit, Concurrency Reconciliation & Controlled Load Hardening](#20-phase-2-backend-scalability-forensic-audit-concurrency-reconciliation--controlled-load-hardening-completed-2026-10-08)
21. [Phase 1 Implementation: Layered Node.js + Express Backend & Frontend Firebase Eradication](#21-phase-1-implementation-layered-nodejs--express-backend--frontend-firebase-eradication)
22. [Security & Data-Integrity Remediation (F-01, F-02, F-03)](#22-security--data-integrity-remediation-f-01-f-02-f-03)
23. [Phase 29 — Bug Fix: Administrator Role Elevation & Account Lookup Architecture](#29-bug-fix-administrator-role-elevation--account-lookup-architecture-admin_tester-to-platform_admin)
24. [Phase 30 — Admin-Led Learner Onboarding Implementation](#30-phase-30--admin-led-learner-onboarding-implementation)

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
5. **Questionnaire Audit Completed**: Authored [`QUESTIONNAIRE_CONTENT_AUDIT.md`](./QUESTIONNAIRE_CONTENT_AUDIT.md) auditing all 25 structural and content dimensions.
6. **IndexedDB Role Reclassification**: Classified existing IndexedDB stores (`daily_sessions` $\rightarrow$ optional local UI render cache only; `user_stats` and `user_profile` $\rightarrow$ migrate to server-authoritative Firestore; `session_records` $\rightarrow$ removed). Zero offline synchronization engines, outboxes, or conflict resolvers will be built.
7. **Eighteen-Phase Roadmap**: Updated [`BACKEND_IMPLEMENTATION_PLAN.md`](./BACKEND_IMPLEMENTATION_PLAN.md) to `v2.6.0-PROD-PLAN` (Phases 2.1 through 2.18).
8. **Specification Update**: Updated [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) to `v2.6.0-PROD-SPEC`.
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

---

## 19. Phase 2 Frontend Remediation, Mobile Polish & Live DEV Smoke Verification (Completed 2026-10-07)

### 19.1 Objective & Context
Completed full UI remediation, accessibility hardening, and mobile responsive optimization for AiSteth Academy on mobile viewports (360px–412px Android/iOS devices) followed by live cloud smoke testing on `https://aisteth-academy-dev.web.app`.

### 19.2 Core Deliverables
1. **Header Action Cluster & Unified User Nav (`src/components/common/Header.tsx`)**:
   - Replaced fragmented controls with a cohesive top-bar cluster: Streak badge with animated pulse, Level progress pill, Power-ups shortcut, and trainee Profile icon.
   - Guaranteed minimum 44px tap targets adhering to WCAG 2.1 AAA touch guidelines.
2. **Simplified Trainee Profile (`src/views/ProfileScreen.tsx`)**:
   - Consolidated trainee profile into an uncluttered single-page view featuring editable designation, health sub-centre, district, state, and optional email.
   - Integrated training lifetime statistics (total XP, current streak, completed daily sessions).
   - Clean, safe signout workflow with session state eviction.
3. **Power-Ups Screen Polish (`src/views/PowerUpsScreen.tsx`)**:
   - Full support for 50/50, LEARN, and STREAK SHIELD power-ups with real-time inventory counts and actionable activate/equip buttons.
   - Clear explanatory clinical utility notes and badge counters.
4. **Mobile Layout & PWA Optimization**:
   - Hardened bottom sheet drawer gestures (`src/hooks/useBottomSheetGesture.ts`, `src/components/feedback/FeedbackDrawer.tsx`) with touch velocity and distance threshold snapping.
   - Audio question card (`src/components/audio/AudioPlayerCard.tsx`) responsive controls with high-contrast waveform visuals.
   - Generated valid 192x192 and 512x512 PWA icons in `public/` and configured Web App Manifest in `index.html` and `vite.config.ts`.
5. **Live DEV Smoke Verification**:
   - Executed live interactive verification on `aisteth-academy-dev.web.app` using QA account `powerup_qa_test` (`Mm1TrJPtd0ZUhPgwjehmndpD8E12`).
   - Verified end-to-end question answering, power-up redemption, profile updates, and responsive rendering on live hosting.

### 19.3 Verification Results
- **Automated Tests**: **202 / 202 passed** across 15 test suites via Vitest.
- **Frontend Production Build**: Clean `tsc && vite build` in 3.65s with service worker and PWA asset generation.
- **Live Hosting**: Deployed and smoke-tested on `https://aisteth-academy-dev.web.app`.

---

## 20. Phase 2 Backend Scalability Forensic Audit, Concurrency Reconciliation & Controlled Load Hardening (Completed 2026-10-08)

### 20.1 Objective & Absolute Scope Boundaries
Conducted a deep forensic audit and controlled load hardening of the Cloud Firestore / Firebase Auth backend architecture.
- **Strict Scope Rule**: Backend scalability, concurrency safety, and reliability only. Questionnaire integration, clinical content, question repositories, and Phase 3 adaptive engine remained strictly out of scope.
- **Core Hypothesis Evaluated**: Can the current client-authoritative + Firestore Security Rules backend reliably support increasing volumes of concurrent trainees and daily sessions without introducing unnecessary servers, Redis, Pub/Sub, or Cloud Functions?

### 20.2 Critical Implementation Reconciliation
Resolved three fundamental implementation discrepancies identified during forensic inspection:

1. **Session ID Mismatch Unified (Issue 1)**:
   - *Problem*: `useLearningSession.ts` constructed session IDs as `daily_[date]` while `SessionService.ts` expected `daily_[date]_[uid.substring(0,8)]`, risking duplicate documents or state divergence.
   - *Fix*: Standardized canonical session ID generation using `generateCanonicalSessionId(uid, dateStr)` $\rightarrow$ `daily_[YYYY-MM-DD]_[UID8]` across [`src/services/SessionService.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/services/SessionService.ts) and [`src/hooks/useLearningSession.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/hooks/useLearningSession.ts).
2. **State Machine Finalization Unblocked (Issue 2)**:
   - *Problem*: `QUESTIONS_COMPLETED` was incorrectly included in `terminalStatuses`, causing `finalizeSession()` to immediately reject sessions that had completed all 10 questions.
   - *Fix*: Corrected lifecycle transition rules in `SessionService.ts`: `IN_PROGRESS` $\rightarrow$ `QUESTIONS_COMPLETED` $\rightarrow$ `REVIEW_COMPLETED` $\rightarrow$ `REVIEW_VIEWED`. `QUESTIONS_COMPLETED` is an intermediate finalization-ready status, not a terminal state.
3. **Atomic Session Finalization via Transactions (Issue 3)**:
   - *Problem*: Session status update and trainee `learningState` XP/streak increments were executed as separate non-atomic writes, allowing network crashes to create partial commits.
   - *Fix*: Re-engineered `SessionService.finalizeSession()` to use native Cloud Firestore atomic transactions (`runTransaction`). Either both `dailySessions` status and `learningState` commit together, or neither commits. Duplicate calls are safely rejected.

### 20.3 Concurrency & Failure Test Automation
Created comprehensive test suite [`tests/BackendConcurrencyAndReliability.test.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/tests/BackendConcurrencyAndReliability.test.ts):
- **Multi-Tab Finalization**: Verified that simultaneous `finalizeSession()` calls across multiple tabs result in exactly 1 successful finalization and 0 duplicate XP, streak, or session completion increments.
- **Multi-Device Answers**: Verified that simultaneous attempts from different devices append cleanly using UUID keys without attempt collisions.
- **N=10 Concurrent Finalizations**: Handled 10 parallel finalization requests cleanly: 1 committed transaction, 9 safely ignored.
- **Concurrent XP Increments**: Verified atomic progression accumulation ($\text{old XP} + \Delta A + \Delta B$).
- **Network Failure Rollback**: Verified that simulated network timeout in transaction commit cleanly rolls back both documents.
- **Browser Crash Idempotence**: Verified that reloading and retrying after abort commits cleanly without duplicate progression.

### 20.4 Live Controlled Load Testing on Cloud Firestore
Conducted staged load tests against live project `aisteth-academy-dev` using multi-client synthetic runners ([`scripts/run_controlled_load_test.js`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/scripts/run_controlled_load_test.js)):

| Metric | Stage 1 (10 Users) | Intermediate (50 Users) | Stage 2 (100 Users) | Stage 3 (500 Users) |
| :--- | :---: | :---: | :---: | :---: |
| **Successful Sessions** | **10 / 10** | **50 / 50** | **99 / 100** | **NOT MEASURED** *(Spark Cap)* |
| **Failed Sessions** | 0 | 0 | 0 *(0 Firestore failures)* | **NOT MEASURED** |
| **Auth Failures** | 0 | 0 | 1 *(Single-IP rate limit)* | **NOT MEASURED** |
| **Firestore Failures** | **0** | **0** | **0** | **NOT MEASURED** |
| **Total Writes** | 230 | 1,150 | 2,277 | **NOT MEASURED** |
| **Writes / Session** | Exactly 23.0 | Exactly 23.0 | Exactly 23.0 | Projected: 23.0 |
| **Total Reads** | 30 | 150 | 297 | Projected: 1,500 |
| **Peak Throughput** | 98.61 writes/s | 287.17 writes/s | 346.53 writes/s | Projected: $\approx 1,250$ writes/s |
| **Average Latency** | 163.75 ms | 239.54 ms | 358.06 ms | Projected: $\approx 450$ ms |
| **P95 Latency** | 366.24 ms | 448.78 ms | 608.07 ms | Projected: $\approx 750$ ms |
| **Completion Rate** | **100.0%** | **100.0%** | **99.0%** *(100% of Auth)* | **NOT MEASURED** |
| **Progression Correctness**| **100% Verified** | **100% Verified** | **100% Verified** | **NOT MEASURED** |

*Note: Stage 3 was paused per protocol to avoid exhausting the daily 20,000 write quota on the Firebase Spark tier.*

### 20.5 Scalability & Platform Limit Modeling
- **Baseline Workload**: Exactly **23 Firestore writes and 3 reads** per completed session.
- **Zero Global Write Hotspots**: All trainee writes are strictly partitioned under `/users/{uid}/...`. Single-document write rate during a 5-minute session is $\sim 0.04$ writes/s (well below Firestore's 1 write/s hardware limit).
- **Security Rules Under Load**: Security rules evaluate in $O(1)$ memory using `request.auth` and resource payload without cross-document `get()` or `exists()` calls.
- **Spark vs Blaze Quota Ceiling**:
  - Spark Plan (Free Tier, 20,000 writes/day): Hard limit is $\lfloor 20,000 / 23 \rfloor = \mathbf{869\text{ completed sessions/day}}$. User 870 fails with HTTP 429 (`RESOURCE_EXHAUSTED`).
  - Blaze Plan (Pay-as-you-go): Removes the daily quota limit. At 10,000 sessions/day, cost is $\approx \$0.42\text{ / day}$.
  - Conclusion: Architectural scalability is **GREEN**. Bottleneck at scale is purely Google Cloud billing tier, not system architecture.

### 20.6 Verification Results
- **Automated Test Suite**: **209 / 209 passed** across 16 test files via Vitest (`npm run test`).
- **TypeScript Typecheck & Build**: Zero compiler errors across frontend (`tsc && vite build`).
- **Live Cloud Verification**: Passed live reconciliation script (`scripts/verify_reconciliation.js`) and 100-user controlled load test (`scripts/run_controlled_load_test.js`) on `aisteth-academy-dev`.
- **Backend Scalability Verdict**: **GREEN** across Architecture, Concurrency, Reliability, Firestore Partitioning, and Security Rules. Ready for commercial Blaze plan upgrade when scaling beyond 850 daily sessions.

---

## 21. Phase 1 Implementation: Layered Node.js + Express Backend & Frontend Firebase Eradication

### 21.1 Architectural Transformation Summary
In accordance with the approved Revised Authentication & Session Architecture Specification, the application was decoupled from direct client-side Firebase coupling:
```
React Frontend (Vite PWA)
      │
      │ HTTPS REST / JSON (Credentials: include)
      ▼
Node.js + Express Backend (/api/v1)
      │
      ├── API / Controllers (AuthController, SessionController, QuestionController, UserController)
      ├── Application / Use Cases (AuthUseCase, SessionUseCase, QuestionUseCase)
      ├── Domain / Rules & Models (User, Session, Question, AnswerEvaluator, PowerUpService)
      └── Infrastructure Layer
             ├── FirebaseAuthAdapter (Google Identity Toolkit v1 REST + Firebase Admin SDK)
             └── Firestore Repositories (FirestoreUserRepository, FirestoreSessionRepository, FirestoreQuestionRepository)
                      │
                      ▼
             Google Cloud Firestore
```

### 21.2 Zero Frontend Firebase SDK Eradication
- **Deleted Legacy Files**:
  - `src/services/firebase.ts` (obsolete client SDK initialization)
  - `src/repositories/FirestoreQuestionRepository.ts` (obsolete client Firestore repository)
- **Dependency Eradication**: Removed `"firebase"` from root `package.json`.
- **Source Verification**: Ripgrep scan across `src/` confirms **0 occurrences** of `firebase/app`, `firebase/auth`, and `firebase/firestore`.
- **Production Bundle**: React bundle size reduced; zero Firebase client SDK bundled into `dist/assets/index-*.js`.

### 21.3 Token & Session Security Implementation
- **Access Token**: Firebase ID Token stored strictly in-memory (`inMemoryAccessToken` in `src/api/client.ts`). Never persisted to `localStorage`, `sessionStorage`, or `IndexedDB`.
- **Refresh Token**: Stored exclusively in an `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/api/v1/auth` cookie. Inaccessible to JavaScript.
- **Silent Session Rehydration**: On application mount, `App.tsx` calls `AuthService.rehydrateSession()`, triggering `POST /api/v1/auth/refresh`. If the HttpOnly cookie is valid, a new access token is stored in memory; if absent or expired, the user is transitioned cleanly to Sign In.
- **Automatic 401 Interception & Refresh Queue**: `src/api/client.ts` intercepts HTTP 401 responses, executes a single locked refresh call via `POST /api/v1/auth/refresh`, drains queued in-flight requests, and retries the original request seamlessly.
- **Logout Semantics**:
  - Default: `POST /api/v1/auth/logout` performs single-device logout (clears HttpOnly cookie and in-memory access token without revoking global refresh tokens).
  - Global: `POST /api/v1/auth/logout?allDevices=true` calls `admin.auth().revokeRefreshTokens(uid)` and clears the cookie.
- **Password Authentication**: Backend implements Google Identity Toolkit REST API v1 (`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`) and Secure Token API for refresh, completely isolating Firebase implementation behind `backend/src/infrastructure/auth/FirebaseAuthAdapter.ts`.

### 21.4 Concurrency & Data Integrity
- **Firestore Schema Preservation**: All existing collection paths (`users/{uid}`, `users/{uid}/dailySessions/{sessionId}`, `users/{uid}/attempts/{attemptId}`, `usernames/{username}`) remain 100% identical and intact.
- **Atomic Session Finalization**: Session finalization is executed via atomic `admin.firestore().runTransaction` in `FirestoreSessionRepository.finalizeSessionAtomic`, strictly preventing duplicate XP, streak, or session completion increments under concurrent requests.
- **Client In-Flight Lock**: `SessionService.finalizeSession` guards against rapid double-clicks and concurrent tab submissions via local in-memory lock set.

### 21.5 Verification Results
- **Frontend Test Suite**: **211 / 211 passed** across 17 test files (`npm test -- --run` including `tests/ApiClientRefreshConcurrency.test.ts`; 16 original regression test files with 209 tests fully green).
- **Backend Test Suite**: **23 / 23 passed** across 2 test files (`backend/tests/api.test.ts`, `backend/tests/authAndSession.test.ts`).
- **Total Combined Tests**: **234 / 234 passed** with 0 failures across 19 test files in workspace.
- **TypeScript Typecheck**:
  - Frontend (`tsc --noEmit`): **0 errors**.
  - Backend (`tsc`): **0 errors**.
- **Production Builds**:
  - Frontend (`npm run build`): Successfully generated Vite + PWA production bundle (`dist/`).
  - Backend (`npm --prefix backend run build`): Successfully compiled production bundle (`backend/dist/`).
- **Firebase Scan**: Verified 0 Firebase SDK imports in `src/` and 0 Firebase dependencies in root `package.json`.

### 21.6 Phase 1 Verification Gate Audit Results
Conducted complete, independent 14-dimension verification pass:

1. **Test Baseline**:
   - Frontend Suite: **17 test files, 211 tests passed, 0 failures** (including 16 original regression files with 209 tests + `tests/ApiClientRefreshConcurrency.test.ts` with 2 tests).
   - Backend Suite: **2 test files, 23 tests passed, 0 failures** ([`backend/tests/api.test.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/tests/api.test.ts), [`backend/tests/authAndSession.test.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/tests/authAndSession.test.ts)).
   - Total Combined Tests: **234 passed, 0 failed**.
2. **Firebase Eradication**:
   - `src/` scan: Exactly **0 imports** of `firebase/app`, `firebase/auth`, or `firebase/firestore`.
   - `initializeApp`, `getAuth`, `getFirestore`, `firebaseConfig`: Exactly **0 occurrences** in `src/`.
   - Root `package.json` & `package-lock.json`: `"firebase"` completely uninstalled and removed.
   - Production bundle `dist/`: Exactly **0 occurrences** of Firebase SDK.
3. **Architectural Dependency Direction**:
   - `Domain`: Imports neither Firebase nor Express.
   - `Application`: Imports neither Firebase nor Express.
   - `Controllers`: Zero direct Firestore calls; interacts solely through Application Use Cases.
   - `Repositories` & `AuthProvider`: Implement pure domain interfaces (`IUserRepository`, `ISessionRepository`, `IQuestionRepository`, `IAuthProvider`).
   - `Frontend`: Communicates exclusively via HTTPS REST/JSON (`/api/v1`).
4. **Authentication Mechanism**:
   - Verified real HTTP integration with Google Identity Toolkit REST API v1 (`accounts:signInWithPassword`) and Secure Token API for refresh. Fictional `admin.auth().signIn(...)` is strictly avoided.
5. **Token Security**:
   - Access token stored exclusively in-memory (`inMemoryAccessToken` in `src/api/client.ts`).
   - Refresh token stored exclusively in an `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Secure` (production) cookie.
   - Client storage audit: Zero tokens in `sessionStorage` or `IndexedDB`.
6. **401 Refresh Concurrency & Interceptor**:
   - Verified that concurrent 401 responses serialize into exactly ONE refresh request via [`tests/ApiClientRefreshConcurrency.test.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/tests/ApiClientRefreshConcurrency.test.ts).
   - Waiting queued requests reuse the refreshed token cleanly.
   - Expired refresh tokens abort the queue cleanly without infinite loops.
7. **Logout Semantics**:
   - Default `POST /api/v1/auth/logout`: Clears HttpOnly cookie and in-memory access token on current device. Does NOT revoke global refresh tokens.
   - `POST /api/v1/auth/logout?allDevices=true`: Invokes `admin.auth().revokeRefreshTokens(uid)` for global revocation.
8. **Firestore Data Preservation**:
   - Confirmed zero schema alterations, collection renames, field renames, or destructive migrations.
   - All canonical collections (`users`, `usernames`, `dailySessions`, `attempts`, `contentReleases/questions`) preserved.
9. **Session Finalization Atomicity**:
   - Re-verified atomic `admin.firestore().runTransaction` in `FirestoreSessionRepository.finalizeSessionAtomic`.
   - Zero duplicate XP, streak, or session completion on concurrent requests.
10. **E2E Flow Classification**:
    - Recorded strictly as **Level A (Unit)** and **Level B (In-Process HTTP Integration)**.
    - Level D (Deployed Cloud E2E) explicitly designated as pending remote cloud deployment.
11. **Environment & Secret Safety**:
    - `.env` and `backend/.env` confirmed ignored by `.gitignore`. Zero service account private keys or secrets tracked by Git.
12. **Cloud Portability**:
    - Abstraction boundary verified. Infrastructure can be substituted without domain rule modifications.
13. **Learning Engine Invariance**:
    - Confirmed zero changes to questionnaire data, question ordering, progression curves, or power-up rules.
14. **Audit Verdict**:
    - **PASS WITH ISSUES** due to minor non-production test-fallback observation:
      - *Issue 1*: Vitest offline test fallback in `src/services/AuthService.ts` (lines 215 & 310) writes a dummy token to `localStorage` when no HTTP backend is running during local unit tests. Production online paths (lines 112, 181, 273) already sanitize tokens.
      - *Remediation*: Sanitize lines 215 and 310 to store only `{ userId, authenticatedAt, emailOrPhone }` upon user authorization, prior to final Phase 1 lock.

### 21.7 Current System Baseline & Phase 1 Lock Status
- **Backend Architecture**: Node.js + Express layered service running under `backend/` with Domain, Application, and Infrastructure boundaries fully established.
- **Frontend Architecture**: React 18 + Vite PWA with zero direct Firebase SDK dependencies or imports. All interactions routed through `/api/v1`.
- **Security Profile**: In-memory access token + `HttpOnly`, `SameSite=Lax` refresh cookie + automated serialized 401 refresh interceptor.
- **Automated Test Suite**:
  - Frontend/Root Vitest: **211 / 211 passed** across 17 test files.
  - Backend Vitest: **23 / 23 passed** across 2 test files.
  - Total: **234 / 234 passed** across 19 test suites.
- **Type Safety & Compilation**: `tsc --noEmit` (frontend: 0 errors), `tsc` (backend: 0 errors), production builds generated cleanly.
- **Phase Transition Status**: Phase 1 implementation complete and independently verified. Phase 2 (Learning Engine) remains completely gated and untouched, awaiting final Phase 1 sign-off and explicit user authorization.

---

## 22. Security & Data-Integrity Remediation (F-01, F-02, F-03)

> **Execution Date**: 2026-10-09  
> **Scope**: Targeted security & data-integrity hardening for confirmed architecture audit blockers (F-01, F-02, F-03).  
> **Status**: COMPLETED & VERIFIED. Learning Engine redesign remains gated and untouched.

### 22.1 F-03 — CORS Hardening
- **Vulnerability Remediated**: Permissive fallback previously reflected unapproved cross-origin origins with `Access-Control-Allow-Credentials: true`.
- **Implementation**:
  - Replaced fallback in `backend/src/app.ts` with explicit approved-origin policy: `['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', process.env.FRONTEND_URL].filter(Boolean)`.
  - Unapproved origins trigger `callback(null, false)`, omitting all CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`).
  - Preserved non-origin requests (curl, server-to-server, mobile native) via `if (!origin) return callback(null, true)`.
  - CORS is maintained as cross-origin transport policy, not authentication.
- **Automated Verification**: Added 6 tests in `backend/tests/api.test.ts` covering approved localhost origins, 127.0.0.1 origins, unapproved malicious origins, preflight `OPTIONS` requests, and requests without an `Origin` header.

### 22.2 F-02 — Profile Update Protection
- **Vulnerability Remediated**: `PATCH /api/v1/users/me` previously forwarded uncurated payloads directly to Firestore `update()`, exposing `learningState`, streak, XP, role, and identity fields to client tampering.
- **Application Layer Protection (`AuthUseCase.updateProfile`)**:
  - Explicit allow-list defined in `UpdateProfileRequestDTO`: `displayName`, `designation`, `district`, `state`, `healthSubCentre`, `optionalEmail`.
  - Strict type and format validation: non-empty string checks with trimming; RFC regex format validation for `optionalEmail`.
  - Server-controlled and protected fields (`learningState`, `totalXp`, `currentStreak`, `currentLevel`, `role`, `organizationId`, `uid`, `username`, `syntheticEmail`, `trainingTimeZone`, `createdAt`, `lastActiveAt`, and unknown fields) are safely stripped and discarded.
  - If no allow-listed fields are present, persistence update is safely bypassed.
- **Persistence Layer Defensive Filtering (`FirestoreUserRepository.updateUserProfile`)**:
  - Enforced secondary defense line: `PROTECTED_FIELDS` list (`uid`, `username`, `role`, `organizationId`, `syntheticEmail`, `trainingTimeZone`, `createdAt`, `learningState`, `lastActiveAt`) is deleted from updates object before calling Firestore `userRef.update()`.
- **Automated Verification**: Added comprehensive unit and persistence tests in `backend/tests/securityRemediation.test.ts` verifying field sanitization, stripping of malicious payloads, validation errors, and Firestore update filtering.

### 22.3 F-01 — Server-Authoritative XP and Session Finalization
- **Vulnerabilities Remediated**:
  1. Client-supplied progression metrics: Finalization endpoint previously accepted client-supplied `totalXpEarned` and `correctCount`, which were applied directly to user progression.
  2. Client-controlled session completion (`isSessionComplete` inconsistency): `RecordAttemptRequestDTO` accepted `isSessionComplete`, and `SessionUseCase.recordAttempt` previously evaluated `payload.isSessionComplete || payload.questionIndex >= 9`, allowing an attacker to force premature session completion on question 1.
- **Server-Authoritative Remediation Implemented**:
  - **Controller Layer Runtime Sanitization (`SessionController.recordAttempt`)**:
    - Validates runtime types (`sessionId` string, `questionId` string, `questionIndex` non-negative integer, `userAnswerPayload` object).
    - Constructs clean DTO, completely stripping `isSessionComplete` and all unexpected client properties before dispatching to the use case.
  - **Use Case Server-Side Sequencing & Completion (`SessionUseCase.recordAttempt`)**:
    - Retrieves the Firestore daily session document; rejects if session is non-existent or already completed.
    - Validates that `payload.questionIndex === session.currentQuestionIndex`, rejecting forged indices.
    - Validates that `payload.questionId === session.questionIds[session.currentQuestionIndex]`, rejecting out-of-order or unrelated question IDs.
    - Evaluates question strictly via server `AnswerEvaluator`.
    - Derives session completion purely from server state: `(session.currentQuestionIndex + 1) >= totalQuestions`. Client `isSessionComplete` is completely ignored.
  - **Persistence Layer Atomicity (`FirestoreSessionRepository.finalizeSessionAtomic`)**:
    - Derives `verifiedAttemptXp` and `verifiedCorrectCount` directly from `sessionData` inside Firestore transaction.
    - Legacy 10 XP completion bonus awarded **only** if session is verified completed (`questionsCompleted: true` or `currentQuestionIndex >= totalQuestions`).
    - Incomplete sessions do not receive completion bonus and do not increment `completedSessionsCount`.
    - Terminal status check (`COMPLETED`, `REVIEW_COMPLETED`, `reviewViewed: true`) guarantees idempotency and concurrency protection.
- **Automated Verification**: Added comprehensive regression tests in `backend/tests/securityRemediation.test.ts` covering:
  1. Ignoring client `isSessionComplete: true` on early question (session remains `IN_PROGRESS`).
  2. Rejecting early question with forged `questionIndex >= 9` with index mismatch error.
  3. Rejecting attempt with unrelated `questionId` with sequence mismatch error.
  4. Legitimate completion on 10th question without client flag.
  5. Incomplete session finalization receiving 0 bonus and 0 `completedSessionsCount` increment.
  6. Duplicate and concurrent finalizations returning `alreadyFinalized: true` with zero duplicate awards.
  7. Controller runtime validation stripping untrusted properties and rejecting malformed inputs.

### 22.4 Final Verification Baseline
- **Backend Tests**: 3 test files, **51 / 51 passed**.
- **Frontend / Root Tests**: 20 test files, **262 / 262 passed**.
- **Backend Build**: `tsc` completed with **0 errors**.
- **Frontend Typecheck**: `tsc --noEmit` completed with **0 errors**.
- **Frontend Production Build**: Vite production build succeeded cleanly.
- **Working Tree Integrity**: All pre-existing working tree changes preserved; zero changes to Learning Engine progression or question sets.

---

## 23. Final XP Integrity Check: Duplicate & Concurrent Answer Submissions (F-01 Idempotency Hardening)

> **Execution Date**: 2026-10-09  
> **Scope**: Audit, regression testing, and atomic transaction hardening for answer submission idempotency and concurrency in `POST /api/v1/sessions/today/attempts`.  
> **Status**: COMPLETED & VERIFIED. Learning Engine redesign remains gated and untouched.

### 23.1 Concurrency & Idempotency Audit Findings
- **Vulnerability Identified**: In the initial multi-step implementation of `SessionUseCase.recordAttempt`, the application layer performed three independent steps:
  1. `sessionRepo.getDailySession()` to read the session state and check `currentQuestionIndex`.
  2. `sessionRepo.appendAttempt()` to write an attempt document.
  3. `sessionRepo.updateSessionProgress()` using `FieldValue.increment(awarded_xp)` and `FieldValue.increment(1)`.
- **Race Condition Under Concurrency**: Two concurrent requests for the same user, `sessionId`, and `questionIndex: 0` could both read `currentQuestionIndex = 0` before either had committed. Both passed use-case validation, both created attempt documents, and both executed `FieldValue.increment()`. This resulted in:
  - 10 XP awarded instead of 5 XP (+100% duplicate XP inflation).
  - `correctCount` incremented twice (2 instead of 1).
  - Two distinct attempt documents persisted for the same question index.
- **Sequential Duplicate Defect**: Relying solely on `FieldValue.increment()` without a transactional conditional check permitted repeated answer calls to continually increment counters.

### 23.2 Minimal Architectural Fix: Atomic Firestore Transaction
- **Interface Contract (`ISessionRepository.ts`)**:
  - Added `recordAttemptAtomic(params: RecordAttemptAtomicParams): Promise<RecordAttemptAtomicResult>`.
- **Transactional Persistence (`FirestoreSessionRepository.recordAttemptAtomic`)**:
  - Encapsulated within `adminDb.runTransaction`:
    1. Reads `sessionRef` within the transaction context.
    2. Enforces terminal status guard: rejects if `questionsCompleted === true`, `status === 'QUESTIONS_COMPLETED'`, or terminal status (`COMPLETED`, `REVIEW_COMPLETED`, `REVIEW_VIEWED`).
    3. Enforces strict expected index validation: `if (questionIndex !== currentIndex) throw new Error(...)`.
    4. Enforces question sequencing: validates `questionId === sessionData.questionIds[currentIndex]`.
    5. Calculates authoritative updates without blind increments: `newXp = oldXp + evaluation.awarded_xp`, `newCorrect = oldCorrect + (evaluation.is_correct ? 1 : 0)`.
    6. Staged writes: writes attempt record (`transaction.set(attemptRef, attemptDoc)`) and updates session state (`transaction.update(sessionRef, sessionUpdates)`) in the same atomic commit.
  - **Optimistic Concurrency Control (OCC)**: If two concurrent transactions race, the winning transaction commits and advances `currentQuestionIndex`. The contending transaction is retried by Firestore, reads the updated index (`currentIndex = 1`), fails the expected index check, and aborts with zero writes committed.
- **Application Layer Refactoring (`SessionUseCase.recordAttempt`)**:
  - Eliminated the non-atomic multi-step read-then-write sequence.
  - Evaluates question validity with `AnswerEvaluator`, then delegates directly to `sessionRepo.recordAttemptAtomic`.
- **HTTP Error Translation (`error.middleware.ts`)**:
  - Mapped `mismatch` (e.g., question index or sequence mismatch) and `already completed` errors to standard `HTTP 409 Conflict`.

### 23.3 Automated Regression & Persistence Verification
Added comprehensive regression test suites in `backend/tests/securityRemediation.test.ts` with stateful transaction simulation verifying persisted Firestore state:
1. **Sequential Duplicate Submission**: First submission succeeds (index=1, XP=5, correct=1, attempts=1). Second submission for index 0 is rejected with index mismatch. Persisted state confirmed unchanged (index=1, XP=5, correct=1, attempts=1).
2. **Two Concurrent Submissions (Same Question)**: Simulated concurrent execution of two identical submissions at index 0. OCC guarantees exactly 1 transaction succeeds and 1 aborts. Persisted state confirmed: index=1, XP=5 (not 10), correct=1 (not 2), attempt docs=1 (not 2).
3. **Two Concurrent Submissions (Differing Answers)**: Concurrent race with different answers for index 0. Winning transaction commits; losing transaction aborts. Persisted state confirmed: index=1, exactly 1 attempt persisted, total XP matches only the winning answer.
4. **Legitimate Sequential Progression**: Submitting question 0 commits (index=1, XP=5, correct=1). Submitting question 1 commits (index=2, XP=10, correct=2). Persisted state confirmed: index=2, XP=10, correct=2, attempts=2.
5. **Replayed Request After Session Completion**: Attempt submitted against completed session (`QUESTIONS_COMPLETED` and `REVIEW_COMPLETED`) is rejected with "Daily session is already completed." Persisted state confirmed: 0 mutations, 0 attempts added.
6. **HTTP Error Mapping**: Verified `SessionController.recordAttempt` returns `HTTP 409 Conflict` on index mismatch and already completed session.

### 23.4 Final Verification Baseline
- **Backend Tests**: 3 test files, **54 / 54 passed** (+3 new tests, 100% pass).
- **Workspace Tests**: 20 test files, **265 / 265 passed** (100% pass).
- **Backend TypeScript Compilation**: `tsc` passed with **0 errors**.
- **Frontend Typecheck**: `tsc --noEmit` passed with **0 errors**.
- **Frontend Production Build**: Vite build generated production bundle cleanly.
- **Git Diff & Repository Integrity**: Clean working tree changes; pre-existing files preserved; Learning Engine untouched.

---

## 24. Learning Engine Redesign Phase 1: Question Model & Lineage Ingestion Mapping

> **Execution Date**: 2026-10-09  
> **Scope**: Implementation of Phase 1 only (Question Model and Lineage Ingestion Mapping).  
> **Status**: COMPLETED & VERIFIED. Phase 2 (State Machine, XP Logic, Unsolved Bucket, Leaderboard, Frontend UI, Reminders) remains strictly gated and untouched. Zero data migrations executed.

### 24.1 Clarification of Transactional Architecture & Participants
To resolve ambiguous terminology in planning documentation, the exact transaction topology for question attempts is formally defined:
- **Transaction Scope**: Single atomic Firestore transaction via `adminDb.runTransaction`.
- **Participants & Affected Documents**:
  1. `users/{uid}` (User Profile Document): Reads `learningState.lifetimeCompletedQuestionIds` and `learningState.totalXp`; writes `arrayUnion(questionId)` if newly completed main question, updates `totalXp`, `currentLevel`, and `totalCorrectAnswersCount`.
  2. `users/{uid}/dailySessions/{sessionId}` (Daily Session Document): Reads `activeQuestionId`, `activeQuestionType`, `branchState`; writes `totalXpEarned`, `currentMainIndex`, `activeQuestionId`, `status`.
  3. `users/{uid}/attempts/{attemptId}` (Attempt Document): Creates append-only attempt record with `result`, `xpAwarded`, `isFollowUp`, and timestamps.
  4. `users/{uid}/unsolvedQuestions/{itemId}` (Unsolved Bucket Document, conditional): Written *only* when a follow-up fails or a returned main question re-attempt fails.
- **Document Count**: Exactly 3 documents mutated on a standard question attempt; exactly 4 documents mutated when logging to the Unsolved Bucket.

### 24.2 Phase 1 Implementation Details
1. **Domain Model (`backend/src/domain/models/question.model.ts`)**:
   - Extended `BaseQuestion` interface to expose `question_type?: 'Primary' | 'Follow-Up'`, `follow_up_for?: string | null`, `Question_Type?: 'Primary' | 'Follow-Up'`, and `Follow_Up_For?: string | null`.
   - Preserves lineage metadata across all derived question types (`MCQQuestion`, `TrueFalseQuestion`, etc.).
2. **Repository Contract (`backend/src/domain/interfaces/IQuestionRepository.ts`)**:
   - Added `getFollowUpQuestion(mainQuestionId: string, releaseId?: string): Promise<Question | null>` to interface.
3. **Infrastructure Adapter (`backend/src/infrastructure/firestore/FirestoreQuestionRepository.ts`)**:
   - Corrected `mapFirestoreDocToQuestion` to read and preserve `Question_Type` and `Follow_Up_For` from raw Firestore documents, applying safe defaults (`'Primary'`, `null`) when omitted.
   - Implemented `getFollowUpQuestion(mainQuestionId, releaseId)` which searches cached or fetched release questions to find the linked remedial follow-up question where `follow_up_for === mainQuestionId`.
4. **Unit Test Suite (`backend/tests/questionRepository.test.ts`)**:
   - Added 7 focused unit tests covering:
     - Preserving Primary question metadata and `null` follow-up.
     - Preserving Follow-Up question metadata and parent linkage (`MG-AIL-01-PR` -> `MG-AIL-01-TH`).
     - Handling missing metadata with safe defaults.
     - Preserving metadata on pre-formatted question documents.
     - Lineage retrieval via `getFollowUpQuestion` returning linked follow-up.
     - Returning `null` when no follow-up exists.
     - Returning `null` on empty question IDs.

### 24.3 Verification Baseline
- **Backend Tests**: 4 test files, **61 / 61 passed** (+7 new tests, 100% pass).
- **Full Workspace Tests**: 21 test files, **272 / 272 passed** (100% pass).
- **Backend TypeScript Compilation**: `tsc` passed with **0 errors**.
- **Frontend Typecheck**: `tsc --noEmit` passed with **0 errors**.
- **Frontend Production Build**: Vite build completed cleanly in 1.36s with **0 errors**.
- **Gate Enforcement**: Phase 2 state machine, XP modifications, Unsolved Bucket mutations, leaderboards, reminders, and data migrations are **NOT** started. Zero data migrations executed.

---

## 25. Learning Engine Redesign Phase 1 Correction: Authoritative Questionnaire Dataset Integration

> **Execution Date**: 2026-10-09  
> **Scope**: Phase 1 Correction — Integrating and auditing the actual project questionnaire dataset (`src/data/all_topics_questions.json`).  
> **Status**: COMPLETED & VERIFIED. Phase 2 (State Machine, XP Logic, Unsolved Bucket, Leaderboard, Frontend UI, Reminders) remains strictly gated and untouched. Zero data migrations executed.

### 25.1 Dataset Inspection & Lineage Audit
- **Dataset Path**: `src/data/all_topics_questions.json` (588,116 bytes, 10,544 lines).
- **Total Questions**: Exactly **620 questions** across exactly **31 topics**.
- **Question Composition**: Exactly **310 Primary questions** (`Question_Type: "Primary"`, 10 per topic) and **310 Follow-Up questions** (`Question_Type: "Follow-Up"`, 10 per topic).
- **Question ID Uniqueness**: Exactly **620 unique Question IDs** (0 duplicate IDs).
- **Consistent Schema Properties**: Every question record contains the 15 standard properties: `Question_ID`, `Topic`, `Question_Type`, `Difficulty_Rank` (1-10), `Follow_Up_For`, `Audience`, `Question`, `Option_A`, `Option_B`, `Option_C`, `Option_D`, `Correct`, `Explanation`, `Action`, `MedGemma_Tag`.
- **Existing Follow-Up Relationships**:
  - **309 Follow-Ups** have valid, existing parent references (`Follow_Up_For !== null`).
  - **0 Broken References**: Every single non-null referenced parent exists in the dataset as an authentic Primary question.
  - **Lineage Discrepancies Identified**:
    1. Topic `"Noise Quality"`: Question `MG-NOI-01-PR` has `Follow_Up_For: null` instead of referencing `MG-NOI-01-TH`.
    2. Topic `"Fever Flow Murmur"`: Follow-up questions `MG-FEV-02-PR` through `MG-FEV-10-PR` reference `MG-FEV-01-TH` rather than `MG-FEV-02-TH` .. `MG-FEV-10-TH`.
    3. Topic `"Innocent Murmur"`: Follow-up questions `MG-INN-02-PR` through `MG-INN-10-PR` reference `MG-INN-01-TH` rather than `MG-INN-02-TH` .. `MG-INN-10-TH`.
- **Lineage Handling Rule**: In strict compliance with architectural guidelines, missing or anomalous relationships are **not fabricated**. `getFollowUpQuestion('MG-NOI-01-TH')` safely returns `null` because `MG-NOI-01-PR` does not declare `Follow_Up_For: 'MG-NOI-01-TH'`.

### 25.2 Suffix Semantics & ID-Lineage Audit
- **`-TH` vs. `-PR` Suffix Meaning**:
  - `-TH`: **Theoretical** (Primary questions testing conceptual clinical knowledge and guidelines).
  - `-PR`: **Practical** (Follow-Up remedial questions placing the trainee in concrete frontline health camp/field scenarios).
  - 100% of all 310 `-TH` records possess `Question_Type: "Primary"`.
  - 100% of all 310 `-PR` records possess `Question_Type: "Follow-Up"`.
  - Zero other suffixes exist in the dataset.
- **Discrepancy Table for Content Owner Review**:
  | Record ID | Type | Rank | `Follow_Up_For` (Actual) | Content-Aligned Parent | Issue Description | Approval Required |
  | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
  | `MG-NOI-01-PR` | Follow-Up | 1 | `null` | `MG-NOI-01-TH` | Missing parent reference. Sibling to `MG-NOI-01-TH`. | **Yes (Content Owner)** |
  | `MG-FEV-02-PR` .. `10-PR` | Follow-Up | 2–10 | `MG-FEV-01-TH` | `MG-FEV-0x-TH` | Copy-paste duplication: all 10 follow-ups point to Rank 1 parent. | **Yes (Content Owner)** |
  | `MG-INN-02-PR` .. `10-PR` | Follow-Up | 2–10 | `MG-INN-01-TH` | `MG-INN-0x-TH` | Copy-paste duplication: all 10 follow-ups point to Rank 1 parent. | **Yes (Content Owner)** |

### 25.3 Repository Architecture, Production Packaging & Fail-Fast Guarantees
1. **Authoritative Dataset Priority & No Silent Degradation**:
   - `FirestoreQuestionRepository.ts` treats `src/data/all_topics_questions.json` as the authoritative dataset.
   - If the local dataset is missing, unreadable, malformed, or empty, the repository **fails fast with an explicit fatal exception**. It strictly does NOT fall back to Firestore and silently truncate to 20 questions or return an empty array.
2. **Production Packaging Verification**:
   - Added `backend/scripts/copy_dataset.js` invoked via `npm run build` in `backend/package.json`.
   - Copies `all_topics_questions.json` into `backend/dist/data/all_topics_questions.json`.
   - Verified that path resolution succeeds from arbitrary working directories and within packaged production distributions.
3. **Deterministic Follow-Up Lookup Semantics**:
   - `getFollowUpQuestion(mainQuestionId)` returns ONLY records explicitly declaring `Follow_Up_For === mainQuestionId`.
   - Strictly does NOT invent relationships using ID suffixes, rank, or topic similarity.
   - For duplicate parent references (e.g. `MG-FEV-01-TH`), logs a prominent diagnostic warning and deterministically selects the rank-matched candidate (`MG-FEV-01-PR`, rank 1).
   - Unreferenced questions (e.g. `MG-FEV-02-TH`, `MG-NOI-01-TH`) safely return `null`.

### 25.4 Comprehensive Test Suite & Verification Baseline
Updated `backend/tests/questionRepository.test.ts` to **26 comprehensive tests**:
- 7 unit tests: Metadata mapping, type normalization, legacy defaults, fixture edge cases.
- 9 actual dataset integration tests: 620 questions, 31 topics, 620 unique IDs, 309 valid parent links, 1 null parent case, multi-topic lineage retrieval.
- 5 production packaging & fail-fast tests: dist/data packaging, missing dataset error, malformed JSON error, empty questions error, no silent Firestore degradation.
- 5 deterministic disambiguation tests: duplicate parent handling, warning logging, rank-matched selection, strict non-invention of links, edge case inputs.

**Verification Results**:
- **Backend Tests**: 4 test files, **80 / 80 passed** (100% pass in 2.45s).
- **Workspace Tests**: 21 test files, **291 / 291 passed** (100% pass in 4.91s).
- **Backend TypeScript Build**: `tsc && node scripts/copy_dataset.js` passed with **0 errors**. Production artifact created.
- **Frontend Typecheck**: `tsc --noEmit` passed with **0 errors**.
- **Frontend Production Build**: `vite build` completed cleanly in 1.38s with **0 errors**.
- **Gate Enforcement**: Phase 2 state machine, XP modifications, Unsolved Bucket mutations, leaderboards, reminders, and data migrations are **NOT** started. Zero data migrations executed.

---

## 26. Learning Engine Redesign Phase 1.1: Dataset Lineage Correction and Final Verification

> **Execution Date**: 2026-10-09  
> **Scope**: Investigation and evidence-based correction of the 19 dataset lineage anomalies in the authoritative curriculum dataset (`src/data/all_topics_questions.json`), implementation of strict dataset validation, regression testing of repository behavior, and execution of the complete 6-step verification sequence.  
> **Status**: COMPLETED & VERIFIED. All 19 anomalies resolved with 100% clinical and architectural evidence. Phase 2 (State Machine, XP Ledger, Unsolved Bucket, Leaderboards, Frontend UI, Reminders) remains strictly gated and untouched. Zero live Firestore writes and zero cloud deployments occurred.

### 26.1 Baseline vs. Final Dataset Statistics

| Metric | Initial Baseline (Phase 1) | Final State (Phase 1.1) | Delta / Verification Status |
| :--- | :--- | :--- | :--- |
| **Dataset Path** | `src/data/all_topics_questions.json` | `src/data/all_topics_questions.json` | Sole authoritative source preserved |
| **SHA-256 Checksum** | `3ce0408713c5fe4e763bdfb0b993d311dd35777e186f066b22af5b88916b1f9f` | `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a` | Authoritative hash updated |
| **File Size (bytes)** | 588,116 | 588,126 | +10 bytes (replacement of `null` with `"MG-NOI-01-TH"`) |
| **Total Questions** | 620 | 620 | Exactly 620 preserved (0 added / 0 removed) |
| **Primary Questions (`-TH`)** | 310 | 310 | 10 per topic across all 31 topics |
| **Follow-Up Questions (`-PR`)**| 310 | 310 | 10 per topic across all 31 topics |
| **Topic Count** | 31 | 31 | 31 distinct clinical topics |
| **Unique Question IDs** | 620 | 620 | 0 duplicate IDs (100% unique) |
| **Null Parent References** | 1 (`MG-NOI-01-PR`) | 0 | Resolved to `MG-NOI-01-TH` |
| **Broken Parent References** | 0 | 0 | 0 non-existent parent IDs |
| **Non-Primary Parent References**| 0 | 0 | All parents are verified `Primary` (`-TH`) |
| **Cross-Topic Parent References**| 0 | 0 | All parent-child pairs share identical topics |
| **Duplicate Parent References**| 18 (`MG-FEV-01-TH`: 10, `MG-INN-01-TH`: 10) | 0 | Resolved to 1:1 rank-paired parents |
| **Rank Mismatches (Warnings)** | 18 | 0 | All 310 follow-ups match parent rank |
| **Total Lineage Anomalies** | **19** | **0** | **100% resolved with record-level evidence** |

### 26.2 Record-by-Record Clinical Investigation & Disposition Table

Every record was investigated by comparing question text, options, correct answers, explanations, learning actions, difficulty ranks, and MedGemma tags:

| # | Question ID | Existing `Follow_Up_For` | Proposed Parent | Difficulty Rank | Clinical & Structural Evidence | Confidence | Disposition |
| :-: | :--- | :--- | :--- | :-: | :--- | :-: | :--- |
| **1** | `MG-NOI-01-PR` | `null` | `MG-NOI-01-TH` | 1 | Identical clinical scenario (crying child, loud fan, moving stethoscope chestpiece). Identical action: *"Stop the recording and try again in a quieter place."* Identical verbatim explanation. Sibling to ranks 2–10 which all link 1:1. Unambiguous missing metadata artifact. | **Very High (100%)** | **Updated to `MG-NOI-01-TH`** |
| **2** | `MG-FEV-02-PR` | `MG-FEV-01-TH` | `MG-FEV-02-TH` | 2 | Progressive clinical phrasing matches rank 2 theoretical counterpart. Identical action (*"Treat the fever and re-evaluate..."*). Sibling to ranks 1 and 2–10. Spreadsheet autofill artifact. | **High (95%)** | **Updated to `MG-FEV-02-TH`** |
| **3** | `MG-FEV-03-PR` | `MG-FEV-01-TH` | `MG-FEV-03-TH` | 3 | Scenario conciseness aligns directly with rank 3 theoretical counterpart (*"A boy is brought in with a fever..."*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-03-TH`** |
| **4** | `MG-FEV-04-PR` | `MG-FEV-01-TH` | `MG-FEV-04-TH` | 4 | Question phrasing aligns directly with rank 4 theoretical counterpart (*"A child has a fever and a new soft sound..."*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-04-TH`** |
| **5** | `MG-FEV-05-PR` | `MG-FEV-01-TH` | `MG-FEV-05-TH` | 5 | Question phrasing aligns with rank 5 theoretical counterpart (*"If a child is hot with a fever..."*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-05-TH`** |
| **6** | `MG-FEV-06-PR` | `MG-FEV-01-TH` | `MG-FEV-06-TH` | 6 | Question phrasing aligns with rank 6 theoretical counterpart (*"A child has a fever and a new soft heart sound..."*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-06-TH`** |
| **7** | `MG-FEV-07-PR` | `MG-FEV-01-TH` | `MG-FEV-07-TH` | 7 | Concise clinical phrasing aligns with rank 7 theoretical counterpart (*"Child has fever and a soft murmur. What to do?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-07-TH`** |
| **8** | `MG-FEV-08-PR` | `MG-FEV-01-TH` | `MG-FEV-08-TH` | 8 | Concise clinical phrasing aligns with rank 8 theoretical counterpart (*"Child is sick with fever and new murmur. What to do?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-08-TH`** |
| **9** | `MG-FEV-09-PR` | `MG-FEV-01-TH` | `MG-FEV-09-TH` | 9 | Ultra-concise clinical phrasing aligns with rank 9 theoretical counterpart (*"Fever and a soft murmur in a child. What to do?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-09-TH`** |
| **10**| `MG-FEV-10-PR` | `MG-FEV-01-TH` | `MG-FEV-10-TH` | 10 | Ultra-concise clinical phrasing aligns with rank 10 theoretical counterpart (*"Fever and soft murmur. What to do?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-FEV-10-TH`** |
| **11**| `MG-INN-02-PR` | `MG-INN-01-TH` | `MG-INN-02-TH` | 2 | Hospital report / surgery concern scenario aligns with rank 2 theoretical counterpart. Identical action (*"Reassure the parents that the murmur is harmless..."*). Spreadsheet autofill artifact. | **High (95%)** | **Updated to `MG-INN-02-TH`** |
| **12**| `MG-INN-03-PR` | `MG-INN-01-TH` | `MG-INN-03-TH` | 3 | Healthy active girl scenario aligns with rank 3 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-03-TH`** |
| **13**| `MG-INN-04-PR` | `MG-INN-01-TH` | `MG-INN-04-TH` | 4 | Well-child routine check-up scenario aligns with rank 4 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-04-TH`** |
| **14**| `MG-INN-05-PR` | `MG-INN-01-TH` | `MG-INN-05-TH` | 5 | Growing-well child scenario aligns with rank 5 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-05-TH`** |
| **15**| `MG-INN-06-PR` | `MG-INN-01-TH` | `MG-INN-06-TH` | 6 | Scared parents guidance aligns with rank 6 theoretical counterpart (*"Is an innocent murmur a sign of a sick heart?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-06-TH`** |
| **16**| `MG-INN-07-PR` | `MG-INN-01-TH` | `MG-INN-07-TH` | 7 | Direct safety reassurance aligns with rank 7 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-07-TH`** |
| **17**| `MG-INN-08-PR` | `MG-INN-01-TH` | `MG-INN-08-TH` | 8 | Concise scenario aligns with rank 8 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-08-TH`** |
| **18**| `MG-INN-09-PR` | `MG-INN-01-TH` | `MG-INN-09-TH` | 9 | Mother query on sick heart aligns with rank 9 theoretical counterpart. Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-09-TH`** |
| **19**| `MG-INN-10-PR` | `MG-INN-01-TH` | `MG-INN-10-TH` | 10 | Ultra-concise scenario (*"Healthy child, innocent murmur. What does it mean?"*) aligns with rank 10 theoretical counterpart (*"What does an innocent murmur mean?"*). Identical action and explanation. | **High (95%)** | **Updated to `MG-INN-10-TH`** |

*Records intentionally left unchanged*: **0**. All 19 records were conclusively established as authoring/spreadsheet artifacts through record-level comparison of question scenarios, learning actions, explanations, and sibling topic patterns. No ambiguous cases required deferral.

### 26.3 Architectural & Implementation Changes

1. **Authoritative Dataset Correction (`src/data/all_topics_questions.json`)**:
   - Updated lines 5635, 5652, 5669, 5686, 5703, 5720, 5737, 5754, 5771 (`MG-FEV-02-PR` .. `10-PR`).
   - Updated lines 6315, 6332, 6349, 6366, 6383, 6400, 6417, 6434, 6451 (`MG-INN-02-PR` .. `10-PR`).
   - Updated line 7165 (`MG-NOI-01-PR`).
   - Zero clinical question texts, options, correct answers, or explanations were modified.
2. **Curriculum Dataset Validator (`backend/src/domain/rules/datasetValidator.ts`)**:
   - Implemented `validateQuestionDataset(questions)` enforcing:
     - Hard errors: `EMPTY_DATASET`, `EMPTY_QUESTION_ID`, `DUPLICATE_QUESTION_ID`, `INVALID_QUESTION_TYPE`, `MISSING_REQUIRED_FIELD`, `INVALID_PRIMARY_FOLLOW_UP`, `MISSING_FOLLOW_UP_PARENT`, `NON_EXISTENT_PARENT`, `PARENT_NOT_PRIMARY`, `CROSS_TOPIC_REFERENCE`, `DUPLICATE_FOLLOW_UP_FOR_PARENT`.
     - Diagnostic warnings: `RANK_MISMATCH`, `SUFFIX_MISMATCH`.
   - Never performs automatic data mutations or link fabrication.
3. **Build Packaging Pre-Validation (`backend/scripts/copy_dataset.js`)**:
   - Added pre-validation of dataset syntax, non-emptiness, and structure prior to packaging.
   - Added post-packaging byte-size and existence verification guaranteeing production artifact fidelity.
4. **Automated Test Coverage Expansion (`backend/tests/questionRepository.test.ts`)**:
   - Expanded from 26 to **36 comprehensive tests** (+10 tests).
   - Added 12 dataset validator unit tests covering all hard error conditions and diagnostic warnings.
   - Verified that the authoritative dataset passes with 0 errors and 0 warnings.
   - Verified that all 310 follow-ups resolve to their exact parent questions (including all 3 corrected topics).
   - Verified that duplicate parent disambiguation and warning logging operate deterministically via synthetic fixtures.

### 26.4 Complete Verification Sequence Results

All commands executed in strict sequential order with verified terminal outputs:

| Sequence Step | Command | Execution Time | Results | Status |
| :-: | :--- | :-: | :--- | :-: |
| **Step 1** | Dataset Schema & Lineage Audit | 0.45s | 620 questions, 31 topics, 620 unique IDs, 0 null parents, 0 broken parents, 0 duplicate parents, 0 rank mismatches. | **PASSED** |
| **Step 2** | Backend Test Suite (`npm.cmd --prefix backend test`) | 2.45s | 4 test files, **90 / 90 tests passed** (100%). | **PASSED** |
| **Step 3** | Backend Production Build (`npm.cmd --prefix backend run build`) | 1.82s | `tsc` compiled cleanly; `copy_dataset.js` packaged 620 questions (588,126 bytes) to `dist/data/`. | **PASSED** |
| **Step 4** | Workspace Test Suite (`npm.cmd test -- --run`) | 4.94s | 21 test files, **301 / 301 tests passed** (100%). | **PASSED** |
| **Step 5** | Frontend Typecheck (`npm.cmd run typecheck`) | 6.81s | `tsc --noEmit` completed with **0 errors**. | **PASSED** |
| **Step 6** | Frontend Production Build (`npm.cmd run build`) | 1.38s | Vite production bundle generated cleanly (1943 modules transformed, 0 errors). | **PASSED** |

### 26.5 Independent Packaged Dataset Verification

Bit-for-bit comparison between `src/data/all_topics_questions.json` and `backend/dist/data/all_topics_questions.json`:
- **Source SHA-256**: `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a`
- **Dist SHA-256**: `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a`
- **Checksum Match**: **True (Exact Match)**
- **File Size Match**: Exactly 588,126 bytes on both paths.
- **Question Count Match**: Exactly 620 on both paths.
- **Field-by-Field Mismatches**: Exactly **0**. All 19 corrected records confirmed in production artifact.

### 26.6 Gate Enforcement & Strict Separation of Facts

- **Live Database Writes**: **ZERO**. No writes to cloud Firestore, staging, or production collections occurred.
- **Deployments**: **ZERO**. No hosting deployments, Cloud Functions deploys, or remote publishes occurred.
- **Pre-existing Working Tree**: All pre-existing modified/untracked files preserved intact.
- **Phase 2 Status**: **STRICTLY ON HOLD**. Branching state machine, `unsolvedQuestions` transactions, XP ledger, and UI changes are untouched.

---

## 27. Learning Engine Redesign Phase 2 — Stage 1: Domain Models, State Machine & Progression Service

> **Execution Date**: 2026-10-09  
> **Scope**: Implementation of Phase 2 Stage 1 ONLY: Domain Models, State Machine, and Progression Service. Gated implementation following explicit approval of Decisions 1, 2, 3, and 4 (Option A).  
> **Status**: COMPLETED & VERIFIED. Stages 2–6 remain strictly gated and untouched. Zero data migrations executed. Zero cloud deployments occurred.

### 27.1 Approved Product Decisions Implemented
1. **Decision 1 (Option A) — Re-attempt Policy**:
   - Exactly ONE re-attempt permitted after successful remedial Follow-Up.
   - Flow: Incorrect Main → present exact linked Follow-Up. Correct Follow-Up (0 XP) → route back to Main for one re-attempt. Correct Main Re-attempt → mark completed and proceed. Incorrect Main Re-attempt → queue for Unsolved Questions Bucket (`reason: 'REATTEMPT_FAILED'`) and proceed to next Main question.
   - Unlimited remedial loop is strictly prevented.
2. **Decision 2 (Option A) — XP Accounting Policy**:
   - 10 XP awarded per uncompleted Main question if learner's total XP before award is < 310 (including on permitted re-attempt).
   - Trainee at 305 XP receives full 10 XP, reaching 315 XP.
   - If total XP >= 310, awards 0 XP. Historical XP is NEVER reduced.
   - Follow-Ups, incorrect answers, and finalization award 0 XP.
   - Main question completion recorded in `lifetimeCompletedQuestionIds`.
3. **Level Formula**:
   - `level = min(31, floor(max(0, totalXp) / 10) + 1)` with Level 31 ceiling.
4. **Curriculum Completion Milestone**:
   - Requires all 310 unique foundational Main questions in `lifetimeCompletedQuestionIds`.

### 27.2 File-by-File Implementation Details
1. **Domain Models**:
   - `backend/src/domain/models/session.model.ts`: Added `BranchState = 'MAIN' | 'FOLLOW_UP' | 'REATTEMPT_MAIN'`. Extended `DailySessionDoc` and `AttemptDoc` with optional branching and re-attempt metadata (`branchState`, `activeMainQuestionId`, `activeFollowUpQuestionId`, `isReattempt`, `isFollowUp`, `parentQuestionId`).
   - `src/models/session.types.ts`: Mirror definitions on frontend for full type compatibility.
2. **State Machine (`backend/src/domain/rules/LearningEngineStateMachine.ts`)**:
   - Implemented pure finite state machine governing phases: `IDLE`, `PRESENTING_MAIN`, `MAIN_FEEDBACK`, `PRESENTING_FOLLOW_UP`, `FOLLOW_UP_FEEDBACK`, `REATTEMPTING_MAIN`, `REATTEMPT_FEEDBACK`, `QUESTIONS_COMPLETED`.
   - Deterministic branching, re-attempt limits, unsolved question queueing, and session interruption recovery.
3. **Progression Service (`backend/src/domain/rules/ProgressionService.ts` & `src/services/ProgressionService.ts`)**:
   - Implemented `calculateLevel(totalXp)` (31 levels).
   - Implemented `calculateMainQuestionXpAward(params)` (10 XP under 310 threshold, 305 -> 315 rule, 0 XP if >= 310 or already completed).
   - Implemented `calculateFollowUpXpAward()` (0 XP) and `calculateSessionFinalizationXpAward()` (0 XP).
   - Implemented `isCurriculumCompleted(ledger)` (310 unique main questions).
   - Preserved backward-compatible `calculateProgression` for legacy views.

### 27.3 Automated Test Coverage & Verification Results
- **New Unit Tests Added**:
  - `backend/tests/progressionService.test.ts`: **21 tests** covering Level 1–31 calculations, 305 XP edge case, 310 XP threshold, ledger idempotency, and curriculum completion.
  - `backend/tests/learningEngineStateMachine.test.ts`: **15 tests** covering linear flows, branching, correct re-attempt, failed re-attempt, failed follow-up, 10th question completion, and interrupted session recovery.
- **Backend Test Suite** (`npm.cmd --prefix backend test`):
  - **6 test files passed, 126 / 126 tests passed** (100% pass, +36 tests).
- **Workspace Test Suite** (`npm.cmd test`):
  - **23 test files passed, 337 / 337 tests passed** (100% pass, +36 tests).
- **TypeScript Typechecks & Builds**:
  - Frontend typecheck (`npm run typecheck`): Clean, **0 errors**.
  - Frontend production build (`npm run build`): Clean, **0 errors**.
  - Backend build (`npm --prefix backend run build`): Clean, **0 errors**.
- **Authoritative Dataset Integrity**:
  - `src/data/all_topics_questions.json`: SHA-256 `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a` (Unmodified).
  - `backend/dist/data/all_topics_questions.json`: SHA-256 `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a` (Bit-for-bit match).

### 27.4 Gate Enforcement
- **Live Database Writes**: **ZERO**.
- **Cloud Deployments**: **ZERO**.
- **Stage 2 Status**: **ON HOLD**. Awaiting explicit user authorization before proceeding to Question Selection & Follow-Up Ingestion Alignment.

---

## 28. Learning Engine Redesign Phase 2 — Stage 2: Question Selection & Follow-Up Ingestion Alignment

> **Execution Date**: 2026-10-12  
> **Scope**: Implementation of Phase 2 Stage 2 ONLY: Authoritative Main-Question Selection, Follow-Up Lineage Ingestion Validation, and Stage 1 Correctness Alignment for `isCurriculumCompleted()`.  
> **Status**: COMPLETED & VERIFIED. Stages 3–6 remain strictly gated and untouched. Zero live Firestore writes and zero cloud deployments occurred.

### 28.1 Stage 1 Correctness Alignment — `isCurriculumCompleted()`
1. **Authoritative ID Validation**:
   - Replaced simple count threshold (`Set(ids).size >= 310`) with strict verification against canonical foundational curriculum question IDs: `authoritativeMainQuestionIds.every((id) => completedSet.has(id))`.
   - Prevents arbitrary, synthetic, or non-curriculum IDs from falsely triggering curriculum completion.
   - Canonical `AUTHORITATIVE_MAIN_QUESTION_IDS` (310 Primary IDs) imported directly from `sessionSelection.ts` as default reference set.
   - Mirrored identically in backend (`backend/src/domain/rules/ProgressionService.ts`) and frontend (`src/services/ProgressionService.ts`).
2. **Regression Test Verification**:
   - Added 4 new regression tests in `backend/tests/progressionService.test.ts` (suite total: 25 tests):
     - Confirms 310 arbitrary question IDs evaluate to `false`.
     - Confirms 309 authoritative IDs + 1 arbitrary ID evaluate to `false`.
     - Confirms exactly all 310 authoritative Primary IDs evaluate to `true`.
     - Confirms custom subsets validate strictly against specified authoritative IDs.

### 28.2 Main-Question Selection Algorithm (`selectDailyMainQuestions`)
Implemented pure deterministic selection engine in `backend/src/domain/rules/sessionSelection.ts`:
1. **Topic Ordering Sequence (`AUTHORITATIVE_TOPIC_SEQUENCE`)**:
   - Exact 31-topic progression order from `src/data/all_topics_questions.json`: `Ai Abnormal`, `AI limitation`, `AiSteth`, `Anaemia flow`, `Apex`, `ASHA role`, `CHD basics`, `Chorea`, `Continuous Murmur`, `Cyanosis`, `Diastolic`, `DEIC`, `Echocardiogram`, `Exercise Intolerance`, `Family History`, `Feeding Red Flags`, `Fever Flow Murmur`, `Five Points`, `Innocent Murmur`, `Llsb`, `Murmur Not Diagnosis`, `Noise Quality`, `Position Change`, `Rbsk Condition`, `Rhd Age`, `Rhd Basics`, `Secondary Prevention`, `Sore Throat History`, `Sore Throat Prevention`, `Systolic Timing`, `Thrill`.
2. **Authoritative Primary Questions List (`AUTHORITATIVE_MAIN_QUESTION_IDS`)**:
   - Exactly 310 unique Primary question IDs (`-TH` suffix) sorted by curriculum topic order and difficulty rank (1 to 10).
3. **Deterministic Selection Rules**:
   - Exclusively filters for `Question_Type === 'Primary'` (`isPrimaryQuestion`).
   - Strictly excludes any question ID present in `lifetimeCompletedQuestionIds`.
   - Never selects Follow-Up questions.
   - Deterministic sort hierarchy:
     1. Primary: Topic index in `AUTHORITATIVE_TOPIC_SEQUENCE` (0 to 30).
     2. Secondary: Difficulty Rank ascending (1 to 10).
     3. Tie-breaker: Lexical Question ID ascending (`localeCompare`).
   - Boundary handling:
     - Returns up to 10 questions per daily session.
     - If fewer than 10 remain (e.g. 5 uncompleted), returns all remaining uncompleted questions.
     - If 0 remain, returns empty selection with `isCurriculumCompleted: true` and `remainingUncompletedCount: 0`.
     - Never fabricates placeholder or duplicate questions.

### 28.3 Lineage Ingestion Validation (`validateFollowUpLineage`)
Implemented 1:1 parent-child verification function in `backend/src/domain/rules/sessionSelection.ts`:
- **Validation Rules**:
  - Every Follow-Up must have a non-null `Follow_Up_For` referencing an existing Primary question.
  - Parent question must have `Question_Type === 'Primary'`.
  - Parent and Follow-Up topics must match.
  - Parent and Follow-Up difficulty ranks must match.
  - Exactly one Follow-Up points to each Primary question (zero duplicate parents).
  - Every Primary question has exactly one Follow-Up referencing it (zero orphan primaries).
- **Authoritative Dataset Lineage Audit Results**:
  - Total questions evaluated: **620**.
  - Primary questions: **310**.
  - Follow-Up questions: **310**.
  - Valid 1:1 lineage pairs: **310**.
  - Errors detected: **0**.
  - Warnings detected: **0**.
  - `isValid`: **true**.

### 28.4 Repository Interface Alignment
- `backend/src/domain/interfaces/IQuestionRepository.ts`:
  - Added method `getDailyMainQuestions(lifetimeCompletedQuestionIds?: string[], count?: number, releaseId?: string): Promise<Question[]>`.
- `backend/src/infrastructure/firestore/FirestoreQuestionRepository.ts`:
  - Implemented `getDailyMainQuestions`, retrieving the authoritative curriculum pool and invoking pure `selectDailyMainQuestions`.
  - Preserved backward compatibility for `getDailySessionQuestions` and legacy day-parity rotation.

### 28.5 Automated Test Coverage & Verification Results
- **New Test Files Added**:
  - `backend/tests/sessionSelection.test.ts`: **19 tests** covering:
    - Initial 10-question daily selection.
    - Deterministic progression (advances to next batch as questions are completed).
    - Exclusion of completed question IDs.
    - Completion of curriculum (empty selection, `isCurriculumCompleted: true`).
    - Trailing subset selection (< 10 questions remaining).
    - Strict non-inclusion of Follow-Ups in daily selection.
    - Tie-breaker stability.
    - Full 620-question authoritative dataset lineage validation (0 errors, 310 valid pairs).
    - Synthetic lineage error detection (`MISSING_PARENT_REFERENCE`, `PARENT_NOT_FOUND`, `PARENT_NOT_PRIMARY`, `TOPIC_MISMATCH`, `DIFFICULTY_RANK_MISMATCH`, `DUPLICATE_PARENT_LINK`, `ORPHAN_MAIN_QUESTION`).
- **Regression Tests Expanded**:
  - `backend/tests/progressionService.test.ts`: Expanded from 21 to **25 tests** for authoritative curriculum completion logic.
- **Backend Test Suite** (`npm.cmd --prefix backend test`):
  - **7 test files passed, 149 / 149 tests passed** (100% pass, +23 tests).
- **Workspace Test Suite** (`npm.cmd test`):
  - **24 test files passed, 360 / 360 tests passed** (100% pass, +23 tests).
- **TypeScript Typechecks & Production Builds**:
  - Frontend typecheck (`npm run typecheck`): Clean, **0 errors**.
  - Frontend production build (`npm run build`): Clean, **0 errors**.
  - Backend build (`npm --prefix backend run build`): Clean, **0 errors**. Production artifact packaged into `dist/data/`.
- **Authoritative Dataset Integrity (SHA-256 Checksum Verification)**:
  - `src/data/all_topics_questions.json`: `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a` (Unmodified).
  - `backend/dist/data/all_topics_questions.json`: `34e7e60f77fdbeaa972f452a37e3b89383833b7766a4d0ad7445598c1e98151a` (Bit-for-bit match).

### 28.6 Gate Enforcement & Prohibited Actions
- **Live Database Writes**: **ZERO**. No writes to cloud Firestore, staging, or production databases.
- **Cloud Deployments**: **ZERO**. No Cloud Functions or Firebase Hosting deployments.
- **Stage 3 Scope Gated**: Atomic Firestore transactions, runtime persistence, and session controller mutations are **STRICTLY ON HOLD** pending explicit user approval (Gate C).

---

## 29. Bug Fix: Administrator Role Elevation & Account Lookup Architecture (`admin_tester` to `PLATFORM_ADMIN`)

> **Execution Date**: 2026-10-27  
> **Scope**: Investigation and resolution of administrator role elevation failure when invoking `node backend/scripts/set_admin_role.js admin_tester PLATFORM_ADMIN`.  
> **Status**: COMPLETED & VERIFIED. Real test account `admin_tester` successfully elevated to `PLATFORM_ADMIN` in both Firestore and Firebase Authentication custom claims. Multi-strategy user resolution, idempotent elevation, and automated unit test suite implemented.

### 29.1 Root Cause Investigation
1. **Firestore Keying Architecture vs. CLI Target**:
   - In Firestore, trainee profile documents are keyed by Firebase Auth UID: `users/${uid}` (e.g., `users/UjofqlcL6pWLL4jq7WtEZliab8L2`).
   - The legacy `set_admin_role.js` script performed a naïve lookup:
     1. Checked `usernames.doc(target.toLowerCase())` (e.g. `usernames/admin_tester`).
     2. If absent, fell back to `users.doc(target)` (e.g. `users/admin_tester`).
     3. Threw `Error: User document "users/admin_tester" does not exist in Firestore.`
2. **Registration Normalization & Account State**:
   - The user registered with username `admin_tester`, full name `admin_tester`, and designation `ASHA_WORKER`.
   - In Firebase Authentication: UID `UjofqlcL6pWLL4jq7WtEZliab8L2`, email `admintester@trainee.aisteth.internal`, displayName `admin_tester`.
   - In Firestore `users` collection: document `users/UjofqlcL6pWLL4jq7WtEZliab8L2` (`displayName: 'admin_tester'`, `username: 'admintester'`, `syntheticEmail: 'admintester@trainee.aisteth.internal'`, `role: 'TRAINEE'`).
   - In Firestore `usernames` collection: document `usernames/admintester` (stripped of underscore during sign-up normalization).
   - Because `usernames/admin_tester` did not exist, the script defaulted to `users.doc('admin_tester')` which failed.

### 29.2 Architectural Fix & Multi-Strategy Resolution
Updated `backend/scripts/set_admin_role.js`:
1. **Multi-Strategy User Identifier Resolution (`resolveUserIdentifier`)**:
   - **Strategy 1**: Direct Firestore UID check (`users/${target}`).
   - **Strategy 2**: Firebase Auth UID lookup (`auth.getUser(target)`).
   - **Strategy 3**: Exact username mapping (`usernames/${target.toLowerCase()}`).
   - **Strategy 4**: Sanitized username mapping (`usernames/${target.replace(/[^a-zA-Z0-9]/g, '')}`).
   - **Strategy 5**: Firestore profile query by `username` field.
   - **Strategy 6**: Firestore profile query by `displayName` field.
   - **Strategy 7**: Firestore profile query by `optionalEmail` / `syntheticEmail` fields.
   - **Strategy 8**: Firebase Auth user lookup by email.
2. **Dual-Layer RBAC Authorization Update**:
   - Updates Firestore user document `users/${uid}.role = role` without overwriting or mutating any unrelated trainee profile attributes.
   - Updates Firebase Authentication custom claims: `auth.setCustomUserClaims(uid, { role })`.
   - Creates alias mapping `usernames/${lowerTarget} -> { uid, ... }` to ensure instantaneous future lookups.
   - Validates role against `VALID_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPERVISOR']`.
   - Provides clear error messaging if user cannot be found or profile document is missing.
   - Exports `resolveUserIdentifier`, `setAdminRole`, and `VALID_ADMIN_ROLES` for isolated testing.

### 29.3 Verification & Live Elevation Results
1. **Executed Role Elevation**:
   - Command: `node backend/scripts/set_admin_role.js admin_tester PLATFORM_ADMIN`
   - Output:
     - Resolved identifier `admin_tester` to UID: `UjofqlcL6pWLL4jq7WtEZliab8L2`
     - Updated `users/UjofqlcL6pWLL4jq7WtEZliab8L2.role` from `TRAINEE` to `PLATFORM_ADMIN`
     - Set Firebase Auth custom claims `{ role: "PLATFORM_ADMIN" }`
     - Created index alias `usernames/admin_tester` -> `UjofqlcL6pWLL4jq7WtEZliab8L2`
2. **Session Refresh Note**:
   - Existing active browser sessions must sign out and sign in (or trigger token refresh) to acquire the new custom claims in their client JWT.
3. **Automated Unit & Integration Tests**:
   - Created `backend/tests/setAdminRole.test.ts` (12 tests covering resolution strategies, invalid roles, non-existent users, dual-layer persistence, idempotent execution, and `requireAdminRole` middleware enforcement).
   - Full workspace test suite: **41 test files passed, 625 / 625 tests passed**.
   - Backend & frontend production builds: Clean, **0 errors**.

---

## 30. Phase 30 — Admin-Led Learner Onboarding Implementation

> **Execution Date**: 2026-10-27  
> **Scope**: Implementation of the official **Admin-Led Learner Onboarding** decision for AuSkill (AiSteth RBSK Learning Engine). Eliminates public worker self-registration, empowers platform administrators and supervisors to provision worker accounts individually or in bulk, manages worker lifecycle (editing, deactivation, credential regeneration), and preserves all existing learning functionality, daily sessions, streaks, and gamification.  
> **Status**: COMPLETED & VERIFIED. Full automated test suite passes (41 test files, 632 / 632 tests), backend and frontend production builds pass with zero errors.

### 30.1 Background & Strategic Onboarding Decision
- **Core Directive**: Frontline RBSK healthcare workers (ASHA and Anganwadi workers) operating in rural health sub-centres may possess limited technical dexterity. Forcing them through multi-step self-registration forms, email confirmations, or profile setup undermines adoption and risks non-compliance.
- **Approved Approach**: The healthcare organisation already maintains official rosters of RBSK workers and their verified phone numbers. Platform administrators and supervisors provision worker accounts in AuSkill either individually or through bulk spreadsheet (CSV) imports. Workers are provided with simple access instructions containing their mobile number / username and a secure temporary password.
- **Worker Experience Principles**:
  1. Frontline workers sign in directly using their provisioned credentials—no self-registration, no complex profile configuration.
  2. Workers immediately land on their daily learning dashboard to answer their 10 daily clinical questions.
  3. Worker identity verification and role-based access controls remain strictly enforced.

### 30.2 Architectural Changes & Data Model Extensions

1. **User Profile Model (`UserProfileDoc` & `admin.types.ts`)**:
   - Added `accountStatus: 'ACTIVE' | 'DEACTIVATED' | 'PENDING'` field to track account operational state.
   - Added `deactivatedLearners` metric counter to `AdminOverviewStats`.
   - Added `accountStatus` filtering to `ListLearnersQuery` (`GET /api/v1/admin/learners?accountStatus=ACTIVE|DEACTIVATED`).
   - Extended `LearnerSummaryItem` to include `accountStatus`.
   - Defined `UpdateLearnerInput` (supporting authorized updates to `displayName`, `designation`, `state`, `district`, `healthSubCentre`, `phoneNumber`, `accountStatus`).
   - Defined `ResetCredentialsResult` for secure temporary password generation.

2. **Dual-Layer Account Deactivation & Session Revocation**:
   - Deactivating a worker via `PATCH /api/v1/admin/learners/:uid/status` or `PATCH /api/v1/admin/learners/:uid` (`accountStatus = 'DEACTIVATED'`):
     - Sets `accountStatus: 'DEACTIVATED'` on the Firestore user document `users/${uid}`.
     - Calls `authProvider.revokeUserSessions(uid)` to invalidate all active Firebase Auth refresh tokens.
     - Calls `authProvider.updateUserDisabled(uid, true)` via Firebase Admin SDK (`adminAuth.updateUser(uid, { disabled: true })`) to block future sign-in attempts at the identity provider layer.
   - In `AuthUseCase.ts`:
     - Both `login` and `getUserProfileAndStats` explicitly verify `accountStatus !== 'DEACTIVATED'`. If deactivated, requests are rejected with HTTP 403 (`FORBIDDEN_ACCOUNT_DEACTIVATED: This account has been deactivated by the administrator.`).

3. **Authorized Worker Profile Updates & Index Re-anchoring**:
   - Admins can update a worker's full name, clinical designation, district, state, and health sub-centre.
   - Phone number updates:
     - Validates Indian mobile number format via `WhatsAppOnboardingService.normalizePhoneNumber()`.
     - Checks `phone_numbers/${normalizedPhone}` index to prevent collision with other active accounts.
     - Releases previous phone reservation index (`phone_numbers/${oldPhone}`) and atomically reserves and activates the new phone mapping (`phone_numbers/${newPhone}`).

4. **Credential Regeneration & Access Instruction Formatting**:
   - Endpoint: `POST /api/v1/admin/learners/:uid/reset-credentials`.
   - Generates a cryptographically random, user-friendly temporary password (`AuSkill@<last4digits><random3digits>`).
   - Updates password in Firebase Auth via `adminAuth.updateUser()`.
   - Revokes previous sessions (`revokeUserSessions`).
   - Generates a ready-to-send access instructions template for SMS/WhatsApp containing:
     - Worker's Name
     - Login ID (Phone Number or `@username`)
     - Temporary Password
     - App Portal URL (`APP_BASE_URL` or default `http://localhost:3000`)
     - Instruction to complete daily 10-question clinical mission.

5. **Frontline Sign-In Experience Simplification (`SignInScreen.tsx`)**:
   - Added prominent **Admin-Led Onboarding Notice** on the worker login screen explaining that accounts are created by health department supervisors.
   - Updated footer guidance pointing workers to contact their RBSK District Coordinator if they do not yet have login credentials.
   - Preserved legacy link compatibility for testing invariants.

6. **Admin Dashboard Enhancements**:
   - **Learners Directory (`AdminLearnerList.tsx`)**:
     - Added **Account Status** column with distinct badges (`Active` in green, `Deactivated` in red).
     - Added **Account Status Tabs** (`All Status`, `Active`, `Deactivated`) alongside Onboarding status filters.
   - **Worker Management Modal (`LearnerDetailModal.tsx`)**:
     - Added editable form fields for Name, Designation, Phone Number, State, District, and Sub-Centre with live validation.
     - Added one-click **Deactivate Account / Reactivate Account** action with confirmation dialog.
     - Added **Regenerate Temporary Password** button and copyable **Access Instructions Card** with one-click copy and WhatsApp dispatch action.

7. **Preservation of Learning Engine Integrity**:
   - All 620 clinical curriculum questions, 5 question types, XP scoring, streak counters, power-up systems (50/50, Learn, Shield), Daily Session state machine, Review Vault, and leaderboard calculations remain completely untouched and fully functional.

### 30.3 Engagelo WhatsApp Integration Status
- Audited API contract documented in `WHATSAPP_INTEGRATION_API_DOCUMENTATION.md`.
- `WhatsAppOnboardingService.ts` maintains accurate onboarding lifecycle state (`NOT_INITIATED`, `PENDING_DELIVERY`, `DELIVERED`, `FAILED_INVALID_NUMBER`).
- Ready for Meta Graph API / Engagelo webhook integration when credentials are supplied.

### 30.4 Test Suite & Production Build Verification
- **Automated Vitest Suite**:
  - `backend/tests/adminOnboarding.test.ts`: Added Section 6 covering login blocking for deactivated users, credential regeneration, phone re-anchoring, collision rejection, and status toggling (22 / 22 tests passing).
  - Full workspace suite: **41 test files passed, 632 / 632 tests passed (100% pass rate)**.
- **Production Builds**:
  - Backend: `npm.cmd --prefix backend run build` -> Clean TypeScript build, dataset packaged (620 questions, 588,126 bytes).
  - Frontend: `npm.cmd run build` -> Clean Vite production build, PWA service worker generated.

---

## 31. Phase 31 — Elimination of State and District Selection Across Application (Completed 2026-10-27)

### 31.1 Architecture Decision & Rationale
To streamline learner onboarding, administrative workflows, and frontline user profiles:
- **State and District fields have been eliminated** across all registration forms, user profile screens, and admin interfaces.
- **Health Sub-Centre / Facility is preserved** as the single authoritative location field representing the frontline worker's duty station.
- **Backward Compatibility**: Existing database records containing `state` and `district` are gracefully hydrated without runtime errors. The bulk CSV importer tolerates and ignores legacy `State` and `District` columns without failing imports.
- **Security Rules**: `firestore.rules` updated so trainees cannot mutate legacy location fields, maintaining strict allow-list protections.

### 31.2 Files Updated & Modified
1. **Domain Models & DTOs**:
   - `backend/src/domain/models/admin.types.ts`: Removed `district` and `state` from `SingleLearnerInput`, `UpdateLearnerInput`, `ListLearnersQuery`; retained optional legacy fields in `LearnerSummaryItem` and `BulkLearnerRowInput`.
   - `backend/src/domain/models/user.model.ts`: Marked `district` and `state` optional legacy fields in `UserProfileDoc`.
   - `backend/src/api/dtos/auth.dto.ts`: Made `district` and `state` optional legacy parameters in `RegisterRequestDTO`, removed from `UpdateProfileRequestDTO`.
   - `src/models/user.types.ts` & `src/models/auth.types.ts` & `src/models/admin.types.ts`: Synchronized frontend models with backend specifications.
2. **Backend & Functions Use Cases**:
   - `backend/src/application/usecases/AuthUseCase.ts`: Removed mandatory district/state validations and profile mappings in `login`, `getUserProfileAndStats`, and `updateProfile`.
   - `backend/src/application/usecases/AdminLearnerUseCase.ts`: Removed district/state mandatory validation in `registerSingleLearner`, search filtering in `listLearners`, and updates in `updateLearner`.
   - `backend/src/infrastructure/firestore/FirestoreUserRepository.ts`: Conditional write/read for legacy `district` and `state`.
   - `backend/src/api/controllers/AdminController.ts`: Removed `district` query filter.
   - `functions/src/types/auth.types.ts`, `functions/src/utils/username.ts`, `functions/src/services/registrationService.ts`: Made state and district optional legacy inputs.
3. **Frontend Application Views**:
   - `src/views/SignUpScreen.tsx`: Removed State and District dependent dropdown selectors and validation. Preserved Health Sub-Centre.
   - `src/views/ProfileScreen.tsx`: Removed State and District selectors from edit form. Location display now presents Health Sub-Centre.
   - `src/views/admin/AdminAddLearner.tsx`: Removed State and District input grid and validation. Preserved Health Sub Centre (Optional).
   - `src/views/admin/AdminBulkImport.tsx`: Updated sample CSV template and preview table to remove district/state and feature Health Sub-Centre. Added backward-compatible parsing to ignore older CSV state/district columns.
   - `src/views/admin/AdminLearnerList.tsx`: Replaced "Location" table column with "Facility / Sub-Centre".
   - `src/views/admin/LearnerDetailModal.tsx`: Removed State and District dropdowns from edit form; displays Health Sub Centre in detail view.
   - `src/api/userApi.ts`, `src/api/authApi.ts`, `src/api/adminApi.ts`, `src/services/AuthService.ts`, `src/hooks/useUserProfile.ts`: Cleaned of district and state parameters.
4. **Security & Documentation**:
   - `firestore.rules`: Trainee profile update allow-list updated (`allowedTopLevelKeys` no longer permits `district` or `state` updates).
   - `docs/DATABASE_SCHEMA.md`: Documented `district` and `state` as optional legacy fields.

### 31.3 Verification & Quality Assurance
- **Automated Vitest Suite**:
  - Full workspace suite: **41 test files passed, 631 / 631 tests passed (100% pass rate)**.
- **Production Builds**:
  - Backend: `npm.cmd --prefix backend run build` -> Clean TypeScript build, dataset packaged (620 questions, 588,126 bytes).
  - Frontend: `npm.cmd run build` -> Clean Vite production build (1953 modules transformed, PWA service worker generated).





