package com.apkzio.sdk

/** Successful response from [ApkzioClient.init]. */
data class InitResponse(
    val deviceId: String,
    val appId: String,
    val subscriberId: String?,
    val isNewInstall: Boolean,
    val heartbeatIntervalSec: Int,
)

data class HeartbeatResponse(
    val ok: Boolean,
    val throttled: Boolean,
    val ack: Boolean?,
)

data class EventResponse(
    val ok: Boolean,
    val accepted: Int,
    val rejected: Int,
)

data class TrackResponse(
    val ok: Boolean,
    val throttled: Boolean,
    val ack: Boolean?,
)

/** One row in an [ApkzioClient.event] batch (max 100 per request on server). */
data class SdkEvent(
    val eventName: String,
    val eventParams: Map<String, Any?> = emptyMap(),
    val occurredAt: String? = null,
    val sessionId: String? = null,
    val appVersion: String? = null,
)

enum class PushEngagement {
    DELIVERED,
    OPENED,
    CLICKED,
    ;

    internal val wireValue: String
        get() = name.lowercase()
}

class ApkzioApiException(
    val code: String,
    message: String,
) : Exception(message)

class ApkzioHttpException(
    val httpCode: Int,
    val body: String,
) : Exception("HTTP $httpCode: $body")
