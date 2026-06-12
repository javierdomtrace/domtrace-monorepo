# Despliegue de Stoqly en Arsys (VPS Ubuntu 24.04, 4vCPU/8GB/240GB)

Guía paso a paso para una primera "prueba real" en la nube. Cubre API (Fastify),
PostgreSQL, Redis y panel web (Vite). El albarán (Next.js) se añade más adelante
cuando esté implementado — ya está preparado el hueco en `docker-compose.prod.yml`
y en `infra/nginx/albaran.stoqlyhome.com.conf.future`.

## 0. DNS (hacerlo ya, tarda en propagar)

En el panel DNS de `stoqlyhome.com`, añade dos registros A apuntando a la IP
pública de la VPS (no toques los registros de correo existentes — MX/SPF/DKIM
son independientes):

| Tipo | Nombre | Valor              |
|------|--------|--------------------|
| A    | api    | <IP de la VPS>     |
| A    | app    | <IP de la VPS>     |

(Cuando exista el albarán, añadir también `albaran` → misma IP.)

## 1. Acceso inicial y actualización del sistema

```bash
ssh root@<IP_VPS>
apt update && apt upgrade -y
```

## 2. Firewall básico

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 3. Instalar Docker + Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

## 4. Instalar Nginx + Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx
```

## 5. Clonar el repositorio

```bash
mkdir -p /srv && cd /srv
git clone https://github.com/javierdomtrace/domtrace-monorepo.git
cd domtrace-monorepo
```

## 6. Configurar variables de entorno de producción

```bash
cp .env.production.example .env.production
nano .env.production
```

Rellenar como mínimo:
- `POSTGRES_PASSWORD` — contraseña fuerte nueva
- `JWT_SECRET` y `REFRESH_SECRET` — generar con `openssl rand -base64 48`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (live si vais a cobrar)
- `R2_*`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_*` — copiar de
  `apps/api/.env` local
- `BASE_URL=https://api.stoqlyhome.com`
- `VITE_API_URL=https://api.stoqlyhome.com/v1`

**Importante**: nunca subir `.env.production` a git (ya está cubierto por
`.gitignore` vía `.env*`).

## 7. Levantar los contenedores

```bash
cd infra
docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d --build
docker compose -f docker-compose.prod.yml ps
```

Esto construye las imágenes de `api` y `web-panel` (puede tardar varios
minutos la primera vez) y arranca Postgres, Redis, API (puerto 3000 solo en
localhost) y el panel (puerto 8080 solo en localhost).

## 8. Migraciones y seed de la base de datos

```bash
docker compose -f docker-compose.prod.yml exec api pnpm --filter @domtrace/db migrate:deploy
```

Para la primera prueba, opcionalmente crea el usuario de pruebas
(jtorres@cogelo.es / password123):

```bash
docker compose -f docker-compose.prod.yml exec api pnpm --filter @domtrace/db seed
```

⚠️ En producción real, después de validar, conviene cambiar/eliminar este
usuario semilla.

## 9. Configurar Nginx (host) + SSL

```bash
cp infra/nginx/api.stoqlyhome.com.conf /etc/nginx/sites-available/
cp infra/nginx/app.stoqlyhome.com.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/api.stoqlyhome.com.conf /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/app.stoqlyhome.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d api.stoqlyhome.com -d app.stoqlyhome.com
```

Certbot edita automáticamente las configs para servir HTTPS y configura la
renovación automática (cron/systemd timer ya viene incluido con el paquete).

## 10. Verificación

```bash
curl https://api.stoqlyhome.com/health
```

Y abrir `https://app.stoqlyhome.com` en el navegador — debería cargar el
panel y poder hacer login con jtorres@cogelo.es / password123 (si ejecutaste
el seed).

## 11. Conectar la app móvil (desbloquea el trabajo de voz pendiente)

En `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://api.stoqlyhome.com/v1
```

A partir de aquí, la implementación de voz en Expo (TTS/STT, ver memoria
"Voz móvil — pendiente para cloud") ya tiene una URL fija de backend y se
puede retomar.

## 12. Backups de la base de datos (recomendado)

Cron diario simple con `pg_dump` desde el host:

```bash
mkdir -p /srv/backups
crontab -e
```

Añadir:

```
0 3 * * * docker compose -f /srv/domtrace-monorepo/infra/docker-compose.prod.yml exec -T postgres pg_dump -U domtrace domtrace | gzip > /srv/backups/domtrace_$(date +\%Y\%m\%d).sql.gz
```

## Actualizar la app tras cambios (despliegues posteriores)

```bash
cd /srv/domtrace-monorepo
git pull
cd infra
docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d --build
docker compose -f docker-compose.prod.yml exec api pnpm --filter @domtrace/db migrate:deploy
```

## Servicios externos que NO cambian

Cloudflare R2, Resend, Stripe, Claude API (Anthropic) y ElevenLabs siguen
siendo los mismos servicios externos — solo hace falta que sus claves de
producción estén en `.env.production`.
