package __PUSHCARE_PACKAGE_NAME__

import android.provider.Settings
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

// Receives FCM messages and reports a `delivered` event back to PushCare so
// the dashboard's delivery funnel matches reality. If the payload doesn't
// carry a pc_notification_id we just log and return — those messages were
// not sent through PushCare.
class PushCareMessagingService : FirebaseMessagingService() {

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    Log.i(TAG, "fcm_received keys=${data.keys}")

    val notificationId = data["pc_notification_id"] ?: return
    val androidId = Settings.Secure.getString(
      contentResolver, Settings.Secure.ANDROID_ID,
    ) ?: ""

    thread(start = true, isDaemon = true, name = "pushcare-track") {
      try {
        track(notificationId, androidId)
      } catch (t: Throwable) {
        Log.w(TAG, "track_failed", t)
      }
    }
  }

  private fun track(notificationId: String, deviceId: String) {
    val payload = JSONObject().apply {
      put("notification_id", notificationId)
      put("device_id", deviceId)
      put("event", "delivered")
    }.toString().toByteArray(Charsets.UTF_8)

    val url = URL("${BuildConfig.PUSHCARE_API_BASE}/push/track")
    val conn = url.openConnection() as HttpURLConnection
    try {
      conn.requestMethod = "POST"
      conn.setRequestProperty("content-type", "application/json")
      conn.setRequestProperty("x-pc-app-key", BuildConfig.PUSHCARE_APP_KEY)
      conn.doOutput = true
      conn.connectTimeout = 5_000
      conn.readTimeout = 5_000
      conn.outputStream.use { it.write(payload) }
      conn.inputStream.use { it.readBytes() }
    } finally {
      conn.disconnect()
    }
  }

  companion object { private const val TAG = "PushCare" }
}
