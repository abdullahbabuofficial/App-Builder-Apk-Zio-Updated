#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apkzio"
API_PORT="${API_PORT:-8787}"
FRONTEND_HOST="${FRONTEND_HOST:-admin.apkzio.net}"
API_HOST="${API_HOST:-api.apkzio.net}"
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

cd "$APP_DIR/apkzio-admin"
npm ci
npm run build

echo "[3/6] Installing API systemd service"
cat >/etc/systemd/system/apkzio-api.service <<SERVICE
[Unit]
Description=ApkZio test API
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backends/local-api
Environment=NODE_ENV=production
Environment=PORT=$API_PORT
Environment=APKZIO_SERVICE_KEY=sk_live_demo_apkzio_local
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now apkzio-api

echo "[4/6] Configuring Apache"
mkdir -p /var/www/apkzio
rm -rf /var/www/apkzio/*
cp -a "$APP_DIR/apkzio-admin/dist/." /var/www/apkzio/

if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" == "Enforcing" ]]; then
  command -v chcon >/dev/null 2>&1 && chcon -R -t httpd_sys_content_t /var/www/apkzio || true
  command -v setsebool >/dev/null 2>&1 && setsebool -P httpd_can_network_connect 1 || true
fi

cat >/etc/apache2/conf.d/apkzio.conf <<APACHE
<VirtualHost $APACHE_VHOST_ADDR:80>
  ServerName $API_HOST
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyPass / http://127.0.0.1:$API_PORT/
  ProxyPassReverse / http://127.0.0.1:$API_PORT/
  ErrorLog logs/apkzio-api-error_log
  CustomLog logs/apkzio-api-access_log combined
</VirtualHost>

<VirtualHost $APACHE_VHOST_ADDR:80>
  ServerName $FRONTEND_HOST
  ServerAlias www.$FRONTEND_HOST
  DocumentRoot /var/www/apkzio

  <Directory /var/www/apkzio>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    FallbackResource /index.html
  </Directory>

  ErrorLog logs/apkzio-web-error_log
  CustomLog logs/apkzio-web-access_log combined
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
systemctl --no-pager --full status apkzio-api | sed -n '1,12p'
