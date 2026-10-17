# FRONTEND_BACKEND_ARCHITECTURE_COMPLIANCE_AUDIT.md
# Comprehensive Frontend, Backend & Architecture Rules Audit — AiSteth Academy

**Date**: 2026-10-09  
**Auditor**: Lead System & Security Architecture Reviewer  
**Repository**: `c:\Users\I Health Highway\Downloads\TARUN PROJECT\acad`  
**Target Environment**: AiSteth Academy Frontline Healthcare Training Platform  
**Audit Scope**: Read-Only Comprehensive Architecture, Security, API, and Learning Engine Audit  

---

## 1. Executive Summary

This independent, comprehensive, read-only architectural audit evaluated the AiSteth Academy codebase across frontend, backend, security, API integration, data persistence, and learning engine subsystems.

### Key Audit Highlights
1. **Layered Decoupling & Firebase SDK Eradication (PASS)**:
   - The React frontend has **zero** direct client-side dependencies on Firebase SDKs (`firebase/app`, `firebase/auth`, `firebase/firestore`). Root `package.json` contains zero Firebase packages.
   - The Node.js + Express backend (`backend/`) establishes clear physical boundaries across API Controllers, Application Use Cases, Pure Domain Rules, and Infrastructure Repositories/Adapters.
   - The Firebase Admin SDK and Google Identity Toolkit REST APIs are strictly isolated within `backend/src/infrastructure/`.
2. **Token & Session Lifecycle (PASS WITH LOW OBSERVATION)**:
   - Access tokens are stored strictly in memory (`inMemoryAccessToken` in `src/api/client.ts`).
   - Refresh tokens are transported via `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth` cookies.
   - In-flight 401 token refresh queueing is verified to serialize concurrent requests into exactly one refresh call.
   - A minor test-harness fallback in `src/services/AuthService.ts` (lines 215, 310) serializes mock tokens to `localStorage` during offline Vitest runs, though production online paths strictly sanitize tokens.
3. **Critical Authorization & Authority Deficits (HIGH FINDINGS)**:
   - **Client-Authoritative Scoring & XP**: The frontend evaluates answers and dictates the final session XP and correct count to `POST /api/v1/sessions/today/finalize`. The backend accepts `totalXpEarned` and increments persistent user XP without verifying attempt history in Firestore.
   - **Unfiltered Profile Mutation (`PATCH /api/v1/users/me`)**: The backend repository strips immutable identity fields (`uid`, `role`, `organizationId`, etc.) but fails to strip `learningState`, allowing trainees to overwrite their own XP and level.
   - **Overly Permissive CORS Configuration**: `backend/src/app.ts` contains a development fallback allowing any origin when credentials are included (`credentials: true`), presenting cross-site request forgery and data access exposure in deployed environments.
4. **Learning Engine Gap Analysis (ARCHITECTURAL REORIENTATION REQUIRED)**:
   - The current codebase implements the legacy **Phase 2 Day-Parity Model** (alternating 10 Primary questions on even days and 10 Follow-Up questions on odd days).
   - **None** of the newly approved simplified Learning Engine requirements are currently implemented:
     - No dynamic Main $\rightarrow$ Follow-Up runtime branching upon incorrect answers.
     - No Unsolved Question Bucket repository or persistence.
     - No single overall XP leaderboard calculation.
     - No 31-level / 310-XP progression scale (codebase retains a provisional 5-level / 1,000+ XP curve).
     - No daily reminder scheduling or WhatsApp integration.
   - The question ingestion pipeline (`AI_limitation.json` contains `Question_Type` and `Follow_Up_For`) currently drops follow-up relationships when questions are mapped into Firestore and domain models.
5. **Quality & Test Baseline**:
   - Root Vitest Suite: **211 passed / 211 total** across 17 test files.
   - Backend Vitest Suite: **23 passed / 23 total** across 2 test files.
   - Total Workspace Tests: **234 passed / 234 total** (0 failures).
   - Type Safety: 0 TypeScript errors across frontend (`tsc --noEmit`) and backend (`tsc`).
   - Production Build: Generated cleanly in 1.77s (`dist/`) and `backend/dist/`.

---

## 2. Actual Repository Baseline

### 2.1 Git Repository State
- **Active Branch**: `main`
- **Head Commit Hash**: `8d645afa85db385e0c87d44a9a6af993002167a1`
- **Pre-Existing Modified Tracked Files**:
  - `PROJECT_LOG.md`, `index.html`, `package.json`, `tailwind.config.js`, `vite.config.ts`
  - `src/App.tsx`, `src/styles/index.css`, `src/hooks/useBottomSheetGesture.ts`, `src/hooks/useLearningSession.ts`
  - `src/services/AuthService.ts`, `src/services/QuestionService.ts`, `src/services/SessionService.ts`
  - `src/components/audio/AudioPlayerCard.tsx`, `src/components/common/Header.tsx`, `src/components/feedback/FeedbackDrawer.tsx`
  - `src/components/questions/AudioDiscriminationRenderer.tsx`, `src/components/questions/ImageTapRenderer.tsx`, `src/components/questions/MCQRenderer.tsx`, `src/components/questions/StepOrderRenderer.tsx`
  - `src/views/DailySessionScreen.tsx`, `src/views/HomeScreen.tsx`, `src/views/PowerUpsScreen.tsx`, `src/views/ProfileScreen.tsx`, `src/views/QuestionReviewScreen.tsx`
  - `tests/MobileLayoutAndResponsiveness.test.ts`, `tests/PowerUpsScreen.test.ts`, `tests/SessionFinalizationIdempotency.test.ts`, `tests/SimplifiedProfileScreen.test.ts`
- **Pre-Existing Deleted Tracked Files** (Legacy Phase 1 Firebase SDK Clean-Up):
  - `src/services/firebase.ts`
  - `src/repositories/FirestoreQuestionRepository.ts`
- **Pre-Existing Untracked Files**:
  - `backend/` (Layered Node.js + Express backend service)
  - `src/api/` (`client.ts`, `authApi.ts`, `sessionApi.ts`, `questionApi.ts`)
  - `src/repositories/ApiQuestionRepository.ts`
  - `tests/ApiClientRefreshConcurrency.test.ts`, `tests/BackendConcurrencyAndReliability.test.ts`
  - `public/pwa-192x192.png`, `public/pwa-512x512.png`
  - Scripts: `inspect_live_hosting.js`, `live_smoke_test_runner.js`, `run_controlled_load_test.js`, `test_live_qa_powerups.js`, `update_qa_user_state.js`, `verify_reconciliation.js`

### 2.2 Directory Hierarchy
```
acad/
├── AI_limitation.json               # Canonical 20-question module dataset (Primary + Follow-Up pairs)
├── PROJECT_LOG.md                   # Permanent architectural and history log
├── firestore.rules                  # Firestore declarative security rules
├── package.json                     # Frontend dependencies & root toolchain
├── tsconfig.json                    # Frontend TypeScript configuration
├── vite.config.ts                   # Vite + PWA build configuration & API proxy
├── src/                             # React 18 frontend
│   ├── api/                         # Centralized REST API client & service contracts
│   ├── components/                  # UI presentation components
│   ├── data/                        # Static datasets (dummy questions, Indian state/districts)
│   ├── hooks/                       # Custom hooks (session runner, gestures)
│   ├── layouts/                     # Layout shells (MobileContainer)
│   ├── models/                      # Domain & DTO TypeScript interfaces
│   ├── repositories/                # Frontend repository abstractions (ApiQuestionRepo, StorageRepo)
│   ├── services/                    # Frontend services (AuthService, SessionService, QuestionService)
│   ├── styles/                      # TailwindCSS tokens & custom CSS
│   ├── utils/                       # Timezone, day-parity, username utilities
│   └── views/                       # Screen-level views (Home, DailySession, Profile, PowerUps, etc.)
├── backend/                         # Node.js + Express backend service
│   ├── package.json                 # Backend dependencies (express, cors, cookie-parser, firebase-admin)
│   ├── tsconfig.json                # NodeNext backend TypeScript configuration
│   ├── src/
│   │   ├── app.ts                   # Express application setup, CORS, middleware mounting
│   │   ├── server.ts                # HTTP server listener
│   │   ├── api/                     # Controllers, routes, auth/error middleware
│   │   ├── application/             # Use cases & DTOs (AuthUseCase, SessionUseCase, QuestionUseCase)
│   │   ├── domain/                  # Pure interfaces, models, pure business rules
│   │   └── infrastructure/          # Adapters (FirebaseAuthAdapter, Firestore Repositories, Env)
│   └── tests/                       # Backend Vitest suites (api.test.ts, authAndSession.test.ts)
└── tests/                           # Root/Frontend Vitest suites (17 test files)
```

### 2.3 Runtimes, Manifests & Build Tools
- **Node.js**: v22.10.x runtime environment.
- **Frontend Stack**: React 18.3.1, TypeScript 5.7.2, Vite 6.0.3, Vite PWA Plugin 0.21.1, TailwindCSS 3.4.17, idb 8.0.2, Lucide React 1.16.0.
- **Backend Stack**: Node.js, Express 4.21.2, TypeScript 5.7.2 (`NodeNext`), `firebase-admin` 13.1.0, `cors` 2.8.5, `cookie-parser` 1.4.7, `dotenv` 16.4.7.
- **Testing Engine**: Vitest 2.1.8 with `@testing-library/react` and `supertest` 7.0.0.

### 2.4 Documented Architecture Rules & Authority Classification
The audit assessed compliance against three formal categories of rules:
1. **Explicit Project Rules**:
   - *Rule 1.1*: Zero Firebase client SDK in `src/` (Explicitly approved in Phase 1 Architecture Plan).
   - *Rule 1.2*: In-memory access token + HttpOnly Secure SameSite=Lax refresh cookie (`Path=/api/v1/auth`) (Explicitly approved in Authentication Specification).
   - *Rule 1.3*: Single-device default logout vs global revocation via `allDevices=true` (Explicitly approved).
   - *Rule 1.4*: Domain purity: Domain layer must not import Express, Firebase, or HTTP transports (Explicitly approved).
   - *Rule 1.5*: Exactly 10 questions per daily session (Explicitly approved in Phase 2 Spark Spec).
   - *Rule 1.6*: Frozen Three-Power-Up System: 50/50, LEARN, STREAK SHIELD with HINT/RETRY removed (Approved in v2.7.0-SPARK-SPEC).
2. **Necessary Architectural Invariants**:
   - *Invariant 2.1*: Backend-authoritative XP and progression calculation: client must not dictate unverified XP to persistent storage.
   - *Invariant 2.2*: User-scoped resource isolation: trainees can only read/write their own records (`users/${uid}/...`).
   - *Invariant 2.3*: Concurrency idempotency: repeated finalization requests must not duplicate streak increments or XP rewards.
   - *Invariant 2.4*: Atomic database commits: learning state updates and session finalizations must execute within a single Firestore transaction.
3. **Recommended Practices**:
   - *Practice 3.1*: Typed domain exception classes instead of string-matching in error middleware.
   - *Practice 3.2*: Shared validation schemas (e.g. Zod) across frontend and backend DTOs.
   - *Practice 3.3*: Complete removal of fallback secret literals in configuration modules.

---

## 3. Architecture Currently Implemented

The repository currently operates in a decoupled client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                   React + Vite PWA (Frontend)               │
│  - Presentation: DailySessionScreen, HomeScreen, Profile    │
│  - State Management: useLearningSession hook, idb cache     │
│  - Transport: src/api/client.ts (fetch wrapper)             │
│  - In-Memory Access Token                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS REST / JSON
                               │ Credentials: 'include'
                               │ Authorization: Bearer <token>
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js + Express API (/api/v1)              │
│  - Controllers: AuthController, SessionController, etc.     │
│  - Middleware: authMiddleware, errorHandler, cookieParser    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer (Use Cases)              │
│  - AuthUseCase: Registration, login, profile hydration     │
│  - SessionUseCase: getOrCreateTodaySession, recordAttempt    │
│  - QuestionUseCase: getTodayQuestions, getQuestionById      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Pure Domain Layer (Entities & Rules)        │
│  - Models: UserProfileDoc, DailySessionDoc, Question        │
│  - Pure Rules: AnswerEvaluator, PowerUpService, Progression │
│  - Interfaces: IUserRepository, ISessionRepository, etc.    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                    │
│  - FirebaseAuthAdapter: Identity Toolkit v1 REST + Admin Auth│
│  - FirestoreUserRepository: Transactional username locking   │
│  - FirestoreSessionRepository: Atomic runTransaction finalize│
│  - FirestoreQuestionRepository: Cached content catalog      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Google Cloud Services                      │
│  - Cloud Firestore (Data Persistence)                       │
│  - Google Identity Toolkit / Firebase Auth                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Frontend Implementation & Compliance Audit

### A. Architectural Boundary Rules
- **REST Communication (PASS)**: All network operations in `src/services/` are routed through `src/api/authApi.ts`, `src/api/sessionApi.ts`, and `src/api/questionApi.ts`.
- **Component Separation (PASS)**: UI screens (`DailySessionScreen`, `HomeScreen`) delegate domain rules and state to `useLearningSession` and service abstractions.
- **Firebase Eradication (PASS)**:
  - `src/services/firebase.ts` and `src/repositories/FirestoreQuestionRepository.ts` have been deleted.
  - Ripgrep search across `src/` shows **0 imports** of `firebase`, `firebase/app`, `firebase/auth`, or `firebase/firestore`.
- **Infrastructure Leakage (PASS)**: No Firestore DocumentReferences or raw Firebase objects leak into the frontend components.

### B. Authentication & Session Handling
- **Token Memory Isolation (PASS)**: Access tokens are held exclusively in variable `inMemoryAccessToken` in [`src/api/client.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/api/client.ts#L10) and accessed via `getAccessToken()`. They are never written to `localStorage` or `IndexedDB` during production operations.
- **401 Interception & Concurrency Serialization (PASS)**: [`src/api/client.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/api/client.ts#L51-L115) intercepts HTTP 401, locks further requests via `isRefreshing = true`, queues subscribers, dispatches a single `POST /api/v1/auth/refresh`, drains the queue with the new access token, and retries the original requests. This behavior is verified by [`tests/ApiClientRefreshConcurrency.test.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/tests/ApiClientRefreshConcurrency.test.ts).
- **Logout Contracts (PASS)**: `AuthService.signOut(allDevices)` invokes `POST /api/v1/auth/logout?allDevices=${allDevices}`, clears the in-memory access token, and purges local storage metadata.
- **Observation (Test Fallback Mock Serialization)**: In [`src/services/AuthService.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/services/AuthService.ts#L215-L310), lines 215 and 310 write dummy `session` objects containing mock tokens to `localStorage` when running in offline Vitest environments without a live HTTP server. While harmless in production, this should be unified with lines 112, 181, and 273.

### C. UI, State, & Learning Workflow Deficits
- **Client-Authoritative XP Calculation (FAIL - P1)**:
  - In [`src/hooks/useLearningSession.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/hooks/useLearningSession.ts#L267-L270), question evaluation is executed in frontend JavaScript.
  - In lines 437–440, the frontend adds a 10 XP bonus (`SESSION_COMPLETION_BONUS`), computes `finalXp = prev.totalXpEarned + bonusXp`, and passes `finalXp` in `sessionService.finalizeSession(currentUid, prev.sessionId, finalXp, prev.correctCount, 10)`.
  - The client is authoritative for scoring and completion rewards. The backend does not recalculate or verify this number.
- **Inconsistent Rehydration Auth State (PARTIAL - P2)**:
  - In [`src/App.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/App.tsx#L37-L39), `authStatus` initializes to `'AUTHENTICATED'` if `localStorage` has metadata.
  - In lines 112–118, `rehydrateSession()` calls `/auth/refresh`. If the cookie is expired or missing, `rehydrated` resolves to `false`, but the effect does not reset `authStatus` to `'UNAUTHENTICATED'`. The UI remains in an authenticated state with an empty in-memory token until a subsequent action fails.

---

## 5. Backend Implementation & Compliance Audit

### A. Layering and Dependency Rules
- **Dependency Direction (PASS)**:
  - `Domain` imports **0 external packages** (purity confirmed).
  - `Application` depends exclusively on Domain interfaces and models.
  - `Controllers` handle transport (Express `req`/`res`) and delegate to Use Cases.
  - `Infrastructure` implements Domain repository interfaces (`IUserRepository`, `ISessionRepository`, `IQuestionRepository`, `IAuthProvider`).
- **Domain Purity (PASS)**: Zero instances of Express, Firestore, or Firebase Admin SDK inside `backend/src/domain/`.

### B. Authentication and Security Rules
- **Google Identity Toolkit Integration (PASS)**: [`backend/src/infrastructure/auth/FirebaseAuthAdapter.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/auth/FirebaseAuthAdapter.ts#L13-L47) correctly uses `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` for password login and `https://securetoken.googleapis.com/v1/token` for token refreshing.
- **Admin SDK Boundaries (PASS)**: Admin SDK is used exclusively for server-side token verification (`adminAuth.verifyIdToken`), account creation (`adminAuth.createUser`), account deletion, token revocation (`adminAuth.revokeRefreshTokens`), and password reset links.
- **Refresh Cookie Specifications (PASS)**: Set in [`backend/src/api/controllers/AuthController.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/api/controllers/AuthController.ts#L11-L17):
  - `httpOnly: true`
  - `secure: process.env.NODE_ENV === 'production'`
  - `sameSite: 'lax'`
  - `path: '/api/v1/auth'`
  - `maxAge: 30 days`
- **Permissive CORS with Credentials (FAIL - P1)**:
  - In [`backend/src/app.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/app.ts#L24-L35):
    ```typescript
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow during dev/preview
        }
      },
      credentials: true,
      ...
    }));
    ```
  - The `else` clause allows **any** origin to make credentialed requests. In production, this allows arbitrary origins to invoke credentialed endpoints if cookies are set.
- **Unsanitized Profile Mutation in `PATCH /api/v1/users/me` (FAIL - P1)**:
  - In [`backend/src/infrastructure/firestore/FirestoreUserRepository.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/firestore/FirestoreUserRepository.ts#L143-L148):
    ```typescript
    delete dataToUpdate.uid;
    delete dataToUpdate.username;
    delete dataToUpdate.role;
    delete dataToUpdate.organizationId;
    delete dataToUpdate.createdAt;
    await userRef.update(dataToUpdate);
    ```
  - `learningState` is **not deleted** or filtered. An authenticated user can submit `{ learningState: { totalXp: 999999 } }` and overwrite their learning state.
- **Embedded Fallback API Key (PARTIAL - P2)**:
  - [`backend/src/infrastructure/config/env.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/config/env.ts#L8) embeds a fallback string literal `AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA`. While this is a Firebase Web API key (publicly scoped), fallback secrets should not be checked into backend configuration files.

---

## 6. Authentication & Security Audit

| Security Control | Implementation Location | Documented Standard | Audit Finding | Severity |
| :--- | :--- | :--- | :--- | :---: |
| **Access Token Storage** | `src/api/client.ts:10` | In-memory only; no localStorage / IndexedDB | Strict in-memory compliance in production. | **PASS** |
| **Refresh Token Storage** | `backend/src/api/controllers/AuthController.ts:11` | HttpOnly, SameSite=Lax, Path=/api/v1/auth | Exact match to approved security decision. | **PASS** |
| **Password Authentication** | `backend/src/infrastructure/auth/FirebaseAuthAdapter.ts:13` | Google Identity Toolkit REST API v1 | Implemented without fictional SDK calls. | **PASS** |
| **Token Refresh** | `backend/src/infrastructure/auth/FirebaseAuthAdapter.ts:50` | Google Secure Token REST API | Implemented cleanly with grant_type=refresh_token. | **PASS** |
| **Token Verification** | `backend/src/api/middlewares/auth.middleware.ts:38` | Server-side `adminAuth.verifyIdToken` | Bearer token validated on all protected endpoints. | **PASS** |
| **Single-Device Logout** | `backend/src/api/controllers/AuthController.ts:74` | Clear cookie & in-memory token only | Cookie cleared; refresh token remains valid globally. | **PASS** |
| **Global Logout** | `backend/src/api/controllers/AuthController.ts:71` | `adminAuth.revokeRefreshTokens(uid)` | Triggered when `allDevices=true` is requested. | **PASS** |
| **CORS Policy** | `backend/src/app.ts:25` | Whitelist approved origins with credentials | Permissive fallback allows arbitrary origins with credentials. | **FAIL (P1)** |
| **Profile Mutation Guard**| `backend/src/infrastructure/firestore/FirestoreUserRepository.ts:143` | Disallow trainee updates to learning state & roles | `learningState` not stripped; allows client tampering. | **FAIL (P1)** |
| **Secret Configuration** | `backend/src/infrastructure/config/env.ts:8` | All secrets from environment variables | Fallback Web API key hardcoded in source. | **PARTIAL (P2)** |

---

## 7. API Contract Matrix

Matrix comparing frontend API invocations against backend route declarations:

| Frontend API Invocation | HTTP Method | Target Endpoint | Backend Route & Controller | Auth Required | Contract Consistency | Notes |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| `authApi.register()` | `POST` | `/api/v1/auth/register` | `authRouter.post('/register', AuthController.register)` | No | **MATCH** | Creates synthetic email & reserves username |
| `authApi.login()` | `POST` | `/api/v1/auth/login` | `authRouter.post('/login', AuthController.login)` | No | **MATCH** | Returns profile + stats; sets HttpOnly cookie |
| `authApi.refresh()` | `POST` | `/api/v1/auth/refresh` | `authRouter.post('/refresh', AuthController.refresh)` | Cookie | **MATCH** | Reads refresh cookie; returns new access token |
| `authApi.logout()` | `POST` | `/api/v1/auth/logout` | `authRouter.post('/logout', AuthController.logout)` | Optional | **MATCH** | Supports `?allDevices=true` query |
| `authApi.forgotPassword()` | `POST` | `/api/v1/auth/forgot-password` | `authRouter.post('/forgot-password', AuthController.forgotPassword)` | No | **MATCH** | Generates reset link |
| `authApi.getMe()` | `GET` | `/api/v1/users/me` | `userRouter.get('/me', UserController.getMe)` | Yes (Bearer) | **MATCH** | Returns `{ profile, stats }` |
| `authApi.updateMe()` | `PATCH` | `/api/v1/users/me` | `userRouter.patch('/me', UserController.updateMe)` | Yes (Bearer) | **MATCH** | Updates profile fields |
| `sessionApi.getTodaySession()` | `GET` | `/api/v1/sessions/today` | `sessionRouter.get('/today', SessionController.getTodaySession)` | Yes (Bearer) | **MATCH** | Supports `?date=YYYY-MM-DD` |
| `sessionApi.recordAttempt()` | `POST` | `/api/v1/sessions/today/attempts` | `sessionRouter.post('/today/attempts', SessionController.recordAttempt)` | Yes (Bearer) | **MATCH** | Appends attempt record to user subcollection |
| `sessionApi.finalizeSession()` | `POST` | `/api/v1/sessions/today/finalize` | `sessionRouter.post('/today/finalize', SessionController.finalizeSession)` | Yes (Bearer) | **MATCH** | Atomically updates streak, session & profile |
| `questionApi.getTodayQuestions()` | `GET` | `/api/v1/questions/today` | `questionRouter.get('/today', QuestionController.getTodayQuestions)` | Yes (Bearer) | **MATCH** | Returns 10 questions for current calendar date |
| `questionApi.getQuestionById()` | `GET` | `/api/v1/questions/:id` | `questionRouter.get('/:id', QuestionController.getQuestionById)` | Yes (Bearer) | **MATCH** | Returns single question by ID |
| *(None)* | `GET` | `/api/v1/health` | `app.get('/api/v1/health')` | No | **N/A** | Backend healthcheck; unused by frontend |

---

## 8. Learning Engine Behavior Audit

### 8.1 Comparison: Current Implementation vs. Redesigned Learning Engine Requirements

The table below contrasts the existing codebase against the newly approved simplified Learning Engine requirements:

| Dimension | Newly Approved Simplified Engine | Current Implemented Codebase | Audit Finding & Gap |
| :--- | :--- | :--- | :--- |
| **Main Question Flow** | Correct: Complete, award XP, update stats/leaderboard, advance. Incorrect: 0 XP, preserve attempt, present linked follow-up. | Flat linear sequence of 10 questions. If incorrect: shows feedback drawer, awards 0 XP, advances to next question in sequence on button click. | **NOT IMPLEMENTED**: No branching to linked follow-up on incorrect answer. |
| **Follow-Up Question Flow**| Correct: 0 XP, return to original Main question. Incorrect: 0 XP, log to Unsolved Question Bucket, advance to next Main question. | Follow-up questions are served only as entire standalone 10-question sessions on odd Julian days (`selectSessionQuestions`). | **NOT IMPLEMENTED**: No runtime relationship or navigation between Main and Follow-Up. |
| **Follow-Up Data Linking** | Follow-Up questions link to Main questions via `Follow_Up_For` property. | `AI_limitation.json` has `Follow_Up_For`, but `FirestoreQuestionRepository.ts` drops this field during mapping! | **DROPPED IN PIPELINE**: Schema mapping strips follow-up metadata. |
| **Unsolved Question Bucket**| Persistent store recording `{ mainQuestionId, followUpQuestionId, timestamp }` when follow-up is failed. | Does not exist anywhere in frontend, backend, Firestore schema, or tests. | **NOT IMPLEMENTED**: Bucket entity and storage are completely absent. |
| **XP Allocation Authority**| Backend is authoritative; awards XP only on verified correct Main questions; 0 XP on Follow-ups; prevents duplicate awards. | Frontend calculates XP (`useLearningSession.ts:437`), adds 10 XP bonus, and sends `totalXpEarned` to backend. Backend accepts it blindly. | **ARCHITECTURAL VIOLATION**: Client-authoritative XP computation. |
| **Levels & Thresholds** | 31 Levels with a 310 XP progression target (exact XP-per-question and level boundaries undecided). | 5 Levels (`Trainee` to `Master Auscultator`) spanning 0 to 1,000+ XP in `ProgressionService.ts`. | **OUT OF SYNC**: Retains obsolete 5-level model. |
| **Leaderboard** | Single overall leaderboard ranked by accumulated XP. No location-specific boards. | No leaderboard endpoint, database collection, query, or UI exists. | **NOT IMPLEMENTED**: Leaderboard infrastructure absent. |
| **Daily Reminders** | 9 AM daily invitation; 3 PM completion check with 30-min reminder; WhatsApp decoupled from answer logic. | No notification scheduler, cron job, worker, or notification contract exists. | **NOT IMPLEMENTED**: Reminder engine absent. |
| **Power-Ups (50/50, Learn, Shield)** | Unmentioned in newly approved simplified engine specification. | Implemented in `PowerUpService.ts`, `DailySessionScreen.tsx`, `PowerUpsScreen.tsx`, and Firestore session doc. | **OPEN DECISION**: Clarify whether power-ups are deprecated or retained. |

### 8.2 Remnants of Old Complex / Adaptive Architecture
- **Mastery Scoring / Decay**: None found in active code. The code uses pure deterministic answer checks.
- **Difficulty-Ranked Day Parity**: In [`src/utils/sessionSelection.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/utils/sessionSelection.ts#L62-L102), the Julian day parity algorithm sorts by `difficultyRank` (ranks 1 through 10) and toggles between Primary (even days) and Follow-Up (odd days). This is active legacy code from the Spark spec that directly conflicts with the new dynamic follow-up pairing model.
- **Provisional 5-Level Curve**: [`src/services/ProgressionService.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/services/ProgressionService.ts#L14-L52) still defines `PROVISIONAL_PROGRESSION_LEVELS` (Level 1–5: 0, 100, 300, 600, 1000+ XP).

---

## 9. Firestore & Data Persistence Audit

### 9.1 Collection Architecture & Schema Adherence
1. `/users/{uid}`:
   - Contains profile metadata, organization (`org_rbsk_national`), and nested `learningState`.
   - Adheres to the baseline document model.
2. `/users/{uid}/dailySessions/{sessionId}`:
   - Keyed canonically by `daily_{YYYY-MM-DD}_{uid.substring(0,8)}`.
   - Stores session lifecycle state (`NOT_STARTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `QUESTIONS_COMPLETED` $\rightarrow$ `REVIEW_COMPLETED`).
3. `/users/{uid}/attempts/{attemptId}`:
   - Append-only attempt log with `userAnswerPayload`, `result`, `xpAwarded`, and server timestamps.
4. `/usernames/{username}`:
   - Normalized lowercase document IDs.
   - Enforces 2-phase reservation (`RESERVED` with 5-minute TTL $\rightarrow$ `ACTIVE`) via atomic transactions.
5. `/contentReleases/rel_v1_0_0/questions/{id}`:
   - Contains ingested questions from `AI_limitation.json`.
   - **Schema Gap**: The documents do not preserve `Follow_Up_For` or `Question_Type` attributes.

### 9.2 Transaction Boundaries & Concurrency
- **Session Finalization Atomicity (PASS)**: Handled in [`backend/src/infrastructure/firestore/FirestoreSessionRepository.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/firestore/FirestoreSessionRepository.ts#L69-L139) via `adminDb.runTransaction`. Checks if session status is already terminal (`COMPLETED`, `REVIEW_COMPLETED`, `REVIEW_VIEWED`). If not, atomically updates `dailySessions/{sessionId}` and `users/{uid}/learningState`.
- **Username Reservation Atomicity (PASS)**: Implemented in `FirestoreUserRepository.reserveUsername` via `adminDb.runTransaction`, preventing concurrent registration race conditions.

---

## 10. Cross-Layer Architecture Compliance Matrix

| Rule ID | Layer | Rule | Rule Source | Status | Evidence | Risk | Recommended Action |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| **ARC-001** | Frontend | Zero direct Firebase client SDK imports in `src/` | Explicit Project Rule | **PASS** | Grep confirms 0 Firebase imports in `src/`; `package.json` has 0 Firebase dependencies. | None | Maintain zero Firebase frontend boundary. |
| **ARC-002** | Frontend | Access token kept in-memory only | Explicit Project Rule | **PASS** | `src/api/client.ts:10` stores token in `inMemoryAccessToken`. | None | Continue in-memory storage. |
| **ARC-003** | Frontend | Refresh token stored exclusively in HttpOnly cookie | Explicit Project Rule | **PASS** | Cookie options configured in `AuthController.ts:11`; `credentials: 'include'` used in `client.ts:48`. | None | Retain HttpOnly cookie transport. |
| **ARC-004** | Frontend | Serialized 401 token refresh queue | Explicit Project Rule | **PASS** | `src/api/client.ts:51-115` verified by `tests/ApiClientRefreshConcurrency.test.ts`. | None | Retain queueing mechanism. |
| **ARC-005** | Backend | Domain purity: No Express or Firebase imports in Domain | Explicit Project Rule | **PASS** | Grep confirms 0 external framework imports across `backend/src/domain/`. | None | Maintain domain isolation. |
| **ARC-006** | Backend | Layered dependency direction (Transport $\rightarrow$ UseCase $\rightarrow$ Domain) | Explicit Project Rule | **PASS** | Controllers delegate to UseCases; UseCases depend on Domain interfaces. | None | Retain dependency inversion. |
| **ARC-007** | Backend | Infrastructure isolation: Firebase Admin SDK restricted to adapters | Explicit Project Rule | **PASS** | Firebase Admin isolated in `backend/src/infrastructure/`. | None | Retain adapter isolation. |
| **ARC-008** | Security | Whitelisted CORS origin enforcement with credentials | Necessary Invariant | **FAIL** | `backend/src/app.ts:25-30` allows all origins in `else` branch with `credentials: true`. | High (CSRF / unauthorized data access) | Restrict CORS to explicit allowed origins list in all environments. |
| **ARC-009** | Security | Strip non-updatable fields on `PATCH /api/v1/users/me` | Necessary Invariant | **FAIL** | `FirestoreUserRepository.ts:143-148` does not strip `learningState` before update. | High (Trainee can overwrite XP/level) | Add `delete dataToUpdate.learningState;` and validate allowed fields. |
| **ARC-010** | Architecture | Backend-authoritative XP and progression calculation | Necessary Invariant | **FAIL** | `useLearningSession.ts:437-478` passes client-computed `finalXpEarned` to backend; backend accepts it. | High (Forged XP awards) | Compute session XP server-side based on verified question attempts. |
| **ARC-011** | Learning | Dynamic Main $\rightarrow$ Follow-Up question branching | Explicit Project Rule | **FAIL** | Not implemented; questions run linearly without dynamic branching. | High (Spec divergence) | Implement Main/Follow-Up state machine in Learning Engine. |
| **ARC-012** | Learning | Unsolved Question Bucket persistence | Explicit Project Rule | **FAIL** | Not implemented in frontend, backend, or Firestore. | High (Feature missing) | Create Unsolved Question Bucket model and repository. |
| **ARC-013** | Learning | 31-Level / 310-XP progression curriculum | Explicit Project Rule | **FAIL** | `ProgressionService.ts` maintains provisional 5-level / 1,000+ XP curve. | Medium (Curriculum mismatch) | Align progression rules to 31 levels upon final formula sign-off. |
| **ARC-014** | Learning | Overall XP leaderboard | Explicit Project Rule | **FAIL** | No leaderboard endpoint or query exists. | Medium (Feature missing) | Implement leaderboard calculation in backend. |
| **ARC-015** | Learning | Daily 9 AM / 3 PM reminders with WhatsApp isolation | Explicit Project Rule | **FAIL** | No scheduler or reminder service exists. | Medium (Feature missing) | Design standalone notification worker decoupled from core evaluation. |
| **ARC-016** | Code Quality | Single source of truth for domain rules | Recommended Practice | **PARTIAL** | `AnswerEvaluator`, `PowerUpService`, `ProgressionService` duplicated in `src/` and `backend/`. | Medium (Logic drift) | Share domain rules or make backend authoritative. |
| **ARC-017** | Testing | Test suite regression baseline | Necessary Invariant | **PASS** | 234 / 234 tests passing across 19 suites in Vitest. | None | Maintain automated test suite. |
| **ARC-018** | Security | Secret safety: Zero sensitive keys in repo | Explicit Project Rule | **PARTIAL** | Fallback API key string in `backend/src/infrastructure/config/env.ts:8`. | Low (Hardcoded credential) | Require `FIREBASE_WEB_API_KEY` in environment; remove source fallback. |

---

## 11. Test & Build Verification Results

All verification checks were executed locally using non-destructive, read-only commands:

| Check | Exact Command Executed | Exit Code | Result Summary | Verification Scope & Notes |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend/Root Vitest** | `npm.cmd test -- --run` | `0` | **19 test files passed, 234 passed (234 total)** in 4.53s | Unit & integration tests; uses in-memory mocks & jsdom. |
| **Backend Vitest** | `npm.cmd --prefix backend test` | `0` | **2 test files passed, 23 passed (23 total)** in 2.15s | In-process Supertest HTTP integration & mock use cases. |
| **Frontend Typecheck** | `npm.cmd run typecheck` (`tsc --noEmit`) | `0` | **0 errors** | Full TypeScript 5.7 static type verification across `src/`. |
| **Backend Build / Typecheck** | `npm.cmd --prefix backend run build` (`tsc`) | `0` | **0 errors** | Full TypeScript 5.7 compilation to `backend/dist/`. |
| **Frontend Production Build** | `npm.cmd run build` (`tsc && vite build`) | `0` | **Successfully generated `dist/` bundle** in 1.77s | Production Vite + PWA build; 0 Firebase code in bundle. |
| **Schema Validation** | `node scripts/validate_schema.js` | `0` | **15 questions valid** against `question.schema.json` | JSON schema validation of dummy questions via Ajv. |

*Note on Test Levels*: Tests currently verify **Level A (Unit)** and **Level B (In-Process Integration)**. Deployed Cloud End-to-End verification (**Level D**) has not been executed as the backend is not yet hosted in a cloud container.

---

## 12. Prioritized Findings

### P1 — High Severity

#### F-01: Client-Authoritative XP & Stat Calculation
- **Layer**: Frontend (`src/hooks/useLearningSession.ts:437-478`) & Backend (`backend/src/api/controllers/SessionController.ts`, `FirestoreSessionRepository.ts:107`)
- **Risk**: The client decides `totalXpEarned` and `correctCount` and sends them in the request body to `/api/v1/sessions/today/finalize`. The backend blindly increments persistent trainee XP by `Math.min(finalXpEarned, 200)` without verifying recorded attempt documents.
- **Impact**: Any client or automated tool can forge high scores, XP gains, and completion statistics.
- **Learning Engine Blocker**: **YES**. Must be remediated before the new Learning Engine is introduced.
- **Remediation**: The backend `/finalize` use case must query the session's actual recorded attempts in Firestore, calculate the verified XP, and update `learningState` authoritatively.

#### F-02: Unsanitized Profile Mutation in `PATCH /api/v1/users/me`
- **Layer**: Backend (`backend/src/infrastructure/firestore/FirestoreUserRepository.ts:143-148`)
- **Risk**: `updateUserProfile` deletes `uid`, `username`, `role`, `organizationId`, and `createdAt` from updates, but does **not** delete `learningState`.
- **Impact**: An authenticated user sending a crafted PATCH request can overwrite `learningState.totalXp`, `currentLevel`, `currentStreak`, etc.
- **Learning Engine Blocker**: **YES**.
- **Remediation**: Add `delete dataToUpdate.learningState;` in `FirestoreUserRepository.updateUserProfile` and define an explicit allow-list for profile update DTOs.

#### F-03: Permissive CORS Configuration with Credentials Enabled
- **Layer**: Backend (`backend/src/app.ts:25-30`)
- **Risk**: In `backend/src/app.ts`, the CORS origin callback returns `callback(null, true)` for unmatched origins in the `else` branch, while `credentials: true` is configured.
- **Impact**: Any third-party website visited by a trainee could execute authenticated cross-origin requests using the browser's credentials.
- **Learning Engine Blocker**: No, but high security risk before remote deployment.
- **Remediation**: Reject unlisted origins with `callback(new Error('Not allowed by CORS'))` or `callback(null, false)`.

---

### P2 — Medium Severity

#### F-04: Dual Duplication of Domain Rules & Types
- **Layer**: Frontend (`src/services/`) & Backend (`backend/src/domain/rules/`)
- **Risk**: `AnswerEvaluator`, `PowerUpService`, `ProgressionService`, and `sessionSelection` are duplicated between frontend and backend.
- **Impact**: Inevitable logic drift as the Learning Engine evolves.
- **Learning Engine Blocker**: No, but creates technical debt during Learning Engine implementation.
- **Remediation**: Move toward backend-authoritative evaluation where the frontend simply displays questions and renders server evaluations, or extract a shared pure domain package.

#### F-05: Inconsistent Rehydration State on Expired Silent Refresh
- **Layer**: Frontend (`src/App.tsx:112-118`)
- **Risk**: `App.tsx` initializes `authStatus` to `'AUTHENTICATED'` based on `localStorage` presence. If `rehydrateSession()` fails (cookie expired), `authStatus` is not reset to `'UNAUTHENTICATED'`.
- **Impact**: UI remains in authenticated state with null in-memory token, causing subsequent API calls to fail unexpectedly.
- **Learning Engine Blocker**: No.
- **Remediation**: If `rehydrateSession()` returns false, set `authStatus('UNAUTHENTICATED')` and clear local storage metadata.

#### F-06: Error Handler Relies on String Matching Heuristics
- **Layer**: Backend (`backend/src/api/middlewares/error.middleware.ts:14-40`)
- **Risk**: `errorHandler` checks `message.includes('required')`, `message.includes('not found')`, etc., to assign HTTP status codes.
- **Impact**: Fragile error translation; unhandled messages default to 500 or misclassify bad requests.
- **Learning Engine Blocker**: No.
- **Remediation**: Implement typed domain exception classes (`ValidationError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`).

---

### P3 — Low Severity

#### F-07: Test Fallback Mock Token in `localStorage`
- **Layer**: Frontend (`src/services/AuthService.ts:215, 310`)
- **Risk**: Vitest offline fallback writes mock dummy token strings to `localStorage`.
- **Impact**: Very low (affects offline unit test runner only; production online paths omit token).
- **Learning Engine Blocker**: No.
- **Remediation**: Sanitize lines 215 and 310 to store only `{ userId, authenticatedAt, emailOrPhone }`.

#### F-08: Hardcoded Fallback Firebase Web API Key
- **Layer**: Backend (`backend/src/infrastructure/config/env.ts:8`)
- **Risk**: Fallback string literal `AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA` embedded in config file.
- **Impact**: Low (public web API key), but violates credential hygiene.
- **Learning Engine Blocker**: No.
- **Remediation**: Remove fallback string; require `FIREBASE_WEB_API_KEY` in environment.

---

### INFO — Architectural Observations

#### INFO-01: Question Ingestion Pipeline Drops Follow-Up Metadata
- **Observation**: `AI_limitation.json` contains `Question_Type` (`Primary` vs `Follow-Up`) and `Follow_Up_For` (`MG-AIL-01-TH`, etc.). However, `FirestoreQuestionRepository.ts` drops these fields during mapping.
- **Relevance**: Before the redesigned Learning Engine can pair Main questions with Follow-Ups, the Question entity and Firestore repository must retain these fields.

---

## 13. Open Product & Architecture Decisions

Before implementing the redesigned Learning Engine, the following architectural and product decisions must be formally approved:

1. **XP Formula & Level Thresholds**:
   - The user requirements state: "31 levels and a 310 XP progression target, but the exact XP-per-question value and level thresholds remain undecided."
   - *Decision Needed*: What is the XP awarded per correct Main question (e.g. 10 XP)? What are the exact thresholds for Levels 1 through 31?
2. **Fate of the Three-Power-Up System**:
   - The current codebase contains the frozen 3-power-up system (50/50, LEARN, STREAK SHIELD). The redesigned specification does not mention power-ups.
   - *Decision Needed*: Are Power-Ups deprecated and to be removed, or do they remain active alongside the new Main/Follow-Up question workflow?
3. **Daily Reminders Infrastructure**:
   - Requirements specify a 9 AM invitation and a 3 PM incomplete reminder, with WhatsApp integration decoupled from evaluation logic.
   - *Decision Needed*: What execution engine will run these cron jobs (e.g., Cloud Tasks, Node cron worker, Firebase Scheduled Functions)? What third-party provider/gateway (e.g. Twilio, Gupshup) is selected for WhatsApp delivery?
4. **Unsolved Question Bucket Re-engagement**:
   - The spec states that failed follow-ups are recorded in the Unsolved Question Bucket.
   - *Decision Needed*: When and how does the learner encounter questions from the Unsolved Bucket again? In subsequent daily sessions? In a dedicated review mode?

---

## 14. Recommended Remediation Order

To ensure architectural integrity, the recommended sequence of work is:

```
Step 1: Security & Authority Hardening (Prerequisite)
├── Fix P1 F-02: Sanitize PATCH /api/v1/users/me to reject learningState mutations
├── Fix P1 F-03: Restrict CORS origins to eliminate wildcard credentials in backend/src/app.ts
└── Fix P1 F-01: Shift XP calculation authority from client to backend in SessionUseCase

Step 2: Question Data Pipeline Alignment
├── Update Question model & schema to retain Question_Type and Follow_Up_For
└── Re-seed/map questions so that Main-to-Follow-Up links exist in memory and Firestore

Step 3: Redesigned Learning Engine Backend Implementation
├── Implement Main/Follow-Up state machine & attempt progression in SessionUseCase
├── Implement Unsolved Question Bucket entity & persistence
├── Implement Overall XP Leaderboard query in backend
└── Implement 31-Level progression calculation once thresholds are decided

Step 4: Frontend UI Adaptation
├── Update useLearningSession to follow the server-driven Main/Follow-Up flow
└── Update screens to display the 31-level curve and leaderboard
```

---

## 15. Readiness Assessment for the Redesigned Learning Engine

| Readiness Dimension | Status | Assessment |
| :--- | :---: | :--- |
| **Backend Physical Layering** | **READY** | Clean architecture is in place with separate Controllers, UseCases, Domain, and Adapters. |
| **Frontend Decoupling** | **READY** | React frontend is 100% decoupled from Firebase SDK; all operations go through `/api/v1`. |
| **Test Infrastructure** | **READY** | 234 Vitest tests passing; fast test execution (under 5 seconds); build toolchains healthy. |
| **Data Integrity & Authority**| **NOT READY** | Backend must be made authoritative for XP awarding (F-01) and profile mutation (F-02) before new rules are added. |
| **Question Linking Data** | **NOT READY** | `Follow_Up_For` is dropped by the repository mapping and must be restored (INFO-01). |
| **Curriculum Specification** | **BLOCKED ON DECISION**| Exact 31-level curve, XP-per-question, and Power-Up disposition must be formally decided. |

**Overall Readiness Verdict**: **CONDITIONALLY READY**. The foundation and layering are solid, but Step 1 (Security & Authority Hardening) and curriculum decisions are required before coding the new Learning Engine.

---

## 16. Explicitly Unverified Items & Limitations

1. **Deployed Cloud Production (Level D Verification)**:
   - This audit verified Level A (Unit) and Level B (In-Process HTTP Integration via Supertest). Real cloud deployments (Google Cloud Run / App Engine) were not audited for production load, container memory, or ingress firewall settings.
2. **Third-Party WhatsApp Gateway**:
   - No WhatsApp Business API credentials, webhooks, or vendor SLAs were verified as no integration code currently exists in the repository.
3. **Live Firestore Spark Quota Verification**:
   - The audit confirmed schema correctness and security rules offline; no live queries that mutate production Firestore databases were executed during this read-only audit.

---

## 17. Working-Tree Preservation Confirmation

In accordance with strict audit constraints:
- **Zero application code, tests, or configurations were modified, refactored, or deleted.**
- **No dependencies were installed or updated.**
- **No Firestore documents were altered.**
- **All pre-existing working-tree changes (modified and untracked files) remain completely preserved.**
- **This audit report was generated as a standalone artifact: `FRONTEND_BACKEND_ARCHITECTURE_COMPLIANCE_AUDIT.md`.**
