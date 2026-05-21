import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ISMSProvider, SendOTPOptions, SendSMSOptions, SendSMSResult } from '../interfaces/sms-provider.interface'

/**
 * Fast2SMS provider — India's free-tier SMS gateway.
 * API docs: https://docs.fast2sms.com
 *
 * Supports:
 *  - Quick SMS (transactional, DLT not required for < 200 chars)
 *  - OTP via DLT template route
 */
@Injectable()
export class Fast2SMSProvider implements ISMSProvider {
  private readonly logger = new Logger(Fast2SMSProvider.name)
  private readonly apiKey: string
  private readonly senderId: string

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('FAST2SMS_API_KEY') ?? ''
    this.senderId = config.get<string>('FAST2SMS_SENDER_ID') ?? 'FSTSMS'
  }

  /** Normalise to 10-digit Indian number */
  private normalise(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('91') && digits.length === 12) return digits.slice(2)
    if (digits.length === 10) return digits
    return digits.slice(-10)
  }

  async sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
    try {
      if (!this.apiKey) {
        this.logger.warn('FAST2SMS_API_KEY not configured — SMS not sent')
        return { success: false, error: 'SMS provider not configured' }
      }

      const phone = this.normalise(options.to)

      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',           // Quick SMS (no DLT required)
          message: options.message,
          language: 'english',
          flash: 0,
          numbers: phone,
        }),
      })

      const data = await response.json() as {
        return?: boolean
        request_id?: string
        message?: string[]
      }

      if (!data.return) {
        const err = data.message?.join(', ') ?? 'Fast2SMS error'
        this.logger.error(`Fast2SMS error: ${err}`)
        return { success: false, error: err }
      }

      this.logger.log(`SMS sent via Fast2SMS: ${data.request_id} → ${phone}`)
      return { success: true, messageId: data.request_id }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Fast2SMSProvider.sendSMS failed: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async sendOTP(options: SendOTPOptions): Promise<SendSMSResult> {
    const message = `${options.otp} is your OccasionPro OTP. Valid for 5 minutes. Do not share with anyone.`

    // Use DLT OTP route if templateId provided, else fall back to quick SMS
    if (options.templateId) {
      try {
        if (!this.apiKey) return { success: false, error: 'SMS provider not configured' }

        const phone = this.normalise(options.to)

        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'dlt',
            sender_id: this.senderId,
            message: options.templateId,
            variables_values: `${options.otp}|`,
            flash: 0,
            numbers: phone,
          }),
        })

        const data = await response.json() as { return?: boolean; request_id?: string; message?: string[] }

        if (!data.return) {
          // Fallback to quick route
          this.logger.warn('DLT OTP failed, falling back to quick route')
          return this.sendSMS({ to: options.to, message })
        }

        return { success: true, messageId: data.request_id }
      } catch {
        return this.sendSMS({ to: options.to, message })
      }
    }

    return this.sendSMS({ to: options.to, message })
  }
}
