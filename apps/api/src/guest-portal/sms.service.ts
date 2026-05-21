/**
 * OccasionPro — SMS Service (ISMSProvider pattern)
 *
 * Pluggable SMS sending via env var SMS_PROVIDER:
 *   fast2sms (default, free, India)
 *   msg91
 *   twilio
 *   textlocal
 *
 * Used for: Guest Portal OTP delivery
 */

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISMSProvider {
  sendOTP(mobile: string, otp: string, eventName?: string): Promise<void>
  sendMessage(mobile: string, message: string): Promise<void>
}

// ─── Fast2SMS (default — free tier, India) ────────────────────────────────────

class Fast2SMSProvider implements ISMSProvider {
  private readonly apiKey: string
  private readonly logger = new Logger('Fast2SMS')

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async sendOTP(mobile: string, otp: string, eventName = 'the event'): Promise<void> {
    const message = `Your OTP for ${eventName} guest portal is ${otp}. Valid for 10 minutes. Do not share.`
    await this.sendMessage(mobile, message)
  }

  async sendMessage(mobile: string, message: string): Promise<void> {
    try {
      await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'q',  // Quick Transactional route
          message,
          language: 'english',
          flash: 0,
          numbers: mobile.replace(/^\+91/, '').replace(/\D/g, ''),
        },
        {
          headers: {
            authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        }
      )
    } catch (err) {
      this.logger.error('Fast2SMS send failed', err instanceof Error ? err.message : err)
      throw new Error('Failed to send SMS. Please try again.')
    }
  }
}

// ─── MSG91 ────────────────────────────────────────────────────────────────────

class MSG91Provider implements ISMSProvider {
  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
  ) {}

  async sendOTP(mobile: string, otp: string, _eventName?: string): Promise<void> {
    await axios.post(
      'https://control.msg91.com/api/v5/otp',
      {
        template_id: this.templateId,
        mobile: mobile.replace(/^\+/, ''),
        otp,
      },
      {
        headers: { authkey: this.authKey, 'Content-Type': 'application/json' },
        timeout: 10_000,
      }
    )
  }

  async sendMessage(mobile: string, message: string): Promise<void> {
    await axios.post(
      'https://control.msg91.com/api/v5/flow/',
      { flow_id: this.templateId, sender: 'OCCPRO', mobiles: mobile, message },
      { headers: { authkey: this.authKey }, timeout: 10_000 }
    )
  }
}

// ─── Twilio ───────────────────────────────────────────────────────────────────

class TwilioProvider implements ISMSProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async sendOTP(mobile: string, otp: string, eventName = 'the event'): Promise<void> {
    const message = `Your OTP for ${eventName}: ${otp}. Expires in 10 min.`
    await this.sendMessage(mobile, message)
  }

  async sendMessage(mobile: string, message: string): Promise<void> {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      new URLSearchParams({ From: this.fromNumber, To: mobile, Body: message }),
      {
        auth: { username: this.accountSid, password: this.authToken },
        timeout: 15_000,
      }
    )
  }
}

// ─── SMS Service (factory + facade) ──────────────────────────────────────────

@Injectable()
export class SMSService {
  private readonly provider: ISMSProvider
  private readonly logger = new Logger(SMSService.name)

  constructor(private readonly config: ConfigService) {
    this.provider = this.buildProvider()
  }

  async sendOTP(mobile: string, otp: string, eventName?: string): Promise<void> {
    this.logger.log(`Sending OTP to ${this.maskMobile(mobile)} (${eventName ?? 'portal'})`)
    await this.provider.sendOTP(mobile, otp, eventName)
  }

  async sendMessage(mobile: string, message: string): Promise<void> {
    await this.provider.sendMessage(mobile, message)
  }

  private buildProvider(): ISMSProvider {
    const providerName = this.config.get<string>('SMS_PROVIDER', 'fast2sms')

    switch (providerName) {
      case 'msg91':
        return new MSG91Provider(
          this.config.getOrThrow('MSG91_AUTH_KEY'),
          this.config.getOrThrow('MSG91_TEMPLATE_ID'),
        )
      case 'twilio':
        return new TwilioProvider(
          this.config.getOrThrow('TWILIO_ACCOUNT_SID'),
          this.config.getOrThrow('TWILIO_AUTH_TOKEN'),
          this.config.getOrThrow('TWILIO_FROM_NUMBER'),
        )
      case 'fast2sms':
      default:
        return new Fast2SMSProvider(
          this.config.getOrThrow('FAST2SMS_API_KEY'),
        )
    }
  }

  private maskMobile(mobile: string): string {
    return mobile.slice(0, -4).replace(/\d/g, '*') + mobile.slice(-4)
  }
}
