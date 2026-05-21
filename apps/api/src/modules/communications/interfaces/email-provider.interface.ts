export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface IEmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>
  sendBulk(emails: SendEmailOptions[]): Promise<SendEmailResult[]>
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER'
