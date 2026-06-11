#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# Despliegue de Stoqly en el VPS de Arsys (Ubuntu 24.04)
#
# Uso:
#   1. Asegúrate de que los registros DNS A de api.stoqlyhome.com y
#      app.stoqlyhome.com apuntan ya a la IP de esta VPS (y han
#      propagado — puedes comprobarlo con: dig +short api.stoqlyhome.com)
#   2. Copia este script a la VPS y ejecútalo como root:
#        scp infra/deploy-arsys.sh root@<IP_VPS>:/root/
#        ssh root@<IP_VPS>
#        bash /root/deploy-arsys.sh
#   3. La PRIMERA ejecución hace los pasos 1-5 y se detiene para que
#      rellenes /srv/domtrace-monorepo/.env.production con las claves
#      reales (Stripe, R2, Resend, Anthropic, ElevenLabs, JWT...).
#   4. Vuelve a ejecutar el mismo script: continuará desde el paso 6
#      (build, migraciones, Nginx, SSL).
# ════════════════════════════════════════════════════════════════════
set -e

REPO_URL="https://github.com/javierdomtrace/domtrace-monorepo.git"
REPO_DIR="/srv/domtrace-monorepo"

echo "=== 1. Sistema y firewall ==="
apt update && apt upgrade -y
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== 2. Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "=== 3. Nginx + Certbot ==="
apt install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "=== 4. Clonar/actualizar repo ==="
mkdir -p /srv
if [ ! -d "$REPO_DIR" ]; then
  git clone -b master "$REPO_URL" "$REPO_DIR"
else
  cd "$REPO_DIR" && git checkout master && git pull origin master
fi
cd "$REPO_DIR"

echo "=== 5. Variables de entorno ==="
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo ""
  echo ">>> Rellena ahora /srv/domtrace-monorepo/.env.production con las claves reales:"
  echo ">>>   nano /srv/domtrace-monorepo/.env.production"
  echo ">>> Cuando termines, vuelve a ejecutar este script (bash /root/deploy-arsys.sh)"
  echo ">>> y continuará automáticamente desde el paso 6."
  exit 0
fi

echo "=== 6. Construir y levantar contenedores ==="
cd "$REPO_DIR/infra"
docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d --build
docker compose -f docker-compose.prod.yml ps

echo "=== 7. Migraciones de base de datos ==="
docker compose -f docker-compose.prod.yml exec -T api pnpm --filter @domtrace/db migrate:deploy

read -p "¿Crear usuario de pruebas jtorres@cogelo.es / password123? [y/N] " seed
if [[ "$seed" == "y" || "$seed" == "Y" ]]; then
  docker compose -f docker-compose.prod.yml exec -T api pnpm --filter @domtrace/db seed
fi

echo "=== 8. Nginx (host) + SSL ==="
cd "$REPO_DIR"
cp infra/nginx/api.stoqlyhome.com.conf /etc/nginx/sites-available/
cp infra/nginx/app.stoqlyhome.com.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/api.stoqlyhome.com.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/app.stoqlyhome.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d api.stoqlyhome.com -d app.stoqlyhome.com

echo "=== 9. Verificación ==="
sleep 2
curl -sf https://api.stoqlyhome.com/health && echo " -> API OK" || echo " -> API no responde todavía"
echo "Abre https://app.stoqlyhome.com en el navegador para probar el panel."

echo "=== 10. Backups diarios (opcional pero recomendado) ==="
mkdir -p /srv/backups
CRON_LINE='0 3 * * * docker compose -f /srv/domtrace-monorepo/infra/docker-compose.prod.yml exec -T postgres pg_dump -U domtrace domtrace | gzip > /srv/backups/domtrace_$(date +\%Y\%m\%d).sql.gz'
( crontab -l 2>/dev/null | grep -F "$CRON_LINE" ) || ( crontab -l 2>/dev/null; echo "$CRON_LINE" ) | crontab -

echo ""
echo "=== Despliegue completado ==="
echo "Para futuras actualizaciones: cd $REPO_DIR && git pull && cd infra && docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d --build && docker compose -f docker-compose.prod.yml exec -T 