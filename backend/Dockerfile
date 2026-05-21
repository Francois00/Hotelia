# ── Build ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Instalar dependencias (dev incluidas — prisma CLI y tsc las necesitan)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile
# Regenerar cliente Prisma con detección correcta de OpenSSL 3 en Alpine
RUN pnpm prisma generate

# Compilar TypeScript → dist/
COPY tsconfig.json .
COPY src ./src/
RUN pnpm exec tsc

# ── Producción ────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copiar node_modules completo del builder (contiene el Prisma engine linux-musl-openssl-3.0.x)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma/

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
