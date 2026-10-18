# syntax=docker/dockerfile:1

# ==========================================
# Étape 1 : Installation des dépendances
# ==========================================
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# OpenSSL est requis par le moteur Prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN mkdir -p public

RUN npm ci

# ==========================================
# Étape 2 : Build de l'application Next.js
# ==========================================
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"
ENV DB_PROVIDER="sqlite"

RUN npx prisma generate && node scripts/copy-pdf-worker.mjs && npm run build

# ==========================================
# Étape 3 : Image d'exécution (Runner)
# ==========================================
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PROVIDER="sqlite"
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV AUTH_TRUST_HOST="true"

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/uploads /app/prisma

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
