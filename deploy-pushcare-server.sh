#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/pushcare"
API_PORT="${API_PORT:-8787}"
FRONTEND_HOST="${FRONTEND_HOST:-admin.pushcare.net}"
API_HOST="${API_HOST:-api.pushcare.net}"
SUBSCRIBER_HOST="${SUBSCRIBER_HOST:-subscribers.pushcare.net}"
APACHE_VHOST_ADDR="${APACHE_VHOST_ADDR:-$(hostname -I | awk '{print $1}')}"

export DEBIAN_FRONTEND=noninteractive

echo "[1/6] Checking runtime packages"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not installed." >&2
  exit 1
fi

if [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]]; then
  echo "Node.js 20+ is required. Found $(node -v)." >&2
  exit 1
fi

if ! command -v httpd >/dev/null 2>&1; then
  echo "Apache/httpd is required but not installed." >&2
  exit 1
fi

echo "[2/6] Installing dependencies and building"
cd "$APP_DIR/backends/local-api"
npm ci
npm run build

cd "$APP_DIR/pushcare-admin"
npm ci
npm run build

if [[ -d "$APP_DIR/pushcare-subscriber-portal" ]]; then
  cd "$APP_DIR/pushcare-subscriber-portal"
  npm ci
  npm run build
fi

echo "[3/6] Installing API systemd service"
cat >/etc/systemd/system/pushcare-api.service <<SERVICE
[Unit]
Description=PushCare test API
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backends/local-api
Environment=NODE_ENV=production
Environment=PORT=$API_PORT
Environment=PUSHCARE_SERVICE_KEY=sk_live_demo_pushcare_local
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now pushcare-api

echo "[4/6] Configuring Apache"
mkdir -p /var/www/pushcare
rm -rf /var/www/pushcare/*
cp -a "$APP_DIR/pushcare-admin/dist/." /var/www/pushcare/

if [[ -d "$APP_DIR/pushcare-subscriber-portal/dist" ]]; then
  mkdir -p /var/www/pushcare-subscribers
  rm -rf /var/www/pushcare-subscribers/*
  cp -a "$APP_DIR/pushcare-subscriber-portal/dist/." /var/www/pushcare-subscribers/
fi

if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" == "Enforcing" ]]; then
  command -v chcon >/dev/null 2>&1 && chcon -R -t httpd_sys_content_t /var/www/pushcare || true
  command -v chcon >/dev/null 2>&1 && [[ -d /var/www/pushcare-subscribers ]] && chcon -R -t httpd_sys_content_t /var/www/pushcare-subscribers || true
  command -v setsebool >/dev/null 2>&1 && setsebool -P httpd_can_network_connect 1 || true
fi

cat >/etc/apache2/conf.d/pushcare.conf <<APACHE
<VirtualHost $APACHE_VHOST_ADDR:80>
  ServerName $API_HOST
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyPass / http://127.0.0.1:$API_PORT/
  ProxyPassReverse / http://127.0.0.1:$API_PORT/
  ErrorLog logs/pushcare-api-error_log
  CustomLog logs/pushcare-api-access_log combined
</VirtualHost>

<VirtualHost $APACHE_VHOST_ADDR:80>
  ServerName $FRONTEND_HOST
  ServerAlias www.$FRONTEND_HOST
  DocumentRoot /var/www/pushcare

  <Directory /var/www/pushcare>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource /index.html
  </Directory>

  ErrorLog logs/pushcare-web-error_log
  CustomLog logs/pushcare-web-access_log combined
</VirtualHost>

<VirtualHost $APACHE_VHOST_ADDR:80>
  ServerName $SUBSCRIBER_HOST
  DocumentRoot /var/www/pushcare-subscribers

  <Directory /var/www/pushcare-subscribers>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource /index.html
  </Directory>

  ErrorLog logs/pushcare-subscribers-error_log
  CustomLog logs/pushcare-subscribers-access_log combined
</VirtualHost>
APACHE

httpd -t
systemctl reload httpd

echo "[5/6] Local health checks"
curl -fsS "http://127.0.0.1:$API_PORT/health"
curl -fsSI "http://127.0.0.1/"

echo "[6/6] Public HTTP checks"
curl -fsS "http://$API_HOST/health"
curl -fsSI "http://$FRONTEND_HOST/"

echo "Done"
systemctl --no-pager --full status pushcare-api | sed -n '1,12p'
