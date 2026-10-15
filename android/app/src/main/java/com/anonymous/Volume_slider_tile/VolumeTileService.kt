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
import android.os.SystemClock
import android.service.quicksettings.TileService
import android.view.View
import android.view.Window
import android.view.WindowManager

/**
 * Opens the system volume HUD from Quick Settings.
 *
 * Android 17 (Pixel) drops FLAG_SHOW_UI while a TYPE_QS_DIALOG is still attached or while
 * the shade is collapsing. The reliable pattern is:
 * 1. showDialog() — collapses the shade (no tile-expand animation)
 * 2. dismiss the dialog immediately — clears SystemUI's "showing dialog" flag
 * 3. only then request the volume HUD, with a few retries
 *
 * System/custom ROM volume tiles use [AudioManager.adjustVolume], not adjustStreamVolume.
 */
class VolumeTileService : TileService() {

    private val handler = Handler(Looper.getMainLooper())
    private var lastClickElapsed = 0L

    override fun onClick() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastClickElapsed < CLICK_DEBOUNCE_MS) {
            return
        }
        lastClickElapsed = now

        handler.removeCallbacksAndMessages(null)

        if (isLocked) {
            launchTrampolineActivity()
            return
        }

        try {
            collapseShadeThenShowVolume()
        } catch (_: RuntimeException) {
            requestVolumeHud()
        }
    }

    private fun collapseShadeThenShowVolume() {
        val dialog = Dialog(this, android.R.style.Theme_Translucent_NoTitleBar)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(View(this))
        dialog.setCancelable(false)
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

        // Collapse shade via showDialog, then dismiss so SystemUI clears setShowingDialog(true).
        // Volume HUD is blocked on Android 17 while that flag is still set.
        dialog.setOnShowListener {
            handler.post { if (dialog.isShowing) dialog.dismiss() }
        }
        dialog.setOnDismissListener {
            scheduleVolumeRequests()
        }

        showDialog(dialog)
    }

    private fun scheduleVolumeRequests() {
        // Shade collapse animation continues after dialog hide; request at several points.
        VOLUME_REQUEST_DELAYS_MS.forEach { delay ->
            handler.postDelayed({ requestVolumeHud() }, delay)
        }
    }

    private fun requestVolumeHud() {
        val audioManager = getSystemService(AudioManager::class.java)
        // Prefer adjustVolume — same API used by Lineage/AICP system volume tiles.
        audioManager.adjustVolume(AudioManager.ADJUST_SAME, AudioManager.FLAG_SHOW_UI)
    }

    private fun launchTrampolineActivity() {
        val intent = Intent(this, ShowVolumeActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_NO_ANIMATION,
            )
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                REQUEST_CODE_SHOW_VOLUME,
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
        const val CLICK_DEBOUNCE_MS = 400L
        const val REQUEST_CODE_SHOW_VOLUME = 1001
        val VOLUME_REQUEST_DELAYS_MS = longArrayOf(80L, 220L, 450L, 750L)
    }
}
