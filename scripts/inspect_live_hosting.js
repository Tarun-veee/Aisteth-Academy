import https from 'https';

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching live index.html from https://aisteth-academy-dev.web.app/ ...');
  const response = await fetchUrl('https://aisteth-academy-dev.web.app/');
  console.log('Status code:', response.statusCode);
  console.log('Headers:');
  console.log('  Date:', response.headers['date']);
  console.log('  Last-Modified:', response.headers['last-modified']);
  console.log('  ETag:', response.headers['etag']);
  console.log('  Content-Type:', response.headers['content-type']);
  console.log('  Cache-Control:', response.headers['cache-control']);
  
  console.log('\n--- Full HTML Content ---');
  console.log(response.body);

  // Extract JS bundle asset URLs
  const scriptMatches = [...response.body.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  const linkMatches = [...response.body.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  console.log('\nScripts referenced:', scriptMatches);
  console.log('Links referenced:', linkMatches);

  for (const scriptPath of scriptMatches) {
    if (scriptPath.endsWith('.js')) {
      const fullJsUrl = `https://aisteth-academy-dev.web.app${scriptPath.startsWith('/') ? '' : '/'}${scriptPath}`;
      console.log(`\nFetching live JS bundle: ${fullJsUrl} ...`);
      const jsResponse = await fetchUrl(fullJsUrl);
      console.log('  Bundle size:', jsResponse.body.length, 'bytes');
      console.log('  Last-Modified:', jsResponse.headers['last-modified']);
      console.log('  ETag:', jsResponse.headers['etag']);

      // Check for power-up symbols and keywords
      console.log('\n--- Bundle Inspection ---');
      const hasFiftyFifty = jsResponse.body.includes('FIFTY_FIFTY') || jsResponse.body.includes('50/50');
      const hasHint = jsResponse.body.includes('canUseHint') || jsResponse.body.includes('"HINT"') || jsResponse.body.includes('HINT');
      const hasRetry = jsResponse.body.includes('canUseRetry') || jsResponse.body.includes('retryOfAttemptId') || jsResponse.body.includes('"RETRY"');
      const hasLearn = jsResponse.body.includes('canUseLearn') || jsResponse.body.includes('"LEARN"');
      const hasStreakShield = jsResponse.body.includes('STREAK_SHIELD') || jsResponse.body.includes('Streak Shield');
      const hasIdempotencyLog = jsResponse.body.includes('already finalized');

      console.log('  Contains "50/50" / "FIFTY_FIFTY":', hasFiftyFifty);
      console.log('  Contains "HINT":', hasHint);
      console.log('  Contains "RETRY":', hasRetry);
      console.log('  Contains "LEARN":', hasLearn);
      console.log('  Contains "STREAK_SHIELD":', hasStreakShield);
      console.log('  Contains idempotency guard message:', hasIdempotencyLog);

      // Search for power-up specific strings
      const powerUpOccurrences = {
        fiftyFiftyCount: (jsResponse.body.match(/FIFTY_FIFTY/g) || []).length,
        hintCount: (jsResponse.body.match(/HINT/g) || []).length,
        retryCount: (jsResponse.body.match(/RETRY/g) || []).length,
        learnCount: (jsResponse.body.match(/LEARN/g) || []).length,
        streakShieldCount: (jsResponse.body.match(/STREAK_SHIELD/g) || []).length,
      };
      console.log('  Identifier matches in live bundle:', powerUpOccurrences);

      // Extract Firebase Config inside bundle
      const projectIdMatch = jsResponse.body.match(/projectId[:=]"([^"]+)"/) || jsResponse.body.match(/aisteth-academy-[a-z]+/g);
      console.log('  Firebase project references in bundle:', projectIdMatch ? [...new Set(projectIdMatch)] : 'None found');
    }
  }

  // Local bundle inspection
  console.log('\n======================================================');
  console.log('LOCAL BUILD INSPECTION (dist/assets/):');
  const fs = await import('fs');
  const path = await import('path');
  const distDir = path.resolve('dist/assets');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const localJsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
    if (localJsFile) {
      const localCode = fs.readFileSync(path.join(distDir, localJsFile), 'utf8');
      console.log('  Local JS File:', localJsFile);
      console.log('  Local Bundle Size:', localCode.length, 'bytes');
      console.log('  Local modified time:', fs.statSync(path.join(distDir, localJsFile)).mtime.toISOString());
      console.log('  FIFTY_FIFTY count:', (localCode.match(/FIFTY_FIFTY/g) || []).length);
      console.log('  "HINT" count:', (localCode.match(/"HINT"/g) || []).length);
      console.log('  "RETRY" count:', (localCode.match(/"RETRY"/g) || []).length);
      console.log('  "LEARN" count:', (localCode.match(/"LEARN"/g) || []).length);
      console.log('  "STREAK_SHIELD" count:', (localCode.match(/"STREAK_SHIELD"/g) || []).length);
      console.log('  Contains idempotency guard message:', localCode.includes('already finalized'));
      console.log('  Contains canUseFiftyFifty:', localCode.includes('canUseFiftyFifty'));
      console.log('  Contains canUseHint:', localCode.includes('canUseHint'));
      console.log('  Contains canUseRetry:', localCode.includes('canUseRetry'));
    }
  }

  // Also check production site if it exists
  console.log('\n======================================================');
  console.log('Checking https://aisteth-academy-prod.web.app/ ...');
  try {
    const prodRes = await fetchUrl('https://aisteth-academy-prod.web.app/');
    console.log('Prod Status code:', prodRes.statusCode);
    console.log('Prod Last-Modified:', prodRes.headers['last-modified']);
    console.log('Prod ETag:', prodRes.headers['etag']);
  } catch (err) {
    console.log('Prod fetch error:', err.message);
  }
}

main().catch(console.error);
