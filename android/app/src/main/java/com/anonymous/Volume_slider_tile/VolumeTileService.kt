package com.anonymous.Volume_slider_tile

import android.content.Intent
import android.service.quicksettings.TileService

class VolumeTileService : TileService() {
    override fun onClick() {
        val intent = Intent(this, VolumeSliderActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivityAndCollapse(intent)
    }
}
