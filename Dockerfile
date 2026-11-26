# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app


FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./

RUN npm ci --legacy-peer-deps --no-audit --no-fund

FROM base AS builder
ARG SOURCE_COMMIT=unknown
ARG POSTHOG_PROJECT_ID
ARG POSTHOG_HOST
ENV COMMIT_REF=$SOURCE_COMMIT \
    POSTHOG_PROJECT_ID=$POSTHOG_PROJECT_ID \
    POSTHOG_HOST=$POSTHOG_HOST
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN apk add --no-cache bash git
RUN --mount=type=cache,target=/app/.next/cache \
    --mount=type=secret,id=POSTHOG_API_KEY,env=POSTHOG_API_KEY \
    npm run build

FROM base AS runner
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs ./scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 8008
ENV PORT=8008
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
