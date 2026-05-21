# ============================================================
# OccasionPro API — Multi-stage Docker Build
# Base image: node:20-alpine
# Monorepo-aware: copies pnpm workspace + builds via turbo
# ============================================================

# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM base AS builder

# Copy workspace manifests first (layer cache optimisation)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Copy package.json for each workspace the API depends on
COPY apps/api/package.json ./apps/api/

# Copy shared packages if they exist (no-op if directory is empty)
COPY packages/ ./packages/

# Install all dependencies (including devDeps needed for the build)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/api ./apps/api
COPY packages ./packages

# Build the API via Turbo (falls back to pnpm run build if turbo.json absent)
RUN pnpm turbo build --filter=api

# ── Stage 3: Production Runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Create non-root user before installing
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy workspace manifests for production-only install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Production deps only — no devDependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled dist from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]

# ── Stage 4: Development (optional, not built in CI) ──────────────────────────
FROM builder AS development

WORKDIR /app/apps/api

EXPOSE 4000 9229

CMD ["pnpm", "run", "start:debug"]
