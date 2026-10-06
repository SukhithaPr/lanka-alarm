package expo.modules.fullscreenalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "arrival_fullscreen"
private const val CHANNEL_ID_SOUND = "arrival_fullscreen_sound"
private const val NOTIFICATION_ID = 7421

// One siren per process, shared across module instances (the background task and the UI may differ).
private object Siren {
  var player: MediaPlayer? = null
  var savedVolume: Int? = null
}

class FullScreenAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("FullScreenAlarm")

    // Posts a notification whose full-screen intent opens the app over the lock screen.
    // withSound: also play the system alarm ringtone from the notification (fallback when JS audio fails).
    Function("show") { title: String, body: String, withSound: Boolean ->
      show(title, body, withSound)
    }

    // Loops the system alarm tone on the ALARM stream at full volume, so it ignores the media
    // volume. Returns false if it could not start, so JS can fall back to another player.
    Function("startSiren") {
      startSiren()
    }

    Function("stopSiren") {
      stopSiren()
    }

    Function("cancel") {
      manager.cancel(NOTIFICATION_ID)
    }

    // Android 14+ can revoke full-screen intents. Older versions always allow them.
    Function("canUseFullScreenIntent") {
      Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      val intent = Intent(
        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }

  private fun startSiren(): Boolean {
    stopSiren()
    return try {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      try {
        Siren.savedVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
        audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
      } catch (_: SecurityException) {
        // Some Do Not Disturb setups block volume changes. Play at the current alarm volume instead.
        Siren.savedVolume = null
      }
      val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      Siren.player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(context, uri)
        isLooping = true
        prepare()
        start()
      }
      true
    } catch (e: Exception) {
      stopSiren()
      false
    }
  }

  private fun stopSiren() {
    Siren.player?.let {
      try { it.stop() } catch (_: IllegalStateException) {}
      it.release()
    }
    Siren.player = null
    Siren.savedVolume?.let {
      try {
        (context.getSystemService(Context.AUDIO_SERVICE) as AudioManager).setStreamVolume(AudioManager.STREAM_ALARM, it, 0)
      } catch (_: SecurityException) {}
    }
    Siren.savedVolume = null
  }

  private fun ensureChannel(withSound: Boolean): String {
    val id = if (withSound) CHANNEL_ID_SOUND else CHANNEL_ID
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(id) == null) {
      val channel = NotificationChannel(id, "Arrival alarm (full screen)", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Wakes you when you are near your destination"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 400, 800)
        setBypassDnd(true)
        if (withSound) {
          setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
        } else {
          setSound(null, null)
        }
      }
      manager.createNotificationChannel(channel)
    }
    return id
  }

  private fun show(title: String, body: String, withSound: Boolean) {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val pending = PendingIntent.getActivity(
      context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(context, ensureChannel(withSound))
    } else {
      @Suppress("DEPRECATION") Notification.Builder(context).setPriority(Notification.PRIORITY_MAX)
    }

    val notification = builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(pending)
      .setFullScreenIntent(pending, true)
      .build()

    manager.notify(NOTIFICATION_ID, notification)
  }
}
