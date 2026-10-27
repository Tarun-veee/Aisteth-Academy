import { ISessionRepository } from '../../domain/interfaces/ISessionRepository.js';
import { IQuestionRepository } from '../../domain/interfaces/IQuestionRepository.js';
import { Question } from '../../domain/models/question.model.js';
import {
  TodaySessionResponseDTO,
  RecordAttemptRequestDTO,
  RecordAttemptResponseDTO,
  FinalizeSessionRequestDTO,
  FinalizeSessionResponseDTO
} from '../dtos/session.dto.js';
import { toSafeQuestionDTO, DataIntegrityError } from '../dtos/question.dto.js';
import { DailySessionDoc, AttemptDoc } from '../../domain/models/session.model.js';
import {
  getResolvedCalendarDate,
  selectSessionQuestions,
  selectAdaptiveQueueDailyQuestions,
  CANONICAL_31_TOPIC_SEQUENCE,
  normalizeToCanonicalTopic,
} from '../../domain/rules/sessionSelection.js';
import { AnswerEvaluator } from '../../domain/rules/AnswerEvaluator.js';

export class SessionUseCase {
  constructor(
    private sessionRepo: ISessionRepository,
    private questionRepo: IQuestionRepository
  ) {}

  generateCanonicalSessionId(uid: string, dateStr: string): string {
    return `daily_${dateStr}_${uid.substring(0, 8)}`;
  }

  async getOrCreateTodaySession(uid: string, dateStr: string = getResolvedCalendarDate()): Promise<TodaySessionResponseDTO> {
    const sessionId = this.generateCanonicalSessionId(uid, dateStr);

    let session = await this.sessionRepo.getDailySession(uid, sessionId);
    let questionIds: string[] = [];

    // 1. If today's session exists, recover and return it (survives refreshes, retries, etc.)
    if (session) {
      if (session.branchState === 'FOLLOW_UP' && session.activeFollowUpQuestionId) {
        if (Array.isArray(session.questionIds) && session.questionIds[session.currentQuestionIndex] !== session.activeFollowUpQuestionId) {
          session.questionIds[session.currentQuestionIndex] = session.activeFollowUpQuestionId;
          await this.sessionRepo.updateSessionProgress(uid, sessionId, { questionIds: session.questionIds });
        }
      } else if (Array.isArray(session.questionIds) && session.questionIds.some((id) => id.endsWith('-PR'))) {
        const activeFu = session.activeFollowUpQuestionId;
        const needsHealing = session.questionIds.some((id) => id.endsWith('-PR') && id !== activeFu);
        if (needsHealing) {
          session.questionIds = session.questionIds.map((id) => {
            if (id === activeFu) return id;
            return id.replace(/-PR$/, '-TH');
          });
          await this.sessionRepo.updateSessionProgress(uid, sessionId, { questionIds: session.questionIds });
        }
      }
      if (typeof this.sessionRepo.reconcileSessionProgressAtomic === 'function') {
        session = await this.sessionRepo.reconcileSessionProgressAtomic(uid, sessionId);
      }
      questionIds = session.questionIds;
    } else {
      // 2. Check if user has an active, incomplete session for the CURRENT cycle that has not reached terminal state
      const activeSession = await this.sessionRepo.getActiveDailySession(uid, dateStr);
      if (activeSession && activeSession.status === 'IN_PROGRESS' && !activeSession.questionsCompleted && activeSession.localDate === dateStr) {
        session = activeSession;
        if (typeof this.sessionRepo.reconcileSessionProgressAtomic === 'function') {
          session = await this.sessionRepo.reconcileSessionProgressAtomic(uid, activeSession.sessionId);
        }
        questionIds = session.questionIds;
      } else {
        // 3. Create a brand new daily session for the new cycle using the persistent 31-topic round-robin queue
        const user = await this.sessionRepo.getUser(uid);
        const userQueue: string[] = (Array.isArray(user?.topicQueue) && user.topicQueue.length > 0)
          ? user.topicQueue
          : [...CANONICAL_31_TOPIC_SEQUENCE];
        const lifetimeCompleted: string[] = Array.isArray(user?.lifetimeCompletedQuestionIds)
          ? user.lifetimeCompletedQuestionIds
          : [];

        const allQuestions = await this.questionRepo.getAllQuestions();
        const selectionResult = selectAdaptiveQueueDailyQuestions({
          pool: allQuestions,
          topicQueue: userQueue,
          lifetimeCompletedQuestionIds: lifetimeCompleted,
          count: 10,
        });

        questionIds = selectionResult.selectedQuestionIds;
        const newSession: DailySessionDoc = {
          sessionId,
          uid,
          userId: uid,
          localDate: dateStr,
          contentReleaseId: 'rel_v1_0_0',
          status: 'IN_PROGRESS',
          questionIds,
          selectedTopics: selectionResult.selectedTopics,
          currentQuestionIndex: 0,
          questionsCompleted: false,
          reviewViewed: false,
          totalXpEarned: 0,
          correctCount: 0,
          accuracy: 0,
        };

        // Concurrency-safe atomic creation (prevents duplicate allocation on simultaneous requests)
        const atomicCreate = typeof (this.sessionRepo as any).createDailySessionIfNotExists === 'function'
          ? await (this.sessionRepo as any).createDailySessionIfNotExists(newSession)
          : null;

        if (atomicCreate && !atomicCreate.created) {
          // Another concurrent request already created the session for this daily cycle
          session = atomicCreate.session as DailySessionDoc;
          questionIds = session.questionIds;
        } else {
          if (!atomicCreate) {
            await this.sessionRepo.createDailySession(newSession);
            await this.sessionRepo.updateUser(uid, {
              activeSessionId: sessionId,
              activeSessionTopics: selectionResult.selectedTopics,
              ...((!user?.topicQueue || user.topicQueue.length === 0) ? { topicQueue: userQueue } : {}),
            });
          } else {
            if (!user?.topicQueue || user.topicQueue.length === 0) {
              await this.sessionRepo.updateUser(uid, { topicQueue: userQueue });
            }
          }
          session = newSession;
        }
      }
    }

    if (!session) {
      throw new Error(`Failed to initialize or recover daily session for user '${uid}' on cycle '${dateStr}'.`);
    }

    const allQuestions = await this.questionRepo.getAllQuestions();
    const questionMap = new Map(allQuestions.map((q) => [q.question_id, q]));
    const rawQuestions = questionIds.map((id) => questionMap.get(id)).filter(Boolean) as Question[];
    const questions = rawQuestions.map(toSafeQuestionDTO);

    return {
      session,
      questions,
    };
  }

  async recordAttempt(uid: string, payload: RecordAttemptRequestDTO): Promise<RecordAttemptResponseDTO> {
    if (!payload?.sessionId) {
      throw new Error('Session ID is required.');
    }
    if (!payload?.questionId) {
      throw new Error('Question ID is required.');
    }

    // Auto-heal legacy odd-day attempt submitted with -PR on MAIN branch
    let targetQuestionId = payload.questionId;
    let targetAnswerPayload = payload.userAnswerPayload;
    let targetSelectedOption = payload.selectedOption ?? (payload.userAnswerPayload as any)?.selectedOption;

    const sessionDoc = await this.sessionRepo.getDailySession(uid, payload.sessionId);
    const activeBranch = payload.branchState || sessionDoc?.branchState || 'MAIN';

    if (activeBranch === 'MAIN' && targetQuestionId.endsWith('-PR')) {
      const parentId = targetQuestionId.replace(/-PR$/, '-TH');
      const parentQuestion = await this.questionRepo.getQuestionById(parentId);
      const prQuestion = await this.questionRepo.getQuestionById(targetQuestionId);
      if (parentQuestion && prQuestion) {
        const prOptKey = targetSelectedOption || (targetAnswerPayload as any)?.selected_option;
        const selectedText = (prQuestion as any)[prOptKey] || (prQuestion as any)[`option_${prOptKey?.toLowerCase()}`];
        if (selectedText) {
          for (const optKey of ['option_a', 'option_b', 'option_c', 'option_d']) {
            if ((parentQuestion as any)[optKey]?.trim().toLowerCase() === selectedText.trim().toLowerCase()) {
              targetSelectedOption = optKey;
              targetAnswerPayload = { ...targetAnswerPayload, selected_option: optKey as any };
              break;
            }
          }
        }
        targetQuestionId = parentId;
      }
    }

    // 1. Retrieve question details and validate answer payload format
    const question = await this.questionRepo.getQuestionById(targetQuestionId);
    if (!question) {
      throw new Error(`Question ${targetQuestionId} not found.`);
    }

    // Lineage referential integrity check on session attempt path
    const isFollowUp = targetQuestionId.endsWith('-PR') || question.question_type === 'Follow-Up';
    if (isFollowUp) {
      if (targetQuestionId.endsWith('-TH') && question.question_type === 'Follow-Up') {
        throw new DataIntegrityError(`Question identifier '${targetQuestionId}' suffix -TH conflicts with Follow-Up question type.`);
      }
      const parentId = question.follow_up_for || (question as any).Follow_Up_For;
      if (!parentId || typeof parentId !== 'string') {
        throw new DataIntegrityError(`Follow-Up question '${targetQuestionId}' must reference a valid parent.`);
      }
      const parent = await this.questionRepo.getQuestionById(parentId);
      if (!parent) {
        throw new DataIntegrityError(`Referential integrity failure: Parent question '${parentId}' not found.`);
      }
      const isParentPrimary = parent.question_id.endsWith('-TH') || (!parent.question_id.endsWith('-PR') && parent.question_type === 'Primary');
      if (!isParentPrimary) {
        throw new DataIntegrityError(`Referential integrity failure: Referenced parent '${parentId}' is not a Primary question.`);
      }
      const rawTopic = question.topic || (question as any).Topic;
      const parentRawTopic = parent.topic || (parent as any).Topic;
      const childTopic = normalizeToCanonicalTopic(rawTopic);
      const parentTopic = normalizeToCanonicalTopic(parentRawTopic);
      if (childTopic !== parentTopic) {
        throw new DataIntegrityError(`Referential integrity failure: Inconsistent topic between parent '${parentTopic}' and follow-up '${childTopic}'.`);
      }
    } else {
      if (targetQuestionId.endsWith('-PR') && question.question_type === 'Primary') {
        throw new DataIntegrityError(`Question identifier '${targetQuestionId}' suffix -PR conflicts with Primary question type.`);
      }
      const followUpFor = question.follow_up_for !== undefined ? question.follow_up_for : ((question as any).Follow_Up_For ?? null);
      if (followUpFor !== null) {
        throw new DataIntegrityError(`Primary question '${targetQuestionId}' must have follow_up_for: null.`);
      }
    }

    if (!AnswerEvaluator.isValidAnswer(question, targetAnswerPayload)) {
      throw new Error('Invalid answer payload format for question type.');
    }

    // 2. Server-authoritative answer evaluation
    const evaluation = AnswerEvaluator.evaluate(question, targetAnswerPayload);

    // 3. Atomic attempt record, sequencing check, XP award, and session progression in a single transaction
    const atomicResult = await this.sessionRepo.recordAttemptAtomic({
      uid,
      sessionId: payload.sessionId,
      questionId: targetQuestionId,
      questionIndex: payload.questionIndex,
      userAnswerPayload: targetAnswerPayload,
      evaluation,
      idempotencyKey: payload.idempotencyKey,
      selectedOption: targetSelectedOption as any,
    });

    return {
      success: true,
      attemptId: atomicResult.attemptId,
      evaluation,
      questionIndex: atomicResult.currentQuestionIndex,
      branchState: atomicResult.branchState,
      result: atomicResult.result,
      xpAwarded: atomicResult.xpAwarded,
      isSessionComplete: atomicResult.isSessionComplete,
      status: atomicResult.status,
      questionsCompleted: atomicResult.questionsCompleted,
      currentQuestionIndex: atomicResult.currentQuestionIndex,
      totalXpEarned: atomicResult.totalXpEarned,
      correctCount: atomicResult.correctCount,
      activeFollowUpQuestionId: atomicResult.activeFollowUpQuestionId,
    };
  }

  async finalizeSession(uid: string, payload: FinalizeSessionRequestDTO): Promise<FinalizeSessionResponseDTO> {
    if (!payload?.sessionId) {
      throw new Error('Session ID is required.');
    }
    const todayDateStr = getResolvedCalendarDate();

    const result = await this.sessionRepo.finalizeSessionAtomic({
      uid,
      sessionId: payload.sessionId,
      todayDateStr,
    });

    return {
      success: result.success,
      alreadyFinalized: result.alreadyFinalized,
      updatedStats: result.updatedLearningState ? {
        totalXp: result.updatedLearningState.totalXp,
        currentStreak: result.updatedLearningState.currentStreak,
        longestStreak: result.updatedLearningState.longestStreak,
        lastActiveDate: result.updatedLearningState.lastActiveDate,
        completedQuestionsCount: result.updatedLearningState.completedQuestionsCount,
        completedSessionsCount: result.updatedLearningState.completedSessionsCount,
        totalCorrectAnswersCount: result.updatedLearningState.totalCorrectAnswersCount,
      } : undefined,
    };
  }
}
