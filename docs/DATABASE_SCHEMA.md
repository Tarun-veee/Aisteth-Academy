# AiSteth Academy — Production Database Schema Specification

**Document Version:** `2.6.1-PROD-SPEC`  
**Target Platform:** Firebase Hosting (PWA) + Firebase Authentication + Google Cloud Firestore + Cloud Functions  
**Architecture Model:** Cloud-First / Server-Authoritative  
**Content Source of Truth:** `AI_limitation.json` (Release `rel_v1_0_0` — 20 MCQs for AI Limitation Module)  
**Schema Status:** Approved Production Baseline Design (Ready for Implementation)  

---

## 1. Executive Database Summary & Principles

AiSteth Academy is a cloud-first, server-authoritative clinical training platform hosted on **Firebase Hosting** and powered directly by **Google Firebase Cloud Services** (`aisteth-academy-dev`, `aisteth-academy-staging`, `aisteth-academy-prod`).

```
                    FIREBASE HOSTING
             React + Vite + PWA
                        │
                        ▼
                 FIREBASE CLOUD
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
     Firebase Auth               Firestore
                                     │
                                     ▼
                              Cloud Functions
```

> **Note on Firebase Storage**: Firebase Storage is not an active Phase 2 dependency. The current application uses Firebase Firestore for all structured application data (questionnaires, users, sessions, attempts, progress, and analytics). Storage is reserved for a future phase if binary media requirements (e.g. stethoscope audio recordings, anatomical diagrams) are introduced.

### 1.1 Core Invariants
1. **Direct Firebase Cloud Backend**: The application communicates directly with real Firebase Cloud services via the official Firebase Web SDK. There is **NO Local Emulator Suite** in the architecture.
2. **Cloud Firestore is Authoritative**: Firestore is the primary application database and authoritative single source of truth for user profiles, daily training sessions, append-only attempt logs, and pre-aggregated analytics.
3. **Zero Client Write to Learning & Session State**: Trainees have **READ ONLY** access to their `/users/{uid}/dailySessions` and `/users/{uid}/attempts`. All daily session creations, progress updates, answer evaluations, and session locks are executed strictly by authenticated server-side Cloud Functions (`startDailySession`, `submitAttempt`, `finalizeDailySession`).
4. **Single Authoritative Profile Provisioning**: The server-side registration workflow (`registerWithUsername`) is the sole owner of initial user profile creation in `/users/{uid}`.
5. **Decoupling Renderer Capability from Content Releases**: The application engine supports **five polymorphic question renderer types** (`MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION`). Individual content releases may contain any valid subset. Release `rel_v1_0_0` (from `AI_limitation.json`) contains **20 MCQs** for Module 1.
6. **Content-Driven Session Selection Policy**: The 10-question daily mission is selected from the active content release according to configured curriculum selection rules (e.g. difficulty distribution, non-repetition across consecutive days) **without assuming a specific question-type distribution**.
7. **Curriculum Scope Separation**: `AI_limitation.json` represents the 20-question content release for Module 1 (`AI Limitation`, `RBSK` audience). Future modules and question types will be added through subsequent immutable content releases (`contentReleases/{releaseId}`).
8. **Follow-Up Metadata Preserved (Phase 3 Execution)**: `Follow_Up_For` relationships between Primary (`-TH`) and Follow-Up (`-PR`) questions are preserved in Firestore. Automated dynamic triggering of follow-ups upon errors is deferred to Phase 3.
9. **Append-Only Attempt History**: Every user answer submission is permanently preserved in Firestore by the backend. When a learner uses RETRY on a question, both the initial incorrect attempt and the subsequent retry attempt are stored with `retryOfAttemptId` lineage.
10. **No Synchronization Engine Required**: The application assumes an active internet connection. Offline synchronization queues, outbox stores, sync engines, and conflict resolvers are completely omitted.
11. **Zero Username Directory Exposure**: The `/usernames` collection is strictly internal to server Cloud Functions and is blocked from client direct reads to prevent enumeration attacks.
12. **IndexedDB Local Cache Boundary**: IndexedDB is strictly an optional, non-authoritative local UI cache.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUD FIRESTORE HIERARCHY                          │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ appConfig/global              │ Runtime parameters, active release pointer  │
│ usernames/{username}          │ Internal username reservation lifecycle     │
│ organizations/{orgId}         │ Healthcare tenant boundary (e.g. State NHM) │
│ users/{uid}                   │ Trainee profile, role & learningState       │
│   ├── dailySessions/{sessId}  │ Daily 10-question session (Server write)    │
│   └── attempts/{attemptId}    │ Append-only attempt log (Server write)      │
│ contentReleases/{releaseId}   │ Immutable versioned clinical question bundle│
│   └── questions/{questionId}  │ Canonical validated questions + media links │
│ analytics/organizations/{...} │ Pre-aggregated daily supervisor metrics     │
│ auditLogs/{auditId}           │ Administrative action audit trail           │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. Global Conventions & Standards

| Dimension | Standard Specification |
| :--- | :--- |
| **Timestamps** | Server timestamps generated with `FieldValue.serverTimestamp()`. Client timestamps stored as epoch milliseconds (`number`). |
| **Calendar Dates** | `YYYY-MM-DD` string computed authoritatively using `Asia/Kolkata` (UTC+05:30) for all V1 daily sessions, streak calculations, and question-set rotation. |
| **Identifiers** | Semantic prefixes: `org_` (organization), `daily_` (session), `att_` (attempt), `rel_` (release), `MG-` or `q_` (question), `aud_` (audit). |
| **Field Naming** | `camelCase` for Firestore document properties. |
| **Nullability** | No undefined fields; default to `0`, `false`, `""`, or `[]`. |

---

## 3. Detailed Collection & Document Schemas

---

### 3.1. Collection: `appConfig`

#### Path
`/appConfig/global`

#### Purpose
Stores global application runtime parameters, active content release pointer, default onboarding organization, minimum supported app version, and maintenance toggles.

#### Document ID
`global` (Singleton).

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `activeContentReleaseId` | `string` | Yes | `^rel_v\d+_\d+_\d+$` (e.g., `rel_v1_0_0`) | No | Platform Admin | Active question release for daily missions. |
| `defaultOrganizationId` | `string` | Yes | Valid organization ID (e.g., `org_rbsk_national`) | No | Platform Admin | Default tenant assigned during public self-registration. |
| `minimumSupportedAppVersion` | `string` | Yes | Semantic version (e.g., `1.0.0`) | No | Platform Admin | Enforces client PWA refresh if below version. |
| `maintenanceMode` | `boolean` | Yes | `true`, `false` | No | Platform Admin | Emergency maintenance lock. |
| `maintenanceMessage` | `string` | No | Free text | No | Platform Admin | Display message during maintenance. |
| `sessionConfig.questionCount` | `number` | Yes | Default: `10` | No | Platform Admin | Questions per daily mission. |
| `sessionConfig.selectionPolicy`| `string` | Yes | `CONTENT_DRIVEN_BALANCED` | No | Platform Admin | Algorithm policy for selecting 10 session questions from active release. |
| `sessionConfig.xpRewards` | `map` | Yes | `{ MCQ: 5, TRUE_FALSE: 5, PRACTICAL: 10, COMPLETION_BONUS: 10 }` | No | Platform Admin | XP reward schedule. |
| `updatedAt` | `timestamp` | Yes | Server timestamp | No | Cloud Function | Last configuration change. |
| `updatedBy` | `string` | Yes | Admin UID | No | Cloud Function | Admin who modified config. |

#### Security & Access
- **Read**: Authenticated users (`request.auth != null`).
- **Write**: `PLATFORM_ADMIN` only.
- **Client Direct Write**: **BLOCKED**.

---

### 3.2. Collection: `usernames`

#### Path
`/usernames/{username}`

#### Purpose
Internal reservation index tracking the lifecycle of unique usernames during registration to prevent duplicate accounts and handle race conditions. **Not exposed to clients.**

#### Document ID
Lowercased, normalized username: `^[a-z0-9._-]{3,30}$` (e.g., `sunita.patil`, `asha_wardha_01`).

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `username` | `string` | Yes | Normalized username string | Yes | Server (`registerWithUsername`) | The registered username key. |
| `uid` | `string` | No | Firebase Auth UID or null | No | Server (`registerWithUsername`) | Assigned user ID upon activation. |
| `status` | `string` | Yes | `RESERVED`, `ACTIVE` | No | Server (`registerWithUsername`) | Reservation lifecycle state. |
| `reservationId` | `string` | Yes | Unique operation UUID/token | Yes | Server (`registerWithUsername`) | Ownership token preventing cross-request compensation race conditions. |
| `reservedAt` | `timestamp` | Yes | Server timestamp | Yes | Server (`registerWithUsername`) | Timestamp when reservation was created. |
| `activatedAt` | `timestamp` | No | Server timestamp or null | No | Server (`registerWithUsername`) | Timestamp when Auth user was created. |

#### Security & Access
- **Read**: **BLOCKED FOR ALL CLIENTS** (No client enumeration allowed).
- **Write**: **BLOCKED FOR ALL CLIENTS** (Managed strictly by `registerWithUsername` Cloud Function using Firebase Admin SDK).

---

### 3.3. Collection: `organizations`

#### Path
`/organizations/{organizationId}`

#### Purpose
Healthcare agency tenant boundary (e.g., State National Health Mission, District Health Society, NGO Partner, RBSK program) providing administrative isolation and supervisor cohort scope.

#### Document ID
Deterministic slug: `^[a-z0-9_-]{3,64}$` (e.g., `org_nhm_maharashtra`, `org_rbsk_national`).

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `organizationId` | `string` | Yes | Slug format | Yes | Platform Admin | Unique tenant identifier. |
| `name` | `string` | Yes | Min 3, Max 120 chars | No | Platform Admin | Official organization name. |
| `type` | `string` | Yes | `STATE_NHM`, `DISTRICT_HEALTH_SOCIETY`, `NGO_PARTNER`, `RBSK_PROGRAM`, `PILOT` | No | Platform Admin | Tenant category. |
| `status` | `string` | Yes | `ACTIVE`, `SUSPENDED`, `ARCHIVED` | No | Platform Admin | Tenant operational status. |
| `state` | `string` | Yes | Indian State name | No | Platform Admin | Primary state jurisdiction. |
| `district` | `string` | No | Indian District name | No | Platform Admin | Primary district (if district-level). |
| `contactEmail` | `string` | Yes | Email format | No | Platform Admin | Administrative contact email. |
| `contactPhone` | `string` | No | Phone format | No | Platform Admin | Administrative contact phone. |
| `createdAt` | `timestamp` | Yes | Server timestamp | Yes | Cloud Function | Creation timestamp. |
| `updatedAt` | `timestamp` | Yes | Server timestamp | No | Cloud Function | Last update timestamp. |

#### Security & Access
- **Read**: Authenticated users belonging to this organization, or `PLATFORM_ADMIN`.
- **Write**: `PLATFORM_ADMIN` only.
- **Client Direct Write**: **BLOCKED**.

---

### 3.4. Collection: `users`

#### Path
`/users/{uid}`

#### Purpose
Master user profile and server-authoritative learning state for trainees, supervisors, content admins, and platform admins.

#### Document ID
Firebase Auth `uid`.

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `uid` | `string` | Yes | Firebase Auth UID | Yes | Server | Primary user key. |
| `username` | `string` | Yes | Normalized username | Yes | Server | Display and login handle. |
| `syntheticEmail` | `string` | Yes | `<username>@trainee.aisteth.internal` | Yes | Server | Firebase Auth email. |
| `optionalEmail` | `string` | No | Standard email format or `""` | No | User / Admin | Optional contact email (profile only). |
| `displayName` | `string` | Yes | Min 2, Max 80 chars | No | User / Admin | Frontline worker's full name. |
| `role` | `string` | Yes | `TRAINEE`, `SUPERVISOR`, `CONTENT_ADMIN`, `PLATFORM_ADMIN` | Yes* | Server | User role (Authoritative). |
| `organizationId` | `string` | Yes | Slug format | Yes* | Server | Healthcare agency tenant ID. |
| `designation` | `string` | Yes | `ASHA`, `ANM`, `CHO`, `RBSK_MO`, `SUPERVISOR`, `OTHER` | No | User / Admin | Clinical role title. |
| `healthSubCentre` | `string` | No | Free text | No | User | Local primary health centre / clinic (primary location). |
| `district` | `string` | No | Valid Indian district name (Legacy) | No | User | Deprecated / Optional legacy field. |
| `state` | `string` | No | Valid Indian state name (Legacy) | No | User | Deprecated / Optional legacy field. |
| `trainingTimeZone`| `string` | Yes | Default: `Asia/Kolkata` | No | User | Profile display metadata only. NOT used for V1 session date/rotation resolution. |
| `learningState.totalXp` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Cumulative experience points. |
| `learningState.currentLevel` | `number` | Yes | `1` to `5` (Default: `1`) | No | Server | Calculated level tier. |
| `learningState.currentStreak` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Consecutive active training days. |
| `learningState.longestStreak` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | All-time highest streak count. |
| `learningState.lastActiveDate` | `string` | No | `YYYY-MM-DD` or `null` | No | Server | Last completed training date. |
| `learningState.completedSessionsCount` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Total daily sessions finished. |
| `learningState.completedQuestionsCount` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Total questions answered. |
| `learningState.totalCorrectAnswersCount` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Total correct first attempts. |
| `learningState.streakShieldActive` | `boolean` | Yes | Default: `false` | No | Server | Unlocked at 30-day streak. |
| `learningState.streakShieldConsumed` | `boolean` | Yes | Default: `false` | No | Server | True if shield used to save streak. |
| `createdAt` | `timestamp` | Yes | Server timestamp | Yes | Server | Account creation date. |
| `updatedAt` | `timestamp` | Yes | Server timestamp | No | Server | Last profile modification (`serverTimestamp()` required). |
| `lastActiveAt` | `timestamp` | No | Server timestamp | No | Server | Last activity timestamp. |

#### Security & Access
- **Read**: Owner (`request.auth.uid == uid`), organization Supervisor, or `PLATFORM_ADMIN`.
- **Create**: **BLOCKED FOR CLIENTS** (Provisioned strictly via `registerWithUsername` Cloud Function).
- **Update**: Trainee can update personal profile fields (`displayName`, `designation`, `healthSubCentre`, `optionalEmail`, `trainingTimeZone`). Server-controlled fields (`uid`, `username`, `role`, `organizationId`, `learningState`, `lastActiveAt`, `createdAt`, `updatedAt`) are protected by Security Rules.
- **Delete**: `PLATFORM_ADMIN` only.

---

### 3.5. Subcollection: `dailySessions`

#### Path
`/users/{uid}/dailySessions/{sessionId}`

#### Purpose
Stores the daily 10-question training mission record for a specific user and calendar date. Trainees have **READ ONLY** access.

#### Document ID
Semantic string: `daily_{YYYY-MM-DD}_{sessionIdSuffix}`.

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sessionId` | `string` | Yes | ID format | Yes | Server | Unique session identifier. |
| `uid` | `string` | Yes | Firebase Auth UID | Yes | Server | Trainee ID. |
| `localDate` | `string` | Yes | `YYYY-MM-DD` | Yes | Server | User calendar date for session. |
| `contentReleaseId` | `string` | Yes | `rel_v1_0_0` | Yes | Server | Release ID used for session. |
| `status` | `string` | Yes | `NOT_STARTED`, `IN_PROGRESS`, `QUESTIONS_COMPLETED`, `REVIEW_VIEWED` | No | Server | Authoritative lifecycle state. |
| `questionIds` | `array<string>` | Yes | Array of 10 question IDs | Yes | Server | Ordered 10 questions selected by server policy. |
| `currentQuestionIndex` | `number` | Yes | `0` to `9` | No | Server | Current active question index. |
| `questionsCompleted` | `boolean` | Yes | Default: `false` | No | Server | True when 10 questions answered. |
| `reviewViewed` | `boolean` | Yes | Default: `false` | No | Server | True when final review dismissed. |
| `totalXpEarned` | `number` | Yes | `>= 0` (Default: `0`) | No | Server | Total XP gained in session. |
| `correctCount` | `number` | Yes | `0` to `10` | No | Server | Count of correct first attempts. |
| `accuracy` | `number` | Yes | `0.0` to `1.0` | No | Server | `correctCount / questionIds.length`. |
| `powerUpsUsed.HINT` | `array<string>` | Yes | Question IDs where Hint used | No | Server | Tracked power-up usage. |
| `powerUpsUsed.LEARN` | `array<string>` | Yes | Question IDs where Learn used | No | Server | Tracked power-up usage. |
| `powerUpsUsed.RETRY` | `array<string>` | Yes | Question IDs where Retry used | No | Server | Tracked power-up usage. |
| `startedAt` | `timestamp` | Yes | Server timestamp | Yes | Server | Session start timestamp. |
| `questionsCompletedAt` | `timestamp` | No | Server timestamp or null | No | Server | When 10th question completed. |
| `completedAt` | `timestamp` | No | Server timestamp or null | No | Server | When review marked viewed. |

#### Security & Access
- **Read**: Owner, organization Supervisor, or `PLATFORM_ADMIN`.
- **Write**: **BLOCKED FOR ALL CLIENTS**. Created and updated strictly via `startDailySession`, `submitAttempt`, and `finalizeDailySession` Cloud Functions.

---

### 3.6. Subcollection: `attempts`

#### Path
`/users/{uid}/attempts/{attemptId}`

#### Purpose
Append-only historical audit log of every question submission. Trainees have **READ ONLY** access.

#### Document ID
Semantic string: `att_{timestampMs}_{randomSuffix}`.

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `attemptId` | `string` | Yes | Unique attempt ID | Yes | Server | Primary attempt key. |
| `dailySessionId` | `string` | Yes | Session ID | Yes | Server | Associated daily session. |
| `uid` | `string` | Yes | Firebase Auth UID | Yes | Server | Trainee ID. |
| `questionId` | `string` | Yes | Question ID (e.g. `MG-AIL-01-TH`) | Yes | Server | Answered question ID. |
| `contentReleaseId` | `string` | Yes | `rel_v1_0_0` | Yes | Server | Version of question answered. |
| `questionIndex` | `number` | Yes | `0` to `9` | Yes | Server | Position in daily session. |
| `userAnswerPayload` | `map` | Yes | `{ type, selected_option }` | Yes | Server | Raw trainee response. |
| `result` | `string` | Yes | `CORRECT`, `INCORRECT` | Yes | Server | Server-evaluated result. |
| `xpAwarded` | `number` | Yes | `>= 0` | Yes | Server | XP credited for this attempt. |
| `isRetry` | `boolean` | Yes | Default: `false` | Yes | Server | True if this was a RETRY attempt. |
| `retryOfAttemptId` | `string` | No | Attempt ID or null | Yes | Server | Link to parent failed attempt. |
| `powerUpsActive` | `array<string>` | Yes | e.g. `["HINT"]` | Yes | Server | Power-ups active during attempt. |
| `clientTimestamp` | `number` | Yes | Epoch ms | Yes | Server | Client submission timestamp. |
| `serverTimestamp` | `timestamp` | Yes | Server timestamp | Yes | Server | Authoritative server receipt time. |

#### Security & Access
- **Read**: Owner, organization Supervisor, or `PLATFORM_ADMIN`.
- **Write**: **BLOCKED FOR ALL CLIENTS**. Created strictly by `submitAttempt` Cloud Function.

---

### 3.7. Collection: `contentReleases`

#### Path
`/contentReleases/{releaseId}`

#### Purpose
Immutable bundles of validated clinical questions. `AI_limitation.json` forms Release `rel_v1_0_0`.

#### Document ID
Release string: `rel_v{major}_{minor}_{patch}` (e.g., `rel_v1_0_0`).

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Immut | Written By | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `releaseId` | `string` | Yes | Semantic format | Yes | Content Admin | Unique release identifier. |
| `version` | `string` | Yes | `1.0.0` | Yes | Content Admin | Release semver string. |
| `name` | `string` | Yes | Free text | No | Content Admin | Release display title. |
| `description` | `string` | Yes | Free text | No | Content Admin | Release curriculum scope. |
| `status` | `string` | Yes | `DRAFT`, `VALIDATING`, `PUBLISHED`, `RETIRED` | No | Content Admin | Release lifecycle status. |
| `totalQuestions` | `number` | Yes | e.g. `20` | Yes | Content Admin | Total questions in bundle. |
| `publishedAt` | `timestamp` | No | Server timestamp | No | Server | Publication timestamp. |
| `publishedBy` | `string` | No | Admin UID | No | Server | Admin who published release. |

---

### 3.8. Subcollection: `questions` (under `contentReleases/{releaseId}`)

#### Path
`/contentReleases/{releaseId}/questions/{questionId}`

#### Purpose
Canonical clinical training questions supporting polymorphic renderer types (`MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION`).

#### Document ID
Canonical Question ID (e.g., `MG-AIL-01-TH`, `MG-AIL-01-PR`).

#### Field Definitions

| Field Name | Type | Req | Allowed Values / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `questionId` | `string` | Yes | `MG-AIL-01-TH`, etc. | Authoritative question identifier. |
| `contentReleaseId` | `string` | Yes | `rel_v1_0_0` | Parent release pointer. |
| `category` | `string` | Yes | `QUALITY_ASSESSMENT`, `DEVICE_HANDLING`, `HEART_RECORDING`, `ANATOMICAL_PLACEMENT` | Competency category. |
| `type` | `string` | Yes | `MCQ`, `TRUE_FALSE`, `IMAGE_TAP`, `STEP_ORDER`, `AUDIO_DISCRIMINATION` | Interaction renderer type. |
| `difficulty` | `string` | Yes | `BEGINNER`, `INTERMEDIATE`, `ADVANCED` | Broad difficulty classification. |
| `difficultyRank` | `number` | Yes | `1` to `10` (from `AI_limitation.json`) | Granular difficulty rank. |
| `audience` | `string` | Yes | `"RBSK"`, `"ASHA"`, `"ALL"` | Target frontline health audience. |
| `question` | `string` | Yes | Clinical scenario text | The question text presented to trainee. |
| `option_a` | `string` | No | Option string (if MCQ) | Choice A. |
| `option_b` | `string` | No | Option string (if MCQ) | Choice B. |
| `option_c` | `string` | No | Option string (if MCQ) | Choice C. |
| `option_d` | `string` | No | Option string (if MCQ) | Choice D. |
| `correctAnswer` | `any` | Yes | `'option_a'`, `true`, `{ x, y }`, etc. | Authoritative correct solution. |
| `explanation` | `string` | Yes | Clinical rationale string | Immediate micro-learning explanation. |
| `action` | `string` | Yes | Protocol action (e.g. `"Refer the child to a doctor."`) | Recommended clinical action. |
| `learningObjective`| `string` | Yes | Text string | Pedagogical goal of question. |
| `tags` | `array<string>`| Yes | e.g. `["ai_limitation", "cyanosis", "rbsk"]` | Topic tags for search and filtering. |
| `clinicianValidated`| `boolean` | Yes | `true` | Clinical validation status. |
| `source` | `string` | Yes | `'MEDGEMMA'` | Origin source identifier. |
| `version` | `string` | Yes | `'1.0.0'` | Question version string. |
| `medGemmaMetadata`| `map` | Yes | `{ questionType, difficultyRank, followUpFor, medGemmaTag, action }` | Preserved MedGemma curriculum metadata. |
| `createdAt` | `timestamp` | Yes | Server timestamp | Ingestion timestamp. |

---

### 3.9. Collection: `analytics`

#### Path
`/analytics/organizations/{organizationId}/dailyMetrics/{metricDocId}`

#### Purpose
Pre-aggregated daily supervisor analytics derived from raw `attempts` and `dailySessions`.

---

### 3.10. Collection: `auditLogs`

#### Path
`/auditLogs/{auditId}`

#### Purpose
Tamper-evident administrative audit log. Written strictly by server Cloud Functions.

---

## 4. Frontend IndexedDB Audit & Classification

| Object Store | Previous Role (Prototype) | New Architectural Classification | Migration Action |
| :--- | :--- | :--- | :--- |
| **`daily_sessions`** | Stored daily session progress locally | **KEEP AS OPTIONAL LOCAL UI CACHE** | Retain strictly as a transient render cache for zero-lag UI feedback. Server Firestore is the authoritative source. |
| **`user_stats`** | Calculated XP, streak, levels locally | **MIGRATE TO FIRESTORE** | Authoritative calculations move to Cloud Functions. Frontend displays server values. |
| **`user_profile`** | Stored profile credentials locally | **MIGRATE TO FIRESTORE** | Authoritative profile stored in `/users/{uid}`. Frontend syncs on auth state change. |
| **`session_records`**| Stored cumulative history locally | **REMOVE** | Replaced by direct queries on `/users/{uid}/dailySessions`. |

---

## 5. Security Rules Matrix

| Resource | Trainee | Supervisor | Content Admin | Platform Admin |
| :--- | :---: | :---: | :---: | :---: |
| `/appConfig/global` | Read | Read | Read | Read / Write |
| `/usernames/{username}` | **BLOCKED** | **BLOCKED** | **BLOCKED** | **BLOCKED (Server Fn Only)** |
| `/organizations/{orgId}` | Read (Own) | Read (Own) | Read (All) | Read / Write (All) |
| `/users/{uid}` | Read / Update Profile | Read (Own Org) | Read (All) | Read / Write (All) |
| `/users/{uid}/dailySessions` | Read (Own) | Read (Own Org) | **BLOCKED** | Read / Write (Server Fn Only) |
| `/users/{uid}/attempts` | Read (Own) | Read (Own Org) | **BLOCKED** | Read / Write (Server Fn Only) |
| `/contentReleases` (Published) | Read | Read | Read | Read / Write |
| `/analytics/organizations/...` | **BLOCKED** | Read (Own Org) | **BLOCKED** | Read / Write (All) |
| `/auditLogs` | **BLOCKED** | **BLOCKED** | **BLOCKED** | Read Only (Server writes) |
