package com.apkzio.sdk

/** Persisted SDK state (install-scoped). */
interface ApkzioStorage {
    var deviceId: String?
    var appId: String?
}
