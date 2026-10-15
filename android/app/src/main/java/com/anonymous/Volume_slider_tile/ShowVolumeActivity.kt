package com.anonymous.Volume_slider_tile

import android.app.Activity
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Invisible trampoline used when the tile is tapped on the lock screen
 * (TileService dialogs are not allowed while locked).
 */
class ShowVolumeActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private var requestCount = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        overridePendingTransition(0, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
        }
    }

    override fun onResume() {
        super.onResume()
        requestCount = 0
        REQUEST_DELAYS_MS.forEach { delay ->
            handler.postDelayed({ requestVolumeHud() }, delay)
        }
        handler.postDelayed({ if (!isFinishing) finish() }, FINISH_DELAY_MS)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            requestVolumeHud()
        }
    }

    private fun requestVolumeHud() {
        if (isFinishing) {
            return
        }
        requestCount += 1
        getSystemService(AudioManager::class.java)
            .adjustVolume(AudioManager.ADJUST_SAME, AudioManager.FLAG_SHOW_UI)
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(0, 0)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private companion object {
        val REQUEST_DELAYS_MS = longArrayOf(50L, 180L, 400L, 700L)
        const val FINISH_DELAY_MS = 900L
    }
}
