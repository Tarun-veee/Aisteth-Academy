import { Response, NextFunction } from 'express';
import { SessionUseCase } from '../../application/usecases/SessionUseCase.js';
import { defaultSessionRepository } from '../../infrastructure/firestore/FirestoreSessionRepository.js';
import { defaultQuestionRepository } from '../../infrastructure/firestore/FirestoreQuestionRepository.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { TodaySessionResponseDTO, RecordAttemptRequestDTO } from '../../application/dtos/session.dto.js';
import { validateIdempotencyKeyBoundary } from '../../domain/rules/sessionValidation.js';

export const sessionUseCase = new SessionUseCase(defaultSessionRepository, defaultQuestionRepository);

export class SessionController {
  static async getTodaySession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const dateStr = (req.query.date as string) || undefined;
      const result: TodaySessionResponseDTO = await sessionUseCase.getOrCreateTodaySession(uid, dateStr);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async recordAttempt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const { sessionId, questionId, questionIndex, userAnswerPayload, idempotencyKey, selectedOption, branchState } = req.body || {};

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({ success: false, error: 'Session ID is required.' });
        return;
      }
      if (idempotencyKey !== undefined && idempotencyKey !== null) {
        validateIdempotencyKeyBoundary(idempotencyKey, sessionId.trim());
      }
      if (!questionId || typeof questionId !== 'string') {
        res.status(400).json({ success: false, error: 'Question ID is required.' });
        return;
      }
      if (typeof questionIndex !== 'number' || questionIndex < 0) {
        res.status(400).json({ success: false, error: 'Valid non-negative question index is required.' });
        return;
      }
      if (!userAnswerPayload || typeof userAnswerPayload !== 'object') {
        res.status(400).json({ success: false, error: 'User answer payload is required.' });
        return;
      }

      const sanitizedPayload: RecordAttemptRequestDTO = {
        sessionId: sessionId.trim(),
        questionId: questionId.trim(),
        questionIndex,
        userAnswerPayload,
        ...(idempotencyKey !== undefined && idempotencyKey !== null ? { idempotencyKey: String(idempotencyKey).trim() } : {}),
        ...(selectedOption !== undefined ? { selectedOption } : {}),
        ...(branchState !== undefined ? { branchState } : {}),
      };

      const result = await sessionUseCase.recordAttempt(uid, sanitizedPayload);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async finalizeSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const result = await sessionUseCase.finalizeSession(uid, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

