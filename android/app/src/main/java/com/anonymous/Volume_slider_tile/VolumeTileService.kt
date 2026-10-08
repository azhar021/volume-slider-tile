package com.anonymous.Volume_slider_tile

import android.content.Context
import android.media.AudioManager
import android.service.quicksettings.TileService

class VolumeTileService : TileService() {
    override fun onClick() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            AudioManager.ADJUST_SAME,
            AudioManager.FLAG_SHOW_UI
        )
    }
}
