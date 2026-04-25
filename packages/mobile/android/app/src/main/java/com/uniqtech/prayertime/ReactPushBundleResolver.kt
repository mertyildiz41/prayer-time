package com.uniqtech.prayertime

import android.content.Context
import android.util.Log
import java.io.File

object ReactPushBundleResolver {
  private const val TAG = "ReactPush"
  private const val BUNDLE_PATH_FILE = "ReactPushBundlePath.txt"

  fun getJsBundlePath(context: Context): String? {
    return try {
      val bundlePathFile = File(context.filesDir, BUNDLE_PATH_FILE)
      if (!bundlePathFile.exists()) {
        null
      } else {
        val bundlePath = bundlePathFile.readText(Charsets.UTF_8).trim()
        if (bundlePath.isEmpty()) {
          null
        } else {
          val bundleFile = File(bundlePath)
          if (bundleFile.exists()) {
            bundlePath
          } else {
            Log.w(TAG, "Bundle file not found at path: $bundlePath")
            null
          }
        }
      }
    } catch (error: Exception) {
      Log.e(TAG, "Failed to read downloaded bundle path", error)
      null
    }
  }
}
