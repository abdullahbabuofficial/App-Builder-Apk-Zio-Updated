import org.gradle.api.publish.maven.tasks.PublishToMavenRepository

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("maven-publish")
}

android {
    namespace = "com.apkzio.sdk"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    api("com.squareup.okhttp3:okhttp:4.12.0")
}

// Optional publishing (opt-in; no credentials required by default).
val enablePublishing = System.getenv("MAVEN_PUBLISH")?.toBoolean() == true
val enableLocalPublish = System.getenv("PUBLISH_LOCAL")?.toBoolean() == true

if (enablePublishing && enableLocalPublish) {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                groupId = "com.apkzio"
                artifactId = "sdk"
                version = "0.1.0"
            }
        }
        repositories {
            // Local-only target; override `url` for dev repos if needed.
            maven {
                name = "apkzioLocal"
                url = uri(layout.buildDirectory.dir("repo"))
            }
        }
    }
}

// Keep assemble working by disabling publish tasks unless explicitly opted in.
tasks.withType<PublishToMavenRepository>().configureEach {
    enabled = enablePublishing && enableLocalPublish
}
