import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'aisteth-academy-dev',
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBpK5ElkrtPhUhlL94PpKX7PU5drk18USA',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
};
