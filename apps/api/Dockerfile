# OccasionPro API — single-stage build (reliable for pnpm monorepo)
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# HUSKY=0 suppresses husky prepare script without skipping other lifecycle
# scripts — @swc/core postinstall runs and downloads the Alpine native binary
RUN HUSKY=0 pnpm install

# Build API (turbo builds workspace deps first)
RUN pnpm turbo build --filter=@occasionpro/api

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

CMD ["node", "apps/api/dist/main"]
