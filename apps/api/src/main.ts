import 'reflect-metadata'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { NestFactory, Reflector } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { VersioningType, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { SanitizationPipe } from './common/pipes/sanitization.pipe'
import { OccasionProValidationPipe } from './common/pipes/validation.pipe'
import { SqlInjectionGuard } from './common/guards/sql-injection.guard'

// ── Sentry — must be initialised before NestJS app creation ──────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    enabled: process.env.NODE_ENV === 'production',
    beforeSend(event) {
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>)['authorization']
      }
      return event
    },
  })
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    { bufferLogs: true },
  )

  const config = app.get(ConfigService)
  const port = config.get<number>('PORT', 4000)
  const nodeEnv = config.get<string>('NODE_ENV', 'development')
  const isProduction = nodeEnv === 'production'

  // ── TRUST PROXY (for Railway / reverse proxies) ──────────
  app.set('trust proxy', 1)

  // ── CORS ──────────────────────────────────────────────────
  const allowedOrigins = config
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true)
      }
      return callback(new Error(`CORS: Origin '${origin}' not allowed`), false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'X-Requested-With',
      'X-Tenant-ID', 'X-API-Key', 'X-Webhook-Timestamp', 'X-Webhook-Delivery-ID',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400,
  })

  app.enableVersioning({ type: VersioningType.URI })
  app.setGlobalPrefix('api')

  const reflector = app.get(Reflector)
  app.useGlobalGuards(
    new ThrottlerGuard({}, app.get('ThrottlerStorage' as any), reflector),
    new SqlInjectionGuard(reflector),
  )

  app.useGlobalPipes(new SanitizationPipe(), new OccasionProValidationPipe())
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor())

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OccasionPro API')
      .setDescription('Enterprise Event Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('Auth').addTag('Tenants').addTag('Events').addTag('CRM')
      .addTag('Finance').addTag('Venues').addTag('Vendors').addTag('Guests')
      .addTag('Inventory').addTag('Microsites').addTag('Team').addTag('AI').addTag('Webhooks')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } })
    logger.log(`Swagger docs at http://localhost:${port}/docs`)
  }

  app.enableShutdownHooks()
  await app.listen(port, '0.0.0.0')
  logger.log(`OccasionPro API running on http://localhost:${port}/api`)
}

bootstrap().catch((err) => { console.error('Fatal bootstrap error:', err); process.exit(1) })
