# Dockerfile del panel web (Vite + React) — build context: raíz del monorepo
#
#   docker build -f apps/web-panel/Dockerfile \
#     --build-arg VITE_API_URL=https://api.track-torr.com/v1 \
#     -t stoqly-web-panel .
#
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY . .

# VITE_API_URL se "hornea" en el bundle en tiempo de build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web-panel build

# ── Runtime: Nginx sirviendo los estáticos ──────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/web-panel/dist /usr/share/nginx/html
COPY apps/web-panel/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
