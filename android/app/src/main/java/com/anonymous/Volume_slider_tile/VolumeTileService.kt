package com.anonymous.Volume_slider_tile

import android.app.Dialog
import android.app.PendingIntent
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
            showDialog(buildInvisibleDialog())
        } catch (_: RuntimeException) {
            showVolumePanel()
        }
    }

    // Tile dialogs collapse the shade without the tile-to-activity launch animation.
    private fun buildInvisibleDialog(): Dialog {
        val dialog = Dialog(this, android.R.style.Theme_Translucent_NoTitleBar)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(View(this))
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            addFlags(
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            )
            setWindowAnimations(0)
            setLayout(1, 1)
        }
        dialog.setOnShowListener {
            handler.postDelayed({
                showVolumePanel()
                handler.postDelayed({
                    if (dialog.isShowing) {
                        dialog.dismiss()
                    }
                }, DISMISS_DELAY_MS)
            }, SHADE_SETTLE_DELAY_MS)
        }
        return dialog
    }

    private fun showVolumePanel() {
        getSystemService(AudioManager::class.java).adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_SAME,
            AudioManager.FLAG_SHOW_UI,
        )
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
        const val SHADE_SETTLE_DELAY_MS = 250L
        const val DISMISS_DELAY_MS = 200L
    }
}
