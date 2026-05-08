# ApkZio Production Deployment - Quick Start

Complete guide to deploy ApkZio to production with nginx.

## Prerequisites Checklist

- [ ] Ubuntu 20.04+ or Debian 11+ server
- [ ] Root or sudo access
- [ ] Domain names configured:
  - `api.apkzio.com` → Server IP
  - `admin.apkzio.com` → Server IP
  - `apkzio.com` → Server IP
  - `www.apkzio.com` → Server IP
- [ ] Ports 80, 443 open in firewall
- [ ] PostgreSQL 15+ installed and running
- [ ] Redis installed and running (optional but recommended)
- [ ] Node.js 20+ installed

## Step-by-Step Deployment

### 1. Clone Repository

```bash
cd /root/home
git clone <your-repo-url> apkzio
cd apkzio
```

### 2. Install Dependencies

```bash
# Backend API
cd backends/local-api
npm install
cd ../..

# Admin Dashboard
cd apkzio-admin
npm install
cd ..

# Public Frontend
cd apkzio-pub
npm install
cd ..
```

### 3. Configure Environment

Create production environment file:

```bash
cd backends/local-api
cp .env .env.production
nano .env.production
```

Update these values in `.env.production`:

```bash
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
USE_DATABASE=true
DATABASE_URL=postgresql://apkzio_user:your_secure_password@localhost:5432/apkzio
REDIS_URL=redis://localhost:6379

# Your admin API key (keep this secret!)
APKZIO_ADMIN_API_KEY=PC_your_admin_key_here

# Generate these with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Optional: Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### 4. Set Up Database

```bash
# Create PostgreSQL database and user
sudo -u postgres psql -c "CREATE DATABASE apkzio;"
sudo -u postgres psql -c "CREATE USER apkzio_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE apkzio TO apkzio_user;"

# Run migrations
cd /root/home/apkzio/backends/local-api
npm run migrate
```

### 5. Build Applications

```bash
cd /root/home/apkzio

# Build backend
cd backends/local-api
npm run build

# Build admin dashboard
cd ../../apkzio-admin
npm run build

# Build public frontend
cd ../apkzio-pub
npm run build

cd ..
```

### 6. Deploy Nginx Configuration

```bash
cd /root/home/apkzio/nginx
sudo ./deploy-nginx.sh
```

This will:
- ✅ Check prerequisites
- ✅ Copy nginx configuration
- ✅ Create symbolic links
- ✅ Test configuration
- ✅ Reload nginx

### 7. Set Up Systemd Service

```bash
cd /root/home/apkzio/nginx
sudo ./setup-systemd.sh
```

This will:
- ✅ Create systemd service file
- ✅ Enable auto-start on boot
- ✅ Start the service
- ✅ Check health endpoint

### 8. Configure SSL Certificates

```bash
cd /root/home/apkzio/nginx
sudo ./setup-ssl.sh
```

Follow the prompts to:
- ✅ Install certbot
- ✅ Get SSL certificates
- ✅ Configure auto-renewal

### 9. Verify Deployment

```bash
# Check backend API
curl https://api.apkzio.com/health
curl https://api.apkzio.com/api/status

# Check admin dashboard
curl -I https://admin.apkzio.com

# Check public frontend
curl -I https://apkzio.com

# Check service status
sudo systemctl status apkzio-api

# Check logs
sudo journalctl -u apkzio-api -n 50
```

## Post-Deployment Configuration

### 1. Create Admin User (Supabase)

If using Supabase authentication:

```bash
cd /root/home/apkzio/apkzio-admin
npm run create-dashboard-user
```

### 2. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to backend
sudo ufw deny 3001/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 3. Set Up Monitoring

Configure Prometheus:

```bash
# Edit prometheus config
sudo nano /etc/prometheus/prometheus.yml
```

Add scrape target:

```yaml
scrape_configs:
  - job_name: 'apkzio-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

Restart Prometheus:

```bash
sudo systemctl restart prometheus
```

### 4. Configure Log Rotation

Nginx logs are auto-rotated. For application logs:

```bash
sudo nano /etc/logrotate.d/apkzio
```

Add:

```
/var/log/apkzio/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
```

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
sudo journalctl -u apkzio-api -n 100

# Check if built
ls -la /root/home/apkzio/backends/local-api/dist/

# Rebuild
cd /root/home/apkzio/backends/local-api
npm run build

# Restart service
sudo systemctl restart apkzio-api
```

### 502 Bad Gateway

```bash
# Check if backend is running
sudo systemctl status apkzio-api

# Check if listening on correct port
ss -tlnp | grep 3001

# Test directly
curl http://localhost:3001/health

# Check nginx logs
sudo tail -f /var/log/nginx/api.apkzio.com.error.log
```

### SSL Certificate Issues

```bash
# Check certificates
sudo certbot certificates

# Renew certificates
sudo certbot renew

# Check nginx SSL config
sudo nginx -t
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U apkzio_user -d apkzio -h localhost

# Check DATABASE_URL in .env.production
cat /root/home/apkzio/backends/local-api/.env.production | grep DATABASE_URL
```

## Maintenance Commands

### Update Application

```bash
cd /root/home/apkzio

# Pull latest code
git pull

# Install dependencies
cd backends/local-api && npm install
cd ../../apkzio-admin && npm install
cd ../apkzio-pub && npm install

# Build everything
cd ../backends/local-api && npm run build
cd ../../apkzio-admin && npm run build
cd ../apkzio-pub && npm run build

# Restart backend
sudo systemctl restart apkzio-api

# Reload nginx (if config changed)
sudo systemctl reload nginx
```

### View Logs

```bash
# Backend API logs
sudo journalctl -u apkzio-api -f

# Nginx access logs
sudo tail -f /var/log/nginx/api.apkzio.com.access.log

# Nginx error logs
sudo tail -f /var/log/nginx/api.apkzio.com.error.log
```

### Restart Services

```bash
# Restart backend
sudo systemctl restart apkzio-api

# Reload nginx (no downtime)
sudo systemctl reload nginx

# Restart nginx (brief downtime)
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql

# Restart Redis
sudo systemctl restart redis
```

### Backup

```bash
# Backup database
pg_dump -U apkzio_user apkzio > /root/backups/apkzio-$(date +%Y%m%d).sql

# Backup application
tar -czf /root/backups/apkzio-app-$(date +%Y%m%d).tar.gz /root/home/apkzio

# Backup nginx config
tar -czf /root/backups/nginx-$(date +%Y%m%d).tar.gz /etc/nginx
```

## Performance Optimization

### Enable Redis Caching

Update `.env.production`:

```bash
REDIS_URL=redis://localhost:6379
```

Restart service:

```bash
sudo systemctl restart apkzio-api
```

### Increase Worker Processes

Edit nginx config:

```bash
sudo nano /etc/nginx/nginx.conf
```

Set to number of CPU cores:

```nginx
worker_processes auto;
```

### Enable HTTP/2

Already enabled in production config!

### Configure Database Connection Pooling

Update `.env.production`:

```bash
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Security Checklist

- [x] SSL/HTTPS enabled
- [x] HSTS headers configured
- [x] Security headers (X-Frame-Options, CSP, etc.)
- [x] Rate limiting enabled
- [x] Firewall configured
- [ ] Fail2ban installed
- [x] Backend not exposed to public
- [x] Strong passwords used
- [x] API keys kept secret
- [ ] Regular security updates
- [ ] Backup strategy in place
- [ ] Monitoring configured

## Support

Need help?

1. Check logs: `sudo journalctl -u apkzio-api -n 100`
2. Test nginx: `sudo nginx -t`
3. Check status: `sudo systemctl status apkzio-api`
4. Review docs: `/root/home/apkzio/README.md`

## Next Steps

After deployment:

1. ✅ Test all endpoints
2. ✅ Create admin user
3. ✅ Configure monitoring
4. ✅ Set up backups
5. ✅ Test SSL certificates
6. ✅ Review security settings
7. ✅ Document custom configuration
8. ✅ Train team on operational procedures

---

**Deployment complete! 🚀**

Your ApkZio instance is now running in production with nginx.
