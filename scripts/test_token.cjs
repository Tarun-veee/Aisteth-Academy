const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

function getFirebaseToken() {
  const tokenPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (fs.existsSync(tokenPath)) {
    const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return data.tokens ? (data.tokens.access_token || data.tokens.refresh_token) : null;
  }
  return null;
}

const token = getFirebaseToken();
console.log('Token found:', !!token);
