package com.anonymous.Volume_slider_tile

import android.app.Activity
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Invisible trampoline that shows the system media volume panel once the
 * Quick Settings shade has fully collapsed, then finishes itself.
 */
class ShowVolumeActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())
    private var shown = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
        }
    }

    override fun onResume() {
        super.onResume()
        handler.postDelayed({ showVolumePanel() }, FALLBACK_DELAY_MS)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            handler.postDelayed({ showVolumePanel() }, SHADE_SETTLE_DELAY_MS)
        }
    }

    private fun showVolumePanel() {
        if (shown || isFinishing) {
            return
        }
        shown = true

        getSystemService(AudioManager::class.java).adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_SAME,
            AudioManager.FLAG_SHOW_UI,
        )
        handler.postDelayed({ finish() }, FINISH_DELAY_MS)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private companion object {
        const val SHADE_SETTLE_DELAY_MS = 120L
        const val FALLBACK_DELAY_MS = 600L
        const val FINISH_DELAY_MS = 250L
    }
}
