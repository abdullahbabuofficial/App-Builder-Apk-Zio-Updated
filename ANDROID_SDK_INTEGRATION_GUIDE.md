# 📱 ApkZio Android SDK - Complete Integration Guide

## 🎯 Overview

This guide shows developers how to integrate ApkZio SDK into their Android app to enable:
- ✅ Auto-registration in ApkZio admin dashboard
- ✅ User registration on first app launch
- ✅ Push notification permissions
- ✅ Subscriber management
- ✅ Send push notifications from admin dashboard

---

## 🚀 Quick Start (5 Steps)

### Step 1: Add Firebase to Your App

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Add Android app
3. Download `google-services.json`
4. Place in `app/` directory

### Step 2: Add Dependencies

**Project-level `build.gradle.kts`**:
```kotlin
plugins {
    id("com.google.gms.google-services") version "4.4.1" apply false
}
```

**App-level `build.gradle.kts`**:
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

### Step 3: Copy SDK Files

Copy these 2 files into your project:

1. **`ApkZioSdk.kt`** (see below)
2. **`ApkZioMessagingService.kt`** (see below)

### Step 4: Update AndroidManifest.xml

```xml
<manifest>
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <application>
        <!-- Firebase Messaging Service -->
        <service
            android:name=".ApkZioMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- Notification defaults -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorPrimary" />
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
            apiKey = "YOUR_API_KEY_HERE"  // Get from admin.apkzio.com
        )
        
        // Register & subscribe
        lifecycleScope.launch {
            registerAndSubscribe()
        }
    }
    
    private suspend fun registerAndSubscribe() {
        // Register device
        if (!apkzio.isRegistered()) {
            apkzio.registerDevice()
        }
        
        // Request notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                subscribeToNotifications()
            } else {
                // Request permission
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        } else {
            // No permission needed on Android 12 and below
            subscribeToNotifications()
        }
    }
    
    private suspend fun subscribeToNotifications() {
        if (!apkzio.isSubscribed()) {
            apkzio.subscribeToNotifications()
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
                subscribeToNotifications()
            }
        }
    }
}
```

**That's it!** Your app is now integrated. ✅

---

## 📝 Complete Code Files

### File 1: `ApkZioSdk.kt`

```kotlin
package com.example.yourapp

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
            return instance ?: throw IllegalStateException("ApkZioSdk not initialized")
        }
    }
    
    init {
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        api = retrofit.create(ApkZioApi::class.java)
    }
    
    suspend fun registerDevice(): Result<DeviceResponse> {
        return try {
            if (isRegistered()) {
                return Result.success(
                    DeviceResponse(true, getDeviceId(), 
                        prefs.getString(PREF_SUBSCRIBER_ID, null), "Already registered")
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
    
    suspend fun subscribeToNotifications(topics: List<String> = listOf("general")): Result<SubscribeResponse> {
        return try {
            val deviceId = getDeviceId()
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            
            val request = SubscribeRequest(fcmToken, topics, true)
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
    
    suspend fun unsubscribe(reason: String = "user_disabled"): Result<UnsubscribeResponse> {
        return try {
            val response = api.unsubscribe(apiKey, getDeviceId(), UnsubscribeRequest(reason))
            if (response.success) {
                prefs.edit().putBoolean(PREF_SUBSCRIBED, false).apply()
            }
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateFcmToken(newToken: String): Result<UpdateTokenResponse> {
        return try {
            val response = api.updateToken(apiKey, getDeviceId(), UpdateTokenRequest(newToken))
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun trackEvent(eventName: String, eventData: Map<String, Any> = emptyMap()): Result<TrackEventResponse> {
        return try {
            val request = TrackEventRequest(
                getDeviceId(), eventName, eventData, System.currentTimeMillis().toString()
            )
            val response = api.trackEvent(apiKey, request)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun isRegistered(): Boolean = prefs.getBoolean(PREF_REGISTERED, false)
    fun isSubscribed(): Boolean = prefs.getBoolean(PREF_SUBSCRIBED, false)
    fun getDeviceId(): String = prefs.getString(PREF_DEVICE_ID, null) ?: getOrCreateDeviceId()
    
    private fun getOrCreateDeviceId(): String {
        var deviceId = prefs.getString(PREF_DEVICE_ID, null)
        if (deviceId == null) {
            deviceId = Settings.Secure.getString(
                context.contentResolver, Settings.Secure.ANDROID_ID
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

// API Interface
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
}

// Data classes
data class RegisterDeviceRequest(
    val deviceId: String, val fcmToken: String, val platform: String,
    val osVersion: String, val appVersion: String, val model: String,
    val manufacturer: String, val locale: String, val timezone: String
)
data class DeviceResponse(val success: Boolean, val deviceId: String, 
    val subscriberId: String?, val message: String)
data class UpdateTokenRequest(val fcmToken: String)
data class UpdateTokenResponse(val success: Boolean, val message: String)
data class SubscribeRequest(val fcmToken: String, val topics: List<String>, val userConsent: Boolean)
data class SubscribeResponse(val success: Boolean, val subscriberId: String, 
    val subscribedAt: String, val message: String)
data class UnsubscribeRequest(val reason: String)
data class UnsubscribeResponse(val success: Boolean, val message: String)
data class TrackEventRequest(val deviceId: String, val eventName: String, 
    val eventData: Map<String, Any>, val timestamp: String)
data class TrackEventResponse(val success: Boolean, val message: String)
```

### File 2: `ApkZioMessagingService.kt`

```kotlin
package com.example.yourapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ApkZioMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        
        showNotification(
            title = message.notification?.title ?: "New Message",
            body = message.notification?.body ?: "",
            data = message.data
        )
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ApkZioSdk.getInstance().updateFcmToken(token)
            } catch (e: Exception) {
                // SDK not initialized yet - will sync on next app start
            }
        }
    }
    
    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "apkzio_default"
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "ApkZio Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtras(android.os.Bundle().apply {
                data.forEach { (key, value) -> putString(key, value) }
            })
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
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

## 🔑 Get Your API Key

1. Go to **https://admin.apkzio.com**
2. Navigate to **Apps** section
3. Click on your app (or it will auto-appear after first build)
4. Copy **API Key** from Settings
5. Replace `"YOUR_API_KEY_HERE"` in your code

---

## 📤 Send Push Notifications (Admin)

From admin dashboard or via API:

```bash
curl -X POST "https://api.apkzio.com/api/v1/notifications/send" \
  -H "X-Apkzio-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "app_abc123",
    "title": "New Update Available!",
    "body": "Check out version 2.0 with amazing features",
    "target": {"type": "all"}
  }'
```

---

## ✅ Summary

**For Developers**:
1. Add Firebase + dependencies
2. Copy 2 SDK files into project
3. Update AndroidManifest.xml
4. Initialize in MainActivity
5. Get API key from admin dashboard

**For ApkZio Admin**:
1. See all registered apps
2. View subscribers per app
3. Send push notifications
4. Track delivery & engagement

---

**API Documentation**: https://api.apkzio.com/docs  
**Admin Dashboard**: https://admin.apkzio.com  
**Support**: support@apkzio.com
