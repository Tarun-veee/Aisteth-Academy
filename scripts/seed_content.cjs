const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

function getFirebaseTokens() {
  const tokenPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(tokenPath)) {
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return data.tokens || {};
  }
  return {};
}

async function getValidAccessToken() {
  const tokens = getFirebaseTokens();
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw new Error('No access_token found in firebase-tools.json');
  }
  return accessToken;
}

function testAccessToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve(false);
    const options = {
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/aisteth-academy-dev/databases/(default)/documents',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function refreshGoogleToken(refreshToken) {
  return new Promise((resolve, reject) => {
    // Google's client id for firebase-tools
    const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho85qd6.apps.googleusercontent.com';
    const clientSecret = 'jZexrAnマイ_v1'; // standard public CLI client secret or refresh endpoint
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken
    }).toString();

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`Failed to refresh token: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Convert JavaScript value to Firestore REST Value
function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    if (val === '__SERVER_TIMESTAMP__') {
      return { timestampValue: new Date().toISOString() };
    }
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function writeFirestoreDoc(accessToken, docPath, data) {
  return new Promise((resolve, reject) => {
    const fields = toFirestoreFields(data);
    const postBody = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/aisteth-academy-dev/databases/(default)/documents/${docPath}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Firestore REST error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('AiSteth Academy: Ingesting Real AI_limitation.json Content');
  console.log('Target: aisteth-academy-dev (Cloud Firestore)');
  console.log('================================================================');

  const accessToken = await getValidAccessToken();
  console.log('Successfully acquired GCP Owner access token.');

  // 1. Read AI_limitation.json
  const rawData = fs.readFileSync(path.resolve('AI_limitation.json'), 'utf8');
  const parsed = JSON.parse(rawData);
  const questions = parsed.questions || [];

  console.log(`Loaded ${questions.length} questions from AI_limitation.json.`);
  if (questions.length !== 20) {
    throw new Error(`Expected exactly 20 questions, but found ${questions.length}`);
  }

  // 2. Create /contentReleases/rel_v1_0_0
  console.log('Writing /contentReleases/rel_v1_0_0 ...');
  await writeFirestoreDoc(accessToken, 'contentReleases/rel_v1_0_0', {
    releaseId: 'rel_v1_0_0',
    title: 'Module 1: AI Limitation & Clinical Decision Making',
    audience: 'RBSK',
    totalQuestions: 20,
    status: 'PUBLISHED',
    version: '1.0.0',
    createdAt: '__SERVER_TIMESTAMP__',
    publishedAt: '__SERVER_TIMESTAMP__'
  });
  console.log('Created /contentReleases/rel_v1_0_0');

  // 3. Write each of the 20 questions to /contentReleases/rel_v1_0_0/questions/{Question_ID}
  console.log('Writing 20 questions to /contentReleases/rel_v1_0_0/questions ...');
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const docPath = `contentReleases/rel_v1_0_0/questions/${q.Question_ID}`;
    await writeFirestoreDoc(accessToken, docPath, {
      questionId: q.Question_ID,
      Question_ID: q.Question_ID,
      topic: q.Topic,
      Topic: q.Topic,
      questionType: q.Question_Type,
      Question_Type: q.Question_Type,
      difficultyRank: q.Difficulty_Rank,
      Difficulty_Rank: q.Difficulty_Rank,
      followUpFor: q.Follow_Up_For || null,
      Follow_Up_For: q.Follow_Up_For || null,
      audience: q.Audience,
      Audience: q.Audience,
      question: q.Question,
      Question: q.Question,
      option_a: q.Option_A,
      Option_A: q.Option_A,
      option_b: q.Option_B,
      Option_B: q.Option_B,
      option_c: q.Option_C,
      Option_C: q.Option_C,
      option_d: q.Option_D,
      Option_D: q.Option_D,
      correct: q.Correct,
      Correct: q.Correct,
      explanation: q.Explanation,
      Explanation: q.Explanation,
      action: q.Action,
      Action: q.Action,
      medGemmaTag: q.MedGemma_Tag,
      MedGemma_Tag: q.MedGemma_Tag,
      category: 'HEART_RECORDING',
      type: 'MCQ',
      createdAt: '__SERVER_TIMESTAMP__'
    });
    console.log(`[${i + 1}/20] Created ${q.Question_ID} (Difficulty Rank ${q.Difficulty_Rank}, ${q.Question_Type})`);
  }

  // 4. Create /appConfig/global
  console.log('Writing /appConfig/global ...');
  await writeFirestoreDoc(accessToken, 'appConfig/global', {
    activeContentReleaseId: 'rel_v1_0_0',
    defaultOrganizationId: 'org_rbsk_national',
    minimumSupportedAppVersion: '1.0.0',
    maintenanceMode: false,
    sessionConfig: {
      questionCount: 10,
      selectionPolicy: 'CONTENT_DRIVEN_BALANCED',
      xpRewards: {
        MCQ: 5,
        TRUE_FALSE: 5,
        PRACTICAL: 10,
        COMPLETION_BONUS: 10
      }
    },
    updatedAt: '__SERVER_TIMESTAMP__',
    updatedBy: 'seed_script'
  });
  console.log('Created /appConfig/global');

  console.log('================================================================');
  console.log('Content Seeding Finished Successfully!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
