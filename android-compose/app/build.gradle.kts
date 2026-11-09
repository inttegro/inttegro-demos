plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val demoBackendUrl = providers.gradleProperty("inttegroDemoBackendUrl")
    .orElse(providers.environmentVariable("INTTEGRO_DEMO_BACKEND_URL"))
    .orElse("")
    .get()
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

val screenshotMode = providers.gradleProperty("inttegroScreenshotMode")
    .orElse(providers.environmentVariable("INTTEGRO_SCREENSHOT_MODE"))
    .orElse("false")
    .get()
    .toBoolean()

val screenshotFeatures = providers.gradleProperty("inttegroScreenshotFeatures")
    .orElse(providers.environmentVariable("INTTEGRO_SCREENSHOT_FEATURES"))
    .orElse("false")
    .get()
    .toBoolean()

android {
    namespace = "com.inttegro.demo.compose"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.inttegro.demo.compose"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "INTTEGRO_DEMO_BACKEND_URL", "\"$demoBackendUrl\"")
        buildConfigField("boolean", "INTTEGRO_SCREENSHOT_MODE", screenshotMode.toString())
        buildConfigField("boolean", "INTTEGRO_SCREENSHOT_FEATURES", screenshotFeatures.toString())
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":inttegro"))
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
