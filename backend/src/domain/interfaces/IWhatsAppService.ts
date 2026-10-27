import { WhatsAppOnboardingResult, OnboardingStatus } from '../models/admin.types.js';

export interface SendOnboardingMessageParams {
  uid: string;
  phoneNumber: string;
  learnerName: string;
  username: string;
}

export interface IWhatsAppService {
  isConfigured(): boolean;
  normalizePhoneNumber(phone: string): { valid: boolean; normalized: string; error?: string };
  sendOnboardingMessage(params: SendOnboardingMessageParams): Promise<WhatsAppOnboardingResult>;
}
