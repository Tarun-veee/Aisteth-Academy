# AiSteth Academy — Firebase Cloud Environment & Deployment Guide

**Document Version:** `2.6.0-PROD-GUIDE`  
**Architecture Baseline:** Frozen Specification v2.6.0  
**Target Platform:** Firebase Hosting (Frontend PWA) + Google Firebase Cloud Services  
**Scope:** Direct Cloud Development, Staging, and Production Environment Management  

---

## 1. Multi-Project Cloud Topology

AiSteth Academy operates on a direct cloud-first model across three separate Google Firebase Cloud projects with Firebase Hosting.

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

### 1.1 Project Topology

| Environment | Firebase Project ID | Firebase Hosting URL | Purpose / Scope |
| :--- | :--- | :--- | :--- |
| **Development** | `aisteth-academy-dev` | `https://aisteth-academy-dev.web.app` | Engineering development, Cloud Functions iteration, test accounts, live `AI_limitation.json` questionnaire dataset. |
| **Staging** | `aisteth-academy-staging` | `https://aisteth-academy-staging.web.app` | Pre-release QA, supervisor pilot verification, end-to-end multi-tenant validation. |
| **Production** | `aisteth-academy-prod` | `https://aisteth-academy-prod.web.app` | Live clinical training deployment for frontline healthcare workers. |

> [!IMPORTANT]
> **No Local Emulators**: The project workflow does NOT use local Firebase emulators or localhost emulation endpoints. The frontend and backend connect directly to real Firebase Cloud services (`aisteth-academy-dev`).

---

## 2. Enabled Cloud Services

1. **Firebase Authentication (Username / Password)**:
   - Frontline trainees authenticate using normalized `username` mapped to an internal synthetic email (`<username>@trainee.aisteth.internal`).
2. **Cloud Firestore (Native Cloud Mode)**:
   - Server-authoritative primary database for profiles, daily missions, append-only attempt logs, and pre-aggregated analytics.
   - Enforces **READ ONLY** trainee permissions on `/users/{uid}/dailySessions` and `/users/{uid}/attempts`.
3. **Firebase Cloud Storage**:
   - Hosts immutable content release assets (stethoscope audio `.mp3` and diagram `.svg` files).
4. **Cloud Functions for Firebase (2nd Gen / Node 20)**:
   - Authoritative business logic execution (`registerWithUsername`, `startDailySession`, `submitAttempt`, `finalizeDailySession`).
5. **Firebase App Check**:
   - Protects Cloud Functions and Firestore from unverified external clients.

---

## 3. Environment Configuration & Firebase Hosting Integration

Client-side environment variables in Vite are prefixed with `VITE_` and injected into the client bundle at build time.

### 3.1 Supported Environment Variables

| Variable Name | Environment | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `VITE_FIREBASE_PROJECT_ID` | All | `aisteth-academy-dev` | Firebase Project ID. |
| `VITE_FIREBASE_API_KEY` | Dev | `AIzaSy...` (Web API Key) | Firebase Web API Key (public client identifier). |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dev | `aisteth-academy-dev.firebaseapp.com` | Auth redirect domain. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Dev | `aisteth-academy-dev.firebasestorage.app` | Cloud Storage bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Dev | `000000000000` | Cloud Messaging Sender ID. |
| `VITE_FIREBASE_APP_ID` | Dev | `1:...:web:...` | Firebase Web App ID. |
| `VITE_APP_ENV` | Dev | `development` | Runtime environment name. |
| `VITE_DEFAULT_TIMEZONE` | All | `Asia/Kolkata` | Calendar date boundary timezone (UTC+05:30). |
| `VITE_APP_VERSION` | All | `1.0.0` | Application release version. |

### 3.2 Environment Files

- [`.env.example`](../.env.example): Committed template documenting all supported environment keys and safe defaults.
- [`.env.development`](../.env.development): Committed development configuration pointing to `aisteth-academy-dev`.
- `.env.local`: **Ignored by Git**. Used by developers for machine-specific overrides.
- **Firebase Hosting Deployment**: Deployed directly via `firebase deploy --only hosting --project <project-id>`.

---

## 4. Security Boundaries & Credential Policies

### 4.1 Strict Rules: What Must NEVER Be Committed

> [!CAUTION]
> The following files and secrets must NEVER be committed to Git:
> - **Service Account Private Key JSONs** (`*.serviceAccountKey.json`, `*firebase-adminsdk*.json`).
> - **Production API Keys or Environment Files** (`.env.production`, `.env.local` containing live secrets).
> - **Firebase App Check Secret Keys**.
> - **Firebase CI/CD deployment tokens** (`FIREBASE_TOKEN`).

These exclusions are strictly enforced in [`.gitignore`](../.gitignore).

### 4.2 Client-Safe vs Server-Only Credentials

| Credential Type | Permitted Location | Exposure Risk | Purpose |
| :--- | :--- | :--- | :--- |
| **Firebase Web Config** (`apiKey`, `projectId`, `appId`) | Client App (`.env.development`, Firebase Hosting) | **Zero (Client Public)** | Identifies the Firebase project to Google APIs. Security is enforced by Firestore/Storage Security Rules, not by keeping this key secret. |
| **Firebase Admin SDK Service Account** | Server Only (`functions/` runtime or GCP Secret Manager) | **CRITICAL (Full Database Access)** | Grants root administrative privileges, bypassing all Security Rules. Must NEVER be exposed to frontend code or browser clients. |

---

## 5. How to Safely Switch Environments

1. **Select Firebase CLI Project Alias**:
   ```bash
   # Switch to Development (Default)
   npx firebase-tools use development

   # Switch to Staging
   npx firebase-tools use staging

   # Switch to Production (Requires explicit authorized login)
   npx firebase-tools use production
   ```

2. **Deploying Cloud Rules & Functions**:
   ```bash
   # Deploy only to development target
   npx firebase-tools deploy -P development --only firestore:rules,storage:rules,functions
   ```
