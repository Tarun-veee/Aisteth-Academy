const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize admin app
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'aisteth-academy-dev'
  });
}

const db = admin.firestore();

async function testConnection() {
  console.log('Testing Firestore connection for aisteth-academy-dev...');
  try {
    const docRef = db.doc('contentReleases/test_doc');
    await docRef.set({ test: true, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    console.log('Success writing test doc!');
    await docRef.delete();
    console.log('Success deleting test doc!');
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testConnection();
