# 🔌 Integrating Public SDK API Routes

## Step 1: Add Routes to Server

Add this to your `/root/home/apkzio/backends/local-api/src/server.ts`:

```typescript
import publicSdkRoutes from "./routes/public-sdk.js";

// ... existing imports and setup ...

// Add this line with your other routes
app.use("/api/v1", publicSdkRoutes);

// ... rest of server setup ...
```

## Step 2: Install Required Dependency

```bash
cd /root/home/apkzio/backends/local-api
npm install uuid
npm install --save-dev @types/uuid
```

## Step 3: Restart Backend

```bash
# Kill existing process
pkill -f "tsx.*server"

# Restart with Android SDK env vars
cd /root/home/apkzio/backends/local-api
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PORT=3001
npm run dev
```

## Step 4: Verify API Endpoints

Test the endpoints:

```bash
# 1. Register a test app
curl -X POST "http://localhost:3001/api/v1/apps/register" \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "com.example.testapp",
    "app_name": "Test App",
    "version_code": 1,
    "version_name": "1.0.0",
    "developer_email": "dev@example.com",
    "developer_name": "Test Developer"
  }'

# Response will include app_id and api_key

# 2. Register a test device (use api_key from step 1)
curl -X POST "http://localhost:3001/api/v1/devices/register" \
  -H "X-Apkzio-Api-Key: apk_live_YOUR_KEY_FROM_STEP_1" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test_device_123",
    "fcm_token": "fake_fcm_token_for_testing",
    "platform": "android",
    "os_version": "14",
    "app_version": "1.0.0",
    "model": "Samsung Galaxy S24",
    "manufacturer": "Samsung",
    "locale": "en_US",
    "timezone": "America/New_York"
  }'

# 3. Subscribe device to notifications
curl -X POST "http://localhost:3001/api/v1/devices/test_device_123/subscribe" \
  -H "X-Apkzio-Api-Key: apk_live_YOUR_KEY_FROM_STEP_1" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "fake_fcm_token_for_testing",
    "topics": ["general", "updates"],
    "user_consent": true
  }'

# 4. Send push notification (use admin key from .env)
curl -X POST "http://localhost:3001/api/v1/notifications/send" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "APP_ID_FROM_STEP_1",
    "title": "Test Notification",
    "body": "This is a test push notification",
    "target": {"type": "all"}
  }'

# 5. List all apps (admin)
curl "http://localhost:3001/api/v1/apps" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>"

# 6. Get app subscribers (use app_id from step 1)
curl "http://localhost:3001/api/v1/apps/APP_ID/subscribers?subscribed=true" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>"
```

---

## 📡 Public API Endpoints (Production)

Share these URLs with Android developers:

### Base URL
```
https://api.apkzio.com
```

### Endpoints

#### For Android Apps (Public)
```
POST   https://api.apkzio.com/api/v1/apps/register
POST   https://api.apkzio.com/api/v1/devices/register
PUT    https://api.apkzio.com/api/v1/devices/{deviceId}/token
POST   https://api.apkzio.com/api/v1/devices/{deviceId}/subscribe
POST   https://api.apkzio.com/api/v1/devices/{deviceId}/unsubscribe
GET    https://api.apkzio.com/api/v1/devices/{deviceId}/status
POST   https://api.apkzio.com/api/v1/events/track
```

#### For Admin Dashboard (Private)
```
GET    https://api.apkzio.com/api/v1/apps
GET    https://api.apkzio.com/api/v1/apps/{appId}/subscribers
POST   https://api.apkzio.com/api/v1/notifications/send
GET    https://api.apkzio.com/api/v1/notifications/{notificationId}/analytics
```

---

## 🔗 What to Share with Developers

Create a public page at **https://apkzio.com/developers** with:

### 1. SDK Download
```
Download ApkZio Android SDK:
https://apkzio.com/downloads/apkzio-android-sdk.zip

Or copy from:
https://github.com/apkzio/android-sdk
```

### 2. Quick Start Guide
```
https://apkzio.com/docs/android-sdk-quickstart
```

Contains:
- 5-step integration guide
- Copy-paste code
- Get API key instructions

### 3. API Reference
```
https://apkzio.com/docs/api-reference
```

Contains:
- All endpoint documentation
- Request/response examples
- Authentication details

### 4. Example App
```
https://github.com/apkzio/android-sdk-example
```

A complete working example app developers can clone and run.

---

## 📋 Checklist for Going Live

- [ ] Add public SDK routes to server
- [ ] Install `uuid` dependency
- [ ] Restart backend with proper env vars
- [ ] Test all endpoints with curl
- [ ] Update Nginx to allow `/api/v1/*` endpoints
- [ ] Enable CORS for public API endpoints
- [ ] Add rate limiting for public endpoints
- [ ] Set up Firebase Admin SDK for actual FCM sending
- [ ] Create "Developers" page on apkzio.com
- [ ] Add SDK download link
- [ ] Publish API documentation
- [ ] Create example Android app repository
- [ ] Add "Get API Key" section in admin dashboard

---

## 🎯 Next Steps

1. **Integrate routes** (see Step 1 above)
2. **Test endpoints** (see Step 4 above)
3. **Update Nginx** for production URLs
4. **Create developer portal** on apkzio.com
5. **Publish documentation** and SDK
6. **Launch!** 🚀

---

**All files created**:
- ✅ `/root/home/apkzio/PUBLIC_SDK_API.md` - Complete API documentation
- ✅ `/root/home/apkzio/backends/local-api/src/routes/public-sdk.ts` - Backend API routes
- ✅ `/root/home/apkzio/ANDROID_SDK_INTEGRATION_GUIDE.md` - Developer integration guide
- ✅ `/root/home/apkzio/INTEGRATE_PUBLIC_SDK_API.md` - This file

**Share with developers**:
- API Documentation: `PUBLIC_SDK_API.md`
- Integration Guide: `ANDROID_SDK_INTEGRATION_GUIDE.md`
- Backend Routes: `routes/public-sdk.ts`
