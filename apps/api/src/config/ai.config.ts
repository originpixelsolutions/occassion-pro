import { registerAs } from '@nestjs/config'

export default registerAs('ai', () => ({
  liteLlmUrl: process.env.LITELLM_URL ?? 'http://localhost:4001',
  liteLlmKey: process.env.LITELLM_API_KEY ?? '',
  defaultModel: process.env.AI_DEFAULT_MODEL ?? 'gpt-4o-mini',
}))
