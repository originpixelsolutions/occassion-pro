import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ISMSProvider, SendOTPOptions, SendSMSOptions, SendSMSResult } from './interfaces/sms-provider.interface'
import { Fast2SMSProvider } from './providers/fast2sms.provider'

/**
 * SMSService — wraps the configured SMS provider.
 * Provider is selected via SMS_PROVIDER env var: fast2sms (default)
 *
 * Usage:
 *   smsService.sendSMS({ to: '+919876543210', message: 'Hello' })
 *   smsService.sendOTP({ to: '+919876543210', otp: '123456' })
 */
@Injectable()
export class SMSService {
  private readonly logger = new Logger(SMSService.name)
  private readonly provider: ISMSProvider

  constructor(
    private readonly config: ConfigService,
    private readonly fast2sms: Fast2SMSProvider,
  ) {
    const providerName = config.get<string>('SMS_PROVIDER') ?? 'fast2sms'

    switch (providerName) {
      case 'fast2sms':
      default:
        this.provider = this.fast2sms
        this.logger.log(`SMS provider: Fast2SMS`)
        break
    }
  }

  /** Send a transactional SMS */
  async sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
    return this.provider.sendSMS(options)
  }

  /** Send an OTP — uses DLT route if templateId provided, else Quick SMS */
  async sendOTP(options: SendOTPOptions): Promise<SendSMSResult> {
    return this.provider.sendOTP(options)
  }

  /**
   * Fire-and-forget SMS — logs errors but never throws.
   * Use for non-critical notifications.
   */
  async sendAsync(options: SendSMSOptions): Promise<void> {
    this.provider.sendSMS(options).then(result => {
      if (!result.success) {
        this.logger.warn(`Async SMS failed: ${result.error}`)
      }
    }).catch(err => {
      this.logger.error(`Async SMS error: ${err.message}`)
    })
  }

  /**
   * Fire-and-forget OTP — logs errors but never throws.
   */
  async sendOTPAsync(options: SendOTPOptions): Promise<void> {
    this.provider.sendOTP(options).then(result => {
      if (!result.success) {
        this.logger.warn(`Async OTP failed: ${result.error}`)
      }
    }).catch(err => {
      this.logger.error(`Async OTP error: ${err.message}`)
    })
  }
}
