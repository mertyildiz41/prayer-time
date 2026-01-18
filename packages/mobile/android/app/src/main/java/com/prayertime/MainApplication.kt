package com.prayertime

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      applicationContext,
      PackageList(this).packages,
      jsMainModulePath = "index",
      isHermesEnabled = BuildConfig.IS_HERMES_ENABLED,
      useDevSupport = BuildConfig.DEBUG
    )
  }

  override val reactNativeHost: ReactNativeHost by lazy {
    // This is deprecated but required by ReactApplication interface
    // The actual implementation uses ReactHost above
    null as? ReactNativeHost ?: throw UnsupportedOperationException("Use reactHost instead")
  }

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.DEBUG) {
      load()
    }
    loadReactNative(this)
  }
}
