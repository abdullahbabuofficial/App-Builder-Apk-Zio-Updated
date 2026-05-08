# ApkZio Nginx Configuration for Production

This directory contains production-ready nginx configuration for ApkZio.

## Configuration Files

- `apkzio-production.conf` - Complete production nginx config with SSL, rate limiting, and security headers

## Features

✅ **SSL/HTTPS** - Full TLS 1.2/1.3 support with Let's Encrypt
✅ **Security Headers** - HSTS, CSP, X-Frame-Options, etc.
✅ **Rate Limiting** - Different limits for API, builder, and SDK endpoints
✅ **Gzip Compression** - Automatic compression for text assets
✅ **Static File Caching** - Long cache times for immutable assets
✅ **HTTP/2** - Enabled for better performance
✅ **Upstream Backend** - Connection pooling with keepalive

## Installation

### 1. Prerequisites

Ensure you have:
- Nginx installed (`nginx -v`)
- Domain names pointed to your server
- SSL certificates (Let's Encrypt)

### 2. Install Configuration

```bash
# Copy production config to nginx sites-available
sudo cp /root/home/apkzio/nginx/apkzio-production.conf /etc/nginx/sites-available/apkzio

# Remove existing symlink (if any)
sudo rm -f /etc/nginx/sites-enabled/apkzio

# Create new symlink
sudo ln -s /etc/nginx/sites-available/apkzio /etc/nginx/sites-enabled/apkzio

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 3. SSL Certificates (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificates for all domains
sudo certbot --nginx -d api.apkzio.com
sudo certbot --nginx -d admin.apkzio.com
sudo certbot --nginx -d apkzio.com -d www.apkzio.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 4. Build Frontend Applications

```bash
cd /root/home/apkzio

# Build admin dashboard
cd apkzio-admin
npm ci --production=false
npm run build
# Output: apkzio-admin/dist/

# Build public frontend
cd ../apkzio-pub
npm ci --production=false
npm run build
# Output: apkzio-pub/dist/
```

### 5. Start Backend API

```bash
cd /root/home/apkzio/backends/local-api

# Build TypeScript
npm run build

# Create systemd service (see below)
sudo systemctl start apkzio-api
sudo systemctl enable apkzio-api
```

## Systemd Service

Create `/etc/systemd/system/apkzio-api.service`:

```ini
[Unit]
Description=ApkZio API Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/home/apkzio/backends/local-api
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="HOST=127.0.0.1"
EnvironmentFile=/root/home/apkzio/backends/local-api/.env.production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=apkzio-api

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/root/home/apkzio/backends/local-api/builds /root/home/apkzio/backends/local-api/tmp

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable apkzio-api
sudo systemctl start apkzio-api
sudo systemctl status apkzio-api
```

## Configuration Details

### Rate Limits

| Endpoint | Limit | Burst | Purpose |
|----------|-------|-------|---------|
| `/api/builder` | 10 req/min | 5 | APK build endpoint (slow) |
| `/api/*` | 100 req/min | 20 | General admin API |
| `/sdk/*` | 200 req/min | 50 | SDK endpoints (high traffic) |

### Timeouts

| Location | Timeout | Purpose |
|----------|---------|---------|
| `/api/builder` | 1800s (30min) | APK builds can take long |
| `/api/*` | 300s (5min) | General API operations |
| `/sdk/*` | 60s (1min) | Fast SDK operations |

### Static File Caching

| Pattern | Cache Duration | Purpose |
|---------|----------------|---------|
| `/assets/*` | 1 year | Admin dashboard immutable assets |
| `/_next/static/*` | 1 year | Next.js immutable assets |
| General static files | 30 days | Images, fonts, PDFs |

### Security Headers

- **HSTS**: Force HTTPS for 1 year
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **CSP**: Content Security Policy for admin dashboard
- **Referrer-Policy**: Protect user privacy

## Monitoring

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/api.apkzio.com.access.log
sudo tail -f /var/log/nginx/admin.apkzio.com.access.log
sudo tail -f /var/log/nginx/apkzio.com.access.log

# Error logs
sudo tail -f /var/log/nginx/api.apkzio.com.error.log
sudo tail -f /var/log/nginx/admin.apkzio.com.error.log
sudo tail -f /var/log/nginx/apkzio.com.error.log
```

### Backend API Logs

```bash
# View logs
sudo journalctl -u apkzio-api -f

# Filter by level
sudo journalctl -u apkzio-api -p err

# Last 100 lines
sudo journalctl -u apkzio-api -n 100
```

### Nginx Status

```bash
# Check configuration
sudo nginx -t

# Reload without downtime
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## Testing

### Health Checks

```bash
# API health
curl https://api.apkzio.com/health

# API status (with database check)
curl https://api.apkzio.com/api/status

# Admin dashboard
curl -I https://admin.apkzio.com

# Public frontend
curl -I https://apkzio.com
```

### SSL Test

```bash
# Check SSL certificate
openssl s_client -connect api.apkzio.com:443 -servername api.apkzio.com

# SSL Labs test (online)
# https://www.ssllabs.com/ssltest/analyze.html?d=api.apkzio.com
```

### Performance Test

```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Test API endpoint
ab -n 1000 -c 10 https://api.apkzio.com/health

# Test static files
ab -n 1000 -c 10 https://apkzio.com/
```

## Troubleshooting

### 502 Bad Gateway

```bash
# Check if backend is running
curl http://localhost:3001/health

# Check backend logs
sudo journalctl -u apkzio-api -n 50

# Restart backend
sudo systemctl restart apkzio-api
```

### 403 Forbidden

```bash
# Check file permissions
ls -la /root/home/apkzio/apkzio-admin/dist/
ls -la /root/home/apkzio/apkzio-pub/dist/

# Fix permissions if needed
sudo chmod -R 755 /root/home/apkzio/apkzio-admin/dist/
sudo chmod -R 755 /root/home/apkzio/apkzio-pub/dist/
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificates
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal
```

### Rate Limit Testing

```bash
# Test rate limiting (should get 429 after limit)
for i in {1..15}; do curl https://api.apkzio.com/api/apps; done
```

## Security Hardening

### Firewall (UFW)

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to backend
sudo ufw deny 3001/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### Fail2Ban

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Configure nginx jail
sudo nano /etc/fail2ban/jail.local
```

Add:

```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log

[nginx-badbots]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
```

Restart:

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

## Maintenance

### Nginx Log Rotation

Nginx logs are automatically rotated by logrotate. Check config:

```bash
cat /etc/logrotate.d/nginx
```

### Backup Configuration

```bash
# Backup nginx config
sudo tar -czf /root/nginx-backup-$(date +%Y%m%d).tar.gz /etc/nginx/

# Backup application
sudo tar -czf /root/apkzio-backup-$(date +%Y%m%d).tar.gz /root/home/apkzio/
```

### Updates

```bash
# Update nginx
sudo apt update
sudo apt upgrade nginx

# Test after update
sudo nginx -t
sudo systemctl reload nginx
```

## Production Checklist

- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall configured (UFW)
- [ ] Fail2Ban configured
- [ ] Backend API running as systemd service
- [ ] Frontend applications built and deployed
- [ ] Rate limiting tested
- [ ] Security headers verified
- [ ] Monitoring configured (Prometheus, Sentry)
- [ ] Logs rotating properly
- [ ] Backup strategy in place
- [ ] Domain DNS configured correctly

## Support

For issues or questions:
- Check logs: `/var/log/nginx/` and `journalctl -u apkzio-api`
- Test configuration: `sudo nginx -t`
- Verify backend: `curl http://localhost:3001/health`
- Review documentation: `/root/home/apkzio/README.md`
