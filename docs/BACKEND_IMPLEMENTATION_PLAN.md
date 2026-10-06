# AiSteth Academy — Production Backend Implementation Plan

**Document Version:** `2.6.1-PROD-PLAN`  
**Architecture Model:** Cloud-First / Server-Authoritative  
**Hosting & Cloud Infrastructure:** Firebase Hosting (Frontend PWA) + Google Firebase Cloud Services (Auth, Firestore, Functions)  
**Content Source of Truth:** `AI_limitation.json` (Release `rel_v1_0_0` — 20 MCQs for AI Limitation Module)  
**Specification Status:** Historical Proposal (Deferred Blaze Architecture)

> [!NOTE]
> **Historical Planning Document / Deferred Blaze Architecture**:
> This document records the initial Phase 2.1 design proposal for a server-authoritative backend with Cloud Functions and Firebase Storage under the Blaze pay-as-you-go plan.
> The **active production architecture** has transitioned to the **Firebase Spark Free Tier (Client-Authoritative with Firestore Security Rules)**, as detailed in [`AISTETH_ACADEMY_COMPLETE_TECHNICAL_REPORT.md`](AISTETH_ACADEMY_COMPLETE_TECHNICAL_REPORT.md).

---

## 1. Architectural Topology & Content Principles

```
                    FIREBASE HOSTING
             React + Vite + PWA
                       │
                       ▼
                FIREBASE CLOUD
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    Firebase Auth   Firestore    Cloud Storage
                       │
                       ▼
                Cloud Functions
```

### 1.1 Core Content & Session Principles
1. **Decoupled Renderers vs Content Releases**: The frontend client supports **5 interactive question renderers** (`MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION`). A content release contains whatever question types its curriculum dictates.
2. **Current Authoritative Content Scope**: `AI_limitation.json` contains **20 MCQs** for Module 1 (`AI Limitation`, `RBSK` audience). It does not establish the entire platform-wide curriculum size. Additional modules and question types will be added through subsequent versioned content releases.
3. **Content-Driven Session Selection Policy**: Daily sessions select **10 questions from the active release pool** according to configured curriculum rules (e.g. difficulty distribution, non-repetition across consecutive days), **without assuming a specific question-type distribution**.
4. **Follow-Up Relationships in Phase 2 vs Phase 3**: Both Primary (`-TH`) and Follow-Up (`-PR`) questions are ingested into `rel_v1_0_0` with `followUpFor` metadata preserved. Automated adaptive triggering of follow-ups upon errors is deferred to Phase 3.

---

## 2. Eighteen-Phase Sequential Implementation Roadmap

```
PHASE 2.1  ─► Cloud Dev Project Setup (aisteth-academy-dev)
PHASE 2.2  ─► Firebase Auth + Username Registration (Reservation + Compensation)
PHASE 2.3  ─► Firestore Schema & Security Rules Deployment
PHASE 2.4  ─► Server-Authoritative User Provisioning
PHASE 2.5  ─► AI_limitation.json Questionnaire Audit & Validation [COMPLETED]
PHASE 2.6  ─► Content Release Ingestion Pipeline (rel_v1_0_0)
PHASE 2.7  ─► Cloud Storage Media Pipeline
PHASE 2.8  ─► Frontend Firebase Web SDK Integration
PHASE 2.9  ─► Firestore Question Repository Implementation
PHASE 2.10 ─► Server Daily Session Generation (startDailySession)
PHASE 2.11 ─► Attempt Submission & Answer Validation (submitAttempt, finalizeDailySession)
PHASE 2.12 ─► Server XP, Streak & Power-Up Calculation Engine
PHASE 2.13 ─► Supervisor Pre-Aggregated Analytics Engine
PHASE 2.14 ─► Cloud Development Integration & Boundary Testing
PHASE 2.15 ─► Firebase Hosting Dev Deployment & Live Verification
PHASE 2.16 ─► Staging Cloud Deployment & Multi-Tenant QA
PHASE 2.17 ─► Production Hardening & App Check Verification
PHASE 2.18 ─► Final Production Deployment (aisteth-academy-prod)
```

---

### Detailed Phase Specifications

---

### PHASE 2.1: Firebase Cloud Development Project Setup
- **Scope**: Configure root repository for direct connection to `aisteth-academy-dev`.
- **Deliverables**:
  - `.firebaserc` defining `default`/`development` (`aisteth-academy-dev`), `staging`, and `production`.
  - `.env.example` and `.env.development` with client-safe Firebase Web Configuration keys.
  - Hardened `.gitignore` protecting server credentials and private keys.
  - `docs/FIREBASE_ENVIRONMENT.md` developer guide.
- **Verification**: Verified zero local emulator dependencies and zero committed secrets.

---

### PHASE 2.2: Firebase Authentication + Username Registration
- **Scope**: Implement username-based authentication backed by Firebase Email/Password with synthetic internal email format (`<username>@trainee.aisteth.internal`).
- **Cloud Functions**:
  - `registerWithUsername`: Implements the 5-step **Idempotent Reservation + Compensation Workflow**:
    1. Normalize username (`^[a-z0-9._-]{3,30}$`).
    2. Reserve `/usernames/{normalizedUsername}` in Firestore transaction.
    3. Create Firebase Auth user with synthetic email and initial custom claims.
    4. Finalize username reservation (`status = "ACTIVE"`, `uid`).
    5. Provision master `/users/{uid}` profile with `role = "TRAINEE"`, default organization ID, and baseline `learningState`.
    6. *Failure Compensation*: If any downstream step fails, delete Auth user and release username reservation.
- **Verification**: Concurrency tests, duplicate username rejection, transaction rollback tests.

---

### PHASE 2.3: Firestore Schema + Security Rules Deployment
- **Scope**: Deploy production security rules to `aisteth-academy-dev`.
- **Security Invariants**:
  - Trainees have **READ ONLY** access to `/users/{uid}/dailySessions` and `/users/{uid}/attempts`.
  - Direct client creation/modification of daily sessions and attempts is completely denied.
  - Direct client reads on `/usernames` are blocked.
  - User profile sensitive keys (`role`, `organizationId`, `learningState`, `uid`, `username`) are protected from client mutation.
- **Verification**: Automated security rules test suite verifying permissions matrix.

---

### PHASE 2.4: Server-Authoritative User Provisioning
- **Scope**: Ensure profile provisioning is strictly server-owned.
- **Rules**:
  - Public registration assigns `role = "TRAINEE"` and default onboarding organization.
  - Administrative roles (`SUPERVISOR`, `CONTENT_ADMIN`, `PLATFORM_ADMIN`) provisioned strictly via protected admin CLI or Cloud Functions.
- **Verification**: Verify public self-registration cannot elevate privileges or inject arbitrary organization IDs.

---

### PHASE 2.5: `AI_limitation.json` Questionnaire Audit & Validation
- **Status**: **COMPLETED & VERIFIED** (See [`QUESTIONNAIRE_CONTENT_AUDIT.md`](../QUESTIONNAIRE_CONTENT_AUDIT.md)).
- **Scope**: Audit all 20 clinical questions in `AI_limitation.json` across 25 structural dimensions. Document mapping from raw JSON to canonical Firestore question documents.

---

### PHASE 2.6: Content Release Ingestion Pipeline
- **Scope**: Ingest the current authoritative `AI_limitation.json` content release into Firestore under Release `rel_v1_0_0`.
- **Document Path**: `/contentReleases/rel_v1_0_0/questions/{questionId}`.
- **Release Metadata**:
  - `releaseId`: `"rel_v1_0_0"`
  - `name`: `"Module 1: AI Limitation & Clinical Decision Making"`
  - `totalQuestions`: 20
  - `status`: `"PUBLISHED"`
  - Preserves all MedGemma metadata (`medGemmaTag`, `followUpFor`, `difficultyRank`, `action`).
- **Verification**: Ingestion script idempotency check; 20 question documents created and verified.

---

### PHASE 2.7: Media Storage Strategy (Deferred / Future Phase)
- **Status**: **NOT AN ACTIVE PHASE 2 DEPENDENCY**. Structured questionnaire data from `AI_limitation.json` is stored directly in Firestore.
- **Future Scope**: Cloud Storage bucket and rules will be introduced in a future phase if binary media (stethoscope audio, anatomical diagrams) are added.

---

### PHASE 2.8: Frontend Firebase Web SDK Integration
- **Scope**: Install official Firebase Web SDK (`firebase@^11.0.0`) in root `package.json`.
- **Module**: Create `src/services/firebase.ts` initializing Firebase App, Auth, Firestore, Functions, and Storage connecting to `aisteth-academy-dev`.
- **Frontend Refactor**: Update `src/services/AuthService.ts` to use Firebase Auth state listeners and call `registerWithUsername`.

---

### PHASE 2.9: Firestore Question Repository
- **Scope**: Implement `FirestoreQuestionRepository.ts` implementing `IQuestionRepository`.
- **Data Source**: Fetches questions directly from `/contentReleases/{activeReleaseId}/questions`.
- **Deprecation**: Deprecate `MockJsonQuestionRepository` and dummy question datasets.

---

### PHASE 2.10: Server Daily Session Generation (`startDailySession`)
- **Scope**: Callable Cloud Function `startDailySession({ trainingDate, timezone })`.
- **Content-Driven Selection Logic**:
  - Checks if a daily session already exists for the user on `localDate`.
  - If existing, returns the authoritative session state.
  - If new, selects 10 questions from the active content release pool (`rel_v1_0_0`) using configured curriculum selection rules (difficulty balancing and non-repetition across consecutive days), without assuming a fixed question-type distribution.
  - Writes new session record to `/users/{uid}/dailySessions/{sessionId}` with status `IN_PROGRESS`.

---

### PHASE 2.11: Attempt Submission & Answer Validation (`submitAttempt`)
- **Scope**: Callable Cloud Function `submitAttempt` and `finalizeDailySession`.
- **Business Logic**:
  - Validates answer payload server-side.
  - Writes append-only record to `/users/{uid}/attempts/{attemptId}`.
  - Increments session `currentQuestionIndex`, `correctCount`, and `totalXpEarned`.
  - Supports RETRY with `retryOfAttemptId` link without corrupting question sequence.
  - Locks session upon 10th answer completion (`QUESTIONS_COMPLETED`).

---

### PHASE 2.12: Server XP, Streak & Power-Up Calculation Engine
- **Scope**: Server calculation of user progression and power-up eligibility upon session completion.
- **Engine Rules**:
  - Calculates streak based on consecutive calendar dates (`YYYY-MM-DD`).
  - Evaluates Streak Shield protection automatically if 1 calendar day is missed.
  - Unlocks HINT (50 correct), LEARN (100 answered), RETRY (20-day streak), STREAK SHIELD (30-day streak).
  - Updates `/users/{uid}.learningState` atomically on the backend.

---

### PHASE 2.13: Supervisor Pre-Aggregated Analytics Engine
- **Scope**: Cloud Firestore Trigger / Scheduled Function computing cohort performance.
- **Destination**: `/analytics/organizations/{orgId}/dailyMetrics/{date}`.
- **Metrics**: Active trainees count, completion rate, average accuracy, category breakdown.

---

### PHASE 2.14: Cloud Development Integration & Boundary Testing
- **Scope**: End-to-end integration testing of the entire web application running against `aisteth-academy-dev`.
- **Test Matrix**: Authentication, daily session lifecycle, answer evaluation, power-up activation, review locking, network error handling.

---

### PHASE 2.15: Vercel Development / Public Demo Deployment
- **Scope**: Deploy React / Vite PWA to Vercel connected to `aisteth-academy-dev`.
- **Deliverables**: Live demo URL for stakeholder and clinical review with real Firebase cloud backend.

---

### PHASE 2.16: Staging Cloud Deployment & Multi-Tenant QA
- **Scope**: Deploy backend to `aisteth-academy-staging` and connect Vercel Staging environment. Conduct multi-supervisor cohort validation.

---

### PHASE 2.17: Production Hardening & App Check Verification
- **Scope**: Configure Firebase App Check, enforce strict rate limits, verify production Firestore composite indexes, and run automated penetration checks.

---

### PHASE 2.18: Final Production Deployment (`aisteth-academy-prod`)
- **Scope**: Deploy final locked backend and immutable content release to `aisteth-academy-prod` and connect production Vercel domain.

---

## 3. Frozen Phase 2 Question-Selection Algorithm Specification (`rel_v1_0_0`)

This section establishes the authoritative, frozen question-selection specification governing `startDailySession` (Phase 2.10).

### 3.1 Active Content Release Facts & Question Breakdown
- **Release ID**: `rel_v1_0_0`
- **Total Release Size**: Exactly **20 questions** (All MCQs; Module 1: AI Limitation & Clinical Decision Making; Audience: RBSK).
- **Sub-Types**: 10 Primary Theoretical questions (`-TH`) and 10 Follow-Up Practical questions (`-PR`).
- **Difficulty Range**: Ranked 1 (lowest) to 10 (highest).
- **Exact Inventory Breakdown**:

| Difficulty Rank | Primary Question ID (`-TH`) | Follow-Up Question ID (`-PR`) | Topic / Focus |
| :---: | :--- | :--- | :--- |
| **1** | `MG-AIL-01-TH` | `MG-AIL-01-PR` | Cyanosis + poor growth override |
| **2** | `MG-AIL-02-TH` | `MG-AIL-02-PR` | Heart sound between beats override |
| **3** | `MG-AIL-03-TH` | `MG-AIL-03-PR` | Blue lips danger sign referral |
| **4** | `MG-AIL-04-TH` | `MG-AIL-04-PR` | School health check diastolic rest sound |
| **5** | `MG-AIL-05-TH` | `MG-AIL-05-PR` | Normal AI reading vs clinical cyanosis |
| **6** | `MG-AIL-06-TH` | `MG-AIL-06-PR` | Mobile health van cyanosis referral |
| **7** | `MG-AIL-07-TH` | `MG-AIL-07-PR` | Infant blue lips referral protocol |
| **8** | `MG-AIL-08-TH` | `MG-AIL-08-PR` | Home visit cyanosis referral priority |
| **9** | `MG-AIL-09-TH` | `MG-AIL-09-PR` | Lethargy + blue lips referral action |
| **10** | `MG-AIL-10-TH` | `MG-AIL-10-PR` | PHC setting danger sign escalation |

### 3.2 Exact Construction of Set A and Set B
- **Set A (Primary / Day Parity 0)**:
  `['MG-AIL-01-TH', 'MG-AIL-02-TH', 'MG-AIL-03-TH', 'MG-AIL-04-TH', 'MG-AIL-05-TH', 'MG-AIL-06-TH', 'MG-AIL-07-TH', 'MG-AIL-08-TH', 'MG-AIL-09-TH', 'MG-AIL-10-TH']`
  - Exactly 10 questions.
  - Exactly 1 question per difficulty rank (1 to 10).
- **Set B (Follow-Up / Day Parity 1)**:
  `['MG-AIL-01-PR', 'MG-AIL-02-PR', 'MG-AIL-03-PR', 'MG-AIL-04-PR', 'MG-AIL-05-PR', 'MG-AIL-06-PR', 'MG-AIL-07-PR', 'MG-AIL-08-PR', 'MG-AIL-09-PR', 'MG-AIL-10-PR']`
  - Exactly 10 questions.
  - Exactly 1 question per difficulty rank (1 to 10).

### 3.3 Authoritative Selection Algorithm & Rules

1. **Timezone Policy**: All daily session boundaries, duplicate prevention, streak calculations, and date parity calculations are derived authoritatively using **`Asia/Kolkata`** (UTC+05:30). Any client-stored `trainingTimeZone` profile field is metadata only and does NOT influence server date resolution or session rotation.
2. **Determinism**: Selection is **deterministic based on the resolved Asia/Kolkata calendar date and day-parity rotation**. Repeated calls to `startDailySession` on the same calendar day return the exact same session question set corresponding to that calendar day's parity.
3. **Difficulty Distribution**: The 10 selected questions guarantee exact 1-to-1 representation across all 10 difficulty tiers: exactly one question for each `Difficulty_Rank` from `1` through `10`.
4. **Consecutive-Day Non-Repetition**: By alternating between Set A (Even Julian day parity) and Set B (Odd Julian day parity), the algorithm guarantees **0% question overlap between consecutive calendar-day sessions**.
5. **Constraint Fallback**: If a date cannot be resolved or future releases have uneven distributions, the selector falls back to a deterministic difficulty-ordered sample.
6. **Session Persistence**: The 10 chosen question IDs are written to `/users/{uid}/dailySessions/{sessionId}.questionIds` as an immutable ordered array.
7. **Eligibility**: Both `-TH` and `-PR` questions are fully eligible in Phase 2 for ordinary daily mission selection.

### 3.4 Post-Registration Authentication Flow & Custom Claims
1. Client calls `registerWithUsername` with trainee details.
2. Server executes the 5-step registration workflow: reserves username with `reservationId`, creates Auth user, assigns custom claims `{ role: 'TRAINEE', organizationId: defaultOrgId }`, and provisions `/users/{uid}`.
3. Upon success response, the client signs in with `signInWithEmailAndPassword(syntheticEmail, password)`.
4. Firebase Auth client receives the ID token containing the newly assigned custom claims (`role`, `organizationId`).
5. Subsequent Firestore and Cloud Function calls automatically include these verified claims in `request.auth.token`.

### 3.5 Strict Phase 2 Boundary Invariants
- **Lineage Only**: `Follow_Up_For` is stored and indexed strictly as curriculum lineage metadata.
- **No Error Branching**: Missing a `-TH` question in Phase 2 does NOT trigger immediate injection of `-PR`.
- **No Leitner Engine**: Spaced repetition scheduling is strictly deferred to Phase 3.
- **No Machine Learning Engine**: Adaptive question selection models are strictly deferred to Phase 3.
- **No Content Fabrication**: No missing question types or missing questions are manufactured. Release size is exactly 20.


