package __PUSHCARE_PACKAGE_NAME__

import android.content.Context
import android.provider.Settings
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

// Single-file PushCare SDK shim. The full SDK lives in a separate module
// in production; this is the minimum viable boot path that the apk-builder
// templates into a tenant app: post device + token to /sdk/init exactly
// once per version_code, then forget.
object PushCareInit {
  private const val PREF_NAME = "pushcare_sdk"
  private const val KEY_INITED = "inited_for_vc"

  fun boot(ctx: Context) {
    val prefs = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    val current = BuildConfig.VERSION_CODE
    if (prefs.getInt(KEY_INITED, 0) == current) return

    val androidId = Settings.Secure.getString(
      ctx.contentResolver, Settings.Secure.ANDROID_ID,
    ) ?: ""

    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
      val token = if (task.isSuccessful) task.result ?: "" else ""
      thread(start = true, isDaemon = true, name = "pushcare-init") {
        try {
          postInit(androidId, token)
          prefs.edit().putInt(KEY_INITED, current).apply()
        } catch (_: Throwable) {
          // Swallow — next launch retries until success.
        }
      }
    }
  }

  private fun postInit(androidId: String, fcmToken: String) {
    val payload = JSONObject().apply {
      put("android_id", androidId)
      put("fcm_token", fcmToken)
      put("app_key", BuildConfig.PUSHCARE_APP_KEY)
    }.toString().toByteArray(Charsets.UTF_8)

    val url = URL("${BuildConfig.PUSHCARE_API_BASE}/sdk/init")
    val conn = url.openConnection() as HttpURLConnection
    try {
      conn.requestMethod = "POST"
      conn.setRequestProperty("content-type", "application/json")
      conn.setRequestProperty("x-pc-app-key", BuildConfig.PUSHCARE_APP_KEY)
      conn.doOutput = true
      conn.connectTimeout = 8_000
      conn.readTimeout = 8_000
      conn.outputStream.use { it.write(payload) }
      conn.inputStream.use { it.readBytes() }
    } finally {
      conn.disconnect()
    }
  }
}
