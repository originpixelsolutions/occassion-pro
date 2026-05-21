import 'reflect-metadata'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { NestFactory, Reflector } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { VersioningType, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import fastifyHelmet from '@fastify/helmet'
import fastifyCompress from '@fastify/compress'
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
      // Strip Authorization headers before they reach Sentry.
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>)['authorization']
      }
      return event
    },
  })
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env.LOG_LEVEL ?? 'info',
      },
      trustProxy: true,
      // Limit request body size to 10MB (file uploads handled by multipart)
      bodyLimit: 10 * 1024 * 1024,
    }),
    { bufferLogs: true },
  )

  const config = app.get(ConfigService)
  const port = config.get<number>('PORT', 4000)
  const nodeEnv = config.get<string>('NODE_ENV', 'development')
  const isProduction = nodeEnv === 'production'

  // ── FASTIFY PLUGINS ───────────────────────────────────────
  await app.register(fastifyHelmet, {
    // CSP handled at Next.js layer (next.config.ts) for the frontend.
    // API responses set restrictive CSP to prevent script execution.
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'none'"],
        scriptSrc:      ["'none'"],
        styleSrc:       ["'none'"],
        imgSrc:         ["'none'"],
        connectSrc:     ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS: force HTTPS for 1 year, include subdomains
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    // Additional security headers
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' },
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })

  await app.register(fastifyCompress, {
    global: true,
    threshold: 1024, // Only compress responses > 1KB
    encodings: ['gzip', 'deflate'],
  })

  // ── CORS ──────────────────────────────────────────────────
  const allowedOrigins = config
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true)
      }
      return callback(new Error(`CORS: Origin '${origin}' not allowed`), false)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-ID',
      'X-API-Key',
      'X-Webhook-Timestamp',
      'X-Webhook-Delivery-ID',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24h preflight cache
  })

  // ── API VERSIONING ────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI })
  app.setGlobalPrefix('api')

  // ── GLOBAL GUARDS (order matters) ─────────────────────────
  // 1. ThrottlerGuard — rate limiting (applied first to fail fast)
  // 2. SqlInjectionGuard — defense-in-depth SQL injection check
  const reflector = app.get(Reflector)
  app.useGlobalGuards(
    new ThrottlerGuard({}, app.get('ThrottlerStorage' as any), reflector),
    new SqlInjectionGuard(reflector),
  )

  // ── GLOBAL PIPES (order matters) ─────────────────────────
  // 1. SanitizationPipe runs FIRST — strips XSS before validation sees input
  // 2. OccasionProValidationPipe — validates sanitized DTOs
  app.useGlobalPipes(
    new SanitizationPipe(),
    new OccasionProValidationPipe(),
  )

  // ── GLOBAL FILTERS & INTERCEPTORS ─────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  )

  // ── SWAGGER DOCS (non-production) ─────────────────────────
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OccasionPro API')
      .setDescription('Enterprise Event Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('Auth', 'Authentication & session management')
      .addTag('Tenants', 'Multi-tenant management')
      .addTag('Events', 'Event CRUD, phases, tasks, runsheet')
      .addTag('CRM', 'Clients, contacts, leads, proposals')
      .addTag('Finance', 'Budgets, invoices, payments, expenses')
      .addTag('Venues', 'Venue management & floor plans')
      .addTag('Vendors', 'Vendor management & contracts')
      .addTag('Guests', 'Guest management, check-in, badges')
      .addTag('Inventory', 'Inventory & warehouse management')
      .addTag('Microsites', 'Event microsites & ticketing')
      .addTag('Team', 'Shifts & workforce management')
      .addTag('AI', 'AI generation & analytics')
      .addTag('Webhooks', 'Webhook management & delivery')
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
      },
    })

    logger.log(`Swagger docs available at http://localhost:${port}/docs`)
  }

  // ── SHUTDOWN HOOKS ────────────────────────────────────────
  app.enableShutdownHooks()

  await app.listen(port, '0.0.0.0')
  logger.log(`🚀 OccasionPro API running on http://localhost:${port}/api`)
  logger.log(`   Environment: ${nodeEnv}`)
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err)
  process.exit(1)
})
