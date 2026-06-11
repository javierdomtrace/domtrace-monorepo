# Dockerfile de la API (Fastify) — build context: raíz del monorepo
#
#   docker build -f apps/api/Dockerfile -t stoqly-api .
#
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copiamos todo el monorepo (node_modules excluido vía .dockerignore)
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @domtrace/db generate

# ── Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app /app

EXPOSE 3000
CMD ["node", "node_modules/tsx/dist/cli.mjs", "apps/api/src/index.t