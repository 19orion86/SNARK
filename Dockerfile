# ── Stage 1: зависимости ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: сборка ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Переменные нужны только для прохождения билда (реальные значения — в .env на сервере)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV USE_MOCK_DB=true
ENV JWT_ACCESS_SECRET=build-placeholder-access
ENV JWT_REFRESH_SECRET=build-placeholder-refresh
ENV S3_ACCESS_KEY_ID=mock
ENV S3_SECRET_ACCESS_KEY=mock
ENV S3_ENDPOINT=http://mock
ENV S3_REGION=ru-central-1
ENV S3_BUCKET=portal

RUN pnpm build

# ── Stage 3: продакшн-образ ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
