# 🧪 APK Builder Testing Guide

## Quick Test (API)

### Test 1: Check Builder Status
```bash
curl -s http://localhost:3001/api/status | python3 -m json.tool
```

**Expected Output**:
```json
{
    "ok": true,
    "features": {
        "apk_gradle_pipeline": true,   ← Must be TRUE
        "apk_pipeline_hint": null       ← Must be NULL (no errors)
    }
}
```

### Test 2: Create Test Build
```bash
curl -X POST "http://localhost:3001/api/builds" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "test-app-001",
    "version_code": 1,
    "version_name": "1.0.0",
    "app_name": "Test WebView",
    "package_name": "com.apkzio.test",
    "start_url": "https://example.com",
    "primary_color": "#3B82F6",
    "background_color": "#FFFFFF",
    "splash_color": "#3B82F6",
    "allow_camera": true,
    "allow_geolocation": false,
    "allow_file_uploads": true,
    "pull_to_refresh": true,
    "swipe_back": true,
    "offline_message": "You are offline",
    "release_notes": "Initial test build"
  }'
```

**Expected**: JSON with `build_id`

### Test 3: Check Build Status
```bash
# Replace BUILD_ID with the ID from Test 2
curl "http://localhost:3001/api/builds/BUILD_ID" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>"
```

**Status Progression**:
1. `queued` - Build queued
2. `building` - Gradle running (this takes 5-15 min first time)
3. `success` - APK ready!
4. `failed` - Check logs

### Test 4: Download APK (when ready)
```bash
curl "http://localhost:3001/api/builds/BUILD_ID/download" \
  -H "X-Apkzio-Admin-Key: PC_<your_admin_api_key>" \
  -o test-app.apk

# Verify it's a real APK
file test-app.apk
unzip -l test-app.apk | head -20
```

## Manual Template Test

### Test the Template Directly
```bash
cd /root/home/apkzio/backends/local-api/template

# Test Gradle wrapper
./gradlew --version

# Expected: Gradle 8.10.2+
```

### Build Template APK
```bash
cd /root/home/apkzio/backends/local-api/template

# Clean previous builds
./gradlew clean

# Build debug APK
./gradlew assembleDebug

# Check output
ls -lh app/build/outputs/apk/debug/app-debug.apk

# Expected: ~2-5MB APK file
```

**First build**: 10-15 minutes (downloads Gradle dependencies ~200MB)
**Subsequent builds**: 3-8 minutes (cached)

## Admin Dashboard Test

### Via Browser
1. Open https://admin.apkzio.com
2. Navigate to **APK Builder** section
3. Fill in the form:
   - **URL**: `https://example.com`
   - **App Name**: `Test App`
   - **Package Name**: `com.test.app`
   - **Version**: `1.0.0`
   - **Color**: Any
   - **Enable**: Camera, File Uploads, Pull-to-Refresh
4. Click **Build APK**
5. Wait for completion (progress bar)
6. Download APK when ready

## Install & Test APK

### On Android Device/Emulator

1. **Enable Developer Options**:
   - Settings → About Phone → Tap "Build Number" 7 times

2. **Enable USB Debugging**:
   - Settings → Developer Options → USB Debugging

3. **Connect device**:
   ```bash
   adb devices
   # Should show your device
   ```

4. **Install APK**:
   ```bash
   adb install test-app.apk
   # Or
   adb install -r test-app.apk  # Reinstall
   ```

5. **Launch app**:
   ```bash
   adb shell am start -n com.apkzio.test/.MainActivity
   ```

6. **View logs**:
   ```bash
   adb logcat | grep "apkzio\|WebView"
   ```

### Test Checklist on Device
- [ ] App launches successfully
- [ ] WebView loads the URL
- [ ] Pull-to-refresh works (if enabled)
- [ ] Back button navigation works (if enabled)
- [ ] Camera access works (if enabled)
- [ ] File upload works (if enabled)
- [ ] Offline page shows when network is off
- [ ] App doesn't crash

## Troubleshooting

### Build Fails

#### Check Logs
```bash
# API logs
tail -f /tmp/apkzio-api-3001.log

# Build-specific logs
cat /root/home/apkzio/backends/local-api/.builds/BUILD_ID/gradle-build.log
```

#### Common Issues

**1. Timeout (> 20 minutes)**
```bash
# Increase timeout in .env
APKZIO_GRADLE_TIMEOUT_MS=2400000  # 40 minutes
```

**2. Out of Memory**
```bash
# Increase heap in .env
APKZIO_GRADLE_HEAP=4g  # 4GB (from 2GB)
```

**3. Network Error**
- Check internet connection
- First build downloads ~200MB of Gradle dependencies
- Retry: Gradle caches downloads

**4. Invalid Package Name**
- Must be valid Java package: `com.company.app`
- Lowercase only
- No spaces, dashes, or special chars
- Must have at least 2 segments (e.g., `com.app` OK, `app` NOT OK)

**5. SDK Not Found**
```bash
# Check Android SDK
ls /opt/android-sdk/
echo $ANDROID_HOME  # Must show /opt/android-sdk

# Restart backend with env vars
cd /root/home/apkzio/backends/local-api
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
npm run dev
```

### APK Won't Install

**1. "App not installed"**
- Enable "Unknown Sources" in device settings
- Settings → Security → Unknown Sources → ON

**2. "Parse error"**
- APK is corrupted or incomplete
- Re-download APK
- Check `file test-app.apk` shows "Android package"

**3. "Signature conflict"**
- Uninstall existing app first:
  ```bash
  adb uninstall com.apkzio.test
  adb install test-app.apk
  ```

### WebView Doesn't Load

**1. Check AndroidManifest permissions**
```bash
unzip -p test-app.apk AndroidManifest.xml | xmllint --format -
```

Must have:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

**2. Check network security**
- HTTP URLs may be blocked
- Use HTTPS URLs for start_url

**3. Check logcat**
```bash
adb logcat | grep "WebView\|apkzio\|ERROR"
```

## Performance Benchmarks

### Expected Build Times

| Stage | First Build | Cached Build |
|-------|-------------|--------------|
| Template render | 0.5s | 0.5s |
| ZIP creation | 1-2s | 1-2s |
| Gradle setup | 3-5min | - |
| Dependency download | 5-10min | - |
| APK compilation | 2-5min | 2-5min |
| **Total** | **10-15min** | **3-8min** |

### Build Sizes

| Output | Size |
|--------|------|
| Source ZIP | ~100 KB |
| Debug APK | 2-5 MB |
| Release APK | 1-3 MB (after minification) |

### System Resources (during build)

| Resource | Usage |
|----------|-------|
| CPU | 80-100% (all cores) |
| RAM | 2-4 GB (Gradle heap) |
| Disk I/O | High (compilation) |
| Network | 200 MB (first build) |

## Advanced Testing

### Test Multiple Builds Concurrently

```bash
# Increase concurrency (if you have resources)
echo "APKZIO_MAX_CONCURRENT_GRADLE=2" >> .env

# Queue 3 builds
for i in {1..3}; do
  curl -X POST "http://localhost:3001/api/builds" \
    -H "X-Apkzio-Admin-Key: PC_YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"app_id\": \"test-app-$i\", ...}" &
done
wait
```

### Load Test

```bash
# Using Apache Bench
ab -n 10 -c 2 \
  -H "X-Apkzio-Admin-Key: PC_YOUR_KEY" \
  -p build-request.json \
  -T "application/json" \
  http://localhost:3001/api/builds
```

### Stress Test Template

```bash
cd /root/home/apkzio/backends/local-api/template

# Run multiple Gradle builds
for i in {1..5}; do
  echo "Build $i..."
  ./gradlew clean assembleDebug
done
```

## Monitoring

### Watch Build Queue

```bash
watch -n 5 'curl -s http://localhost:3001/api/builds | python3 -m json.tool'
```

### Monitor System Resources

```bash
# CPU
top -b -n 1 | grep java

# Memory
free -h

# Disk I/O
iostat -x 5

# Network
iftop
```

### Check Gradle Cache

```bash
du -sh /root/home/apkzio/backends/local-api/template/.gradle/
# Expected: 200-500 MB after first build
```

## Cleanup

### Clear Build Cache

```bash
# Remove all builds
rm -rf /root/home/apkzio/backends/local-api/.builds/*

# Clear Gradle cache
cd /root/home/apkzio/backends/local-api/template
./gradlew clean
rm -rf .gradle/
```

### Reset Builder State

```bash
# Stop backend
pkill -f "tsx.*server"

# Clear cache
rm -rf /root/home/apkzio/backends/local-api/.builds/*

# Restart
cd /root/home/apkzio/backends/local-api
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
npm run dev
```

## Summary

✅ **Builder is working if**:
- `apk_gradle_pipeline: true` in status
- Template builds manually with `./gradlew assembleDebug`
- API creates builds with `status: "queued"`
- Builds progress to `status: "building"` then `status: "success"`
- Downloaded APK can be installed on Android device
- App launches and loads WebView

❌ **Builder has issues if**:
- `apk_gradle_pipeline: false` in status
- Template build fails with Gradle errors
- Builds stay in `queued` state
- Builds fail immediately with `status: "failed"`
- APK file is empty or corrupted
- APK won't install on device

---

**Ready to test?** Start with Test 1-4 above! 🚀
