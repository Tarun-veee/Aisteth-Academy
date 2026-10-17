import { Request, Response, NextFunction } from 'express';
import { QuestionUseCase } from '../../application/usecases/QuestionUseCase.js';
import { defaultQuestionRepository } from '../../infrastructure/firestore/FirestoreQuestionRepository.js';
import { defaultSessionRepository } from '../../infrastructure/firestore/FirestoreSessionRepository.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { TodayQuestionsResponseDTO, QuestionDetailsResponseDTO } from '../../application/dtos/question.dto.js';

export const questionUseCase = new QuestionUseCase(defaultQuestionRepository, defaultSessionRepository);

export class QuestionController {
  static async getTodayQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateStr = (req.query.date as string) || undefined;
      const questions = await questionUseCase.getTodayQuestions(dateStr);
      const response: TodayQuestionsResponseDTO = { questions };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getUnsolvedQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const result = await questionUseCase.getUnsolvedQuestions(uid);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateUnsolvedQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const { id } = req.params;
      const result = await questionUseCase.updateUnsolvedQuestion(uid, id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getQuestionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const question = await questionUseCase.getQuestionById(id);
      if (!question) {
        res.status(404).json({ success: false, error: `Question ${id} not found.` });
        return;
      }
      const response: QuestionDetailsResponseDTO = { question };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getFollowUpQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const question = await questionUseCase.getFollowUpQuestion(id);
      if (!question) {
        res.status(404).json({ success: false, error: `Follow-up question for ${id} not found.` });
        return;
      }
      const response: QuestionDetailsResponseDTO = { question };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
