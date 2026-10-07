package com.anonymous.Volume_slider_tile

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.media.AudioManager
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView

class VolumeSliderActivity : Activity() {

    private lateinit var audioManager: AudioManager
    private lateinit var valueText: TextView
    private lateinit var seekBar: SeekBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        audioManager = getSystemService(AudioManager::class.java)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#101827"))
            setPadding(28, 22, 28, 22)
        }

        val title = TextView(this).apply {
            text = "Volume Control"
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 12)
        }

        valueText = TextView(this).apply {
            text = "$currentVolume / $maxVolume"
            setTextColor(Color.parseColor("#BFDBFE"))
            textSize = 16f
            setPadding(0, 0, 0, 12)
        }

        seekBar = SeekBar(this).apply {
            max = maxVolume
            progress = currentVolume
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    valueText.text = "$progress / $maxVolume"
                    if (fromUser) {
                        audioManager.setStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            progress,
                            AudioManager.FLAG_SHOW_UI
                        )
                    }
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        }

        container.addView(title)
        container.addView(valueText)
        container.addView(seekBar)
        setContentView(container)

        val displayWidth = resources.displayMetrics.widthPixels
        val width = (displayWidth * 0.88f).toInt()
        window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)
        window.setGravity(Gravity.CENTER)
    }
}
