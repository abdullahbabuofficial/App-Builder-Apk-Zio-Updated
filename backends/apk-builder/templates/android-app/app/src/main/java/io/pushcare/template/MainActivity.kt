package __PUSHCARE_PACKAGE_NAME__

import android.app.Activity
import android.os.Bundle

class MainActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Boot the PushCare SDK on first launch (post-version-bump). The init
    // call is idempotent and gated by a SharedPref sentinel.
    PushCareInit.boot(this)
  }
}
