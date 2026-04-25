package com.uniqtech.prayertime

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.wix.reactnativenotifications.fcm.IFcmToken
import com.wix.reactnativenotifications.fcm.INotificationsFcmApplication

class MainApplication : Application(), ReactApplication, INotificationsFcmApplication {
  override val reactNativeHost: ReactNativeHost by lazy {
    object : DefaultReactNativeHost(this) {
      override fun getPackages(): List<ReactPackage> = PackageList(this).packages

      override fun getJSMainModuleName(): String = "index"

      override fun getJSBundleFile(): String? {
        if (BuildConfig.DEBUG) {
          return super.getJSBundleFile()
        }

        val downloadedBundlePath = ReactPushBundleResolver.getJsBundlePath(applicationContext)
        if (downloadedBundlePath != null) {
          Log.d("ReactPush", "Loading downloaded bundle from: $downloadedBundlePath")
          return downloadedBundlePath
        }

        return super.getJSBundleFile()
      }

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
  }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(applicationContext, reactNativeHost)
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }

  override fun getFcmToken(context: android.content.Context): IFcmToken = AndroidNoopFcmToken
}
