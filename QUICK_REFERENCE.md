# ApkZio Quick Reference Card

**Last Updated**: May 9, 2026

---

## 🚀 Quick Commands

### Start Development Servers

```bash
# Backend API (Terminal 1)
cd /root/home/apkzio/backends/local-api
npm run dev
# http://localhost:3001

# Admin Dashboard (Terminal 2)
cd /root/home/apkzio/apkzio-admin
npm run dev
# http://localhost:5173

# Public Frontend (Terminal 3)
cd /root/home/apkzio/apkzio-pub
npm run dev
# http://localhost:5174
```

### Production Services

```bash
# Check API status
sudo systemctl status apkzio-api

# View logs
sudo journalctl -u apkzio-api -f

# Restart API
sudo systemctl restart apkzio-api

# Check Nginx
sudo systemctl status nginx
sudo nginx -t  # Test config
```

### Database Operations

```bash
cd /root/home/apkzio/backends/local-api

# Run migrations
npm run migrate

# Seed data
npm run seed

# Connect to DB
psql $DATABASE_URL
```

---

## 🔑 Important Credentials

### Admin Dashboard
- **URL**: http://localhost:5173 (dev) | https://admin.apkzio.com (prod)
- **Test User**: `test@apkzio.net`
- **Test Password**: `Test@123`

### API Keys
- **Admin API Key**: Check `GENERATED_KEYS.md`
- **Format**: `PC_[64 hex chars]`
- **Header**: `X-Apkzio-Admin-Key: PC_...`

### Database
- **Dev**: In-memory (USE_DATABASE=false)
- **Prod**: PostgreSQL at localhost:5432

---

## 📁 Key Files

| File | Location | Purpose |
|------|----------|---------|
| **Backend .env** | `backends/local-api/.env` | API configuration |
| **Admin .env** | `apkzio-admin/.env` | Dashboard config |
| **Security Keys** | `GENERATED_KEYS.md` | All secrets |
| **API Server** | `backends/local-api/src/server.ts` | Main entry point |
| **Migrations** | `backends/local-api/src/migrations/` | DB schema |

---

## 🌐 URLs

### Development
- **API**: http://localhost:3001
- **Admin**: http://localhost:5173
- **Public**: http://localhost:5174
- **API Status**: http://localhost:3001/api/status
- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics

### Production
- **API**: https://api.apkzio.com
- **Admin**: https://admin.apkzio.com
- **Public**: https://apkzio.com

---

## 🔧 Common Tasks

### Test API Connection
```bash
curl -H "X-Apkzio-Admin-Key: PC_your_key" \
  http://localhost:3001/api/apps
```

### Check APK Build Capability
```bash
curl http://localhost:3001/api/status | jq '.features.apk_gradle_pipeline'
```

### Create Test User
```bash
cd apkzio-admin
npm run create-dashboard-user
```

### Run Tests
```bash
cd backends/local-api
npm test
npm run lint
npm run build
```

### Build for Production
```bash
# Admin
cd apkzio-admin
npm run build

# Public
cd apkzio-pub
npm run build

# Backend
cd backends/local-api
npm run build
```

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check for running processes
lsof -i :3001
# Kill if needed
kill -9 <PID>
```

### Frontend Can't Connect
1. Check backend is running: `curl http://localhost:3001/health`
2. Verify API key in `.env`: `VITE_APKZIO_ADMIN_API_KEY`
3. Check CORS/CSP headers in `backends/local-api/src/security/headers.ts`

### Database Connection Failed
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check if Postgres is running
sudo systemctl status postgresql
```

### APK Builds Not Working
```bash
# Verify Android SDK
echo $ANDROID_HOME
ls -la /opt/android-sdk

# Check Java
java -version  # Need 17+

# Check Gradle wrapper
cd backends/local-api/template
./gradlew --version
```

---

## 🔐 Security

### Generate New Admin API Key
```bash
node -e "console.log('PC_' + require('crypto').randomBytes(32).toString('hex'))"
```

### Rotate Security Keys
```bash
# Generate all keys
cd /root/home/apkzio
node scripts/generate-keys.js

# Update .env files
# Restart services
```

### Check Security Audit
```bash
cd backends/local-api
npm run security:audit
npm audit
```

---

## 📊 Monitoring

### View Metrics
```bash
curl http://localhost:3001/metrics
```

### Check Logs
```bash
# Live logs
sudo journalctl -u apkzio-api -f

# Error logs only
sudo journalctl -u apkzio-api -p err

# Last 100 lines
sudo journalctl -u apkzio-api -n 100
```

### Health Check
```bash
# Basic health
curl http://localhost:3001/health

# Detailed status
curl http://localhost:3001/api/status | jq
```

---

## 🔄 Git Operations

### Current Repository
```bash
# GitLab (primary)
git remote -v
# origin: git@gitlab.com:franklinclinton.writer/Apps-Builder.git
```

### Common Git Commands
```bash
# Check status
git status

# Pull latest
git pull origin main

# Create branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to GitLab
git push origin feature/new-feature
```

---

## 👥 User Management

### ApkZio User
- **Username**: `apkzio`
- **Home**: `/home/apkzio`
- **Project**: `/home/apkzio/projects/apkzio`
- **SSH Access**: ✅ Enabled (root SSH key)

### Switch to apkzio User
```bash
# From root
su - apkzio

# Or SSH
ssh apkzio@your_server_ip
```

### Check Permissions
```bash
ls -la /home/apkzio/projects/apkzio
# Should be: apkzio:apkzio
```

---

## 📦 NPM Commands

### Backend API
```bash
cd backends/local-api

npm run dev              # Development server
npm run start            # Production server
npm run build            # Compile TypeScript
npm run lint             # Type check
npm test                 # Run tests
npm run migrate          # Run DB migrations
npm run seed             # Seed database
npm run security:audit   # Security audit
npm run load-test        # k6 load test
```

### Admin Dashboard
```bash
cd apkzio-admin

npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview production
npm run lint             # Type check
npm run verify:ui        # UI verification
npm run create-dashboard-user  # Create test user
```

### Public Frontend
```bash
cd apkzio-pub

npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview production
```

---

## 🔢 Port Reference

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3001 | http://localhost:3001 |
| Admin Dashboard | 5173 | http://localhost:5173 |
| Public Frontend | 5174 | http://localhost:5174 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Prometheus | 9090 | http://localhost:9090 |
| Grafana | 3000 | http://localhost:3000 |

---

## 📞 Emergency Contacts

### Production Issues
1. Check system status: `sudo systemctl status apkzio-api`
2. View recent errors: `sudo journalctl -u apkzio-api -p err -n 50`
3. Check disk space: `df -h`
4. Check memory: `free -h`
5. Check processes: `top`

### Rollback Procedure
```bash
# Stop service
sudo systemctl stop apkzio-api

# Restore previous version
cd /home/apkzio/projects/apkzio
git checkout <previous-commit>

# Rebuild
cd backends/local-api
npm run build

# Restart service
sudo systemctl start apkzio-api
```

---

## 📚 Documentation Links

- **Full README**: `/root/home/apkzio/README.md`
- **Security Keys**: `/root/home/apkzio/GENERATED_KEYS.md`
- **Deployment Guide**: `/root/home/apkzio/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **User Guide**: `/home/apkzio/README_USER_GUIDE.md`

---

## 🎯 Most Common Use Cases

### 1. Start Development Environment
```bash
# Terminal 1
cd backends/local-api && npm run dev

# Terminal 2
cd apkzio-admin && npm run dev
```

### 2. Deploy to Production
```bash
# Build all
cd apkzio-admin && npm run build
cd apkzio-pub && npm run build
cd backends/local-api && npm run build

# Restart service
sudo systemctl restart apkzio-api
sudo systemctl reload nginx
```

### 3. Check Production Health
```bash
curl https://api.apkzio.com/health
sudo journalctl -u apkzio-api -n 50
```

### 4. Create New App
```bash
curl -X POST https://api.apkzio.com/api/apps \
  -H "X-Apkzio-Admin-Key: PC_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "packageName": "com.example.myapp"
  }'
```

### 5. Build APK
```bash
curl -X POST https://api.apkzio.com/api/builder/builds \
  -H "X-Apkzio-Admin-Key: PC_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "appName": "Example App",
    "packageName": "com.example.app"
  }'
```

---

**Keep this card handy for quick reference!** 📌

