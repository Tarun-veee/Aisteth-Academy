import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { AnswerEvaluator } from '../src/domain/rules/AnswerEvaluator.js';
import { PowerUpService } from '../src/domain/rules/PowerUpService.js';
import { ProgressionService } from '../src/domain/rules/ProgressionService.js';
import { selectSessionQuestions, computeDayParity } from '../src/domain/rules/sessionSelection.js';
import { MCQQuestion } from '../src/domain/models/question.model.js';

describe('Backend API & Domain Layer Verification Suite', () => {
  describe('Healthcheck Endpoint', () => {
    it('returns status HEALTHY on GET /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HEALTHY');
      expect(res.body.service).toBe('aisteth-academy-backend');
    });
  });

  describe('Auth Validation & Middleware Protection', () => {
    it('rejects registration with missing fields with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'testuser' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects login with empty credentials with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: '', password: '' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects refresh without refresh cookie with HTTP 401', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_REFRESH_COOKIE');
    });

    it('rejects protected session route without authorization header with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/sessions/today');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects protected user route without authorization header with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('clears refresh cookie on logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('refreshToken=;');
    });
  });

  describe('Domain Rules Integrity', () => {
    it('evaluates MCQ questions deterministically', () => {
      const mockMcq: MCQQuestion = {
        question_id: 'test_q1',
        category: 'HEART_RECORDING',
        type: 'MCQ',
        difficulty: 'BEGINNER',
        question: 'Sample question',
        explanation: 'Sample explanation',
        learning_objective: 'Test objective',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_answer: 'option_b'
      };

      const correctResult = AnswerEvaluator.evaluate(mockMcq, {
        question_id: 'test_q1',
        type: 'MCQ',
        selected_option: 'option_b'
      });
      expect(correctResult.is_correct).toBe(true);
      expect(correctResult.awarded_xp).toBe(5);

      const incorrectResult = AnswerEvaluator.evaluate(mockMcq, {
        question_id: 'test_q1',
        type: 'MCQ',
        selected_option: 'option_c'
      });
      expect(incorrectResult.is_correct).toBe(false);
      expect(incorrectResult.awarded_xp).toBe(0);
    });

    it('calculates power-up unlocks correctly', () => {
      const unlockedInventory = PowerUpService.calculateInventory({
        totalXp: 100,
        currentStreak: 30,
        completedQuestionsCount: 120,
        completedSessionsCount: 12,
        totalCorrectAnswersCount: 100,
        lastActiveDate: null
      });

      expect(unlockedInventory.items.find((i) => i.id === 'FIFTY_FIFTY')?.isUnlocked).toBe(true);
      expect(unlockedInventory.items.find((i) => i.id === 'LEARN')?.isUnlocked).toBe(true);
      expect(unlockedInventory.streakShield.isUnlocked).toBe(true);
      expect(unlockedInventory.totalUnlockedCount).toBe(3);
    });

    it('calculates XP progression curves deterministically', () => {
      const prog = ProgressionService.calculateProgression(350);
      expect(prog.currentLevel.level).toBe(3);
      expect(prog.currentLevel.title).toBe('Practitioner');
    });

    it('selects exactly 10 questions based on day parity', () => {
      const setA = selectSessionQuestions('2026-10-08');
      expect(setA.length).toBe(10);
      expect(computeDayParity('2026-10-08')).toBe(computeDayParity('2026-10-08'));
    });
  });

  describe('CORS Policy Enforcement (F-03)', () => {
    it('allows approved origin (http://localhost:5173) with credentials', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows 127.0.0.1 development origin with credentials', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://127.0.0.1:5173');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects unapproved origins from receiving credentialed CORS access', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-attacker.com');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('handles OPTIONS preflight for approved origin', async () => {
      const res = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects OPTIONS preflight for unapproved origin without CORS headers', async () => {
      const res = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://unauthorized-domain.org')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows requests without an Origin header (curl, mobile, backend-to-backend)', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HEALTHY');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('enforces authentication on protected routes even when request has no Origin header', async () => {
      const userRes = await request(app).get('/api/v1/users/me');
      expect(userRes.status).toBe(401);
      expect(userRes.body.success).toBe(false);
      expect(userRes.body.error).toContain('Authentication required');

      const sessionRes = await request(app).get('/api/v1/sessions/today');
      expect(sessionRes.status).toBe(401);
      expect(sessionRes.body.success).toBe(false);
      expect(sessionRes.body.error).toContain('Authentication required');
    });
  });
});
