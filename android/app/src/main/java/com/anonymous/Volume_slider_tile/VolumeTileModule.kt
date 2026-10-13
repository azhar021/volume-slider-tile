package com.anonymous.Volume_slider_tile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class VolumeTileModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager: AudioManager =
        reactContext.getSystemService(AudioManager::class.java)

    private var lastEmitted = -1
    private var receiverRegistered = false

    private val volumeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            emitVolume()
        }
    }

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        if (!receiverRegistered) {
            ContextCompat.registerReceiver(
                reactContext,
                volumeReceiver,
                IntentFilter(VOLUME_CHANGED_ACTION),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            receiverRegistered = true
        }
    }

    override fun invalidate() {
        if (receiverRegistered) {
            try {
                reactContext.unregisterReceiver(volumeReceiver)
            } catch (_: IllegalArgumentException) {
            }
            receiverRegistered = false
        }
        super.invalidate()
    }

    private fun emitVolume() {
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        if (current == lastEmitted || !reactContext.hasActiveReactInstance()) {
            return
        }
        lastEmitted = current

        val payload = Arguments.createMap().apply {
            putInt("current", current)
            putInt("max", audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC))
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_VOLUME_CHANGED, payload)
    }

    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    @ReactMethod
    fun getVolumeStatus(promise: Promise) {
        try {
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            lastEmitted = current

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
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val safeLevel = level.coerceIn(0, max)

            lastEmitted = safeLevel
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, safeLevel, AudioManager.FLAG_SHOW_UI)
            promise.resolve("Volume updated to $safeLevel of $max")
        } catch (e: Exception) {
            promise.reject("SET_VOLUME_FAILED", e.message ?: "Unable to update volume.", e)
        }
    }

    @ReactMethod
    fun openVolumePopup(promise: Promise) {
        try {
            val intent = Intent(reactContext, ShowVolumeActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            }
            reactContext.startActivity(intent)
            promise.resolve("Volume popup opened.")
        } catch (e: Exception) {
            promise.reject("OPEN_VOLUME_POPUP_FAILED", e.message ?: "Unable to open volume popup.", e)
        }
    }

    companion object {
        const val NAME = "VolumeTileModule"
        const val EVENT_VOLUME_CHANGED = "volumeChanged"

        // Hidden AudioManager broadcast; sent by the system whenever any stream volume changes.
        private const val VOLUME_CHANGED_ACTION = "android.media.VOLUME_CHANGED_ACTION"
    }
}
