package com.uniqtech.prayertime

import com.wix.reactnativenotifications.fcm.IFcmToken

/**
 * react-native-notifications still tries to bridge FCM token events through ReactInstanceManager
 * on Android, which crashes on modern React Native. This app only uses local scheduled
 * notifications on Android, so token callbacks can be safely ignored.
 */
object AndroidNoopFcmToken : IFcmToken {
  override fun onNewTokenReady() = Unit

  override fun onAppReady() = Unit

  override fun onManualRefresh() = Unit
}
