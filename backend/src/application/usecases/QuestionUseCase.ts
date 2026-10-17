import { IQuestionRepository } from '../../domain/interfaces/IQuestionRepository.js';
import { ISessionRepository } from '../../domain/interfaces/ISessionRepository.js';
import { defaultSessionRepository } from '../../infrastructure/firestore/FirestoreSessionRepository.js';
import { Question, SafeQuestionDTO } from '../../domain/models/question.model.js';
import { getResolvedCalendarDate, normalizeToCanonicalTopic } from '../../domain/rules/sessionSelection.js';
import { BadRequestError } from '../../domain/rules/sessionValidation.js';
import {
  GetUnsolvedQuestionsResponseDTO,
  UpdateUnsolvedQuestionRequestDTO,
  UpdateUnsolvedQuestionResponseDTO,
  UnsolvedQuestionItemDTO,
  toSafeQuestionDTO,
  DataIntegrityError
} from '../dtos/question.dto.js';

export class QuestionUseCase {
  constructor(
    private questionRepo: IQuestionRepository,
    private sessionRepo: ISessionRepository = defaultSessionRepository
  ) {}

  async getTodayQuestions(dateStr: string = getResolvedCalendarDate()): Promise<SafeQuestionDTO[]> {
    const rawQuestions = await this.questionRepo.getSessionQuestions(dateStr, 10);
    return rawQuestions.map(toSafeQuestionDTO);
  }

  async getQuestionById(questionId: string): Promise<SafeQuestionDTO | null> {
    const q = await this.questionRepo.getQuestionById(questionId);
    if (!q) return null;

    // Enforce referential integrity if question is Follow-Up
    const isFollowUp = q.question_id.endsWith('-PR') || q.question_type === 'Follow-Up';
    if (isFollowUp) {
      const parentId = q.follow_up_for || (q as any).Follow_Up_For;
      if (!parentId || typeof parentId !== 'string') {
        throw new DataIntegrityError(`Follow-Up question '${q.question_id}' must reference a valid parent.`);
      }
      const parent = await this.questionRepo.getQuestionById(parentId);
      if (!parent) {
        throw new DataIntegrityError(`Referential integrity failure: Parent question '${parentId}' not found.`);
      }
      const isParentPrimary = parent.question_id.endsWith('-TH') || (!parent.question_id.endsWith('-PR') && parent.question_type === 'Primary');
      if (!isParentPrimary) {
        throw new DataIntegrityError(`Referential integrity failure: Referenced parent '${parentId}' is not a Primary question.`);
      }
      const rawTopic = q.topic || (q as any).Topic;
      const parentRawTopic = parent.topic || (parent as any).Topic;
      const childTopic = normalizeToCanonicalTopic(rawTopic);
      const parentTopic = normalizeToCanonicalTopic(parentRawTopic);
      if (childTopic !== parentTopic) {
        throw new DataIntegrityError(`Referential integrity failure: Inconsistent topic between parent '${parentTopic}' and follow-up '${childTopic}'.`);
      }
    }

    return toSafeQuestionDTO(q);
  }

  async getFollowUpQuestion(mainQuestionId: string): Promise<SafeQuestionDTO | null> {
    const parent = await this.questionRepo.getQuestionById(mainQuestionId);
    if (!parent) {
      return null;
    }

    // Validate parent is Primary
    const isParentPrimary = parent.question_id.endsWith('-TH') || (!parent.question_id.endsWith('-PR') && parent.question_type === 'Primary');
    if (!isParentPrimary) {
      throw new DataIntegrityError(`Main question '${mainQuestionId}' is not a Primary question.`);
    }

    const followUp = await this.questionRepo.getFollowUpQuestion(mainQuestionId);
    if (!followUp) {
      return null;
    }

    // Verify referential integrity and topic match
    const parentTopic = normalizeToCanonicalTopic(parent.topic || (parent as any).Topic);
    const followUpTopic = normalizeToCanonicalTopic(followUp.topic || (followUp as any).Topic);
    if (parentTopic !== followUpTopic) {
      throw new DataIntegrityError(`Referential integrity failure: Inconsistent topic between parent '${parentTopic}' and follow-up '${followUpTopic}'.`);
    }

    return toSafeQuestionDTO(followUp);
  }

  async getAllQuestions(): Promise<Question[]> {
    return this.questionRepo.getAllQuestions();
  }

  async getUnsolvedQuestions(uid: string): Promise<GetUnsolvedQuestionsResponseDTO> {
    if (!uid || typeof uid !== 'string') {
      throw new BadRequestError('User ID is required.');
    }

    const records = await this.sessionRepo.getUnsolvedQuestions(uid);
    const items: UnsolvedQuestionItemDTO[] = [];

    for (const record of records) {
      const mainQuestion = await this.questionRepo.getQuestionById(record.mainQuestionId);
      const followUpQuestion = record.followUpQuestionId
        ? await this.questionRepo.getQuestionById(record.followUpQuestionId)
        : null;

      if (mainQuestion) {
        items.push({
          record,
          mainQuestion,
          followUpQuestion,
        });
      }
    }

    return {
      success: true,
      unsolvedQuestions: items,
      totalCount: items.length,
    };
  }

  async updateUnsolvedQuestion(
    uid: string,
    questionId: string,
    updates: UpdateUnsolvedQuestionRequestDTO
  ): Promise<UpdateUnsolvedQuestionResponseDTO> {
    if (!uid || typeof uid !== 'string') {
      throw new BadRequestError('User ID is required.');
    }
    if (!questionId || typeof questionId !== 'string') {
      throw new BadRequestError('Question ID is required.');
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new BadRequestError('Update payload must be a JSON object.');
    }

    // Explicit field allow-listing: Reject any forbidden fields
    const allowedKeys = new Set(['reviewStatus', 'reviewNotes', 'isResolved']);
    for (const key of Object.keys(updates)) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestError(`DISALLOWED_FIELD: Modification of '${key}' is not permitted.`);
      }
    }

    const { reviewStatus, reviewNotes, isResolved } = updates;

    if (reviewStatus === undefined && reviewNotes === undefined && isResolved === undefined) {
      throw new BadRequestError('NO_UPDATES_PROVIDED: At least one of reviewStatus, reviewNotes, or isResolved must be provided.');
    }

    if (reviewStatus !== undefined) {
      const validStatuses = ['UNREVIEWED', 'IN_REVIEW', 'REVIEWED', 'BOOKMARKED'];
      if (!validStatuses.includes(reviewStatus)) {
        throw new BadRequestError(`INVALID_REVIEW_STATUS: reviewStatus must be one of ${validStatuses.join(', ')}.`);
      }
    }

    if (reviewNotes !== undefined) {
      if (typeof reviewNotes !== 'string') {
        throw new BadRequestError('INVALID_REVIEW_NOTES: reviewNotes must be a string.');
      }
      if (reviewNotes.length > 1000) {
        throw new BadRequestError('INVALID_REVIEW_NOTES: reviewNotes must not exceed 1000 characters.');
      }
    }

    if (isResolved !== undefined && typeof isResolved !== 'boolean') {
      throw new BadRequestError('INVALID_IS_RESOLVED: isResolved must be a boolean.');
    }

    const updatedRecord = await this.sessionRepo.updateUnsolvedQuestion(uid, questionId.trim(), {
      ...(reviewStatus !== undefined ? { reviewStatus } : {}),
      ...(reviewNotes !== undefined ? { reviewNotes: reviewNotes.trim() } : {}),
      ...(isResolved !== undefined ? { isResolved } : {}),
    });

    return {
      success: true,
      updatedRecord,
    };
  }
}
