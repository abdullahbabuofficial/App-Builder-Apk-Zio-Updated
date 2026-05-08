package com.apkzio.sdk

import android.content.Context
import android.content.SharedPreferences

/**
 * Default [ApkzioStorage] backed by [SharedPreferences].
 *
 * @param prefsName Use distinct names if multiple apps embed the SDK in one process.
 */
class SharedPreferencesApkzioStorage(
    context: Context,
    private val prefsName: String = "apkzio_sdk",
) : ApkzioStorage {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

    override var deviceId: String?
        get() = prefs.getString(KEY_DEVICE, null)
        set(value) {
            prefs.edit().putString(KEY_DEVICE, value).apply()
        }

    override var appId: String?
        get() = prefs.getString(KEY_APP, null)
        set(value) {
            prefs.edit().putString(KEY_APP, value).apply()
        }

    private companion object {
        const val KEY_DEVICE = "apkzio_device_id"
        const val KEY_APP = "apkzio_app_id"
    }
}
