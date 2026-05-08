# 📱 ApkZio Android SDK - Integration Package

## 🚀 Quick Links

**API Base URL**: `https://api.apkzio.com`  
**Admin Dashboard**: `https://admin.apkzio.com`  
**Documentation**: `https://apkzio.com/docs`

---

## 📦 What's Included

This package contains everything Android developers need to integrate ApkZio push notifications into their apps:

1. ✅ **Complete Android SDK** (Kotlin)
2. ✅ **API documentation** with examples
3. ✅ **5-step integration guide**
4. ✅ **Firebase setup instructions**
5. ✅ **Copy-paste code** ready to use

---

## 🎯 What It Does

Once integrated, your app will:

1. ✅ **Auto-register** in ApkZio admin dashboard on first build
2. ✅ **Register users** automatically on first app install
3. ✅ **Request notification permission** from users
4. ✅ **Store subscribers** who allow notifications
5. ✅ **Receive push notifications** sent from ApkZio dashboard
6. ✅ **Track custom events** (optional analytics)

---

## 🚀 Integration Steps (5 Minutes)

### Step 1: Add Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Add Android app
3. Download `google-services.json` → Place in `app/` folder

### Step 2: Add Dependencies

**Project `build.gradle.kts`**:
```kotlin
plugins {
    id("com.google.gms.google-services") version "4.4.1" apply false
}
```

**App `build.gradle.kts`**:
```kotlin
plugins {
    id("com.google.gms.google-services")
}

dependencies {
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.8.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    
    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

### Step 3: Copy 2 SDK Files

Download and copy these into your project:

1. **`ApkZioSdk.kt`** → `app/src/main/java/com/yourapp/`
2. **`ApkZioMessagingService.kt`** → `app/src/main/java/com/yourapp/`

[Download SDK files here](#)

### Step 4: Update AndroidManifest.xml

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application>
        <!-- Add Firebase Messaging Service -->
        <service
            android:name=".ApkZioMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- Add notification defaults -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
    </application>
</manifest>
```

### Step 5: Initialize in MainActivity

```kotlin
class MainActivity : AppCompatActivity() {
    
    private lateinit var apkzio: ApkZioSdk
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Initialize ApkZio SDK
        apkzio = ApkZioSdk.initialize(
            context = this,
            apiKey = "YOUR_API_KEY"  // Get from admin.apkzio.com
        )
        
        // Register & subscribe
        lifecycleScope.launch {
            if (!apkzio.isRegistered()) {
                apkzio.registerDevice()
            }
            requestNotificationPermission()
        }
    }
    
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1001
            )
        } else {
            lifecycleScope.launch {
                apkzio.subscribeToNotifications()
            }
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001 && grantResults.isNotEmpty() && 
            grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            lifecycleScope.launch {
                apkzio.subscribeToNotifications()
            }
        }
    }
}
```

**Done!** Your app is now integrated. ✅

---

## 🔑 Get Your API Key

1. Go to **https://admin.apkzio.com**
2. Sign up / Log in
3. Navigate to **Apps** section
4. Your app will appear automatically after first build
5. Click on your app → **Settings** → Copy **API Key**
6. Replace `"YOUR_API_KEY"` in your code

---

## 📡 API Endpoints (for reference)

### Public Endpoints
```
POST   /api/v1/apps/register               - Auto-register app
POST   /api/v1/devices/register            - Register device
PUT    /api/v1/devices/{id}/token          - Update FCM token
POST   /api/v1/devices/{id}/subscribe      - Subscribe to notifications
POST   /api/v1/devices/{id}/unsubscribe    - Unsubscribe
GET    /api/v1/devices/{id}/status         - Get status
POST   /api/v1/events/track                - Track events
```

All requests require `X-Apkzio-Api-Key` header (except app registration).

---

## 📖 Full Documentation

- **Quick Start**: See above (5 steps)
- **API Reference**: [Download PUBLIC_SDK_API.md](#)
- **Complete Guide**: [Download ANDROID_SDK_INTEGRATION_GUIDE.md](#)
- **Example App**: [GitHub Repository](#)

---

## 💬 Support

**Email**: support@apkzio.com  
**Discord**: [Join our community](#)  
**Website**: https://apkzio.com

---

## 🎁 Features

### For Your App

- ✅ **Push Notifications** - Receive notifications from ApkZio dashboard
- ✅ **Auto-registration** - App appears in dashboard automatically
- ✅ **User Analytics** - Track custom events
- ✅ **FCM Token Management** - Automatic token refresh
- ✅ **Permission Handling** - Built-in Android 13+ support

### For You (ApkZio Admin)

- ✅ **Manage Apps** - See all registered apps
- ✅ **View Subscribers** - Track who has your app installed
- ✅ **Send Notifications** - Compose and send to all users or segments
- ✅ **Track Engagement** - See delivery, open, and click rates
- ✅ **Analytics Dashboard** - View app and notification stats

---

## 📊 Example Use Cases

### 1. Send Update Notifications
```kotlin
// In your app - track app updates
apkzio.trackEvent("app_updated", mapOf("version" to "2.0.0"))
```

### 2. Notify Users of New Content
Send from admin dashboard:
- Title: "New Content Available!"
- Body: "Check out what's new in the app"
- Target: All subscribers

### 3. Re-engage Inactive Users
Send from admin dashboard:
- Title: "We miss you!"
- Body: "Come back and see what's changed"
- Target: Users who haven't opened app in 7 days

---

## ✅ Checklist

Before going live:

- [ ] Firebase project created
- [ ] `google-services.json` added to app
- [ ] Dependencies added to `build.gradle.kts`
- [ ] SDK files copied into project
- [ ] AndroidManifest.xml updated
- [ ] SDK initialized in MainActivity
- [ ] API key added to code
- [ ] Notification permission requested
- [ ] App tested on real device
- [ ] Push notifications working

---

## 🚀 What Happens Next

1. **You integrate** the SDK (5 minutes)
2. **Build your app** and install on device
3. **App auto-registers** in ApkZio dashboard
4. **User opens app** → Device registered
5. **User allows notifications** → Subscribed
6. **You send notification** from dashboard
7. **User receives notification** on their device! 🎉

---

## 📱 Minimum Requirements

- **Android**: 7.0+ (API 24+)
- **Kotlin**: 1.8+
- **Gradle**: 8.0+
- **Firebase**: Latest BOM

---

## 🎯 Summary

**Integration Time**: 5 minutes  
**Code to Add**: 2 files  
**Dependencies**: 3 libraries  
**Lines of Code**: ~10 lines in MainActivity

**Result**: Full push notification support with zero backend work! 🚀

---

**Ready to integrate?** Download the SDK and follow the 5 steps above!

**Need help?** Contact support@apkzio.com

---

*ApkZio - Push Notifications Made Simple*
