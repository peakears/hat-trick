package io.github.peakears.hattrick.backgroundwait

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Waits for the live score service (#137). React Native's JS timers only fire while the app is in front (they run on
 * screen frames), so a `setTimeout` in the service never ends once the user leaves the app. A Handler on the main
 * looper keeps running in the background, and the wake lock keeps the processor from sleeping between checks.
 */
class BackgroundWaitModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null

  override fun definition() = ModuleDefinition {
    Name("BackgroundWait")

    /** Resolves after `ms`, whether or not the app is in front or the screen is on. */
    AsyncFunction("sleep") { ms: Double, promise: Promise ->
      handler.postDelayed({ promise.resolve(null) }, ms.toLong().coerceAtLeast(0))
    }

    /**
     * Holds a partial wake lock for at most `timeoutMs`. Calling again restarts the timeout, so the loop renews it
     * each check and a crashed loop lets it lapse on its own.
     */
    Function("keepAwake") { timeoutMs: Double ->
      val lock = wakeLock ?: newWakeLock()?.also { wakeLock = it } ?: return@Function
      lock.acquire(timeoutMs.toLong().coerceAtLeast(1))
    }

    Function("allowSleep") { release() }

    OnDestroy { release() }
  }

  private fun newWakeLock(): PowerManager.WakeLock? {
    val power = appContext.reactContext?.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return null
    return power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hattrick:live-scores").apply {
      setReferenceCounted(false)
    }
  }

  private fun release() {
    wakeLock?.let { if (it.isHeld) it.release() }
  }
}
