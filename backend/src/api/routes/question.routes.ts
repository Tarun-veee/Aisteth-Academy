import { Router } from 'express';
import { QuestionController } from '../controllers/QuestionController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const questionRouter = Router();

questionRouter.use(authMiddleware as any);

questionRouter.get('/today', QuestionController.getTodayQuestions);
questionRouter.get('/unsolved', QuestionController.getUnsolvedQuestions as any);
questionRouter.patch('/unsolved/:id', QuestionController.updateUnsolvedQuestion as any);
questionRouter.get('/follow-up/:id', QuestionController.getFollowUpQuestion);
questionRouter.get('/:id', QuestionController.getQuestionById);
