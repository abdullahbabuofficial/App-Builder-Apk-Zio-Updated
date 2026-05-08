# 📱 ApkZio Public SDK & API Documentation

**Version**: 1.0.0  
**Base URL**: `https://api.apkzio.com`

---

## 🎯 Overview

The ApkZio Public SDK allows any Android developer to integrate push notifications and analytics into their app. Once integrated, the app will:

1. ✅ **Auto-register** in ApkZio admin dashboard on first build
2. ✅ **Register users** on first app launch
3. ✅ **Request notification permission** from users
4. ✅ **Store subscribers** who allow notifications
5. ✅ **Receive push notifications** sent from ApkZio admin dashboard

---

## 🔑 Authentication

All API requests require an **API Key** in the header:

```
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Get your API key**: https://admin.apkzio.com → Apps → Your App → API Key

---

## 📡 Public API Endpoints

### 1. Register App (First Build)

**Endpoint**: `POST /api/v1/apps/register`

**Description**: Called automatically when app is first built. Creates app record in admin dashboard.

**Headers**:
```
Content-Type: application/json
X-Apkzio-Builder-Key: YOUR_BUILDER_KEY (optional)
```

**Request Body**:
```json
{
  "package_name": "com.example.myapp",
  "app_name": "My Awesome App",
  "version_code": 1,
  "version_name": "1.0.0",
  "developer_email": "developer@example.com",
  "developer_name": "John Developer"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "app_id": "app_abc123xyz",
  "api_key": "apk_live_1234567890abcdef",
  "message": "App registered successfully"
}
```

**Response** (409 Conflict - App already exists):
```json
{
  "success": true,
  "app_id": "app_abc123xyz",
  "api_key": "apk_live_1234567890abcdef",
  "message": "App already registered"
}
```

---

### 2. Register Device (First Install)

**Endpoint**: `POST /api/v1/devices/register`

**Description**: Called on first app launch. Registers device in ApkZio system.

**Headers**:
```
Content-Type: application/json
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Request Body**:
```json
{
  "device_id": "unique-device-identifier",
  "fcm_token": "firebase-cloud-messaging-token",
  "platform": "android",
  "os_version": "14",
  "app_version": "1.0.0",
  "model": "Samsung Galaxy S24",
  "manufacturer": "Samsung",
  "locale": "en_US",
  "timezone": "America/New_York"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device_xyz789",
  "subscriber_id": "sub_abc123",
  "message": "Device registered successfully"
}
```

---

### 3. Update FCM Token

**Endpoint**: `PUT /api/v1/devices/{device_id}/token`

**Description**: Update FCM token when it changes (token refresh).

**Headers**:
```
Content-Type: application/json
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Request Body**:
```json
{
  "fcm_token": "new-firebase-cloud-messaging-token"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

---

### 4. Subscribe to Notifications

**Endpoint**: `POST /api/v1/devices/{device_id}/subscribe`

**Description**: Called when user allows notifications.

**Headers**:
```
Content-Type: application/json
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Request Body**:
```json
{
  "fcm_token": "firebase-cloud-messaging-token",
  "topics": ["general", "updates"],
  "user_consent": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "subscriber_id": "sub_abc123",
  "subscribed_at": "2026-05-09T01:45:00Z",
  "message": "Subscribed successfully"
}
```

---

### 5. Unsubscribe from Notifications

**Endpoint**: `POST /api/v1/devices/{device_id}/unsubscribe`

**Description**: Called when user disables notifications.

**Headers**:
```
Content-Type: application/json
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Request Body**:
```json
{
  "reason": "user_disabled" // or "app_uninstalled"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Unsubscribed successfully"
}
```

---

### 6. Track Event (Optional)

**Endpoint**: `POST /api/v1/events/track`

**Description**: Track custom events from your app.

**Headers**:
```
Content-Type: application/json
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Request Body**:
```json
{
  "device_id": "device_xyz789",
  "event_name": "button_clicked",
  "event_data": {
    "button_id": "subscribe_button",
    "screen": "home"
  },
  "timestamp": "2026-05-09T01:45:00Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Event tracked successfully"
}
```

---

### 7. Get Notification Status

**Endpoint**: `GET /api/v1/devices/{device_id}/status`

**Description**: Check if device is subscribed to notifications.

**Headers**:
```
X-Apkzio-Api-Key: YOUR_APP_API_KEY
```

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device_xyz789",
  "subscribed": true,
  "fcm_token": "firebase-token",
  "subscribed_at": "2026-05-09T01:45:00Z",
  "last_seen": "2026-05-09T10:30:00Z"
}
```

---

## 🔥 Admin API (Send Notifications)

### 8. Send Push Notification

**Endpoint**: `POST /api/v1/notifications/send`

**Description**: Send push notification to app subscribers (admin dashboard).

**Headers**:
```
Content-Type: application/json
X-Apkzio-Admin-Key: YOUR_ADMIN_KEY
```

**Request Body**:
```json
{
  "app_id": "app_abc123xyz",
  "title": "New Update Available!",
  "body": "Check out the latest features in version 2.0",
  "image_url": "https://example.com/notification-image.png",
  "action_url": "https://example.com/updates",
  "data": {
    "type": "update",
    "version": "2.0.0"
  },
  "target": {
    "type": "all"  // or "device_ids", "topics", "segments"
  }
}
```

**Target Types**:
- `"all"` - Send to all subscribers
- `"device_ids"` - Send to specific devices
  ```json
  "target": {
    "type": "device_ids",
    "device_ids": ["device_xyz789", "device_abc123"]
  }
  ```
- `"topics"` - Send to topic subscribers
  ```json
  "target": {
    "type": "topics",
    "topics": ["updates", "promotions"]
  }
  ```
- `"segments"` - Send to user segments
  ```json
  "target": {
    "type": "segments",
    "segments": ["active_users", "premium_users"]
  }
  ```

**Response** (200 OK):
```json
{
  "success": true,
  "notification_id": "notif_xyz789",
  "sent_count": 1250,
  "failed_count": 3,
  "message": "Notification sent successfully"
}
```

---

### 9. Get Notification Analytics

**Endpoint**: `GET /api/v1/notifications/{notification_id}/analytics`

**Description**: Get delivery and engagement stats.

**Headers**:
```
X-Apkzio-Admin-Key: YOUR_ADMIN_KEY
```

**Response** (200 OK):
```json
{
  "success": true,
  "notification_id": "notif_xyz789",
  "sent_at": "2026-05-09T10:00:00Z",
  "stats": {
    "sent": 1250,
    "delivered": 1230,
    "opened": 456,
    "clicked": 123,
    "failed": 20
  },
  "delivery_rate": 98.4,
  "open_rate": 37.1,
  "click_rate": 10.0
}
```

---

### 10. Get App Subscribers

**Endpoint**: `GET /api/v1/apps/{app_id}/subscribers`

**Description**: List all subscribers for your app.

**Headers**:
```
X-Apkzio-Admin-Key: YOUR_ADMIN_KEY
```

**Query Parameters**:
```
?page=1&limit=50&subscribed=true&platform=android
```

**Response** (200 OK):
```json
{
  "success": true,
  "total": 1250,
  "page": 1,
  "limit": 50,
  "subscribers": [
    {
      "subscriber_id": "sub_abc123",
      "device_id": "device_xyz789",
      "fcm_token": "firebase-token",
      "platform": "android",
      "os_version": "14",
      "app_version": "1.0.0",
      "subscribed": true,
      "subscribed_at": "2026-05-09T01:45:00Z",
      "last_seen": "2026-05-09T10:30:00Z",
      "model": "Samsung Galaxy S24"
    }
  ]
}
```

---

## 📱 Android Integration (Kotlin)

### Step 1: Add Dependencies

Add to your `app/build.gradle.kts`:

```kotlin
dependencies {
    // Firebase Cloud Messaging
    implementation(platform("com.google.firebase:firebase-bom:32.8.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    
    // ApkZio SDK (or use Retrofit for API calls)
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    
    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

Add to your project-level `build.gradle.kts`:

```kotlin
plugins {
    id("com.google.gms.google-services") version "4.4.1" apply false
}
```

Add to your app-level `build.gradle.kts`:

```kotlin
plugins {
    id("com.google.gms.google-services")
}
```

---

### Step 2: Add `google-services.json`

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project or use existing
3. Add Android app
4. Download `google-services.json`
5. Place in `app/` directory

---

### Step 3: Create ApkZio SDK

Create `ApkZioSdk.kt`:

```kotlin
package com.example.apkziosdk

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.provider.Settings
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.*

class ApkZioSdk private constructor(
    private val context: Context,
    private val apiKey: String
) {
    private val prefs: SharedPreferences = context.getSharedPreferences("apkzio_sdk", Context.MODE_PRIVATE)
    private val api: ApkZioApi
    
    companion object {
        private const val BASE_URL = "https://api.apkzio.com/"
        private const val PREF_DEVICE_ID = "device_id"
        private const val PREF_SUBSCRIBER_ID = "subscriber_id"
        private const val PREF_REGISTERED = "registered"
        private const val PREF_SUBSCRIBED = "subscribed"
        
        @Volatile
        private var instance: ApkZioSdk? = null
        
        fun initialize(context: Context, apiKey: String): ApkZioSdk {
            return instance ?: synchronized(this) {
                instance ?: ApkZioSdk(context.applicationContext, apiKey).also {
                    instance = it
                }
            }
        }
        
        fun getInstance(): ApkZioSdk {
            return instance ?: throw IllegalStateException("ApkZioSdk not initialized. Call initialize() first.")
        }
    }
    
    init {
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        api = retrofit.create(ApkZioApi::class.java)
    }
    
    /**
     * Register device on first launch
     */
    suspend fun registerDevice(): Result<DeviceResponse> {
        return try {
            val isRegistered = prefs.getBoolean(PREF_REGISTERED, false)
            if (isRegistered) {
                return Result.success(
                    DeviceResponse(
                        success = true,
                        deviceId = getDeviceId(),
                        subscriberId = prefs.getString(PREF_SUBSCRIBER_ID, null),
                        message = "Already registered"
                    )
                )
            }
            
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            val deviceId = getOrCreateDeviceId()
            
            val request = RegisterDeviceRequest(
                deviceId = deviceId,
                fcmToken = fcmToken,
                platform = "android",
                osVersion = Build.VERSION.RELEASE,
                appVersion = getAppVersion(),
                model = Build.MODEL,
                manufacturer = Build.MANUFACTURER,
                locale = Locale.getDefault().toString(),
                timezone = TimeZone.getDefault().id
            )
            
            val response = api.registerDevice(apiKey, request)
            
            if (response.success) {
                prefs.edit()
                    .putString(PREF_DEVICE_ID, response.deviceId)
                    .putString(PREF_SUBSCRIBER_ID, response.subscriberId)
                    .putBoolean(PREF_REGISTERED, true)
                    .apply()
            }
            
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Subscribe to push notifications
     */
    suspend fun subscribeToNotifications(topics: List<String> = listOf("general")): Result<SubscribeResponse> {
        return try {
            val deviceId = getDeviceId()
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            
            val request = SubscribeRequest(
                fcmToken = fcmToken,
                topics = topics,
                userConsent = true
            )
            
            val response = api.subscribe(apiKey, deviceId, request)
            
            if (response.success) {
                prefs.edit()
                    .putBoolean(PREF_SUBSCRIBED, true)
                    .putString(PREF_SUBSCRIBER_ID, response.subscriberId)
                    .apply()
            }
            
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Unsubscribe from push notifications
     */
    suspend fun unsubscribe(reason: String = "user_disabled"): Result<UnsubscribeResponse> {
        return try {
            val deviceId = getDeviceId()
            val request = UnsubscribeRequest(reason = reason)
            val response = api.unsubscribe(apiKey, deviceId, request)
            
            if (response.success) {
                prefs.edit().putBoolean(PREF_SUBSCRIBED, false).apply()
            }
            
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Update FCM token (called when token refreshes)
     */
    suspend fun updateFcmToken(newToken: String): Result<UpdateTokenResponse> {
        return try {
            val deviceId = getDeviceId()
            val request = UpdateTokenRequest(fcmToken = newToken)
            val response = api.updateToken(apiKey, deviceId, request)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Track custom event
     */
    suspend fun trackEvent(eventName: String, eventData: Map<String, Any> = emptyMap()): Result<TrackEventResponse> {
        return try {
            val request = TrackEventRequest(
                deviceId = getDeviceId(),
                eventName = eventName,
                eventData = eventData,
                timestamp = System.currentTimeMillis().toString()
            )
            val response = api.trackEvent(apiKey, request)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Check subscription status
     */
    suspend fun getStatus(): Result<StatusResponse> {
        return try {
            val deviceId = getDeviceId()
            val response = api.getStatus(apiKey, deviceId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Check if device is registered
     */
    fun isRegistered(): Boolean = prefs.getBoolean(PREF_REGISTERED, false)
    
    /**
     * Check if subscribed to notifications
     */
    fun isSubscribed(): Boolean = prefs.getBoolean(PREF_SUBSCRIBED, false)
    
    /**
     * Get device ID
     */
    fun getDeviceId(): String {
        return prefs.getString(PREF_DEVICE_ID, null) ?: getOrCreateDeviceId()
    }
    
    private fun getOrCreateDeviceId(): String {
        var deviceId = prefs.getString(PREF_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            ) + "_" + UUID.randomUUID().toString().substring(0, 8)
            prefs.edit().putString(PREF_DEVICE_ID, deviceId).apply()
        }
        return deviceId
    }
    
    private fun getAppVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
}

// Retrofit API Interface
interface ApkZioApi {
    @POST("api/v1/devices/register")
    suspend fun registerDevice(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Body request: RegisterDeviceRequest
    ): DeviceResponse
    
    @PUT("api/v1/devices/{deviceId}/token")
    suspend fun updateToken(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Path("deviceId") deviceId: String,
        @Body request: UpdateTokenRequest
    ): UpdateTokenResponse
    
    @POST("api/v1/devices/{deviceId}/subscribe")
    suspend fun subscribe(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Path("deviceId") deviceId: String,
        @Body request: SubscribeRequest
    ): SubscribeResponse
    
    @POST("api/v1/devices/{deviceId}/unsubscribe")
    suspend fun unsubscribe(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Path("deviceId") deviceId: String,
        @Body request: UnsubscribeRequest
    ): UnsubscribeResponse
    
    @POST("api/v1/events/track")
    suspend fun trackEvent(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Body request: TrackEventRequest
    ): TrackEventResponse
    
    @GET("api/v1/devices/{deviceId}/status")
    suspend fun getStatus(
        @Header("X-Apkzio-Api-Key") apiKey: String,
        @Path("deviceId") deviceId: String
    ): StatusResponse
}

// Data classes
data class RegisterDeviceRequest(
    val deviceId: String,
    val fcmToken: String,
    val platform: String,
    val osVersion: String,
    val appVersion: String,
    val model: String,
    val manufacturer: String,
    val locale: String,
    val timezone: String
)

data class DeviceResponse(
    val success: Boolean,
    val deviceId: String,
    val subscriberId: String?,
    val message: String
)

data class UpdateTokenRequest(val fcmToken: String)
data class UpdateTokenResponse(val success: Boolean, val message: String)

data class SubscribeRequest(
    val fcmToken: String,
    val topics: List<String>,
    val userConsent: Boolean
)

data class SubscribeResponse(
    val success: Boolean,
    val subscriberId: String,
    val subscribedAt: String,
    val message: String
)

data class UnsubscribeRequest(val reason: String)
data class UnsubscribeResponse(val success: Boolean, val message: String)

data class TrackEventRequest(
    val deviceId: String,
    val eventName: String,
    val eventData: Map<String, Any>,
    val timestamp: String
)

data class TrackEventResponse(val success: Boolean, val message: String)

data class StatusResponse(
    val success: Boolean,
    val deviceId: String,
    val subscribed: Boolean,
    val fcmToken: String?,
    val subscribedAt: String?,
    val lastSeen: String?
)
```

---

### Step 4: Create Firebase Messaging Service

Create `ApkZioMessagingService.kt`:

```kotlin
package com.example.yourapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.apkziosdk.ApkZioSdk
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ApkZioMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        
        // Show notification
        showNotification(
            title = message.notification?.title ?: "New Message",
            body = message.notification?.body ?: "",
            data = message.data
        )
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        
        // Update token in ApkZio
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ApkZioSdk.getInstance().updateFcmToken(token)
            } catch (e: Exception) {
                // Handle error
            }
        }
    }
    
    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "apkzio_default"
        
        // Create notification channel (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "ApkZio Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }
        
        // Create intent for notification tap
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtras(android.os.Bundle().apply {
                data.forEach { (key, value) -> putString(key, value) }
            })
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        // Build notification
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification) // Add your icon
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
```

---

### Step 5: Update AndroidManifest.xml

```xml
<manifest>
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application>
        <!-- Your activities -->
        
        <!-- Firebase Messaging Service -->
        <service
            android:name=".ApkZioMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- Default notification icon & color -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/notification_color" />
    </application>
</manifest>
```

---

### Step 6: Initialize in Your App

In your `MainActivity.kt`:

```kotlin
package com.example.yourapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.apkziosdk.ApkZioSdk
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    
    private lateinit var apkzio: ApkZioSdk
    
    // Permission launcher for Android 13+ (API 33+)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            subscribeToNotifications()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Initialize ApkZio SDK
        apkzio = ApkZioSdk.initialize(
            context = this,
            apiKey = "apk_live_YOUR_API_KEY_HERE"  // Get from admin dashboard
        )
        
        // Register device on first launch
        registerDevice()
    }
    
    private fun registerDevice() {
        lifecycleScope.launch {
            if (!apkzio.isRegistered()) {
                val result = apkzio.registerDevice()
                result.onSuccess {
                    // Device registered successfully
                    requestNotificationPermission()
                }.onFailure { error ->
                    // Handle registration error
                }
            } else {
                // Already registered, check if subscribed
                if (!apkzio.isSubscribed()) {
                    requestNotificationPermission()
                }
            }
        }
    }
    
    private fun requestNotificationPermission() {
        // Android 13+ requires runtime permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    // Permission already granted
                    subscribeToNotifications()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // Show explanation to user
                    showPermissionRationale()
                }
                else -> {
                    // Request permission
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            // Android 12 and below don't need runtime permission
            subscribeToNotifications()
        }
    }
    
    private fun showPermissionRationale() {
        // Show dialog explaining why you need notification permission
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Enable Notifications")
            .setMessage("Get notified about important updates and new features!")
            .setPositiveButton("Allow") { _, _ ->
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            .setNegativeButton("Not Now", null)
            .show()
    }
    
    private fun subscribeToNotifications() {
        lifecycleScope.launch {
            val result = apkzio.subscribeToNotifications(
                topics = listOf("general", "updates")
            )
            result.onSuccess {
                // Successfully subscribed
                // Track event
                apkzio.trackEvent(
                    eventName = "notification_subscribed",
                    eventData = mapOf("source" to "main_activity")
                )
            }.onFailure { error ->
                // Handle subscription error
            }
        }
    }
}
```

---

## 🎨 Admin Dashboard Integration

Add to your admin dashboard to send notifications and view subscribers.

---

## 🔗 Integration URLs

Share these with developers:

### API Base URL
```
https://api.apkzio.com
```

### Documentation
```
https://docs.apkzio.com
```

### Get API Key
```
https://admin.apkzio.com → Apps → Your App → Settings → API Key
```

### SDK Repository (GitHub)
```
https://github.com/apkzio/android-sdk
```

---

## 📊 Example Use Cases

### 1. Send Welcome Notification
```kotlin
// In your app
apkzio.trackEvent("user_registered", mapOf("source" to "email"))
```

### 2. Send Update Notification (from admin)
```bash
curl -X POST "https://api.apkzio.com/api/v1/notifications/send" \
  -H "X-Apkzio-Admin-Key: YOUR_ADMIN_KEY" \
  -d '{
    "app_id": "app_abc123",
    "title": "New Update Available!",
    "body": "Version 2.0 is here with amazing features",
    "target": {"type": "all"}
  }'
```

### 3. Check Subscriber Count
```bash
curl "https://api.apkzio.com/api/v1/apps/app_abc123/subscribers" \
  -H "X-Apkzio-Admin-Key: YOUR_ADMIN_KEY"
```

---

## ✅ Summary

Developers need to:
1. ✅ Add Firebase to their app
2. ✅ Add ApkZio SDK code (copy from above)
3. ✅ Initialize SDK with their API key
4. ✅ Call `registerDevice()` on first launch
5. ✅ Request notification permission
6. ✅ Call `subscribeToNotifications()` when allowed

Then you (ApkZio admin) can:
1. ✅ See all apps in admin dashboard
2. ✅ View subscribers per app
3. ✅ Send push notifications to subscribers
4. ✅ Track delivery & engagement analytics

---

**Next**: I'll create the backend API implementation for these endpoints!
