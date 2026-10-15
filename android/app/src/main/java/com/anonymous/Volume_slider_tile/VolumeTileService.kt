package com.anonymous.Volume_slider_tile

import android.app.Dialog
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.TileService
import android.view.View
import android.view.Window
import android.view.WindowManager

class VolumeTileService : TileService() {

    private val handler = Handler(Looper.getMainLooper())

    override fun onClick() {
        if (isLocked) {
            launchTrampolineActivity()
            return
        }

        try {
            showDialog(VolumeTriggerDialog(this))
        } catch (_: RuntimeException) {
            showVolumePanel()
        }
    }

    private fun showVolumePanel() {
        getSystemService(AudioManager::class.java).adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_SAME,
            AudioManager.FLAG_SHOW_UI,
        )
    }

    /**
     * Invisible 1x1 dialog. Tile dialogs collapse the shade without the tile-to-activity
     * launch animation, and the dialog only gains window focus once the shade is gone —
     * SystemUI drops volume UI requests made while the shade is still visible.
     */
    private inner class VolumeTriggerDialog(context: Context) :
        Dialog(context, android.R.style.Theme_Translucent_NoTitleBar) {

        private var shownCount = 0

        init {
            requestWindowFeature(Window.FEATURE_NO_TITLE)
            setContentView(View(context))
            window?.apply {
                setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
                clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
                addFlags(
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                )
                setWindowAnimations(0)
                setLayout(1, 1)
            }
            setOnShowListener {
                handler.postDelayed({ trigger() }, FALLBACK_DELAY_MS)
            }
        }

        override fun onWindowFocusChanged(hasFocus: Boolean) {
            super.onWindowFocusChanged(hasFocus)
            if (hasFocus && shownCount == 0) {
                handler.postDelayed({ trigger() }, FOCUS_SETTLE_DELAY_MS)
            }
        }

        private fun trigger() {
            if (shownCount > 0 || !isShowing) {
                return
            }
            shownCount = 1
            showVolumePanel()

            // Second request covers the case where the first one landed during the
            // tail of the shade animation and was dropped.
            handler.postDelayed({
                if (isShowing) {
                    showVolumePanel()
                }
                handler.postDelayed({ if (isShowing) dismiss() }, DISMISS_DELAY_MS)
            }, RETRY_DELAY_MS)
        }
    }

    private fun launchTrampolineActivity() {
        val intent = Intent(this, ShowVolumeActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private companion object {
        const val FOCUS_SETTLE_DELAY_MS = 80L
        const val FALLBACK_DELAY_MS = 700L
        const val RETRY_DELAY_MS = 350L
        const val DISMISS_DELAY_MS = 150L
    }
}
