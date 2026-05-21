# OccasionPro API — single-stage build (reliable for pnpm monorepo)
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# Install deps — skip lifecycle scripts (husky not needed in Docker)
RUN pnpm install --ignore-scripts

# Build API (turbo builds workspace deps first)
RUN pnpm turbo build --filter=@occasionpro/api

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

  CMD ["node", "apps/api/dist/main"]
