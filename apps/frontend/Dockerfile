# syntax=docker/dockerfile:1

###############################################################################
# Builder: install workspace deps from root lockfile, build the Next app
# Context must be the repo ROOT (root package.json + package-lock.json).
# Build context: docker build -f apps/frontend/Dockerfile .
###############################################################################
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/agents/package.json apps/agents/package.json

RUN npm ci

COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

###############################################################################
# Runner: standalone-trace output only (server.js, static, public)
###############################################################################
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system nodejs \
    && adduser --system --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# Runtime env vars come from the deployment environment, NOT the image.
# Server-only (needed at runtime for /api/location + /api/livekit/token):
#   GOOGLE_MAPS_API_KEY, LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
# (NEXT_PUBLIC_API_URL was baked in at build time.)

CMD ["node", "apps/frontend/server.js"]