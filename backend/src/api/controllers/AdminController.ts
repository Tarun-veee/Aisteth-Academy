import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { defaultAdminLearnerUseCase } from '../../application/usecases/AdminLearnerUseCase.js';

export class AdminController {
  static async getOverview(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await defaultAdminLearnerUseCase.getOverviewStats();
      res.status(200).json({
        success: true,
        stats,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listLearners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await defaultAdminLearnerUseCase.listLearners({
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        search: req.query.search ? String(req.query.search) : undefined,
        status: req.query.status as any,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLearnerDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = req.params;
      if (!uid) {
        res.status(400).json({ success: false, error: 'Learner UID is required.' });
        return;
      }

      const learner = await defaultAdminLearnerUseCase.getLearnerDetails(uid);
      if (!learner) {
        res.status(404).json({ success: false, error: `Learner '${uid}' not found.` });
        return;
      }

      res.status(200).json({
        success: true,
        learner,
      });
    } catch (err) {
      next(err);
    }
  }

  static async registerSingleLearner(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const learner = await defaultAdminLearnerUseCase.registerSingleLearner(req.body);
      res.status(201).json({
        success: true,
        learner,
        message: `Learner '${learner.displayName}' (@${learner.username}) registered successfully.`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to register learner.',
      });
    }
  }

  static async bulkImportLearners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rows } = req.body || {};
      if (!Array.isArray(rows)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payload: "rows" array is required.',
        });
        return;
      }

      const result = await defaultAdminLearnerUseCase.bulkImportLearners(rows);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Bulk import failed.',
      });
    }
  }

  static async triggerWhatsAppOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = req.params;
      if (!uid) {
        res.status(400).json({ success: false, error: 'Learner UID is required.' });
        return;
      }

      const result = await defaultAdminLearnerUseCase.triggerWhatsAppOnboarding(uid);
      res.status(200).json({
        success: true,
        result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to trigger WhatsApp onboarding.',
      });
    }
  }

  static async bulkTriggerWhatsAppOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uids } = req.body || {};
      if (!Array.isArray(uids) || uids.length === 0) {
        res.status(400).json({ success: false, error: '"uids" array is required.' });
        return;
      }

      const result = await defaultAdminLearnerUseCase.bulkTriggerWhatsAppOnboarding(uids);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      next(err);
    }
  }

  static async updateLearner(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = req.params;
      if (!uid) {
        res.status(400).json({ success: false, error: 'Learner UID is required.' });
        return;
      }
      const learner = await defaultAdminLearnerUseCase.updateLearner(uid, req.body);
      res.status(200).json({
        success: true,
        learner,
        message: `Learner '${learner.displayName}' updated successfully.`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to update learner details.',
      });
    }
  }

  static async setLearnerStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = req.params;
      const { status } = req.body || {};
      if (!uid) {
        res.status(400).json({ success: false, error: 'Learner UID is required.' });
        return;
      }
      if (status !== 'ACTIVE' && status !== 'DEACTIVATED') {
        res.status(400).json({ success: false, error: 'Status must be either "ACTIVE" or "DEACTIVATED".' });
        return;
      }
      const learner = await defaultAdminLearnerUseCase.setLearnerStatus(uid, status);
      res.status(200).json({
        success: true,
        learner,
        message: `Learner account marked as ${status}.`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to update learner account status.',
      });
    }
  }

  static async resetLearnerCredentials(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = req.params;
      if (!uid) {
        res.status(400).json({ success: false, error: 'Learner UID is required.' });
        return;
      }
      const result = await defaultAdminLearnerUseCase.resetLearnerCredentials(uid);
      res.status(200).json({
        success: true,
        result,
        message: `Credentials regenerated for learner '${result.username}'.`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to reset learner credentials.',
      });
    }
  }
}
