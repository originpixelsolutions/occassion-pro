import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  env: process.env.NODE_ENV ?? 'development',
  webUrl: process.env.WEB_URL ?? 'https://app.occasionpro.in',
  apiUrl: process.env.API_URL ?? 'https://api.occasionpro.in',
  internalWebhookSecret: process.env.INTERNAL_WEBHOOK_SECRET ?? 'dev-webhook-secret',
}))
