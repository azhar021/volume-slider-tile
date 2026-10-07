package com.anonymous.Volume_slider_tile

import android.content.Intent
import android.media.AudioManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VolumeTileModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getVolumeStatus(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(AudioManager::class.java)
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)

            val map = Arguments.createMap().apply {
                putInt("max", max)
                putInt("current", current)
                putString("summary", "Volume is $current of $max")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_VOLUME_STATUS_FAILED", e.message ?: "Unable to read volume state.", e)
        }
    }

    @ReactMethod
    fun setVolume(level: Int, promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(AudioManager::class.java)
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val safeLevel = level.coerceIn(0, max)

            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, safeLevel, AudioManager.FLAG_SHOW_UI)
            promise.resolve("Volume updated to $safeLevel of $max")
        } catch (e: Exception) {
            promise.reject("SET_VOLUME_FAILED", e.message ?: "Unable to update volume.", e)
        }
    }

    @ReactMethod
    fun openVolumePopup(promise: Promise) {
        try {
            val activity = reactContext.currentActivity ?: run {
                promise.reject("OPEN_VOLUME_POPUP_FAILED", "No active Android activity was found.")
                return
            }

            val intent = Intent(activity, VolumeSliderActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            promise.resolve("Volume popup opened.")
        } catch (e: Exception) {
            promise.reject("OPEN_VOLUME_POPUP_FAILED", e.message ?: "Unable to open volume popup.", e)
        }
    }

    companion object {
        const val NAME = "VolumeTileModule"
    }
}
