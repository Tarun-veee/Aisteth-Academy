# AiSteth Academy — Cloud Functions (Deferred Architecture Reference)

> [!IMPORTANT]
> **STATUS: DEFERRED ARCHITECTURE / HISTORICAL REFERENCE (PHASE 3 BLAZE UPGRADE)**
> 
> This directory contains the **server-authoritative Cloud Functions reference implementation** authored during Phase 2.2.
>
> **It is NOT deployed in the active production environment.**
>
> The active production system operates on the **Firebase Spark Plan (Free Tier — ₹0/month)**:
> - **Frontend**: Firebase Hosting (React 18 + Vite + PWA)
> - **Authentication**: Firebase Authentication (Client Web SDK with synthetic email mapping)
> - **Database**: Cloud Firestore (Client-Authoritative constrained by hardened Security Rules `firestore.rules`)
>
> Cloud Functions require the pay-as-you-go **Blaze Plan**. To comply with zero-cost Spark constraints, `functions/` is deliberately excluded from deployment in `firebase.json`.

---

## Purpose of this Directory

This codebase is preserved as a verified, working reference for future Phase 3 migration when the project is upgraded to the Blaze plan:
1. **`src/index.ts`**: 2nd Gen HTTPS Callable Function entry point (`registerWithUsername`).
2. **`src/services/registrationService.ts`**: Server-authoritative 5-step registration workflow with `reservationId` ownership tokens, synthetic email creation, custom claims assignment, and transaction compensation.
3. **`src/utils/username.ts`**: Server-side username normalization and payload sanitization utilities.
4. **`src/utils/sessionSelection.ts`**: Deterministic day-parity question selection engine.
5. **`src/types/auth.types.ts`**: Server-authoritative domain contracts.

---

## Future Blaze Deployment (Phase 3 Roadmap)

When upgrading to the Firebase Blaze plan:
1. Add `"functions"` to root `firebase.json`:
   ```json
   "functions": [
     {
       "source": "functions",
       "codebase": "default",
       "ignore": [
         "node_modules",
         ".git",
         "firebase-debug.log",
         "firestore-debug.log"
       ]
     }
   ]
   ```
2. Deploy to Firebase:
   ```bash
   firebase deploy --only functions
   ```
