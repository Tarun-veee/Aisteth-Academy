import { Router } from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireAdminRole } from '../middlewares/admin.middleware.js';

export const adminRouter = Router();

// Strictly protect all administrative routes with JWT authentication and Admin role enforcement
adminRouter.use(authMiddleware as any);
adminRouter.use(requireAdminRole as any);

adminRouter.get('/overview', AdminController.getOverview as any);
adminRouter.get('/learners', AdminController.listLearners as any);
adminRouter.get('/learners/:uid', AdminController.getLearnerDetails as any);
adminRouter.post('/learners', AdminController.registerSingleLearner as any);
adminRouter.post('/learners/bulk', AdminController.bulkImportLearners as any);
adminRouter.post('/learners/:uid/whatsapp-onboard', AdminController.triggerWhatsAppOnboarding as any);
adminRouter.post('/learners/bulk-whatsapp-onboard', AdminController.bulkTriggerWhatsAppOnboarding as any);
adminRouter.patch('/learners/:uid', AdminController.updateLearner as any);
adminRouter.patch('/learners/:uid/status', AdminController.setLearnerStatus as any);
adminRouter.post('/learners/:uid/reset-credentials', AdminController.resetLearnerCredentials as any);
