import { registerAs } from '@nestjs/config'

export default registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  ttl: parseInt(process.env.REDIS_TTL ?? '300', 10),
}))
