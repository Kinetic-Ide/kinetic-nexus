# syntax=docker/dockerfile:1

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
# OpenSSL so Prisma detects the correct engine at generate time (Alpine ships
# OpenSSL 3.x; without libssl present Prisma mis-guesses openssl-1.1.x).
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
# Build the redesigned dashboard (Phase 7.9 cutover). It is a separate npm package under web/; its
# static output (web/dist) is what the runtime image serves. Built here so the runtime stage carries
# only the compiled assets, never the dashboard's dev toolchain.
RUN cd web && npm ci && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# libssl must also be present in the runtime image so the Prisma query engine
# loads when the container starts.
RUN apk add --no-cache openssl

LABEL org.opencontainers.image.title="Alayra Nexus" \
      org.opencontainers.image.description="Open-source AI gateway — one OpenAI-compatible endpoint for every provider, with load balancing, failover, rate limits, and cost analytics." \
      org.opencontainers.image.source="https://github.com/Alayra-Systems-Pvt-Limited/Alayra-Nexus" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Alayra Systems"

# Production dependencies only. `prisma` is a runtime dependency (migrate deploy
# runs at startup), so the CLI is present without pulling in dev tooling.
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
# The dashboard's static build. The gateway serves it from web/dist (see the static root in
# src/server.ts); only the built assets ship, not web/'s source or toolchain. @fastify/static only
# logs a warning for a missing root, so keep this COPY in step with that static root — if they drift,
# the container starts clean but returns 404 for the dashboard.
COPY --from=builder /app/web/dist ./web/dist

# Drop root: run as the image's built-in unprivileged `node` user.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Container healthcheck against the app's own /health endpoint (Node 22 has fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# npm's update notice is noise in a container log and cannot be acted on from inside
# an immutable image.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Apply pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
