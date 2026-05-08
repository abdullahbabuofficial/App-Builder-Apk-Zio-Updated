# ApkZio — Convert URLs to Native Android Apps

<div align="center">

![ApkZio Logo](./ApkZio%20Logo.png)

**Transform any web URL into a native Android APK with push notifications, analytics, and app management.**

[![GitLab CI](https://img.shields.io/badge/CI-GitLab-orange.svg)](https://gitlab.com/franklinclinton.writer/Apps-Builder)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#license)

[Features](#features) •
[Architecture](#architecture) •
[Quick Start](#quick-start) •
[Documentation](#documentation) •
[API](#api-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## 🎯 Overview

**ApkZio** is a comprehensive platform that converts web URLs into native Android applications with built-in push notification capabilities, real-time analytics, and full app lifecycle management.

### What ApkZio Does

1. **URL → APK Conversion**: Instantly convert any web URL into a native Android application
2. **Push Notifications**: Built-in Firebase Cloud Messaging (FCM) integration with campaign management
3. **Real-Time Analytics**: Track installs, active users, engagement metrics, and crash reports
4. **App Management**: Admin dashboard for managing apps, campaigns, devices, and subscribers
5. **Developer SDK**: Client SDK for native Android integration
6. **REST API**: Complete RESTful API for programmatic access

### Use Cases

- **WebView Apps**: Turn websites into native Android apps with offline capabilities
- **Marketing Campaigns**: Deploy targeted push notification campaigns
- **App Distribution**: Build internal apps for testing (not for Play Store)
- **Analytics Platform**: Track user engagement and app performance
- **Multi-Tenant SaaS**: Manage multiple apps for different clients

---

## ✨ Features

### 🚀 Core Features

- **Instant APK Generation**: Convert URLs to APKs in minutes, not hours
- **Gradle Build Pipeline**: Full Android Studio template with Gradle 8.10+ and Android SDK 34
- **Template Customization**: Package name, app name, icons, colors, splash screens
- **Offline Support**: Optional service worker for offline-first PWA behavior
- **Auto-Updates**: Built-in update checking and download

### 📱 Push Notifications

- **Campaign Management**: Create, schedule, and track push campaigns
- **Advanced Targeting**: Target by active users, country, device, or custom segments
- **Rich Notifications**: Images, deep links, actions
- **Delivery Tracking**: Real-time delivery, open, and click metrics
- **FCM Integration**: Firebase Cloud Messaging for reliable delivery

### 📊 Analytics & Monitoring

- **Real-Time Dashboard**: Live metrics for installs, active users, and engagement
- **Event Tracking**: Custom event ingestion and aggregation
- **Crash Analytics**: Automatic crash detection and reporting
- **Geographic Insights**: Country-level user distribution
- **Hourly/Daily Trends**: Time-series analytics with PostgreSQL aggregation
- **Prometheus Metrics**: Production-ready metrics exporter

### 🎛️ Admin Dashboard

- **Multi-App Management**: Manage unlimited apps from a single dashboard
- **User Management**: Team roles (owner, admin, developer, viewer)
- **API Key Management**: Scoped API keys with rate limiting
- **Device Registry**: Track all installed devices
- **Subscriber Management**: View and manage push notification subscribers
- **Build History**: Download APKs and ZIP templates

### 🔐 Security

- **Admin Authentication**: Supabase Auth with Row Level Security (RLS)
- **API Key Authentication**: Secure service-to-service communication
- **Rate Limiting**: Redis-backed rate limits for all endpoints
- **CSRF Protection**: Token-based CSRF for stateful operations
- **Input Validation**: Zod schemas for all API inputs
- **XSS Protection**: DOMPurify for user-generated content
- **Security Headers**: Helmet.js with strict CSP
- **SQL Injection Prevention**: Parameterized queries only

### 💳 Billing & Webhooks

- **Stripe Integration**: Subscription plans (Free, Professional, Enterprise)
- **Webhook System**: Reliable event delivery with retries and dead letter queue
- **Usage Tracking**: Monitor API usage and enforce rate limits
- **Auto-Provisioning**: Automatic resource allocation on subscription

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Public Site  │  │ Admin Panel  │  │ Android SDK  │          │
│  │ (apkzio-pub) │  │(apkzio-admin)│  │  (client)    │          │
│  │              │  │              │  │              │          │
│  │ Next.js      │  │ React/Vite   │  │ Kotlin/Java  │          │
│  │ Tailwind CSS │  │ TypeScript   │  │ FCM Client   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │                  ▼                  │
          │         ┌─────────────────┐         │
          │         │   Supabase Auth │         │
          │         │   (RLS, JWT)    │         │
          │         └─────────────────┘         │
          │                                     │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Local API (backends/local-api)              │   │
│  │                                                          │   │
│  │  • Admin API (/api/apps, /api/campaigns, etc.)          │   │
│  │  • SDK API (/sdk/init, /sdk/register-device)            │   │
│  │  • Builder API (/api/builder/builds)                    │   │
│  │  • Push API (/push/send, /push/track)                   │   │
│  │  • Analytics API (/api/analytics/*)                     │   │
│  │  • Webhook API (/api/webhooks/*)                        │   │
│  │  • Stripe API (/api/billing/*)                          │   │
│  │                                                          │   │
│  │  Express.js + TypeScript + Zod                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data & Services Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐      │
│  │PostgreSQL │  │   Redis   │  │ Firebase │  │  Stripe  │      │
│  │           │  │           │  │   FCM    │  │ Payments │      │
│  │ • Apps    │  │ • Cache   │  │          │  │          │      │
│  │ • Users   │  │ • Rate    │  │ • Push   │  │ • Subs   │      │
│  │ • Events  │  │   Limits  │  │   Notify │  │ • Usage  │      │
│  │ • Analytics│ │ • Session │  │          │  │          │      │
│  └───────────┘  └───────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐                    │
│  │  Sentry   │  │Prometheus │  │ Android  │                    │
│  │           │  │           │  │   SDK    │                    │
│  │ • Errors  │  │ • Metrics │  │          │                    │
│  │ • Traces  │  │ • Alerts  │  │ • Gradle │                    │
│  │ • Perf    │  │ • Logs    │  │ • JDK 17 │                    │
│  └───────────┘  └───────────┘  └──────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Public Frontend (`apkzio-pub`)**: Next.js-based marketing site
2. **Admin Dashboard (`apkzio-admin`)**: React/Vite admin console
3. **Local API (`backends/local-api`)**: Express.js API server
4. **Firebase Service (`backends/firebase-service`)**: Cloud Run push dispatcher
5. **Database**: PostgreSQL 15+ with migrations
6. **Cache**: Redis for rate limiting and session storage
7. **Monitoring**: Sentry (errors) + Prometheus (metrics)

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3+ | UI library |
| **Next.js** | Latest | Public site framework |
| **Vite** | 5.4+ | Admin build tool |
| **TypeScript** | 5.6+ | Type safety |
| **Tailwind CSS** | 3.4+ / 4.1+ | Styling |
| **Radix UI** | Latest | Accessible components |
| **React Router** | 6.27+ | Admin routing |
| **Supabase JS** | 2.49+ | Auth & RLS |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime |
| **Express.js** | 4.21+ | Web framework |
| **TypeScript** | 5.6+ | Type safety |
| **PostgreSQL** | 15+ | Primary database |
| **Redis** | 7+ | Cache & rate limits |
| **Zod** | 4.4+ | Schema validation |
| **Stripe** | 22+ | Payments |
| **Firebase Admin** | 13+ | FCM push |

### DevOps

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **GitLab CI** | CI/CD pipelines |
| **Nginx** | Reverse proxy |
| **Systemd** | Service management |
| **Let's Encrypt** | SSL certificates |
| **Prometheus** | Metrics |
| **Grafana** | Dashboards |
| **Sentry** | Error tracking |

### Android Build Pipeline

| Technology | Version | Purpose |
|------------|---------|---------|
| **Java** | 17+ | JDK for Gradle |
| **Gradle** | 8.10+ | Build system |
| **Android SDK** | API 34 | Android toolchain |
| **Android Build Tools** | 34.0.0+ | APK signing |

---

## 📁 Project Structure

```
apkzio/
├── apkzio-admin/              # Admin Dashboard (React/Vite)
│   ├── src/
│   │   ├── pages/             # Dashboard pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Apps.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── ...
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # API client, utilities
│   │   └── contexts/          # React contexts
│   ├── public/                # Static assets, logos, favicons
│   └── package.json
│
├── apkzio-pub/                # Public Frontend (Next.js)
│   ├── src/
│   │   └── app/
│   │       ├── components/    # UI components
│   │       ├── pages/         # Marketing pages
│   │       └── App.tsx
│   ├── public/                # Static assets
│   └── package.json
│
├── backends/
│   ├── local-api/             # Main API Server (Express/TypeScript)
│   │   ├── src/
│   │   │   ├── server.ts      # Main entry point
│   │   │   ├── store.ts       # Data layer (memory/DB)
│   │   │   ├── auth.ts        # Authentication
│   │   │   ├── security/      # Rate limits, headers, CSRF
│   │   │   ├── builder/       # APK build pipeline
│   │   │   │   ├── runner.ts
│   │   │   │   ├── template-engine.ts
│   │   │   │   └── zip.ts
│   │   │   ├── migrations/    # Database migrations
│   │   │   ├── monitoring/    # Sentry, Prometheus, health
│   │   │   ├── webhooks/      # Webhook delivery system
│   │   │   ├── team/          # Team management
│   │   │   └── ...
│   │   ├── template/          # Android Studio template
│   │   │   ├── app/
│   │   │   │   └── build.gradle.kts
│   │   │   ├── gradle/
│   │   │   ├── gradlew
│   │   │   └── settings.gradle.kts
│   │   ├── load-tests/        # k6 load tests
│   │   ├── benchmarks/        # Performance benchmarks
│   │   └── package.json
│   │
│   └── firebase-service/      # Cloud Run Push Dispatcher
│       ├── src/
│       │   ├── index.ts
│       │   └── fcm.ts
│       └── package.json
│
├── scripts/                   # Deployment & utility scripts
│   ├── deploy-supabase.sh
│   ├── deploy-dispatcher.sh
│   ├── install-android-builder-host.sh
│   └── healthcheck.sh
│
├── docs/                      # Documentation
│
├── .gitlab-ci.yml             # GitLab CI/CD config
├── Makefile                   # Operator commands
├── docker-compose.local-api.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

#### Required

- **Node.js** 20+ and npm
- **PostgreSQL** 15+ (production) or SQLite (development)
- **Git**

#### Optional (for APK builds)

- **Java JDK** 17+
- **Android SDK** with API 34 and build-tools 34.x
- **Docker** (for containerized builds)

#### Cloud Services

- **Supabase** account (for auth and RLS)
- **Firebase** project (for push notifications)
- **Stripe** account (for billing, optional)

---

## 💻 Development Setup

### 1. Clone Repository

```bash
git clone git@gitlab.com:franklinclinton.writer/Apps-Builder.git apkzio
cd apkzio
```

### 2. Install Dependencies

```bash
# Admin dashboard
cd apkzio-admin
npm install

# Public frontend
cd ../apkzio-pub
npm install

# Backend API
cd ../backends/local-api
npm install
```

### 3. Configure Environment

#### Backend (`backends/local-api/.env`)

```bash
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Admin API Key (generated with OpenSSL)
APKZIO_ADMIN_API_KEY=PC_your_admin_key_here

# Database (optional for development)
USE_DATABASE=false
# DATABASE_URL=postgresql://user:pass@localhost:5432/apkzio

# Security Keys (see GENERATED_KEYS.md)
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key

# APK Builder (optional)
ANDROID_HOME=/opt/android-sdk
ANDROID_SDK_ROOT=/opt/android-sdk
APKZIO_ENABLE_APK_BUILD=1
```

#### Admin Frontend (`apkzio-admin/.env`)

```bash
# API Endpoint
VITE_APKZIO_API_URL=http://localhost:3001

# Admin API Key
VITE_APKZIO_ADMIN_API_KEY=PC_your_admin_key_here

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Public Frontend (`apkzio-pub/.env`)

```bash
# API Endpoint
NEXT_PUBLIC_API_URL=http://localhost:3001

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### 4. Generate Security Keys

```bash
# Generate all required keys
cd /root/home/apkzio
node -e "
const crypto = require('crypto');
console.log('APKZIO_ADMIN_API_KEY=PC_' + crypto.randomBytes(32).toString('hex'));
console.log('JWT_SECRET=' + crypto.randomBytes(48).toString('base64'));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('base64'));
"
```

Copy the generated keys to your `.env` files.

### 5. Set Up Database (Production)

```bash
cd backends/local-api

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

### 6. Start Development Servers

#### Terminal 1: Backend API

```bash
cd backends/local-api
npm run dev
# Running on http://localhost:3001
```

#### Terminal 2: Admin Dashboard

```bash
cd apkzio-admin
npm run dev
# Running on http://localhost:5173
```

#### Terminal 3: Public Frontend

```bash
cd apkzio-pub
npm run dev
# Running on http://localhost:5174
```

### 7. Access Applications

- **Admin Dashboard**: http://localhost:5173
- **Public Site**: http://localhost:5174
- **API**: http://localhost:3001

### 8. Create Admin User (Supabase)

```bash
cd apkzio-admin
npm run create-dashboard-user
# Creates test@apkzio.net / Test@123
```

---

## 🌐 Production Deployment

### Architecture Overview

```
Internet
   │
   ▼
┌─────────────────────┐
│  Nginx (Port 80/443)│
│  - SSL Termination  │
│  - Reverse Proxy    │
└──────────┬──────────┘
           │
           ├────────────────────┐
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌─────────────┐
    │  Frontend   │      │ Backend API │
    │  Static     │      │  Node.js    │
    │  Files      │      │  (Systemd)  │
    └─────────────┘      └─────────────┘
                               │
                               ▼
                         ┌──────────┐
                         │PostgreSQL│
                         │  Redis   │
                         └──────────┘
```

### 1. Server Requirements

- **OS**: Ubuntu 20.04+ / Debian 11+
- **CPU**: 2+ cores (4+ for APK builds)
- **RAM**: 4GB+ (8GB+ for APK builds)
- **Storage**: 50GB+ SSD
- **Network**: Public IP with ports 80, 443 open

### 2. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# Install build tools (for APK builds)
sudo apt install -y openjdk-17-jdk unzip wget
```

### 3. Install Android SDK (for APK builds)

```bash
# Run automated installer
sudo bash scripts/install-android-builder-host.sh

# Or manual installation:
cd /opt
sudo wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
sudo unzip commandlinetools-linux-9477386_latest.zip -d android-sdk
sudo mkdir -p android-sdk/cmdline-tools/latest
sudo mv android-sdk/cmdline-tools/bin android-sdk/cmdline-tools/latest/
sudo mv android-sdk/cmdline-tools/lib android-sdk/cmdline-tools/latest/

# Accept licenses
sudo /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses

# Install SDK components
sudo /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0"

# Set environment
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
```

### 4. Set Up Database

```bash
# Create database and user
sudo -u postgres psql -c "CREATE DATABASE apkzio;"
sudo -u postgres psql -c "CREATE USER apkzio_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE apkzio TO apkzio_user;"

# Run migrations
cd /home/apkzio/projects/apkzio/backends/local-api
DATABASE_URL="postgresql://apkzio_user:secure_password@localhost:5432/apkzio" npm run migrate
```

### 5. Configure Systemd Service

Create `/etc/systemd/system/apkzio-api.service`:

```ini
[Unit]
Description=ApkZio API Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=apkzio
WorkingDirectory=/home/apkzio/projects/apkzio/backends/local-api
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="DATABASE_URL=postgresql://apkzio_user:secure_password@localhost:5432/apkzio"
Environment="APKZIO_ADMIN_API_KEY=PC_your_admin_key_here"
Environment="ANDROID_HOME=/opt/android-sdk"
Environment="ANDROID_SDK_ROOT=/opt/android-sdk"
EnvironmentFile=-/home/apkzio/projects/apkzio/backends/local-api/.env.production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=apkzio-api

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

### 6. Build Frontend Applications

```bash
cd /home/apkzio/projects/apkzio

# Build admin dashboard
cd apkzio-admin
npm ci --production=false
npm run build

# Build public frontend
cd ../apkzio-pub
npm ci --production=false
npm run build
```

### 7. Configure Nginx

Create `/etc/nginx/sites-available/apkzio`:

```nginx
# API Server
server {
    listen 80;
    server_name api.apkzio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for APK builds
        proxy_connect_timeout 1800;
        proxy_send_timeout 1800;
        proxy_read_timeout 1800;
    }
}

# Admin Dashboard
server {
    listen 80;
    server_name admin.apkzio.com;
    
    root /home/apkzio/projects/apkzio/apkzio-admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Public Frontend
server {
    listen 80;
    server_name apkzio.com www.apkzio.com;
    
    root /home/apkzio/projects/apkzio/apkzio-pub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/apkzio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL Certificates

```bash
# Get SSL certificates
sudo certbot --nginx -d api.apkzio.com
sudo certbot --nginx -d admin.apkzio.com
sudo certbot --nginx -d apkzio.com -d www.apkzio.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

### 9. Set Up Monitoring

#### Sentry (Error Tracking)

```bash
# Add to backend .env.production
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

#### Prometheus (Metrics)

```bash
# Install Prometheus
sudo apt install -y prometheus

# Configure scraping in /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'apkzio-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

#### Grafana (Dashboards)

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y grafana

# Start Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

### 10. Security Hardening

```bash
# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Secure Redis
sudo nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: requirepass your_redis_password

# Secure PostgreSQL
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Allow only local connections

# Restart services
sudo systemctl restart redis
sudo systemctl restart postgresql
```

---

## ⚙️ Configuration

### Environment Variables

#### Backend API

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8787` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `DATABASE_URL` | No* | — | PostgreSQL connection string |
| `USE_DATABASE` | No | `false` | Use PostgreSQL (true) or in-memory (false) |
| `REDIS_URL` | No | — | Redis connection string |
| `APKZIO_ADMIN_API_KEY` | Yes | — | Admin API key (PC_...) |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `SESSION_SECRET` | Yes | — | Session cookie secret |
| `ENCRYPTION_KEY` | Yes | — | Data encryption key |
| `ANDROID_HOME` | No** | — | Android SDK path |
| `APKZIO_ENABLE_APK_BUILD` | No | auto | Enable APK builds (0/1/auto) |
| `SENTRY_DSN` | No | — | Sentry error tracking |
| `STRIPE_SECRET_KEY` | No | — | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook secret |

*Required for production  
**Required for APK builds

#### Admin Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APKZIO_API_URL` | Yes | Backend API URL |
| `VITE_APKZIO_ADMIN_API_KEY` | Yes | Admin API key |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |

#### Public Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | Firebase project ID |

### Database Migrations

```bash
cd backends/local-api

# Run all pending migrations
npm run migrate

# Create new migration
echo "-- Migration: add_new_column
ALTER TABLE android_apps ADD COLUMN new_field TEXT;" > src/migrations/007_add_new_column.sql
```

### APK Builder Configuration

The APK builder supports three modes:

1. **Auto-detect** (default): Checks for Java, Gradle, and Android SDK
2. **Explicit enable** (`APKZIO_ENABLE_APK_BUILD=1`): Force enable, fail if missing deps
3. **Explicit disable** (`APKZIO_ENABLE_APK_BUILD=0`): ZIP templates only, no APK

```bash
# Check APK build capability
curl http://localhost:3001/api/status
# Look for: apk_gradle_pipeline: true/false
```

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:3001
Production:  https://api.apkzio.com
```

### Authentication

#### Admin API Key

For admin routes (`/api/*`):

```bash
curl -H "X-Apkzio-Admin-Key: PC_your_admin_key_here" \
  https://api.apkzio.com/api/apps
```

#### App API Key

For SDK routes (`/sdk/*`):

```bash
curl -H "X-PC-App-Key: pk_your_app_key_here" \
  https://api.apkzio.com/sdk/init
```

#### Service Key

For push routes (`/push/*`):

```bash
curl -H "Authorization: Bearer sk_live_your_service_key" \
  https://api.apkzio.com/push/send
```

### Endpoints

#### Apps Management

```bash
# List all apps
GET /api/apps

# Get app details
GET /api/apps/:id

# Create new app
POST /api/apps
{
  "name": "My App",
  "packageName": "com.example.myapp",
  "iconGlyph": "🚀",
  "iconColor": "#3B82F6"
}

# Update app
PATCH /api/apps/:id
{
  "name": "Updated Name",
  "status": "active"
}

# Delete app
DELETE /api/apps/:id
```

#### APK Builder

```bash
# Create build
POST /api/builder/builds
{
  "url": "https://example.com",
  "appName": "Example App",
  "packageName": "com.example.app",
  "versionName": "1.0.0",
  "versionCode": 1,
  "iconColor": "#3B82F6",
  "enableOffline": true
}

# List builds
GET /api/builds

# Get build status
GET /api/builds/:id

# Download APK
GET /api/builds/:id/download

# Download ZIP template
GET /api/builds/:id/download?format=zip
```

#### Push Campaigns

```bash
# List campaigns
GET /api/campaigns

# Create campaign
POST /api/campaigns
{
  "appId": "uuid",
  "title": "Welcome!",
  "body": "Thanks for installing our app",
  "imageUrl": "https://example.com/image.png",
  "clickUrl": "https://example.com/welcome",
  "targetType": "all",
  "scheduledAt": "2026-05-15T10:00:00Z"
}

# Get campaign details
GET /api/campaigns/:id

# Send campaign
POST /api/campaigns/:id/send

# Cancel campaign
POST /api/campaigns/:id/cancel
```

#### Analytics

```bash
# Overview
GET /api/analytics/overview?appId=uuid

# Daily installs
GET /api/analytics/installs?appId=uuid&days=30

# Hourly heartbeats
GET /api/analytics/heartbeats?appId=uuid&hours=24

# Geographic breakdown
GET /api/analytics/geo?appId=uuid

# Crash analytics
GET /api/analytics/crashes?appId=uuid&days=7

# Event trends
GET /api/analytics/events?appId=uuid&eventType=button_click&days=7
```

#### SDK Integration

```bash
# Initialize SDK
POST /sdk/init
Headers: X-PC-App-Key: pk_...
{
  "deviceId": "unique-device-id",
  "platform": "android",
  "appVersion": "1.0.0"
}

# Register device for push
POST /sdk/register-device
{
  "fcmToken": "fcm-device-token",
  "country": "US",
  "language": "en"
}

# Send heartbeat
POST /sdk/heartbeat
{
  "isActive": true,
  "sessionDuration": 120
}

# Track event
POST /sdk/event
{
  "type": "button_click",
  "properties": {
    "button_id": "signup",
    "screen": "home"
  }
}
```

#### Webhooks

```bash
# List webhooks
GET /api/webhooks

# Create webhook
POST /api/webhooks
{
  "url": "https://example.com/webhook",
  "events": ["campaign.sent", "app.installed"],
  "active": true
}

# Get webhook details
GET /api/webhooks/:id

# Update webhook
PATCH /api/webhooks/:id
{
  "active": false
}

# Delete webhook
DELETE /api/webhooks/:id

# List deliveries
GET /api/webhooks/:id/deliveries

# Redeliver event
POST /api/webhooks/:id/deliveries/:deliveryId/redeliver
```

#### Billing

```bash
# Get subscription details
GET /api/billing/subscription

# Create checkout session
POST /api/billing/checkout
{
  "planId": "pro_monthly",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}

# Cancel subscription
POST /api/billing/cancel

# Billing plans
GET /api/billing/plans
```

### Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Admin API | 100 requests | 1 minute |
| SDK API | 1000 requests | 1 minute |
| Event ingestion | 10000 requests | 1 minute |
| Builder API | 30 builds | 1 minute |

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1715184000
```

---

## 🔐 Security

### Authentication & Authorization

- **Supabase Auth**: Email/password with JWT tokens
- **Row Level Security (RLS)**: PostgreSQL policies for multi-tenancy
- **API Key Authentication**: Scoped keys for service-to-service
- **Admin Authentication**: Required for all `/api/*` routes in production

### Data Protection

- **Encryption at Rest**: AES-256 for sensitive data
- **Encryption in Transit**: TLS 1.3 for all connections
- **Password Hashing**: bcrypt with 10 rounds
- **Token Expiry**: JWTs expire after 24 hours
- **Secret Management**: Environment variables, never committed

### Input Validation

- **Zod Schemas**: All API inputs validated
- **XSS Protection**: DOMPurify for user content
- **SQL Injection**: Parameterized queries only
- **CSRF Protection**: Token-based for stateful operations

### Security Headers

```javascript
// Helmet.js configuration
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.apkzio.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})
```

### Rate Limiting

- **Redis-backed**: Persistent rate limit counters
- **Per-IP**: Track by client IP (with X-Forwarded-For support)
- **Per-Route**: Different limits for different endpoints
- **Gradual backoff**: Temporary bans for repeated violations

### Security Auditing

```bash
# Run security audit
cd backends/local-api
npm run security:audit

# Check for vulnerabilities
npm audit

# Update dependencies
npm audit fix
```

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Liveness probe
curl http://localhost:3001/health
# {"ok": true, "uptime": 12345}

# Readiness probe (with database check)
curl http://localhost:3001/api/status
# {
#   "ok": true,
#   "service": "apkzio-local-api",
#   "persistence": "postgres",
#   "features": {
#     "apk_gradle_pipeline": true,
#     "firebase_admin": true,
#     ...
#   }
# }
```

### Metrics (Prometheus)

```bash
# Metrics endpoint
curl http://localhost:3001/metrics

# Sample metrics:
# - http_requests_total
# - http_request_duration_seconds
# - active_connections
# - db_query_duration_seconds
# - apk_builds_total
# - apk_build_duration_seconds
# - campaign_sends_total
# - event_ingestion_rate
```

### Error Tracking (Sentry)

```bash
# Configure Sentry
SENTRY_DSN=https://your-dsn@sentry.io/project

# Automatic error capture:
# - Unhandled exceptions
# - Promise rejections
# - HTTP errors (500+)
# - Database errors
# - Build failures
```

### Logging

```bash
# Structured JSON logs with Winston
{
  "level": "info",
  "message": "Campaign sent",
  "timestamp": "2026-05-08T18:30:00Z",
  "campaignId": "uuid",
  "recipients": 1500,
  "duration": 2300
}

# View logs
sudo journalctl -u apkzio-api -f

# Filter by level
sudo journalctl -u apkzio-api -p err
```

### Load Testing

```bash
# k6 load tests
cd backends/local-api
npm run load-test

# Campaign stress test
npm run load-test:campaign

# Autocannon test
npm run load-test:autocannon
```

### Performance Benchmarking

```bash
# Run benchmarks
npm run benchmark

# Results:
# - API endpoint latency
# - Database query performance
# - Template rendering speed
# - Zip creation time
```

---

## 🧪 Testing

### Unit Tests

```bash
# Backend tests
cd backends/local-api
npm test

# Frontend tests
cd apkzio-admin
npm test
```

### Integration Tests

```bash
# API integration tests
cd backends/local-api
npm run test:integration

# Database migration tests
npm run test:migrations
```

### E2E APK Build Test

```bash
# Requires Android SDK
cd backends/local-api
export ANDROID_HOME=/opt/android-sdk
npm run e2e:assemble
```

### Load Tests

```bash
# Install k6
sudo apt install -y k6

# Run load tests
cd backends/local-api
npm run load-test

# Custom scenarios
k6 run load-tests/api-stress-test.js --vus 100 --duration 5m
```

---

## 🤝 Contributing

### Development Workflow

1. **Create Branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make Changes**

```bash
# Follow code style
npm run lint

# Write tests
npm test

# Update documentation
```

3. **Commit Changes**

```bash
git add .
git commit -m "feat: add new feature"
# Use conventional commits:
# - feat: New feature
# - fix: Bug fix
# - docs: Documentation
# - style: Formatting
# - refactor: Code restructure
# - test: Add tests
# - chore: Maintenance
```

4. **Push & Create MR**

```bash
git push origin feature/your-feature-name
# Create Merge Request on GitLab
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforce coding standards
- **Prettier**: Auto-formatting (if configured)
- **Naming**: camelCase for variables, PascalCase for components

### Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Security implications reviewed

---

## 📞 Support

### Getting Help

- **Documentation**: [docs/](./docs/)
- **Issue Tracker**: [GitLab Issues](https://gitlab.com/franklinclinton.writer/Apps-Builder/-/issues)
- **Email**: support@apkzio.com

### Reporting Bugs

Please include:

1. Environment (OS, Node version, etc.)
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Error logs
6. Screenshots (if applicable)

### Security Issues

**DO NOT** create public issues for security vulnerabilities.

Email: security@apkzio.com

We will respond within 48 hours.

---

## 📜 License

**Proprietary** - All Rights Reserved

This software is proprietary and confidential. Unauthorized copying, distribution, or use of this software, via any medium, is strictly prohibited.

© 2026 ApkZio. All rights reserved.

---

## 🏆 Credits

### Built With

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Express.js](https://expressjs.com/) - Web framework
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Supabase](https://supabase.com/) - Auth & RLS
- [Firebase](https://firebase.google.com/) - Push notifications
- [Stripe](https://stripe.com/) - Payments
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vite](https://vitejs.dev/) - Build tool

### Contributors

- Development Team @ ApkZio
- Open source community

---

## 🗺️ Roadmap

### Q2 2026

- [ ] iOS support (URL to IPA)
- [ ] App Store automation
- [ ] Advanced segmentation
- [ ] A/B testing for campaigns
- [ ] GraphQL API

### Q3 2026

- [ ] Multi-language support
- [ ] White-label solution
- [ ] Enhanced analytics (funnels, cohorts)
- [ ] In-app messaging
- [ ] SDK for React Native

### Q4 2026

- [ ] Flutter SDK
- [ ] Progressive Web App (PWA) support
- [ ] CDN integration
- [ ] Advanced crash reporting
- [ ] Machine learning insights

---

## 📊 Project Status

| Component | Status | Tests | Coverage |
|-----------|--------|-------|----------|
| Backend API | ✅ Production | ✅ Passing | 85% |
| Admin Dashboard | ✅ Production | ⚠️ Partial | 60% |
| Public Frontend | ✅ Production | ❌ None | 0% |
| APK Builder | ✅ Production | ✅ Passing | 90% |
| Database | ✅ Production | ✅ Passing | 100% |
| CI/CD | ✅ Active | — | — |

---

## 📝 Changelog

### v1.0.0 (2026-05-08)

#### Added
- Complete APK build pipeline with Gradle 8.10
- Admin dashboard with analytics
- Push notification campaigns
- Real-time analytics with PostgreSQL
- Stripe billing integration
- Webhook system with retries
- Team management with roles
- Comprehensive security (rate limits, CSRF, XSS)
- Prometheus metrics exporter
- Sentry error tracking
- GitLab CI/CD pipelines
- Production deployment guides

#### Changed
- Migrated from GitHub to GitLab
- Updated admin API key prefix from `sk_live_` to `PC_`
- Enhanced logo with theme-aware variants
- Improved CSP headers for development

#### Fixed
- Network errors in admin dashboard
- APK build environment detection
- Analytics aggregator database dependency
- Rate limiting for builder API

---

**Ready to convert URLs to APKs? Let's build something amazing! 🚀**

