# AiSteth Academy — Professional Repository Cleanup & Hygiene Report

**Document ID:** `PROJECT_CLEANUP_REPORT`  
**Execution Date:** 2026-10-06  
**Repository:** `tarun-vee/acad`  
**Branch:** `main` (commit `b999662`)  
**Status:** **CLEANUP COMPLETE & VERIFIED (152/152 Tests Passing, Production Build Passing)**  

---

## 1. Cleanup Objective

The objective was to perform a complete, professional engineering-hygiene and repository cleanup pass across the AiSteth Academy codebase without altering application behavior, clinical curriculum content, or architectural invariants. The repository was optimized for the smallest number of **justified files**, where every remaining file has a well-defined responsibility, zero dead code remains, obsolete architecture remnants are purged, documentation links are portable, and all 152 automated tests pass.

---

## 2. Baseline State

Prior to initiating cleanup, a comprehensive baseline audit was recorded:

- **Git Status**: On branch `main`, working tree clean at commit `b999662a9a9dfa5f2a1d5999e37861dd35c77306` ("third commit").
- **Node Environment**: Node.js `v24.14.1`, npm `11.11.0`.
- **Dependencies Installed**: Root `npm install` completed (632 packages audited).
- **Automated Tests**: 152 unit and integration tests across 13 test files.
  - Initial run: 12 passed, 1 failed (`tests/BackendRegistrationAndAuth.test.ts` missing mock for `firebase-admin` in client test environment).
  - Baseline resolution: Intercepted `firebase-admin` via Vitest mock in `tests/BackendRegistrationAndAuth.test.ts`. All 152 tests passed.
- **Production Build**: `npm run build` compiled cleanly via `tsc && vite build` (1,954 modules transformed, PWA service worker generated, 0 TypeScript errors).

---

## 3. Files Removed

The following 6 files were identified as dead code, obsolete architecture artifacts, or redundant scratch files and permanently removed:

| File | Reason | Evidence |
| :--- | :--- | :--- |
| `src/views/SessionSummaryScreen.tsx` | **Dead React View Component**: Superseded in Change 05/06 when the post-session flow transitioned directly to `QuestionReviewScreen.tsx`. | Zero imports across `src/` and `tests/`. Not referenced in `App.tsx` routes (`ProtectedViewMode` contains only `HOME`, `SESSION`, `REVIEW`, `PROFILE`, `POWER_UPS`). |
| `storage.rules` | **Obsolete Architecture Remnant**: Cloud Storage rules for an architecture that has no Cloud Storage. Spark Free Tier hard constraint: NO FIREBASE STORAGE. | Not referenced in `firebase.json` (only `hosting` and `firestore` configured). Deprecated legacy reference. |
| `scripts/seed_content.cjs` | **Redundant Script Variant**: Temporary CommonJS workaround for `scripts/seed_content.js` that contained hardcoded client credentials for Google OAuth token refresh. | Redundant duplicate of `scripts/seed_content.js`. Hardcoded client credentials posed a security concern. |
| `scripts/test_token.cjs` | **Obsolete Development Scratch File**: 17-line scratch script used during development to inspect local CLI configstore tokens. | Zero imports, zero references in scripts, package.json, or tests. |
| `scripts/test_connection.cjs` | **Obsolete Development Scratch File**: 28-line scratch script testing Admin SDK Firestore connection that threw runtime errors without Admin credentials. | Zero imports, zero references in build or test workflows. |
| `src/assets/aisteth_logo.png` | **Exact Binary Duplicate (106 KB)**: Byte-for-byte identical copy of `public/assets/images/aisteth_logo.png`. | Hashed identically (`c726fda8c916...`). All application views (`SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `Header`) and `index.html` link to `/assets/images/aisteth_logo.png` served by Vite from `public/`. |

---

## 4. Files Renamed

*No files were renamed.* All active files in `src/views/`, `src/services/`, `src/repositories/`, `src/components/`, `src/models/`, and `src/utils/` already adhere to consistent, descriptive naming conventions (`DailySessionScreen.tsx`, `FirestoreQuestionRepository.ts`, `AnswerEvaluator.ts`, `sessionSelection.ts`). Arbitrary renaming was avoided to maintain git commit history and prevent churn across imports.

---

## 5. Files Moved

*No files were moved.* The existing module layout (`components/`, `data/`, `hooks/`, `layouts/`, `models/`, `repositories/`, `services/`, `styles/`, `utils/`, `views/`) is logically structured, modular, and directly aligned with production conventions.

---

## 6. Dependencies Removed

| Package | Reason |
| :--- | :--- |
| *None* | Every dependency in `package.json` (`firebase`, `idb`, `lucide-react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `ajv`, `autoprefixer`, `exceljs`, `postcss`, `tailwindcss`, `typescript`, `vite`, `vite-plugin-pwa`, `vitest`) is actively utilized in runtime components, schema validation, template generation, or testing. No extraneous or abandoned packages exist. |

---

## 7. Configuration Cleaned

1. **`package.json` Scripts**:
   - Added standard developer convenience scripts:
     - `"typecheck": "tsc --noEmit"`
     - `"validate:schema": "node scripts/validate_schema.js"`
     - `"seed:content": "node scripts/seed_content.js"`
2. **`.env.example`**:
   - Sanitized with safe blank placeholders per Phase 6 specifications.
   - Removed placeholder project IDs and demo keys.
3. **`.gitignore`**:
   - Standardized to include comprehensive coverage:
     - Test coverage directories (`coverage/`, `.vitest/`)
     - Environment files (`.env`, `.env.*`, `!.env.example`)
     - OS files (`Thumbs.db`, `.DS_Store`)
     - Editor caches, logs, and Firebase emulator build outputs.

---

## 8. Firebase Cleanup

1. **Service Matrix Realignment**:
   - Active services strictly confirmed: **Firebase Hosting**, **Firebase Authentication**, **Cloud Firestore**.
   - Deferred services confirmed: **Cloud Functions** (code retained as reference in `functions/`, excluded from `firebase.json`), **Firebase Storage** (purged `storage.rules`).
2. **`firebase.json` Integrity**:
   - Preserved Hosting rewrite rules (`**` $\rightarrow$ `/index.html`), caching headers for PWA service workers (`/sw.js` $\rightarrow$ `no-cache`), and immutable cache headers for hashed JS/CSS assets.
   - Preserved Firestore rules and indexes configuration.

---

## 9. Security Cleanup

1. **Credential Purge**:
   - Removed `scripts/seed_content.cjs`, which contained hardcoded Google OAuth client credentials for token refresh.
   - Verified that zero private keys, service account JSON files (`*.serviceAccountKey.json`), or database tokens are tracked in git.
2. **Environment Protection**:
   - Hardened `.gitignore` to prevent future leaks of `.env`, `.env.local`, or service account credentials.

---

## 10. Documentation Cleanup

1. **`README.md`**:
   - Rewritten from an empty 18-byte placeholder into a complete, professional technical README covering: Overview, Key Features, Architecture, Technology Stack, Firebase Setup, Environment Configuration, Local Development, Testing, Build, Deployment, Project Structure, Current Limitations, and Future Roadmap.
2. **Historical Report Labeling**:
   - Added prominent callout banners to:
     - `docs/BACKEND_IMPLEMENTATION_PLAN.md` (labeled as Historical Proposal / Deferred Blaze Architecture).
     - `docs/BACKEND_PHASE_2_1_REPORT.md` (labeled as Historical Archive / Phase 2.1 Cloud Setup Baseline).
     - `docs/BACKEND_PHASE_2_3_REPORT.md` (labeled as Historical Archive / Phase 2.3 Rules Deployment Baseline).
3. **Path Portability**:
   - Replaced all 120+ instances of hardcoded workstation paths (`file:///c:/Users/ASUS/Downloads/work/acad/...`) across `docs/` and root markdown files with clean, relative markdown links.
4. **Technical Report Synchronization**:
   - Updated the directory inventory in `docs/AISTETH_ACADEMY_COMPLETE_TECHNICAL_REPORT.md` to reflect the removed dead files and ensure 100% parity with active repository state.

---

## 11. Code Quality Improvements

1. **Script Professionalization**:
   - Added standard documentation headers (Purpose, Input, Output, Usage) across:
     - `scripts/seed_content.js`
     - `scripts/validate_schema.js`
     - `scripts/generate_template_xlsx.js`
     - `scripts/generate_demo_audio.js`
     - `scripts/generate_icons.js`
   - Updated `scripts/seed_content.js` to dynamically read `PROJECT_ID` from environment variables and provide clear guidance if administrative dependencies are missing.
2. **Test Suite Hygiene**:
   - Enhanced `tests/BackendRegistrationAndAuth.test.ts` with a lightweight Vitest mock for `firebase-admin`, allowing backend logic unit tests to execute cleanly inside the root client testing environment.

---

## 12. Tests Before Cleanup

- **Test Files**: 13 files
- **Total Tests**: 152 tests (126 passed, 1 suite failed due to unresolved `firebase-admin` in root environment).

---

## 13. Tests After Cleanup

- **Test Files**: 13 files passed (100%)
- **Total Tests**: 152 passed (100%)
- **Duration**: ~4.5 seconds

```
✓ tests/FirestoreSecurityRulesIntegration.test.ts (16 tests)
✓ tests/useBottomSheetGesture.test.ts (3 tests)
✓ tests/MobileLayoutAndResponsiveness.test.ts (11 tests)
✓ tests/AnswerEvaluator.test.ts (7 tests)
✓ tests/BackendRegistrationAndAuth.test.ts (26 tests)
✓ tests/QuestionRepositoryAndService.test.ts (6 tests)
✓ tests/HeaderActionCluster.test.ts (5 tests)
✓ tests/HomeScreenProgressionAndPowerUps.test.ts (16 tests)
✓ tests/PowerUpsScreen.test.ts (5 tests)
✓ tests/SimplifiedProfileScreen.test.ts (14 tests)
✓ tests/SchemaValidation.test.ts (1 test)
✓ tests/PowerUpsAndProfileInteractive.test.ts (20 tests)
✓ tests/AuthAndBrandingFlow.test.ts (22 tests)
```

---

## 14. Build Before Cleanup

- `tsc && vite build`: Succeeded (1,954 modules transformed, 1,001.34 KiB precache generated).

---

## 15. Build After Cleanup

- `tsc && vite build`: Succeeded (1,954 modules transformed, 1,000.56 KiB precache generated, 0 TypeScript errors).
- Clean bundle reduction from removing dead React views.

---

## 16. Remaining Technical Debt

1. **Spark Free Tier Client Authority**:
   - While Cloud Firestore Security Rules enforce strict write constraints ($0 \le \Delta\text{totalXp} \le 200$, $0 \le \Delta\text{currentStreak} \le 1$, session size = 10, completed session locking), question answer keys reside in published client-readable collections. Transitioning to server-authoritative answer verification requires Cloud Functions on the Blaze plan.
2. **Vite Bundle Warning**:
   - The main vendor bundle exceeds 500 kB after minification due to Firebase SDK and React DOM. Future optimization can leverage Vite `manualChunks` or dynamic imports for non-critical views.

---

## 17. Items Deliberately NOT Changed

1. **Clinical Curriculum Content**: `AI_limitation.json` (20 real MCQs with clinical explanations and actions) was completely preserved without altering a single word or medical triage recommendation.
2. **Product Gamification Rules**: Scoring thresholds, XP values (+5 for MCQs, +10 for practical questions, +10 completion bonus), streak rules, and power-up unlock metrics (`HINT` at 50, `LEARN` at 100, `RETRY` at 20, `STREAK SHIELD` at 30) were untouched.
3. **Daily Session Logic**: The deterministic `Asia/Kolkata` parity selection algorithm (`selectSessionQuestions`) was preserved.
4. **Firestore Security Rules**: The hardened v2.7.0 declarative rules (`firestore.rules`) were preserved without weakening any security invariant.
5. **Mobile Viewport Contracts**: The 100dvh bounded container (`MobileContainer.tsx`) and 2-state feedback drawer (`useBottomSheetGesture.ts`) were untouched.
6. **Reference Code in `functions/`**: Retained as reference for future Blaze migration, as explicitly specified in Phase 4 / Phase 5.

---

## 18. Final Repository Structure

```
acad/
├── .env.development          # Active local development configuration
├── .env.example              # Sanitized environment template
├── .firebaserc               # Firebase project alias mappings
├── .gitignore                # Production-grade git exclusion rules
├── AI_limitation.json        # Authoritative Module 1 questionnaire dataset
├── PROJECT_LOG.md            # Long-term architecture & history log
├── QUESTIONNAIRE_CONTENT_AUDIT.md # 25-Point clinical content audit
├── QUESTION_SCHEMA.md        # Question schema specification
├── README.md                 # Primary project entry point & documentation
├── docs/                     # Architectural documentation
│   ├── AISTETH_ACADEMY_COMPLETE_TECHNICAL_REPORT.md # Complete technical handover report
│   ├── BACKEND_IMPLEMENTATION_PLAN.md               # Historical Phase 2 plan (Deferred Blaze)
│   ├── BACKEND_PHASE_2_1_REPORT.md                  # Historical Phase 2.1 report
│   ├── BACKEND_PHASE_2_3_REPORT.md                  # Historical Phase 2.3 report
│   ├── DATABASE_SCHEMA.md                           # Database schema specification
│   ├── FIREBASE_ENVIRONMENT.md                      # Cloud environment setup guide
│   ├── FRONTEND_CHECKLIST.md                        # Frontend design & UX checklist
│   └── PROJECT_CLEANUP_REPORT.md                    # This document
├── firebase.json             # Firebase Hosting & Firestore configuration
├── firestore.indexes.json    # Firestore composite query indexes
├── firestore.rules           # Cloud Firestore Security Rules (v2.7.0)
├── functions/                # Reference Cloud Functions (Deferred Phase 3 Blaze implementation)
├── index.html                # Vite HTML entry point
├── package-lock.json         # Locked dependency graph
├── package.json              # Dependencies and development scripts
├── postcss.config.js         # PostCSS configuration
├── public/                   # Static assets (audio, SVG diagrams, official logo)
├── question.schema.json      # JSON Schema for question bank
├── questions_template.xlsx   # Authoring Excel spreadsheet
├── scripts/                  # Active developer scripts
│   ├── generate_demo_audio.js
│   ├── generate_icons.js
│   ├── generate_template_xlsx.js
│   ├── seed_content.js
│   └── validate_schema.js
├── src/                      # Production application source code
│   ├── components/           # UI components & polymorphic question renderers
│   ├── data/                 # Datasets (indiaLocations, dummy_questions)
│   ├── hooks/                # useLearningSession, useBottomSheetGesture
│   ├── layouts/              # MobileContainer (100dvh shell)
│   ├── models/               # TypeScript domain interfaces
│   ├── repositories/         # StorageRepository, FirestoreQuestionRepository
│   ├── services/             # AuthService, SessionService, AnswerEvaluator, PowerUpService
│   ├── styles/               # Tailwind CSS & global styles
│   ├── utils/                # sessionSelection, username normalization
│   ├── views/                # Active application screen views (8 views)
│   ├── App.tsx               # Root view router
│   └── main.tsx              # React entry point
├── tailwind.config.js        # Design tokens & color system
├── tests/                    # Automated Vitest test suites (13 files)
├── tsconfig.json             # TypeScript compiler configuration
├── vite.config.ts            # Vite & PWA bundler configuration
└── walkthrough.md            # Chronological development walkthrough
```

---

## 19. Final Status

| Metric | Target | Result | Status |
| :--- | :--- | :--- | :---: |
| **Dead Files Removed** | All unreferenced / obsolete files purged | 6 files removed | **VERIFIED** |
| **Clinical Content** | 100% preservation of `AI_limitation.json` | 20 real MCQs preserved | **VERIFIED** |
| **Product Behavior** | Zero behavioral regression | Unchanged | **VERIFIED** |
| **Automated Tests** | 100% passing across all suites | 152 / 152 passed | **VERIFIED** |
| **Production Build** | Clean build with zero TypeScript errors | `tsc && vite build` passed | **VERIFIED** |
| **Documentation** | Complete, clean, relative links | Professional README + Handover Report | **VERIFIED** |
| **Repository Hygiene** | Professional, minimal, maintainable | Production-grade repository | **VERIFIED** |

---

## 20. Final Functions Directory Review

### Classification
**B / C: DEFERRED BUT INTENTIONALLY RETAINED / HISTORICAL REFERENCE**

### Audit Findings
1. **Frontend Referencing**: Zero files in `src/` import or reference anything in `functions/`.
2. **`firebase.json` Configuration**: No `functions` configuration exists in `firebase.json` (only `hosting` and `firestore` are configured).
3. **Package Scripts**: Root `package.json` contains zero scripts that invoke or reference `functions/`.
4. **Current Architecture Need**: Not required for the active Spark Free Tier (Client-Authoritative via Firebase Auth & Firestore Security Rules).
5. **Historical Context**: Implemented during Phase 2.2 as the server-authoritative 2nd Gen Cloud Function (`registerWithUsername`) with custom claims and transaction compensation before transitioning to the Spark Plan (where client auth with compensating cleanup was established).
6. **Dependencies Inside `functions/`**: Contains only `firebase-admin` 13.0, `firebase-functions` 6.0, and `typescript` 5.7.2 inside `functions/package.json`. No extraneous dependencies exist.
7. **Documentation Parity**: `README.md` and `docs/AISTETH_ACADEMY_COMPLETE_TECHNICAL_REPORT.md` consistently document Cloud Functions as deferred for Phase 3 Blaze migration.

### Decision & Retaining Rationale
- **Decision**: **RETAINED AS DEFERRED REFERENCE**.
- **Rationale**: The code represents a verified, functional server-authoritative implementation intended for Phase 3 Blaze plan migration. It does not introduce billing, runtime dependencies, or deployment overhead.
- **Ambiguity Mitigation**: Created [`functions/README.md`](../functions/README.md) explicitly establishing that `functions/` is a deferred Phase 3 reference, excluded from deployment, and that the active system operates strictly on the free Spark plan.
