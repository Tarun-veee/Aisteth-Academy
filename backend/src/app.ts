import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './api/routes/auth.routes.js';
import { sessionRouter } from './api/routes/session.routes.js';
import { questionRouter } from './api/routes/question.routes.js';
import { userRouter } from './api/routes/user.routes.js';
import { adminRouter } from './api/routes/admin.routes.js';
import { errorHandler } from './api/middlewares/error.middleware.js';
import { ENV } from './infrastructure/config/env.js';

export const app = express();

const allowedOrigins = [
  ENV.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'https://aisteth-academy-dev.web.app',
  'https://aisteth-academy-dev.firebaseapp.com',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without Origin (e.g. server-to-server, curl, tests, mobile app)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Explicitly reject unapproved origins from receiving credentialed CORS headers
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(cookieParser());
app.use(express.json());

// Healthcheck
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'aisteth-academy-backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sessions', sessionRouter);
app.use('/api/v1/questions', questionRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/admin', adminRouter);

// Global Error Handler
app.use(errorHandler);
