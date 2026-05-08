package com.apkzio.sdk

import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executor

private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

/**
 * Minimal Android client for Apkzio Edge functions (SDK routes).
 *
 * [baseUrl] must include the Supabase functions prefix, for example:
 * `https://<project-ref>.supabase.co/functions/v1`
 *
 * @param callbackExecutor Runs result callbacks (defaults to OkHttp’s worker threads).
 */
class ApkzioClient(
    private val appKey: String,
    baseUrl: String,
    private val storage: ApkzioStorage,
    private val http: OkHttpClient = OkHttpClient(),
    private val callbackExecutor: Executor? = null,
) {

    private val root: String = baseUrl.trimEnd('/')

    init {
        require(APP_KEY.matches(appKey)) {
            "appKey must match pk_<48 lowercase hex> (see extractAppKey in Edge utils)"
        }
    }

    /** Device id UUID after a successful [init]. */
    val deviceId: String? get() = storage.deviceId

    /** App id UUID after a successful [init]. */
    val appId: String? get() = storage.appId

    /**
     * `POST /sdk-init` — idempotent per app key + android_id.
     * Persists [InitResponse.deviceId] and [InitResponse.appId] to [storage] on success.
     *
     * @param androidId Opaque device/install id, 8..128 chars (not stored raw server-side).
     */
    fun init(
        androidId: String,
        fcmToken: String? = null,
        appVersion: String? = null,
        appBuild: String? = null,
        osVersion: String? = null,
        sdkInt: Int? = null,
        deviceModel: String? = null,
        manufacturer: String? = null,
        language: String? = null,
        timezone: String? = null,
        countryCode: String? = null,
        carrier: String? = null,
        networkType: String? = null,
        metadata: Map<String, Any?>? = null,
        callback: (Result<InitResponse>) -> Unit,
    ) {
        require(androidId.length in 8..128) { "android_id must be 8..128 characters" }
        val body = JSONObject().apply {
            put("android_id", androidId)
            if (fcmToken != null) put("fcm_token", fcmToken)
            if (appVersion != null) put("app_version", appVersion)
            if (appBuild != null) put("app_build", appBuild)
            if (osVersion != null) put("os_version", osVersion)
            if (sdkInt != null) put("sdk_int", sdkInt)
            if (deviceModel != null) put("device_model", deviceModel)
            if (manufacturer != null) put("manufacturer", manufacturer)
            if (language != null) put("language", language)
            if (timezone != null) put("timezone", timezone)
            if (countryCode != null) put("country_code", countryCode)
            if (carrier != null) put("carrier", carrier)
            if (networkType != null) put("network_type", networkType)
            if (metadata != null) put("metadata", jsonObject(metadata))
        }
        postJson(
            path = "/sdk-init",
            includeAppKey = true,
            includeDeviceIdHeader = false,
            body = body,
            callback = callback,
        ) { jo ->
            if (!jo.optBoolean("ok", false)) {
                throw apiError(jo)
            }
            val d = jo.getString("device_id")
            val a = jo.getString("app_id")
            storage.deviceId = d
            storage.appId = a
            InitResponse(
                deviceId = d,
                appId = a,
                subscriberId =
                    when {
                        !jo.has("subscriber_id") || jo.isNull("subscriber_id") -> null
                        else -> jo.optString("subscriber_id").takeIf { it.isNotEmpty() }
                    },
                isNewInstall = jo.optBoolean("is_new_install", false),
                heartbeatIntervalSec = jo.optInt("heartbeat_interval_sec", 45),
            )
        }
    }

    /** `POST /sdk-register-device` — FCM token refresh; requires prior [init]. */
    fun registerDevice(
        fcmToken: String,
        callback: (Result<Unit>) -> Unit,
    ) {
        val did = storage.deviceId
        if (did == null) {
            deliver(callbackExecutor, callback, Result.failure(IllegalStateException("init() must succeed before registerDevice")))
            return
        }
        val body = JSONObject().apply {
            put("device_id", did)
            put("fcm_token", fcmToken)
        }
        postJson(
            path = "/sdk-register-device",
            includeAppKey = true,
            includeDeviceIdHeader = true,
            body = body,
            callback = callback,
        ) { jo ->
            if (!jo.optBoolean("ok", false)) {
                throw apiError(jo)
            }
        }
    }

    /** `POST /sdk-heartbeat` — best-effort; server may return 200 with throttled/ack flags. */
    fun heartbeat(
        sessionId: String? = null,
        appVersion: String? = null,
        countryCode: String? = null,
        callback: (Result<HeartbeatResponse>) -> Unit,
    ) {
        val aid = storage.appId
        val did = storage.deviceId
        if (aid == null || did == null) {
            deliver(callbackExecutor, callback, Result.failure(IllegalStateException("init() must succeed before heartbeat")))
            return
        }
        val body = JSONObject().apply {
            put("app_id", aid)
            put("device_id", did)
            if (sessionId != null) put("session_id", sessionId)
            if (appVersion != null) put("app_version", appVersion)
            if (countryCode != null) put("country_code", countryCode)
        }
        postJson(
            path = "/sdk-heartbeat",
            includeAppKey = false,
            includeDeviceIdHeader = true,
            body = body,
            callback = callback,
        ) { jo ->
            HeartbeatResponse(
                ok = jo.optBoolean("ok", false),
                throttled = jo.optBoolean("throttled", false),
                ack = if (jo.has("ack")) jo.getBoolean("ack") else null,
            )
        }
    }

    /** Single analytic event (buffer in-app and use [eventBatch] for fewer round-trips). */
    fun event(
        eventName: String,
        eventParams: Map<String, Any?> = emptyMap(),
        occurredAt: String? = null,
        sessionId: String? = null,
        appVersion: String? = null,
        countryCode: String? = null,
        callback: (Result<EventResponse>) -> Unit,
    ) {
        eventBatch(
            listOf(
                SdkEvent(
                    eventName = eventName,
                    eventParams = eventParams,
                    occurredAt = occurredAt,
                    sessionId = sessionId,
                    appVersion = appVersion,
                ),
            ),
            countryCode = countryCode,
            callback = callback,
        )
    }

    /** Batch events (server max 100). */
    fun eventBatch(
        events: List<SdkEvent>,
        countryCode: String? = null,
        callback: (Result<EventResponse>) -> Unit,
    ) {
        val aid = storage.appId
        val did = storage.deviceId
        if (aid == null || did == null) {
            deliver(callbackExecutor, callback, Result.failure(IllegalStateException("init() must succeed before event")))
            return
        }
        require(events.isNotEmpty()) { "at least one event required" }
        val arr = JSONArray()
        for (e in events) {
            arr.put(
                JSONObject().apply {
                    put("event_name", e.eventName)
                    if (e.eventParams.isNotEmpty()) {
                        put("event_params", jsonObject(e.eventParams))
                    }
                    if (e.occurredAt != null) put("occurred_at", e.occurredAt)
                    if (e.sessionId != null) put("session_id", e.sessionId)
                    if (e.appVersion != null) put("app_version", e.appVersion)
                },
            )
        }
        val body = JSONObject().apply {
            put("app_id", aid)
            put("device_id", did)
            put("events", arr)
            if (countryCode != null) put("country_code", countryCode)
        }
        postJson(
            path = "/sdk-event",
            includeAppKey = false,
            includeDeviceIdHeader = true,
            body = body,
            callback = callback,
        ) { jo ->
            if (!jo.optBoolean("ok", false)) {
                throw apiError(jo)
            }
            EventResponse(
                ok = true,
                accepted = jo.optInt("accepted", events.size),
                rejected = jo.optInt("rejected", 0),
            )
        }
    }

    /** `POST /push-track` — delivery / open / click attribution for a notification. */
    fun track(
        notificationId: String,
        engagement: PushEngagement,
        callback: (Result<TrackResponse>) -> Unit,
    ) {
        val did = storage.deviceId
        if (did == null) {
            deliver(callbackExecutor, callback, Result.failure(IllegalStateException("init() must succeed before track")))
            return
        }
        val body = JSONObject().apply {
            put("notification_id", notificationId)
            put("device_id", did)
            put("event", engagement.wireValue)
        }
        postJson(
            path = "/push-track",
            includeAppKey = false,
            includeDeviceIdHeader = true,
            body = body,
            callback = callback,
        ) { jo ->
            TrackResponse(
                ok = jo.optBoolean("ok", false),
                throttled = jo.optBoolean("throttled", false),
                ack = if (jo.has("ack")) jo.getBoolean("ack") else null,
            )
        }
    }

    private fun <T> postJson(
        path: String,
        includeAppKey: Boolean,
        includeDeviceIdHeader: Boolean,
        body: JSONObject,
        callback: (Result<T>) -> Unit,
        parse: (JSONObject) -> T,
    ) {
        val url = "$root$path"
        val builder = Request.Builder()
            .url(url)
            .post(body.toString().toRequestBody(JSON_MEDIA))
            .header("Content-Type", "application/json")
        if (includeAppKey) {
            builder.header("X-PC-App-Key", appKey)
        }
        if (includeDeviceIdHeader) {
            val did = storage.deviceId
            if (did != null) {
                builder.header("X-PC-Device-ID", did)
            }
        }
        http.newCall(builder.build()).enqueue(
            object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    deliver(callbackExecutor, callback, Result.failure(e))
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use { resp ->
                        val text = resp.body?.string().orEmpty()
                        try {
                            val jo = JSONObject(text)
                            if (!resp.isSuccessful) {
                                val err = apiErrorOrNull(jo)
                                deliver(
                                    callbackExecutor,
                                    callback,
                                    if (err != null) {
                                        Result.failure(err)
                                    } else {
                                        Result.failure(ApkzioHttpException(resp.code, text))
                                    },
                                )
                                return
                            }
                            val value = parse(jo)
                            deliver(callbackExecutor, callback, Result.success(value))
                        } catch (e: Exception) {
                            deliver(callbackExecutor, callback, Result.failure(e))
                        }
                    }
                }
            },
        )
    }

    private companion object {
        private val APP_KEY = Regex("^pk_[a-f0-9]{48}$")

        private fun apiError(jo: JSONObject): Throwable =
            apiErrorOrNull(jo) ?: ApkzioApiException("unknown", jo.toString())

        private fun apiErrorOrNull(jo: JSONObject): ApkzioApiException? {
            if (jo.optBoolean("ok", true)) return null
            val err = jo.optJSONObject("error") ?: return ApkzioApiException("error", jo.toString())
            val code = err.optString("code", "unknown")
            val msg = err.optString("message", code)
            return ApkzioApiException(code, msg)
        }

        private fun jsonObject(map: Map<String, Any?>): JSONObject {
            val o = JSONObject()
            for ((k, v) in map) {
                o.put(k, jsonValue(v))
            }
            return o
        }

        private fun jsonValue(v: Any?): Any? =
            when (v) {
                null -> JSONObject.NULL
                is JSONObject, is JSONArray -> v
                is Map<*, *> -> jsonObject(
                    v.entries.associate { (a, b) ->
                        require(a is String) { "JSON object keys must be strings" }
                        @Suppress("UNCHECKED_CAST")
                        a to (b as Any?)
                    },
                )
                is Iterable<*> -> JSONArray().also { arr ->
                    for (item in v) {
                        arr.put(jsonValue(item))
                    }
                }
                is Boolean, is Int, is Long, is Double, is Float, is String -> v
                else -> v.toString()
            }

        private fun <T> deliver(
            executor: Executor?,
            callback: (Result<T>) -> Unit,
            result: Result<T>,
        ) {
            if (executor != null) {
                executor.execute { callback(result) }
            } else {
                callback(result)
            }
        }
    }
}

/** Shorthand for [ApkzioClient] (same class). */
typealias Apkzio = ApkzioClient
