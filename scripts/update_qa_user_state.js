import fs from 'fs';
import https from 'https';

function getAccessToken() {
  const configPath = `${process.env.USERPROFILE}/.config/configstore/firebase-tools.json`;
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-tools.json not found');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config.tokens?.access_token;
}

async function firestoreRequest(method, path, body = null) {
  const token = getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/aisteth-academy-dev/databases/(default)/documents/${path}`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  const uid = 'Mm1TrJPtd0ZUhPgwjehmndpD8E12'; // powerup_qa_test
  console.log('Fetching user document before update for UID:', uid);
  const getRes = await firestoreRequest('GET', `users/${uid}`);
  console.log('GET status:', getRes.status);
  
  const currentFields = getRes.data.fields;
  const currentLsFields = currentFields.learningState?.mapValue?.fields || {};

  const updatedLsFields = {
    ...currentLsFields,
    currentStreak: { integerValue: "30" },
    longestStreak: { integerValue: "30" },
    completedQuestionsCount: { integerValue: "100" },
    streakShieldConsumed: { booleanValue: false },
    streakShieldActive: { booleanValue: true },
    lastActiveDate: { stringValue: new Date().toISOString().split('T')[0] }
  };

  const patchBody = {
    fields: {
      learningState: {
        mapValue: {
          fields: updatedLsFields
        }
      },
      updatedAt: {
        timestampValue: new Date().toISOString()
      }
    }
  };

  console.log('\nSending PATCH request to update learningState in aisteth-academy-dev...');
  const patchPath = `users/${uid}?updateMask.fieldPaths=learningState&updateMask.fieldPaths=updatedAt`;
  const patchRes = await firestoreRequest('PATCH', patchPath, patchBody);

  console.log('PATCH status:', patchRes.status);
  if (patchRes.status === 200) {
    console.log('✓ Successfully updated learningState for powerup_qa_test!');
  } else {
    console.error('PATCH failed:', patchRes.data);
    process.exit(1);
  }

  console.log('\nVerifying updated document in Firestore...');
  const verifyRes = await firestoreRequest('GET', `users/${uid}`);
  const verifiedLs = verifyRes.data.fields.learningState.mapValue.fields;
  console.log('Verified learningState in Firestore:');
  console.log('  currentStreak:', verifiedLs.currentStreak.integerValue);
  console.log('  longestStreak:', verifiedLs.longestStreak.integerValue);
  console.log('  completedQuestionsCount:', verifiedLs.completedQuestionsCount.integerValue);
  console.log('  streakShieldConsumed:', verifiedLs.streakShieldConsumed.booleanValue);
  console.log('  role:', verifyRes.data.fields.role.stringValue);
  console.log('  organizationId:', verifyRes.data.fields.organizationId.stringValue);
}

main().catch(console.error);
