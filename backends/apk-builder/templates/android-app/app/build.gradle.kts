plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "__PUSHCARE_PACKAGE_NAME__"
  compileSdk = 34
  defaultConfig {
    applicationId = "__PUSHCARE_PACKAGE_NAME__"
    minSdk = 24
    targetSdk = 34
    versionCode = __PUSHCARE_VERSION_CODE__
    versionName = "__PUSHCARE_VERSION_NAME__"
    buildConfigField("String", "PUSHCARE_APP_KEY", "\"__PUSHCARE_APP_KEY__\"")
    buildConfigField("String", "PUSHCARE_API_BASE", "\"__PUSHCARE_API_BASE__\"")
  }
  buildFeatures { buildConfig = true }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }

  signingConfigs {
    create("release") {
      val ks = file("../keystores/release.jks")
      if (ks.exists()) {
        storeFile = ks
        storePassword = System.getenv("PUSHCARE_KEYSTORE_PASSWORD") ?: ""
        keyAlias = System.getenv("PUSHCARE_KEY_ALIAS") ?: "release"
        keyPassword = System.getenv("PUSHCARE_KEY_PASSWORD") ?: ""
      }
    }
  }
  buildTypes {
    release {
      signingConfig = signingConfigs.findByName("release")
      isMinifyEnabled = false
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.firebase:firebase-messaging:24.0.0")
}
