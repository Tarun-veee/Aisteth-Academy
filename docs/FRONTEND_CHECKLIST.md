# Master Frontend Checklist — AiSteth Academy

> **CANONICAL PROJECT CONTROL DOCUMENT**
> This document is the single source of truth for the entire frontend implementation state of AiSteth Academy.
> 
> **Status Conventions:**
> - `[x]` = Implemented AND verified with automated tests / manual checks
> - `[~]` = Implemented but verification is still pending
> - `[ ]` = Not implemented (planned or deferred)

---

## 1. Frontend Foundation

### Core Setup
- [x] **React 18.3 & TypeScript 5.7**: Strict type system across models, views, repositories, and services (`src/`).
- [x] **Vite 6.4 Build Toolchain**: Fast HMR and optimized production bundle (`vite.config.ts`).
- [x] **Tailwind CSS 3.4**: Clean clinical design tokens, HSL custom palette, and typography utilities (`tailwind.config.js`, `src/styles/index.css`).
- [x] **Progressive Web App (PWA) Setup**: Service worker precaching, offline manifest, and installability (`vite-plugin-pwa`, `dist/sw.js`).
- [x] **Mobile-First Architecture**: 3-tier bounded mobile shell (`h-dvh max-h-dvh overflow-hidden`) preventing artificial document scrolling (`src/layouts/MobileContainer.tsx`).
- [x] **Reusable Component System**: Accessible UI primitives (`Card`, `Button`, `Badge`, `Header`, `ProgressBar`) in `src/components/common/`.
- [x] **IndexedDB Local Persistence**: Offline-first structured storage (`idb`) managing stores for `session_records`, `user_stats`, `user_profile`, and `daily_sessions` with localStorage fallbacks (`src/repositories/StorageRepository.ts`).
- [x] **Offline-First Structure**: Zero mandatory network dependencies for daily training, session review, power-up calculation, or profile state.
- [x] **Bounded Mobile Viewport Architecture**: Fixed header/footer bounds with scrollable internal question and sheet containers.
- [x] **Responsive Layouts**: Contract-tested and verified across standard mobile viewports (**360×800**, **375×812**, **390×844**, **412×915**).

---

## 2. Authentication UI

### Sign In
- [x] **Sign In Screen**: Mobile-first login screen with official branding (`src/views/SignInScreen.tsx`).
- [x] **Email / Phone Identifier**: Dual-format input accepting standard email addresses or 10-digit mobile numbers with optional `+91` prefix.
- [x] **Password Field**: Minimum 6-character validation.
- [x] **Show / Hide Password**: Interactive toggle with dynamic `Eye` / `EyeOff` icons and accessible `aria-label`.
- [x] **Form Validation**: Reactive button enabling based on identifier and password validity.
- [x] **Loading State**: Animated `<Loader2>` spinner during authentication attempts.
- [x] **Error State**: Accessible red alert banner (`role="alert"`) for invalid credentials or connection errors.
- [x] **Success State**: Transitions directly to `HOME` dashboard upon successful authentication.
- [x] **Protected Navigation**: Unauthenticated users cannot access protected application routes (`src/App.tsx`).

### Sign Up
- [x] **Sign Up Screen**: Registration screen with natural mobile scrolling (`src/views/SignUpScreen.tsx`).
- [x] **Full Name**: Minimum 2-character validation.
- [x] **Role Dropdown**: Supported roles selector (`ASHA_WORKER`, `ANGANWADI_WORKER`, `HEALTH_VOLUNTEER`).
- [x] **Health Centre / Sub-Centre**: Sub-centre text input with clinical icon.
- [x] **State Dropdown**: Dropdown selector covering all 36 Indian States and Union Territories (`src/data/indiaLocations.ts`).
- [x] **District Dropdown**: Dependent dropdown dynamically populated based on selected State.
- [x] **Dependent State → District Behavior**: State change automatically clears and resets previously selected District (`src/views/SignUpScreen.tsx`).
- [x] **Email / Phone**: Identifier input with format verification.
- [x] **Password**: Password creation with visibility toggle.
- [x] **Confirm Password**: Password confirmation with live mismatch detection.
- [x] **Validation**: Disabled submit action until all required fields are valid.
- [x] **Sign Up Success Flow**: Automatically persists new `UserProfile` to IndexedDB, creates session, and transitions to `HOME`.

### Forgot Password
- [x] **Forgot Password Screen**: Standalone recovery interface with header back arrow (`src/views/ForgotPasswordScreen.tsx`).
- [x] **Identifier Validation**: Email/phone format verification.
- [x] **Recovery Confirmation State**: Honest prototype notice explaining that cloud email dispatch will connect to Firebase in Phase 3.
- [x] **Return to Sign In**: Quick navigation link returning to login screen.

### Demo & Prototype Authentication
- [x] **Frontend Demo Account**: Prototype session handling in `src/services/AuthService.ts`.
- [x] **Demo Login Credentials**: Allows immediate demonstration login.
- [x] **Demo Profile Initialization**: Default trainee profile (`dev-user-01`).
- [x] **Demo Session Persistence**: Session stored in `localStorage` (`aisteth_auth_session`) with in-memory test fallbacks.
- [x] **Demo Sign Out**: Clears auth session while preserving local IndexedDB training records.
- [x] **Demo Account Test Coverage**: Verified in `tests/AuthAndBrandingFlow.test.ts`.
- [ ] **Production Auth Migration**: Replace frontend mock auth with Firebase Authentication when backend phase begins.

---

## 3. Company Branding

- [x] **Official AiSteth Logo**: Official company asset (`aisteth_logo.png`) stored in `public/assets/images/` and `src/assets/`.
- [x] **Sign In Logo**: Prominent 80×80px official logo mark at top of card.
- [x] **Sign Up Logo**: Prominent 64×64px official logo mark.
- [x] **Forgot Password Logo**: Prominent 64×64px official logo mark.
- [x] **Application Header Logo**: Compact official logo icon (`w-5 h-5`) beside "AiSteth Academy" title (`src/components/common/Header.tsx`).
- [x] **Favicon**: Official logo configured in `index.html` (`<link rel="icon" type="image/png" href="/assets/images/aisteth_logo.png" />`).
- [x] **PWA Branding**: Configured in `vite.config.ts`.
- [x] **Correct Aspect Ratio**: Preserved 1:1 square ratio without distortion or clipping.
- [x] **No Distorted / Cropped Logo**: Clean object-contain rendering.
- [x] **Appropriate Logo Spacing**: Consistent padding and margin across all screens.

---

## 4. Home Screen

- [x] **Greeting**: Trainee greeting with date and Level/XP badge (`src/views/HomeScreen.tsx`).
- [x] **Today's Training**: Primary mission card displaying daily session progress and difficulty breakdown.
- [x] **Daily Session State**: Dynamic 4-state lifecycle (`NOT_STARTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `QUESTIONS_COMPLETED` $\rightarrow$ `REVIEW_VIEWED`).
- [x] **Continue Training State**: Mid-session resumption button ("CONTINUE TODAY'S TRAINING").
- [x] **Session Review State**: Post-session review call to action ("VIEW SESSION REVIEW").
- [x] **Today's Training Complete State**: Locked completion state ("TODAY'S TRAINING COMPLETE") preventing multiple daily sessions.
- [x] **Streak Display**: Header status indicator (`🔥 Streak`).
- [x] **Learning Points Display**: Header status indicator (`⚡ Points`).
- [x] **Compact Power-Ups Access**: Dedicated header action button (`✨ Power-Ups`) routing directly to `PowerUpsScreen`.
- [x] **Compact Profile Access**: Dedicated header action button (`👤 Profile`) routing directly to `ProfileScreen`.
- [x] **Loading State**: Animated skeleton loader preventing layout shifts.
- [x] **Empty / Error Handling**: Error banner with retry trigger (`onRetry`).
- [x] **Mobile Responsive Layout**: Compact vertical hierarchy fitting standard mobile screens.
- [x] **Removed Redundant Large Cards**: Removed duplicate Level/XP card and redundant module cards from Home.
- [x] **Clear Primary Call To Action**: Prominent $\ge 48\text{px}$ primary action button.

---

## 5. Daily Training

### Question Types
- [x] **Multiple Choice Question (MCQ)**: Single-select 4-choice clinical questions with letter badges (`src/components/questions/MCQRenderer.tsx`).
- [x] **True / False**: Binary clinical decision cards with large tactile buttons (`src/components/questions/TrueFalseRenderer.tsx`).
- [x] **Image-Tap Simulation**: Interactive anatomical landmark tapping on chest diagram (`chest_auscultation_points.svg`) with pixel-to-percentage coordinate mapping (`src/components/questions/ImageTapRenderer.tsx`).
- [x] **Audio Discrimination**: Auscultation sound comparison with single-active-audio playback enforcement and acoustic wave controls (`src/components/questions/AudioDiscriminationRenderer.tsx`).
- [x] **Practical Step-Order Simulation**: Tactile chronological ordering of clinical procedural steps with Up/Down controls (`src/components/questions/StepOrderRenderer.tsx`).

### Question Interaction
- [x] **Answer Selection**: Reactive payload dispatch to `useLearningSession.ts`.
- [x] **Submit Validation**: `AnswerEvaluator.isValidAnswer()` gates submission.
- [x] **Submit Disabled When Unanswered**: Check Answer button disabled until valid selection is made.
- [x] **Unanswered State**: Missing input recorded defensively as `UNANSWERED` without XP penalty (`src/services/AnswerEvaluator.ts`).
- [x] **Correct State**: Green indicator with positive reinforcement.
- [x] **Incorrect State**: Rose indicator with clinical explanation.
- [x] **Correct Feedback**: Instant audio/visual feedback in bottom sheet.
- [x] **Incorrect Feedback**: Clinical explanation with key learning takeaway.
- [x] **Experience Points Behavior**: +15 XP awarded on correct answers.

### Mobile Experience
- [x] **Question Scrolling**: Independent scroll container (`flex-1 min-h-0 overflow-y-auto overscroll-contain`).
- [x] **Bottom Action Footer**: Pinned safe-area action footer above device navigation bar.
- [x] **Safe-Area Handling**: `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- [x] **No Unwanted Page Scrolling**: Shell locked to `100dvh`.

### Deferred Question Features
- [ ] **Adaptive Questionnaire**: Dynamic difficulty branching (Deferred to Phase 3).
- [ ] **Version 1 / Version 2 Logic**: Simpler follow-up question pairing (Deferred to Phase 3).
- [ ] **Follow_Up_For Logic**: Remedial question targeting (Deferred to Phase 3).
- [ ] **Leitner Scheduling**: Spaced repetition algorithm (Deferred to Phase 3).
- [ ] **Machine Learning Logic**: ML-based question selection model (Deferred to Phase 3).

---

## 6. Feedback System

- [x] **Feedback Bottom Sheet**: 2-state docked drawer (`COLLAPSED` $\rightarrow$ `EXPANDED`) sharing viewport with question (`src/components/feedback/FeedbackDrawer.tsx`).
- [x] **Collapsed State**: Compact 130px banner showing result, XP, and Continue action.
- [x] **Expanded State**: Max 48dvh panel displaying full micro-learning clinical clue.
- [x] **Drag Handle**: Tactile pill handle with smooth touch/mouse gesture tracking.
- [x] **Swipe Up to Expand**: Touch drag gesture expands sheet smoothly (`src/hooks/useBottomSheetGesture.ts`).
- [x] **Swipe Down to Collapse**: Touch drag gesture collapses sheet smoothly.
- [x] **Internal Scrolling**: Content scrolls internally when expanded without triggering page scroll.
- [x] **Gesture / Scroll Conflict Handling**: Gesture listeners yield to native scrolling when expanded.
- [x] **Safe-Area Handling**: Bottom continue button elevated above system home indicators.
- [x] **Mobile Verification**: Tested and contract-verified in `tests/MobileLayoutAndResponsiveness.test.ts`.

---

## 7. Session Review

- [x] **Ten-Question Completion**: Automatically navigates to Session Review upon finishing Q10 (`src/views/QuestionReviewScreen.tsx`).
- [x] **Session Review Screen**: Comprehensive breakdown of today's 10 clinical questions.
- [x] **Correct / Incorrect Summary**: Badges differentiating `CORRECT`, `INCORRECT` (Needs Review), and `UNANSWERED`.
- [x] **Done Action**: "COMPLETE & RETURN HOME" action.
- [x] **Return to Home**: Updates daily state and navigates back to Home.
- [x] **One-Time Review State**: Review accessible once per daily cycle.
- [x] **Same-Day Session Lock**: Locks today's session into `TODAY'S TRAINING COMPLETE`.
- [x] **Review Persistence**: Persisted in IndexedDB `daily_sessions` store.
- [x] **Today's Training Complete State**: Prevents re-attempting or re-entering completed daily mission.

---

## 8. Power-Ups

### Dedicated Power-Ups Screen
- [x] **Dedicated Power-Ups Screen**: Standalone view (`src/views/PowerUpsScreen.tsx`) with `← Power-Ups` header.
- [x] **Back Navigation**: Returns cleanly to origin screen (`HomeScreen`).
- [x] **💡 Hint Card**: "Get help with a question by removing 2 wrong options".
- [x] **📖 Learn Card**: "See a helpful learning clue before answering".
- [x] **↩ Retry Card**: "Try an incorrect question again".
- [x] **🛡 Streak Shield Card**: "Protect your learning streak if you miss a day".
- [x] **Locked / Unlocked / Used States**: Operational badges (`✓ Available`, `✓ Used`, `🔒 Locked`) without fractional math equations.
- [x] **Persistence**: Synced with `StorageRepository` and `PowerUpService.ts`.

### Unlock Rules
- [x] **HINT**: Unlocks at **50 correct answers** (`totalCorrectAnswersCount >= 50`).
- [x] **LEARN**: Unlocks at **100 answered questions** (`completedQuestionsCount >= 100`).
- [x] **RETRY**: Unlocks at **20-day streak** (`currentStreak >= 20`).
- [x] **STREAK SHIELD**: Unlocks at **30-day streak** (`currentStreak >= 30`).

### In-Session Behaviors
- [x] **HINT Elimination**: Eliminates exactly 2 incorrect options on MCQs while strictly preserving the correct answer (`src/views/DailySessionScreen.tsx`).
- [x] **Correct Option Preservation**: Correct answer is never eliminated by Hint.
- [x] **LEARN Objective**: Displays clinical learning objective before answering without spoiling the answer.
- [x] **RETRY Re-Attempt**: Allows immediate retry on incorrect answers directly inside the feedback drawer without incrementing session question count beyond 10.
- [x] **STREAK SHIELD Protection**: Automatically consumes shield to forgive 1 missed calendar day and protect daily streak (`src/repositories/StorageRepository.ts`).

---

## 9. Profile Screen

- [x] **Profile Screen**: Simple personal learning page designed for frontline health workers (`src/views/ProfileScreen.tsx`).
- [x] **Trainee Information**: Name, Role badge (`ASHA Health Worker`), Health Sub-Centre, District, and State.
- [x] **Single Edit Profile Action**: Clean `Edit Profile →` button located inside the Profile Card.
- [x] **Inline Edit Modal**: Dropdown selectors for Role, State, and dependent District (`src/data/indiaLocations.ts`).
- [x] **Sign Out**: Clean `🚪 Sign Out` card (*"Keep your training progress saved"*) routing back to Sign In while preserving IndexedDB records.
- [x] **Back Navigation**: `← My Profile` returns to origin screen.
- [x] **My Learning Grid**: 3 compact stat tiles (`🔥 Streak`, `⚡ Points`, `📚 Lessons`).
- [x] **No Duplicate Edit Profile**: Redundant second Edit Profile row removed from Account section.
- [x] **No Duplicate Power-Ups Section**: Power-Ups moved to dedicated screen.
- [x] **No Unnecessary Crowded Elements**: Core Competencies and technical analytics removed from learner-facing view.
- [x] **Single-Viewport Mobile Fit**: Natural ~540px height fitting within 360×800 to 412×915 without page scrolling.

---

## 10. Gamification

- [x] **Experience Points (XP)**: +15 XP on correct answers, +10 XP on retry, tracked in `user_stats`.
- [x] **Streak System**: Daily streak incrementation based on local calendar date (`YYYY-MM-DD`).
- [x] **Level System**: Progression curves in `ProgressionService.ts`.
- [x] **Power-Up Unlock System**: Real-time deterministic calculation in `PowerUpService.ts`.
- [x] **Power-Up Persistence**: Cumulative statistics persisted in IndexedDB.
- [x] **Streak Protection**: Automatic Streak Shield consumption logic.
- [ ] **Final Level Names & XP Curves**: Align level titles and XP thresholds with clinical curriculum (Phase 2/3).

---

## 11. Audio System

- [x] **Audio Question Framework**: Multi-track auscultation player (`src/components/questions/AudioDiscriminationRenderer.tsx`).
- [x] **Audio Playback**: Web Audio / HTML5 audio playback with play/pause wave toggles.
- [x] **Audio Replay**: Unlimited replay during question evaluation.
- [~] **Single Active Audio Enforcement**: Prevents simultaneous playback of multiple recordings.
- [ ] **Audio Waveform Visualization**: Visual waveform animation during playback.
- [ ] **Buffering State**: Loading spinner for slow network audio loading.
- [ ] **Audio Fallback**: Textual sound descriptions for offline/unsupported audio devices.
- [ ] **Audio Accessibility Review**: Volume and transcript accessibility audit.

---

## 12. Accessibility (a11y)

- [x] **Interactive Targets**: Minimum **48×48px** interactive touch bounds across buttons, inputs, and options.
- [x] **Accessible Labels**: Descriptive `aria-label` attributes on header actions (`aria-label="Power-Ups"`, `aria-label="My Profile"`, etc.).
- [x] **Visible Focus States**: `focus-visible:ring-2` focus rings for keyboard navigation.
- [x] **Semantic HTML**: Appropriate `<header>`, `<main>`, `<button>`, `<select>`, `<input>`, and `<label>` elements.
- [x] **Form Labels**: Explicit `<label htmlFor="...">` bindings on all form inputs.
- [x] **Error Announcements**: Semantic `role="alert"` on authentication error banners.
- [x] **Password Toggle Accessibility**: Dynamic `aria-label="Show password"` / `aria-label="Hide password"`.
- [x] **Logo Alt Text**: Explicit `alt="AiSteth Official Logo"` on company branding.
- [ ] **Full Screen-Reader Audit**: End-to-end screen-reader testing (NVDA / TalkBack).
- [ ] **Color Contrast Verification**: WCAG 2.1 AA automated contrast scan.

---

## 13. Responsive Design

- [x] **360×800 Baseline**: Budget Android devices (Redmi, Samsung Galaxy A).
- [x] **375×812 Baseline**: Compact iOS (iPhone X/11/12 Mini).
- [x] **390×844 Baseline**: Standard mobile (iPhone 12/13/14/15).
- [x] **412×915 Baseline**: Tall Android (Google Pixel, Galaxy S21/S22/S23).
- [x] **Zero Horizontal Overflow**: Bounded container with responsive max-width.
- [x] **Mobile-First Layouts**: Optimized touch padding and spacing.
- [x] **Safe-Area Inset Handling**: Padding for device notches and home bars.
- [x] **Responsive Authentication Forms**: Natural scrolling without button clipping or keyboard overlap.

---

## 14. Website Launch & Production Readiness

### Security
- [x] **No Secrets in Frontend**: Zero API keys or hardcoded cloud credentials.
- [ ] **Production Environment Variables**: Final `.env.production` configuration.
- [ ] **HTTPS Enforced**: Enforced via production web server / hosting.

### Legal / Privacy
- [ ] **Privacy Policy Page / Modal**: Compliance with health data privacy guidelines.
- [ ] **Terms & Conditions**: Clinical training terms of use.
- [ ] **Local Data Storage Disclosure**: Notice informing users that progress is saved locally on device.

### Metadata & SEO
- [x] **Meta Title**: `<title>AiSteth Academy</title>`
- [x] **Meta Description**: Educational description for ASHA health workers in `index.html`.
- [x] **Favicon**: Official logo icon configured in `index.html`.
- [x] **Web Manifest Metadata**: PWA manifest with theme color (`#2563EB`) and standalone display mode.
- [ ] **Social Preview Image (Open Graph)**: `og:image` asset for social link sharing.
- [ ] **robots.txt & sitemap.xml**: SEO crawlers setup if public indexing is desired.

### Images & Assets
- [x] **Logo Optimized**: Official PNG and SVG assets loaded cleanly.
- [x] **Alt Text on Meaningful Images**: All anatomical diagrams and logos have descriptive alt attributes.
- [ ] **Asset Compression Review**: Compress high-bitrate stethoscope MP3/WAV files for optimal PWA caching.
- [ ] **Unused Asset Purge**: Audit and remove any unreferenced demo images.

### Performance
- [x] **Fast Initial Load**: Vite bundle with gzip size < 85 KB.
- [x] **PWA Service Worker Precache**: 11 entries precached (335.99 KiB).
- [ ] **Lighthouse Performance Audit**: Achieve $\ge 90$ scores across Performance, Accessibility, Best Practices, and PWA.

### Navigation Integrity
- [x] **Zero Dead Buttons**: Every header icon, menu item, and card action has a verified destination.
- [x] **One Action = One Destination**: Header actions cleanly separated (`✨ Power-Ups`, `👤 Profile`).
- [x] **Protected Route Behavior**: Unauthenticated users cannot bypass login screen.
- [ ] **Custom 404 View**: Fallback view for unrecognized state routes.

---

## 15. Final Frontend QA & Verification Status

- [x] **Sign In Flow**: Validated with email/phone formats.
- [x] **Sign Up Flow**: Validated with Role, State, dependent District, and password match.
- [x] **Forgot Password Flow**: Validated with recovery confirmation.
- [x] **Protected App Entry**: Validated in `App.tsx`.
- [x] **Home Dashboard**: Validated daily mission lifecycle.
- [x] **Daily Session Runner**: Validated question progression and scoring across all 5 question types.
- [x] **Feedback Bottom Sheet**: Validated swipe gestures and clue expansion.
- [x] **Session Review & Lock**: Validated 10-question completion and single-session daily lock.
- [x] **Power-Ups Screen**: Validated real unlock state and in-session tools (Hint, Learn, Retry, Shield).
- [x] **Profile Screen**: Validated single Edit Profile, location dropdowns, and Sign Out.
- [x] **Automated Test Suite**: **110/110 tests passing** across 11 test suites (`npm test`).
- [x] **Production Bundle Build**: Clean TypeScript compile and Vite PWA build (`npm run build`).

---

## 16. Documentation History

- [x] **`walkthrough.md`**: Detailed chronological history of all Changes 01 to 23.
- [x] **`PROJECT_LOG.md`**: Complete architectural log, decision records, bug history, and Entries 01 to 20.
- [x] **`docs/FRONTEND_CHECKLIST.md`**: Single canonical master frontend checklist established.
