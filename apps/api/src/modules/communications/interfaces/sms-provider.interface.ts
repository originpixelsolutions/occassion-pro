export interface SendSMSOptions {
  to: string   // phone number, will be normalised to 10-digit Indian format
  message: string
}

export interface SendOTPOptions {
  to: string
  otp: string
  templateId?: string
}

export interface SendSMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface ISMSProvider {
  sendSMS(options: SendSMSOptions): Promise<SendSMSResult>
  sendOTP(options: SendOTPOptions): Promise<SendSMSResult>
}

export const SMS_PROVIDER = 'SMS_PROVIDER'
