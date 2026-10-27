# AiSteth Academy — Terminal Run Walkthrough

This guide explains step-by-step how to start and run the AiSteth Academy full-stack project (React frontend + Express backend) from your terminal.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or higher (v20+ recommended). Check with:
  ```bash
  node -v
  ```
- **npm**: v9.0.0 or higher. Check with:
  ```bash
  npm -v
  ```

---

## 2. One-Time Setup (Install Dependencies)

If you have not already installed dependencies for both root and backend, run:

```bash
# 1. Install root / frontend dependencies
npm install

# 2. Install backend dependencies
npm --prefix backend install
```

---

## 3. Running Locally (Recommended: Dual-Terminal Workflow)

The application uses a decoupled client-server architecture:
- **Backend API**: Node.js + Express running on `http://localhost:5000`
- **Frontend App**: React + Vite running on `http://localhost:3000` (with automated `/api` proxy to port 5000)

### Terminal 1: Start the Backend Server

Open your first terminal in the project root directory and run:

```bash
npm run backend:dev
```
*(Alternative: `cd backend && npm run dev`)*

**Expected output:**
```
[AiSteth Backend] Server listening on http://localhost:5000
[AiSteth Backend] Environment: development
[AiSteth Backend] Firebase Project: aisteth-academy-dev
```

---

### Terminal 2: Start the Frontend Application

Open a second terminal in the project root directory and run:

```bash
npm run dev
```

**Expected output:**
```
  VITE v6.0.3  ready in ~400 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

---

## 4. Open the App in Your Browser

Open your browser and navigate to:
```
http://localhost:3000
```

### What You Can Do in the App:
1. **Frontline Worker Sign-In (Admin-Led Onboarding)**:
   - Frontline RBSK workers log in directly using their provisioned phone number (e.g. `9876543210`) or username along with their temporary password provided by their program supervisor.
   - Public self-registration is eliminated for frontline workers to minimize technical friction.
   - Sessions rehydrate automatically across refreshes via HttpOnly cookies and Bearer tokens.
2. **Admin Dashboard (Platform Admin & Supervisors)**:
   - Elevated administrators access the portal at `#admin` (or click "Admin Dashboard" in the navigation drawer).
   - **Individual Onboarding**: Register single workers with role, phone, district, and health sub-centre with instant E.164 normalization and duplicate detection.
   - **Bulk CSV Import**: Drag & drop CSV spreadsheets with pre-import validation, duplicate collision checking, and error isolation.
   - **Account Management**: Edit worker details, deactivate accounts (instant session revocation + Auth lock), reactivate accounts, and regenerate temporary passwords with copyable access instructions.
3. **Daily 10-Question Training Mission**:
   - Complete today's server-authoritative clinical session.
   - Try Primary questions and observe remedial Follow-Up branching on incorrect answers.
4. **Clinical Vault (Unsolved Question Review)**:
   - Access via the **Clinical Vault** card on the home dashboard or navigate to `#unsolved`.
   - Review paired primary and remedial follow-up questions, change review statuses, and save reinforcement notes.
5. **Trainee Profile & Power-Ups**:
   - Access **My Profile** (`#profile`) to edit demographic details with live server synchronization.
   - Access **Power-Ups** (`#power-ups`) to inspect unlocked clinical tools (50/50, Learn, Streak Shield).

---

## 5. Running Tests & Code Quality Checks

You can run automated test suites directly from the terminal:

### Run All Workspace Tests (632 Tests)
```bash
npm test
```
*Executes all 41 test files including 632 unit and integration tests covering admin onboarding, account deactivation, credential regeneration, authentication, and clinical training.*

### Run Backend Tests Only
```bash
npm run backend:test
```

### Run Frontend Typecheck
```bash
npm run typecheck
```

---

## 6. Production Build & Run Workflow

If you want to test the compiled production artifacts rather than the dev servers:

```bash
# 1. Compile backend and bundle curriculum dataset
npm run backend:build

# 2. Typecheck and bundle frontend for production
npm run build

# 3. Start production backend server (Terminal 1)
npm --prefix backend start

# 4. Preview production frontend build (Terminal 2)
npm run preview
```

---

## 7. Troubleshooting & Common Questions

### Port 5000 or 3000 Already in Use
If another process is using port 5000 or 3000 on Windows:
```powershell
# Find process using port 5000:
netstat -ano | findstr :5000

# Stop process by PID (replace <PID>):
taskkill /F /PID <PID>
```

### PowerShell "running scripts is disabled" Error
If PowerShell warns that running scripts is disabled when launching npm commands, you can either:
- Run commands in standard **Command Prompt (cmd.exe)** or **Git Bash**.
- Or set execution policy for your current user in PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

### Backend Connection Errors in Frontend
Make sure **Terminal 1 (Backend)** is running before interacting with authenticated features in **Terminal 2 (Frontend)**. Vite proxies `/api/v1/*` requests directly to `http://localhost:5000`.
