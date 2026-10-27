# AiSteth Academy — Admin Dashboard Manual Testing Walkthrough

**Document:** `ADMIN_DASHBOARD_WALKTHROUGH.md`  
**Target Environment:** Local Development & Verification  
**Applicable Build:** AiSteth Academy (RBSK Trainee Learning Engine — Phase 1 & 2 Completed)  
**Date:** October 2026  

---

## Table of Contents
1. [How to Run the Application](#1-how-to-run-the-application)
2. [How to Access the Admin Dashboard](#2-how-to-access-the-admin-dashboard)
3. [Admin Dashboard Feature Inventory](#3-admin-dashboard-feature-inventory)
4. [Detailed Manual Test Cases](#4-detailed-manual-test-cases)
5. [Data Persistence Verification](#5-data-persistence-verification)
6. [Security Testing](#6-security-testing)
7. [Known Gaps and Missing Features](#7-known-gaps-and-missing-features)
8. [Test Results Tracker](#8-test-results-tracker)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. How to Run the Application

The AiSteth Academy architecture consists of an **Express/Node.js backend** (port `5000`) and a **Vite/React frontend** (port `3000`). The frontend dev server proxies all `/api` requests directly to `http://localhost:5000`.

### 1.1 Prerequisites
- **Node.js**: Version 18.x or 20.x installed (`node -v`).
- **npm**: Version 9.x or higher (`npm -v`).
- **Google Cloud / Firebase Service Account Key**:
  The backend automatically detects the service account key at:
  `C:\Users\I Health Highway\Downloads\TARUN PROJECT\credentials\aisteth-key.json`  
  (or via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable).
- **PowerShell Note (Windows)**: If running under Windows PowerShell where script execution is restricted, invoke `.cmd` binaries directly (e.g., `npm.cmd run dev`, `npx.cmd tsx`) or run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

---

### 1.2 Environment Configuration

#### Backend Configuration
The backend loads configuration from `backend/.env` (or environment defaults in [`backend/src/infrastructure/config/env.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/config/env.ts)):

```ini
# backend/.env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=aisteth-academy-dev
FIREBASE_WEB_API_KEY=AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA
FRONTEND_ORIGIN=http://localhost:3000
```

#### Frontend Configuration
The frontend dev server is configured in [`vite.config.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/vite.config.ts) to run on port `3000` with proxy rules routing `/api` to `http://localhost:5000`. No mandatory `.env` file is required for local dev, but you may optionally supply:

```ini
# .env (root)
VITE_API_BASE_URL=/api/v1
```

---

### 1.3 Step-by-Step Startup Commands

Open two separate terminal windows (Command Prompt or PowerShell):

#### Terminal 1: Start the Backend Server
```bash
# Navigate to the backend directory
cd backend

# Install dependencies (if not already installed)
npm install

# Start backend in development mode with live watch
npm run dev
```
*Expected Terminal 1 Output:*
```text
[server] AiSteth Academy Backend listening on port 5000
[server] Environment: development
[server] Firebase Project ID: aisteth-academy-dev
```

#### Terminal 2: Start the Frontend Application
```bash
# From the project root directory
npm install

# Start Vite dev server
npm run dev
```
*Expected Terminal 2 Output:*
```text
  VITE v6.0.3  ready in 450 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://<ip>:3000/
```

---

### 1.4 Verification of Running Services

1. **Verify Backend Healthcheck**:
   Open a browser or run curl:
   ```bash
   curl http://localhost:5000/api/v1/health
   ```
   *Expected Response:*
   ```json
   {
     "status": "HEALTHY",
     "service": "aisteth-academy-backend",
     "timestamp": "2026-10-23T..."
   }
   ```

2. **Verify Frontend**:
   Open a browser and navigate to:
   `http://localhost:3000/`  
   The AiSteth Academy authentication screen (Sign In) should display cleanly.

---

## 2. How to Access the Admin Dashboard

### 2.1 Navigation Path & URLs
- **Direct URL Route**: `http://localhost:3000/#admin`
- **In-App Navigation Route**:
  1. Log in with an administrator account.
  2. Tap the **Profile** icon in the header (or navigate to `http://localhost:3000/#profile`).
  3. Scroll to the **Administration** section (visible *only* for accounts with role `PLATFORM_ADMIN` or `SUPERVISOR`).
  4. Click the **Admin Dashboard** card button.

---

### 2.2 How Administrator Authentication Works
AiSteth Academy uses a unified Firebase Authentication system with role-based access control (RBAC):
1. **User Identity**: Users authenticate with `identifier` (username, phone number, or email) and `password` via `POST /api/v1/auth/login`.
2. **Session Storage**: The client stores an ephemeral in-memory JWT `Bearer` token and an `HttpOnly` refresh cookie.
3. **Role Verification**:
   - The backend middleware [`requireAdminRole`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/api/middlewares/admin.middleware.ts#L5-L42) inspects:
     1. The Firebase Auth Custom User Claim (`token.role === 'PLATFORM_ADMIN' || token.role === 'SUPERVISOR'`).
     2. If not present in the token claim, it queries the authoritative Firestore profile at `users/{uid}` and checks `userDoc.role`.
   - If neither condition is met, the backend rejects the request with HTTP **403 Forbidden** (`code: 'FORBIDDEN_NOT_ADMIN'`).

---

### 2.3 How to Create or Elevate a Test Administrator

Because the public registration form (`/api/v1/auth/register`) strictly registers learners with role `TRAINEE`, administrator privileges must be granted using the repository's administrative elevation utility.

#### Step 1: Create a Base Account
1. Open `http://localhost:3000/`.
2. Click **Don't have an account? Sign Up**.
3. Create an account with the following details:
   - **Full Name**: `Admin Test User`
   - **Username**: `admin_tester`
   - **Phone Number**: `9876543210`
   - **Designation**: `RBSK Medical Officer`
   - **District**: `Pune`
   - **State**: `Maharashtra`
   - **Password**: `AdminTest@123`
4. Submit the form. The account is created as a `TRAINEE`.

#### Step 2: Elevate the Account to `PLATFORM_ADMIN`
In your terminal, run the existing utility script [`backend/scripts/set_admin_role.js`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/scripts/set_admin_role.js):

```bash
node backend/scripts/set_admin_role.js admin_tester PLATFORM_ADMIN
```

*Expected Terminal Output:*
```text
Resolved username "admin_tester" to UID: <generated_uid>
[Firestore] Successfully updated users/<generated_uid>.role to "PLATFORM_ADMIN"
[Username Index] Created alias mapping usernames/admin_tester -> UID <generated_uid>
[Auth Claims] Successfully set custom claim { role: "PLATFORM_ADMIN" } on Auth user <generated_uid>

Elevation complete! User <generated_uid> now has PLATFORM_ADMIN access.
```

> **Note on Account Resolution**:
> The `set_admin_role.js` script supports multi-strategy resolution: you can pass the username (`admin_tester`), display name, registered email, or direct Firebase Auth UID. It updates both the Firestore document (`users/{uid}.role`) and the Firebase Auth Custom Claims (`{ role }`), preserving all existing profile fields (demographics, XP, streak).

#### Step 3: Refresh Authentication Session
If you were already logged in, sign out and sign back in so the browser receives an ID token containing the new custom claim.

---

### 2.4 Behavior for Ordinary Learners Attempting Admin Access

If an unprivileged trainee (role `TRAINEE`) attempts to access the dashboard:
1. **Via UI**: The **Administration** card in the Profile screen is hidden.
2. **Via Direct URL Hash** (`http://localhost:3000/#admin`):
   - The React UI renders the shell layout, but immediately issues API calls to `/api/v1/admin/overview` and `/api/v1/admin/learners`.
   - The backend returns HTTP `403 Forbidden`:
     ```json
     {
       "success": false,
       "error": "Access denied. Administrator privileges are required to access this resource.",
       "code": "FORBIDDEN_NOT_ADMIN"
     }
     ```
   - The UI displays a red error notice: *"Access denied. Administrator privileges are required to access this resource."*
   - No sensitive data, learner records, or metrics are shown.

---

## 3. Admin Dashboard Feature Inventory

Below is an exhaustive inventory of features currently implemented in the codebase:

```
[AiSteth Admin Portal]
├── Tab 1: Overview
│   ├── Total Registered Learners Card
│   ├── Active Trainees Card (7-day window)
│   ├── Pending WhatsApp Invites Card
│   ├── Failed Onboarding Card
│   └── Workflow Quick-Action Shortcuts
├── Tab 2: Learners Directory
│   ├── Full-Text Search (Name, Username, Phone)
│   ├── Status Filter Tabs (All, Not Sent, Delivered, Failed)
│   ├── Table Pagination (15 per page)
│   ├── Learner Detail Inspection Modal
│   └── Bulk WhatsApp Onboarding Trigger
├── Tab 3: Add Individual Learner
│   ├── Form Input (Name, Phone, Role, District, State, Centre, Password)
│   ├── Indian Mobile Regex Validation
│   ├── Post-Creation Success Card
│   └── Immediate WhatsApp Trigger Button
└── Tab 4: Bulk CSV Import
    ├── Download Sample Template (.csv)
    ├── File Upload & Parser
    ├── Client-Side Pre-Validation Preview Table
    ├── Row-by-Row Error Highlighting
    └── Batch Import Submission & Results Breakdown
```

---

### Feature 1: Overview Metrics & Status Banner
- **Location**: Tab: `Overview` (`#admin`)
- **Source Files**: [`src/views/admin/AdminOverview.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/views/admin/AdminOverview.tsx), [`AdminLearnerUseCase.ts:L32-76`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/application/usecases/AdminLearnerUseCase.ts#L32-L76)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoint**: `GET /api/v1/admin/overview`
- **Test Data**: Existing Firestore trainee collection
- **Testing Steps**:
  1. Open Admin Dashboard and select **Overview**.
  2. Verify that 4 metric cards load: Total Registered, Active Trainees, Pending WhatsApp, and Failed Onboarding.
  3. Click the **Learner Directory** quick-action shortcut card.
- **Expected Result**: Metric cards render numbers matching the database; shortcut switches view to the Learners Directory.
- **Persistence Verification**: Read-only aggregation.
- **Known Limitations**: Active trainees metric counts users with streak > 0 or active within 7 calendar days.

---

### Feature 2: Learner Directory Search & Status Filtering
- **Location**: Tab: `Learners Directory`
- **Source Files**: [`src/views/admin/AdminLearnerList.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/views/admin/AdminLearnerList.tsx), [`AdminLearnerUseCase.ts:L81-154`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/application/usecases/AdminLearnerUseCase.ts#L81-L154)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoint**: `GET /api/v1/admin/learners?page=1&limit=15&search=...&status=...`
- **Test Data**: Search query string (e.g. `987654` or trainee name)
- **Testing Steps**:
  1. Navigate to **Learners Directory**.
  2. Type a known phone number or trainee name into the search box.
  3. Wait 300ms for debounce.
  4. Click the filter tabs: **All**, **Not Sent**, **Delivered**, **Failed**.
- **Expected Result**: Table updates dynamically. Matching learners appear with their Clinical Progress (XP, Level, Streak) and Onboarding Status badge.
- **Persistence Verification**: N/A (read query).
- **Known Limitations**: Search is performed server-side over in-memory snapshot of trainees (case-insensitive substring on name, username, phone).

---

### Feature 3: Learner Detail Modal
- **Location**: Action column in `Learners Directory`
- **Source Files**: [`src/views/admin/LearnerDetailModal.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/views/admin/LearnerDetailModal.tsx), [`AdminLearnerUseCase.ts:L159-188`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/application/usecases/AdminLearnerUseCase.ts#L159-L188)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoint**: `GET /api/v1/admin/learners/:uid`
- **Testing Steps**:
  1. Click the **Eye icon** on any learner row in the directory.
  2. Inspect the opened modal.
- **Expected Result**: Modal displays complete profile (Health Sub Centre, District, State, Designation) and live learning state (XP, Level, Streak, Completed Sessions, Completed Questions).
- **Persistence Verification**: N/A.

---

### Feature 4: Single Learner Registration
- **Location**: Tab: `Add Individual`
- **Source Files**: [`src/views/admin/AdminAddLearner.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/views/admin/AdminAddLearner.tsx), [`AdminLearnerUseCase.ts:L193-301`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/application/usecases/AdminLearnerUseCase.ts#L193-L301), [`FirestoreUserRepository.ts:L344-375`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/firestore/FirestoreUserRepository.ts#L344-L375)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoint**: `POST /api/v1/admin/learners`
- **Test Data**:
  ```json
  {
    "displayName": "Rani Mukherjee",
    "phoneNumber": "9811122233",
    "designation": "ASHA_WORKER",
    "district": "Pune",
    "state": "Maharashtra",
    "healthSubCentre": "Bavdhan SC"
  }
  ```
- **Testing Steps**:
  1. Navigate to **Add Individual**.
  2. Fill in Full Name, 10-digit mobile number, District, State.
  3. Leave Username blank (verify auto-generation to `trainee_9811122233`).
  4. Click **Register Learner**.
- **Expected Result**: A green success card appears showing the assigned UID, Username, and initial password (`Welcome@2233`).
- **Persistence Verification**:
  - In Firestore, verify `users/{uid}` exists with role `TRAINEE` and `onboardingStatus: "NOT_INITIATED"`.
  - Verify `phone_numbers/+919811122233` exists with `status: "ACTIVE"`.
- **Known Limitations**: Passwords default to `Welcome@<last4digits>` if omitted.

---

### Feature 5: Bulk CSV Learner Import
- **Location**: Tab: `Bulk CSV Import`
- **Source Files**: [`src/views/admin/AdminBulkImport.tsx`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/src/views/admin/AdminBulkImport.tsx), [`AdminLearnerUseCase.ts:L306-460`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/application/usecases/AdminLearnerUseCase.ts#L306-L460)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoint**: `POST /api/v1/admin/learners/bulk`
- **Testing Steps**:
  1. Navigate to **Bulk CSV Import**.
  2. Click **Download Sample CSV Template** (`aisteth_learners_sample.csv`).
  3. Upload the sample file or a custom CSV.
  4. Inspect the pre-validation table for valid vs invalid rows.
  5. Click **Import Valid Learners**.
- **Expected Result**: Shows an import summary: `X Success, Y Skipped Duplicates, Z Failed`.
- **Persistence Verification**: The new learners appear immediately in the **Learners Directory**.

---

### Feature 6: WhatsApp Onboarding Dispatch (Stub)
- **Location**: `LearnerDetailModal` or checkbox action in `Learners Directory`
- **Source Files**: [`WhatsAppOnboardingService.ts`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/external/WhatsAppOnboardingService.ts), [`admin.routes.ts:L17-18`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/api/routes/admin.routes.ts#L17-L18)
- **Required Permission**: `PLATFORM_ADMIN` or `SUPERVISOR`
- **Backend Endpoints**:
  - `POST /api/v1/admin/learners/:uid/whatsapp-onboard`
  - `POST /api/v1/admin/learners/bulk-whatsapp-onboard`
- **Testing Steps**:
  1. Open a learner's detail modal.
  2. Click **Trigger WhatsApp Onboarding**.
- **Expected Result**: Updates Firestore `onboardingStatus` to `SENT` and returns a success notification.
- **Persistence Verification**: Verify `users/{uid}.onboardingStatus` is `SENT` in Firestore.
- **Known Limitations**: This is an outbound status stub. Live WhatsApp messages will not be sent to real devices until Meta WhatsApp credentials are configured in Phase 2.

---

## 4. Detailed Manual Test Cases

### TC-001: Administrator Login
**Objective:** Verify that an authorized administrator can log in and reach the dashboard.  
**Preconditions:**
- Backend running on `http://localhost:5000`.
- Frontend running on `http://localhost:3000`.
- Account elevated to `PLATFORM_ADMIN` via `set_admin_role.js`.  

**Steps:**
1. Open `http://localhost:3000/`.
2. Enter the administrator's username and password.
3. Click **Sign In**.
4. Tap the **Profile** icon in the header.
5. Click **Admin Dashboard**.  

**Expected Result:**
- Dashboard opens at `http://localhost:3000/#admin`.
- Sidebar navigation shows: Overview, Learners Directory, Add Individual, Bulk CSV Import.
- The administrator's name appears in the lower left profile card.  

**Verification:** Check Network tab: `POST /api/v1/auth/login` returns HTTP 200 with profile object.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-002: Rejection of Unauthenticated Requests
**Objective:** Verify that unauthenticated requests to administrative endpoints return HTTP 401.  
**Preconditions:** Backend running.  
**Steps:**
1. Open a terminal or API client (Postman/curl).
2. Execute:
   ```bash
   curl -i http://localhost:5000/api/v1/admin/overview
   ```  
**Expected Result:**
- HTTP status: `401 Unauthorized`.
- JSON body:
  ```json
  {
    "success": false,
    "error": "Authentication required. No authorization token provided."
  }
  ```  
**Verification:** Inspect response status and headers.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-003: Rejection of Unauthorized Learner (RBAC Check)
**Objective:** Verify that a standard learner cannot access administrative endpoints or view admin data.  
**Preconditions:**
- Standard trainee account (role `TRAINEE`) created.  

**Steps:**
1. Log in as standard trainee at `http://localhost:3000/`.
2. Verify that the **Admin Dashboard** button is NOT present in the Profile view.
3. Manually type `http://localhost:3000/#admin` into the browser URL bar.  

**Expected Result:**
- The UI renders the admin container, but displays an alert:  
  *"Access denied. Administrator privileges are required to access this resource."*
- All metric cards display error states; no learner records are shown.
- Network tab shows `GET /api/v1/admin/overview` returning HTTP `403 Forbidden` (`FORBIDDEN_NOT_ADMIN`).  

**Verification:** Inspect the network response in browser devtools.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-004: Overview Metric Counts
**Objective:** Verify that the 4 overview metrics accurately reflect database records.  
**Preconditions:** Administrator logged in.  
**Steps:**
1. Navigate to **Overview**.
2. Note the count for **Total Registered**.
3. Navigate to **Learners Directory**.  

**Expected Result:**
- Total number of learners shown in directory matches the **Total Registered** metric.  

**Verification:** Compare `stats.totalLearners` from `/api/v1/admin/overview` with `res.total` from `/api/v1/admin/learners`.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-005: Learner Full-Text Search
**Objective:** Verify search filtering by name, username, and mobile number.  
**Preconditions:** Multiple learners exist in database.  
**Steps:**
1. Navigate to **Learners Directory**.
2. Type 5 digits of an existing learner's phone number into the search box.
3. Observe the table filtering after 300ms.
4. Clear the search and type the learner's first name.  

**Expected Result:**
- Table instantly narrows to rows matching the phone number or name.
- Pagination recalculates total matching pages.  

**Verification:** Inspect query parameters in Network tab: `GET /api/v1/admin/learners?search=...`.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-006: Status Filter Tabs
**Objective:** Verify learner filtering by onboarding status.  
**Preconditions:** Learners with different statuses exist.  
**Steps:**
1. In **Learners Directory**, click the **Not Sent** tab.
2. Verify all rows have grey **Not Initiated** badges.
3. Click the **Delivered** tab.
4. Verify all rows have green **Delivered** badges.  

**Expected Result:**
- The list filters correctly by status; counts adjust.  

**Verification:** Check query param `status=NOT_INITIATED` or `status=SENT`.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-007: Single Learner Registration (Standard Flow)
**Objective:** Verify successful creation of an individual learner.  
**Preconditions:** Administrator logged in.  
**Steps:**
1. Navigate to **Add Individual**.
2. Enter:
   - Full Name: `Suman Lata`
   - Phone Number: `9876501234`
   - Designation: `ASHA Worker`
   - District: `Nagpur`
   - State: `Maharashtra`
   - Health Sub Centre: `Ramtek PHC`
3. Click **Register Learner**.  

**Expected Result:**
- Green success banner appears.
- Assigned username displays as `trainee_9876501234`.
- Temporary password displays as `Welcome@1234`.  

**Verification:** Navigate to **Learners Directory** and search for `9876501234`. Verify Suman Lata appears.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-008: Duplicate Phone Rejection
**Objective:** Verify that registering an already registered phone number is blocked.  
**Preconditions:** Phone number `9876501234` was registered in TC-007.  
**Steps:**
1. In **Add Individual**, attempt to register another trainee with phone `9876501234`.
2. Click **Register Learner**.  

**Expected Result:**
- Form submission is rejected.
- Red error alert displays:  
  *"A learner with phone number +919876501234 is already registered."*
- No duplicate record is created.  

**Verification:** Inspect network response: returns HTTP 400 or 409 with duplicate error message.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-009: Invalid Phone Number Validation
**Objective:** Verify client and server-side rejection of malformed phone numbers.  
**Preconditions:** Administrator on **Add Individual** tab.  
**Steps:**
1. Enter Phone Number: `12345` (too short).
2. Click **Register Learner**.
3. Enter Phone Number: `5555555555` (starts with 5; invalid in India).
4. Click **Register Learner**.  

**Expected Result:**
- Client-side validation stops submission.
- Field error states: *"Enter a valid 10-digit Indian mobile number (e.g. 9876543210)."*  

**Verification:** Verify no network request is sent when validation fails.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-010: Bulk CSV Import with Valid File
**Objective:** Verify bulk import of multiple learners via CSV.  
**Preconditions:** Valid CSV prepared.  
**Steps:**
1. Navigate to **Bulk CSV Import**.
2. Click **Download Sample CSV Template**.
3. Open the downloaded CSV and adjust phone numbers to unique numbers (e.g. `9820000001`, `9820000002`).
4. Upload the file.
5. Verify that the pre-validation table shows valid status for all rows.
6. Click **Import Valid Learners**.  

**Expected Result:**
- Import results panel displays: `Success: 2, Skipped: 0, Failed: 0`.
- Learners appear immediately in the Learners Directory.  

**Verification:** Check Firestore `users` collection to confirm created profiles.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-011: Bulk CSV Import Row-Level Error Isolation
**Objective:** Verify that invalid or duplicate rows in a CSV do not block valid rows.  
**Preconditions:** Prepare a CSV containing 3 rows:
- Row 1: Valid learner (`9830000001`).
- Row 2: Malformed phone `12345`.
- Row 3: Duplicate phone `9830000001` (same as Row 1).  

**Steps:**
1. Upload the CSV on **Bulk CSV Import**.
2. Inspect the pre-validation table.  

**Expected Result:**
- Row 1 shows green valid badge.
- Row 2 highlights in red with error: *"Invalid Phone Format"*.
- Row 3 highlights with warning: *"Duplicate in file"*.
- Submit button shows: **Import 1 Valid Learners**.
- Clicking submit imports Row 1 successfully while skipping Rows 2 and 3.  

**Verification:** Verify only 1 new learner record was created in database.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-012: Learner Details Progress Inspection
**Objective:** Verify that live learning metrics (XP, streak, level) display accurately in the modal.  
**Preconditions:** A learner who has completed at least one session exists.  
**Steps:**
1. Open **Learners Directory**.
2. Locate the active learner.
3. Click the **Eye icon** to view details.  

**Expected Result:**
- Progress cards accurately show:
  - Total Points / XP.
  - Active Streak (🔥).
  - Current Level.
  - Completed Questions and Completed Sessions.  

**Verification:** Compare values in modal with `users/{uid}.learningState` in Firestore.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-013: Bulk WhatsApp Onboarding Dispatch
**Objective:** Verify batch selection and onboarding trigger.  
**Preconditions:** Multiple learners with status `NOT_INITIATED` exist.  
**Steps:**
1. In **Learners Directory**, check the top **Select All** checkbox (or select 2 individual checkboxes).
2. The blue bulk action bar appears: *"2 learners selected"*.
3. Click **Bulk WhatsApp Invite**.  

**Expected Result:**
- Button enters loading state.
- Notification banner confirms: *"Batch processed: 2 sent successfully"*.
- Selected learners' status badges change from `Not Initiated` to `Delivered`.  

**Verification:** Network tab shows `POST /api/v1/admin/learners/bulk-whatsapp-onboard` returning HTTP 200.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-014: Return to Learner Training Mode
**Objective:** Verify seamless switching between Admin Dashboard and Trainee mobile view.  
**Preconditions:** Administrator on Admin Dashboard.  
**Steps:**
1. In the sidebar or top header, click **Switch to Learner View** / **Learner Training Mode**.  

**Expected Result:**
- Admin portal exits.
- Trainee Mobile View opens (`HomeScreen` at `http://localhost:3000/#`).
- Progress card, Daily Session button, and Streak badge are fully functional.  

**Verification:** URL hash changes from `#admin` to empty or `#home`.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

### TC-015: Responsive Mobile Drawer Navigation
**Objective:** Verify administrative usability on mobile / tablet screens.  
**Preconditions:** Browser in responsive mode (width < 768px).  
**Steps:**
1. Resize browser window to mobile width (e.g. 390px).
2. Verify top bar displays with hamburger menu icon.
3. Click the hamburger icon.
4. Select **Add Individual**.  

**Expected Result:**
- Mobile navigation drawer slides down smoothly.
- Selecting a tab navigates to that section and closes the drawer.  

**Verification:** Visually verify no horizontal scrollbars or clipping.  
**Status:** [ ] PASS [ ] FAIL [ ] BLOCKED  

---

## 5. Data Persistence Verification

When testing features that create or alter data, verify persistence through the following checks:

### 5.1 Verification Checklist for Learner Registration
After registering a learner (e.g., phone `9876543210`, username `trainee_9876543210`):

1. **Verify in Firestore `users` collection**:
   - Document ID: `<uid>`
   - `phoneNumber`: `"+919876543210"`
   - `role`: `"TRAINEE"`
   - `onboardingStatus`: `"NOT_INITIATED"`
   - `learningState.totalXp`: `0`
   - `learningState.currentStreak`: `0`
   - `learningState.currentLevel`: `1`

2. **Verify in Firestore `phone_numbers` collection**:
   - Document ID: `"+919876543210"`
   - `uid`: `<uid>`
   - `status`: `"ACTIVE"`

3. **Verify in Firebase Authentication**:
   - User account exists with email `trainee_9876543210@aisteth.internal`.

4. **Verify Persistence Across Refresh**:
   - Refresh the page (`F5`).
   - Search for `9876543210` in **Learners Directory**.
   - The learner must continue to appear with all details intact.

---

## 6. Security Testing

Perform these non-destructive security checks to ensure administrative isolation:

### 6.1 Protected Route Tampering
- **Test:** Open browser console and attempt to call admin endpoints using standard learner token:
  ```javascript
  fetch('/api/v1/admin/overview', {
    headers: { Authorization: `Bearer ${learnerToken}` }
  }).then(r => console.log(r.status));
  ```
- **Expected Result:** Status `403` with `{ code: "FORBIDDEN_NOT_ADMIN" }`.

### 6.2 Profile Privilege Escalation Prevention
- **Test:** A learner issues `PATCH /api/v1/users/me` with payload `{ "role": "PLATFORM_ADMIN" }`.
- **Expected Result:** The backend profile update logic strips `role` from the update payload ([`FirestoreUserRepository.ts:L195-212`](file:///c:/Users/I%20Health%20Highway/Downloads/TARUN%20PROJECT/acad/backend/src/infrastructure/firestore/FirestoreUserRepository.ts#L195-L212)). The learner's role remains `TRAINEE`.

### 6.3 Password Masking
- **Test:** Inspect responses from `GET /api/v1/admin/learners` and `GET /api/v1/admin/learners/:uid`.
- **Expected Result:** Neither response includes hashed passwords, password salts, or synthetic email credentials.

---

## 7. Known Gaps and Missing Features

| Administrative Feature | Architecture Status | Implementation Status | Notes |
| :--- | :--- | :--- | :--- |
| **Learner Directory & Search** | Required | **IMPLEMENTED** | Debounce, text search, onboarding & account status filters. |
| **Single Learner Registration** | Required | **IMPLEMENTED** | Indian E.164 normalization, atomic phone mapping. |
| **Bulk CSV Import** | Required | **IMPLEMENTED** | Preview parser with row-level validation. |
| **Worker Details Editing** | Required | **IMPLEMENTED** | Updates name, role, location, and re-anchors phone reservation. |
| **Account Deactivation / Reactivation** | Required | **IMPLEMENTED** | Revokes JWT sessions and disables Firebase Auth record. |
| **Credential Reset & Instructions** | Required | **IMPLEMENTED** | Generates secure temp password and formatted access notice. |
| **Admin-Led Sign-In Guidance** | Required | **IMPLEMENTED** | Explains supervisor provisioning on worker login screen. |
| **Role Elevation via CLI** | Required | **IMPLEMENTED** | `backend/scripts/set_admin_role.js`. |
| **Admin Overview Metrics** | Required | **IMPLEMENTED** | Real-time counts for active, deactivated, and onboarding. |
| **WhatsApp Onboarding Trigger** | Required | **STUB / DOCS** | Status tracking active; Engagelo API contract verified. |
| **Question Bank CRUD (Edit/Create)** | Future | **NOT IMPLEMENTED** | Curriculum is read-only from `all_topics_questions.json`. |
| **Language & Translation Console** | Future | **NOT IMPLEMENTED** | English clinical dataset currently supported. |
| **Scheduled Notification Engine** | Future | **NOT IMPLEMENTED** | Cron-based dispatch to be added in WhatsApp phase. |
| **Audit Logs Viewer** | Future | **NOT IMPLEMENTED** | System logs reside in server console. |

---

## 8. Test Results Tracker

Use this tracking table during your manual testing session. Initial status for all test cases is `NOT TESTED`:

| Test ID | Feature | Priority | Status | Bug / Observation |
|---|---|---|---|---|
| **TC-001** | Administrator Login & Dashboard Access | P0 | NOT TESTED | |
| **TC-002** | Unauthenticated Access Rejection (401) | P0 | NOT TESTED | |
| **TC-003** | Unauthorized Learner Access Rejection (403) | P0 | NOT TESTED | |
| **TC-004** | Overview Metric Counters Verification | P1 | NOT TESTED | |
| **TC-005** | Learner Full-Text Search (Name, Phone) | P1 | NOT TESTED | |
| **TC-006** | Status Filter Tabs (Account Status & Onboarding) | P2 | NOT TESTED | |
| **TC-007** | Single Learner Registration & Phone Mapping | P0 | NOT TESTED | |
| **TC-008** | Duplicate Phone Registration Rejection | P0 | NOT TESTED | |
| **TC-009** | Invalid Phone Number Client/Server Validation | P1 | NOT TESTED | |
| **TC-010** | Bulk CSV Import with Valid File | P0 | NOT TESTED | |
| **TC-011** | Bulk CSV Import Row-Level Error Isolation | P1 | NOT TESTED | |
| **TC-012** | Learner Details Progress & XP Inspection | P1 | NOT TESTED | |
| **TC-013** | Bulk WhatsApp Onboarding Trigger (Stub) | P2 | NOT TESTED | |
| **TC-014** | Switch to Learner Training Mode | P2 | NOT TESTED | |
| **TC-015** | Mobile & Tablet Responsive Navigation | P2 | NOT TESTED | |
| **TC-016** | Learner Account Details Edit & Phone Re-anchoring | P1 | NOT TESTED | |
| **TC-017** | Learner Account Deactivation & Session Revocation | P0 | NOT TESTED | |
| **TC-018** | Learner Credential Regeneration & Instructions Card | P0 | NOT TESTED | |
| **TC-019** | Frontline Worker Sign-In with Provisioned Credentials | P0 | NOT TESTED | |

---

## 9. Troubleshooting

### 1. Backend fails to start with `Error: Cannot find module`
- **Cause**: Dataset or build artifacts not copied.
- **Fix**: Run `npm run build` in `backend/` to trigger dataset copy and TypeScript compilation:
  ```bash
  cd backend && npm run build
  ```

### 2. Firebase Initialization Error (`GOOGLE_APPLICATION_CREDENTIALS`)
- **Cause**: Service account key not detected.
- **Fix**: The backend automatically looks in:
  `C:\Users\I Health Highway\Downloads\TARUN PROJECT\credentials\aisteth-key.json`  
  If moved, explicitly set the variable before starting:
  ```bash
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\aisteth-key.json"
  ```

### 3. Administrator Role Not Recognized (HTTP 403)
- **Cause**: User account was created, but role was not elevated or session token is stale.
- **Fix**:
  1. Elevate user:
     ```bash
     node backend/scripts/set_admin_role.js <username_or_uid> PLATFORM_ADMIN
     ```
  2. Sign out in the browser and sign back in to obtain a refreshed JWT containing the claim.

### 4. Port 3000 or 5000 Already in Use
- **Cause**: A previous server instance is still running in the background.
- **Fix (Windows Command Prompt / PowerShell)**:
  ```powershell
  # Find process occupying port 5000
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  
  # Find process occupying port 3000
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```

### 5. CSV Import Fails with "Missing required columns"
- **Cause**: Header row does not contain recognized column names.
- **Fix**: Ensure your CSV has at least `Full Name` and `Phone Number` in the first row. Use the **Download Sample CSV Template** button inside the Bulk Import tab as a baseline.
