/// <reference types="vite/client" />

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || 'AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'aisteth-academy-dev.firebaseapp.com',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'aisteth-academy-dev',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '384522486019',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || '1:384522486019:web:e6d54cc0269fe874aee936'
};

// Initialize Firebase client instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
