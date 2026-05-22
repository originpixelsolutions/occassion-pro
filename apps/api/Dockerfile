# OccasionPro API — single-stage build (reliable for pnpm monorepo)
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# HUSKY=0 suppresses husky prepare script; lifecycle scripts still run so
# @swc/core postinstall can download the correct Alpine/musl native binary
RUN HUSKY=0 pnpm install

# @swc/cli is also required by NestJS SWC builder (in addition to @swc/core)
# It is not in package.json devDependencies, so install it explicitly here
RUN cd /app/apps/api && pnpm add -D @swc/cli@^0.4.0 --ignore-scripts

# Build API (turbo builds workspace deps first)
RUN pnpm turbo build --filter=@occasionpro/api

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

CMD ["node", "apps/api/dist/main"]
