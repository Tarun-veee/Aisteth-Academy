/**
 * AiSteth Academy — Administrative Role Elevation Utility
 * 
 * Usage:
 *   node backend/scripts/set_admin_role.js <uid_or_username_or_email> [PLATFORM_ADMIN|SUPERVISOR]
 * 
 * Examples:
 *   node backend/scripts/set_admin_role.js admin_tester PLATFORM_ADMIN
 *   node backend/scripts/set_admin_role.js admintester PLATFORM_ADMIN
 *   node backend/scripts/set_admin_role.js UjofqlcL6pWLL4jq7WtEZliab8L2 PLATFORM_ADMIN
 *   node backend/scripts/set_admin_role.js admintester@aisteth.com PLATFORM_ADMIN
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export const VALID_ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPERVISOR'];

// Automatic credentials fallback
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const candidateKeyPaths = [
    'C:\\Users\\I Health Highway\\Downloads\\TARUN PROJECT\\credentials\\aisteth-key.json',
    path.resolve(process.cwd(), '../credentials/aisteth-key.json'),
    path.resolve(process.cwd(), 'credentials/aisteth-key.json'),
    path.resolve(process.cwd(), '../../credentials/aisteth-key.json'),
  ];
  for (const candidate of candidateKeyPaths) {
    if (fs.existsSync(candidate)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = candidate;
      break;
    }
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'aisteth-academy-dev';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();

/**
 * Resolves any user identifier (UID, username, displayName, syntheticEmail, optionalEmail, phone)
 * to a verified Firestore user document and Firebase Auth UID.
 */
export async function resolveUserIdentifier(target, firestoreDb = db, firebaseAuth = auth) {
  if (!target || typeof target !== 'string' || !target.trim()) {
    throw new Error('Target identifier must be a non-empty string (UID, username, displayName, or email).');
  }

  const cleanTarget = target.trim();
  const lowerTarget = cleanTarget.toLowerCase();
  const strippedTarget = lowerTarget.replace(/[^a-z0-9]/g, '');

  // 1. Direct Firestore UID check in `users` collection
  const directDoc = await firestoreDb.collection('users').doc(cleanTarget).get();
  if (directDoc.exists) {
    return {
      uid: cleanTarget,
      userDoc: directDoc,
      matchedStrategy: 'Direct Firestore Document ID (UID)',
    };
  }

  // 2. Firebase Auth UID check
  try {
    const authUser = await firebaseAuth.getUser(cleanTarget);
    if (authUser && authUser.uid) {
      const userDoc = await firestoreDb.collection('users').doc(authUser.uid).get();
      if (userDoc.exists) {
        return {
          uid: authUser.uid,
          userDoc,
          authUser,
          matchedStrategy: 'Firebase Authentication UID',
        };
      }
    }
  } catch (_) {
    // Not a valid auth UID or user not found, continue to other strategies
  }

  const candidates = new Map(); // uid -> { userDoc, matchedStrategy }

  // 3. Document lookup in `usernames` mapping collection
  // 3a. Exact lowercase target (e.g. "admintester" or "admin_tester")
  try {
    const usernameDocExact = await firestoreDb.collection('usernames').doc(lowerTarget).get();
    if (usernameDocExact.exists && usernameDocExact.data()?.uid) {
      const uid = usernameDocExact.data().uid;
      const userDoc = await firestoreDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        candidates.set(uid, { userDoc, matchedStrategy: `usernames collection document "@${lowerTarget}"` });
      }
    }
  } catch (_) {}

  // 3b. Stripped target (e.g. "admin_tester" -> "admintester")
  if (strippedTarget && strippedTarget !== lowerTarget && strippedTarget.length >= 3) {
    try {
      const usernameDocStripped = await firestoreDb.collection('usernames').doc(strippedTarget).get();
      if (usernameDocStripped.exists && usernameDocStripped.data()?.uid) {
        const uid = usernameDocStripped.data().uid;
        const userDoc = await firestoreDb.collection('users').doc(uid).get();
        if (userDoc.exists && !candidates.has(uid)) {
          candidates.set(uid, { userDoc, matchedStrategy: `usernames collection document "@${strippedTarget}" (normalized)` });
        }
      }
    } catch (_) {}
  }

  // 4. Query `users` collection by `username` field
  const usernameQueries = [cleanTarget, lowerTarget];
  if (strippedTarget && strippedTarget !== lowerTarget) {
    usernameQueries.push(strippedTarget);
  }
  for (const un of Array.from(new Set(usernameQueries))) {
    try {
      const qSnap = await firestoreDb.collection('users').where('username', '==', un).get();
      for (const doc of qSnap.docs) {
        if (!candidates.has(doc.id)) {
          candidates.set(doc.id, { userDoc: doc, matchedStrategy: `users.username == "${un}"` });
        }
      }
    } catch (_) {}
  }

  // 5. Query `users` collection by `displayName` field (handles "admin_tester")
  const dnQueries = [cleanTarget, cleanTarget.toLowerCase()];
  for (const dn of Array.from(new Set(dnQueries))) {
    try {
      const qSnap = await firestoreDb.collection('users').where('displayName', '==', dn).get();
      for (const doc of qSnap.docs) {
        if (!candidates.has(doc.id)) {
          candidates.set(doc.id, { userDoc: doc, matchedStrategy: `users.displayName == "${dn}"` });
        }
      }
    } catch (_) {}
  }

  // 6. Query `users` collection by email fields (`optionalEmail` and `syntheticEmail`)
  const emailQueries = [lowerTarget];
  if (lowerTarget.includes('@')) {
    const prefix = lowerTarget.split('@')[0];
    if (prefix && prefix.length >= 3) {
      emailQueries.push(`${prefix}@trainee.aisteth.internal`);
      emailQueries.push(`${prefix}@aisteth.internal`);
    }
  } else {
    emailQueries.push(`${lowerTarget}@trainee.aisteth.internal`);
    emailQueries.push(`${lowerTarget}@aisteth.internal`);
    if (strippedTarget && strippedTarget !== lowerTarget) {
      emailQueries.push(`${strippedTarget}@trainee.aisteth.internal`);
      emailQueries.push(`${strippedTarget}@aisteth.internal`);
    }
  }

  for (const em of Array.from(new Set(emailQueries))) {
    try {
      const optSnap = await firestoreDb.collection('users').where('optionalEmail', '==', em).get();
      for (const doc of optSnap.docs) {
        if (!candidates.has(doc.id)) {
          candidates.set(doc.id, { userDoc: doc, matchedStrategy: `users.optionalEmail == "${em}"` });
        }
      }
      const synSnap = await firestoreDb.collection('users').where('syntheticEmail', '==', em).get();
      for (const doc of synSnap.docs) {
        if (!candidates.has(doc.id)) {
          candidates.set(doc.id, { userDoc: doc, matchedStrategy: `users.syntheticEmail == "${em}"` });
        }
      }
    } catch (_) {}
  }

  // 7. Firebase Auth email lookup
  for (const em of Array.from(new Set(emailQueries))) {
    if (em.includes('@')) {
      try {
        const authUser = await firebaseAuth.getUserByEmail(em);
        if (authUser && authUser.uid && !candidates.has(authUser.uid)) {
          const userDoc = await firestoreDb.collection('users').doc(authUser.uid).get();
          if (userDoc.exists) {
            candidates.set(authUser.uid, { userDoc, matchedStrategy: `Firebase Auth email == "${em}"` });
          }
        }
      } catch (_) {}
    }
  }

  // 8. Evaluate candidates
  if (candidates.size === 1) {
    const [uid, result] = Array.from(candidates.entries())[0];
    return {
      uid,
      userDoc: result.userDoc,
      matchedStrategy: result.matchedStrategy,
    };
  }

  if (candidates.size > 1) {
    const list = Array.from(candidates.entries())
      .map(([id, item]) => `  - UID: ${id} (Username: "${item.userDoc.data()?.username}", Name: "${item.userDoc.data()?.displayName}", Email: "${item.userDoc.data()?.syntheticEmail || item.userDoc.data()?.optionalEmail}") [Matched via ${item.matchedStrategy}]`)
      .join('\n');
    throw new Error(`Ambiguity detected: Found ${candidates.size} accounts matching "${cleanTarget}":\n${list}\nPlease re-run the script specifying the exact UID.`);
  }

  // No candidates found
  throw new Error(
    `User not found for identifier "${cleanTarget}".\n` +
    `Attempted resolution strategies:\n` +
    `  1. Firestore document "users/${cleanTarget}"\n` +
    `  2. Firebase Authentication UID "${cleanTarget}"\n` +
    `  3. usernames collection mapping: "${lowerTarget}" and "${strippedTarget}"\n` +
    `  4. users.username field search\n` +
    `  5. users.displayName field search\n` +
    `  6. users.optionalEmail / syntheticEmail search\n` +
    `  7. Firebase Authentication email search`
  );
}

/**
 * Assigns an administrative role to a user across both Firestore and Firebase Auth custom claims.
 */
export async function setAdminRole(target, requestedRole = 'PLATFORM_ADMIN', firestoreDb = db, firebaseAuth = auth) {
  if (!target || typeof target !== 'string' || !target.trim()) {
    throw new Error('Please specify a target UID, username, or email.');
  }

  const role = requestedRole.trim().toUpperCase();
  if (!VALID_ADMIN_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Allowed administrative roles are: ${VALID_ADMIN_ROLES.join(', ')}`);
  }

  // Resolve user
  const { uid, userDoc, matchedStrategy } = await resolveUserIdentifier(target, firestoreDb, firebaseAuth);

  const userData = userDoc.data();
  const previousRole = userData?.role || 'TRAINEE';

  // 1. Update Firestore user document role
  const userRef = firestoreDb.collection('users').doc(uid);
  await userRef.update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`[Firestore] Successfully updated users/${uid}.role to "${role}"`);

  // 2. Ensure usernames mapping collection has this alias if target was a valid username string
  const cleanTarget = target.trim().toLowerCase();
  if (/^[a-z0-9._-]{3,30}$/.test(cleanTarget)) {
    try {
      const aliasDoc = await firestoreDb.collection('usernames').doc(cleanTarget).get();
      if (!aliasDoc.exists) {
        await firestoreDb.collection('usernames').doc(cleanTarget).set({
          username: cleanTarget,
          uid,
          status: 'ACTIVE',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Username Index] Created alias mapping usernames/${cleanTarget} -> UID ${uid}`);
      }
    } catch (aliasErr) {
      console.warn(`[Username Index] Warning: Could not create alias in usernames collection:`, aliasErr.message);
    }
  }

  // 3. Set Firebase Auth custom claims
  let customClaimsApplied = false;
  try {
    const existingAuth = await firebaseAuth.getUser(uid);
    await firebaseAuth.setCustomUserClaims(uid, {
      ...(existingAuth.customClaims || {}),
      role,
    });
    console.log(`[Auth Claims] Successfully set custom claim { role: "${role}" } on Auth user ${uid}`);
    customClaimsApplied = true;
  } catch (authErr) {
    console.warn(`[Auth Claims] Warning: Could not set Auth custom claims:`, authErr.message);
  }

  // 4. Verify Firestore persistence
  const verifySnap = await userRef.get();
  const verifiedRole = verifySnap.data()?.role;
  if (verifiedRole !== role) {
    throw new Error(`Persistence verification failed: users/${uid}.role is "${verifiedRole}", expected "${role}".`);
  }

  return {
    success: true,
    uid,
    previousRole,
    role: verifiedRole,
    displayName: userData?.displayName,
    username: userData?.username,
    email: userData?.syntheticEmail || userData?.optionalEmail,
    matchedStrategy,
    customClaimsApplied,
  };
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('backend/scripts/set_admin_role.js')) {
  const target = process.argv[2];
  const role = process.argv[3] || 'PLATFORM_ADMIN';

  if (!target) {
    console.error('Error: Please specify target UID, username, or email.');
    console.log('Usage: node backend/scripts/set_admin_role.js <uid_or_username> [PLATFORM_ADMIN|SUPERVISOR]');
    process.exit(1);
  }

  setAdminRole(target, role)
    .then((result) => {
      console.log('\n======================================================');
      console.log('       AiSteth Academy Role Elevation Succeeded        ');
      console.log('======================================================');
      console.log(`UID:             ${result.uid}`);
      console.log(`Display Name:    ${result.displayName || '(not set)'}`);
      console.log(`Username:        ${result.username || '(not set)'}`);
      console.log(`Email:           ${result.email || '(not set)'}`);
      console.log(`Matched Via:     ${result.matchedStrategy}`);
      console.log(`Role Transition: ${result.previousRole} -> ${result.role}`);
      console.log(`Custom Claims:   ${result.customClaimsApplied ? 'Applied' : 'Pending'}`);
      console.log(`Firestore Path:  users/${result.uid}`);
      console.log('======================================================');
      console.log('IMPORTANT: If the user is currently signed into the web');
      console.log('application, they must sign out and sign back in (or refresh');
      console.log('their session token) so the browser client receives the');
      console.log('new PLATFORM_ADMIN custom claim.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[Role Elevation Error]', err.message);
      process.exit(1);
    });
}
