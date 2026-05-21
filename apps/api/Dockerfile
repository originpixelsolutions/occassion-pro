# ============================================================
# OccasionPro API — Multi-stage Docker Build
# ============================================================

# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM base AS builder

# Copy workspace manifests first (no lockfile - will resolve fresh)
COPY pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json for each workspace the API depends on
COPY apps/api/package.json ./apps/api/

# Copy shared packages
COPY packages/ ./packages/

# Install all dependencies (no --frozen-lockfile since lockfile not present)
RUN pnpm install

# Copy source files
COPY apps/api ./apps/api
COPY packages ./packages

# Build the API via Turbo
RUN pnpm turbo build --filter=@occasionpro/api

# ── Stage 3: Production Runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy workspace manifests for production-only install
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Production deps only
RUN pnpm install --prod

# Copy compiled dist from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

WORKDIR /app

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

  CMD ["node", "apps/api/dist/main"]
