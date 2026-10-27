import { IWhatsAppService, SendOnboardingMessageParams } from '../../domain/interfaces/IWhatsAppService.js';
import { WhatsAppOnboardingResult } from '../../domain/models/admin.types.js';
import { normalizePhoneNumber } from '../../domain/rules/phone.js';

export class WhatsAppOnboardingService implements IWhatsAppService {
  private apiToken?: string;
  private phoneNumberId?: string;
  private templateName: string;

  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.templateName = process.env.WHATSAPP_TEMPLATE_ONBOARDING || 'aisteth_learner_welcome';
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken && this.phoneNumberId);
  }

  normalizePhoneNumber(phone: string): { valid: boolean; normalized: string; error?: string } {
    return normalizePhoneNumber(phone);
  }

  async sendOnboardingMessage(params: SendOnboardingMessageParams): Promise<WhatsAppOnboardingResult> {
    const { uid, phoneNumber, learnerName, username } = params;

    const phoneValidation = this.normalizePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return {
        uid,
        phoneNumber,
        status: 'FAILED',
        error: phoneValidation.error || 'Invalid phone number format.'
      };
    }

    const normalizedPhone = phoneValidation.normalized;

    // Check if live WhatsApp Business API credentials are configured in environment
    if (!this.isConfigured()) {
      return {
        uid,
        phoneNumber: normalizedPhone,
        status: 'FAILED',
        error: 'WHATSAPP_NOT_CONFIGURED: Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID in server environment. Account created, but message cannot be sent yet.'
      };
    }

    try {
      // Dispatches request to Meta WhatsApp Cloud API endpoint
      const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: this.templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: learnerName },
                { type: 'text', text: username }
              ]
            }
          ]
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetail = data?.error?.message || 'Meta API returned an error';
        return {
          uid,
          phoneNumber: normalizedPhone,
          status: 'FAILED',
          error: `Meta WhatsApp API error: ${errorDetail}`
        };
      }

      const messageId = data?.messages?.[0]?.id;

      return {
        uid,
        phoneNumber: normalizedPhone,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        messageId: messageId || undefined
      };
    } catch (err: any) {
      return {
        uid,
        phoneNumber: normalizedPhone,
        status: 'FAILED',
        error: `Network or dispatch error: ${err?.message || 'Unknown network failure'}`
      };
    }
  }
}

export const defaultWhatsAppService = new WhatsAppOnboardingService();
