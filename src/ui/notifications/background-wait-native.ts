// The only code that calls the app's own BackgroundWait native module (modules/background-wait, #137): a wait and a
// wake lock for the live score service. Android only; in Expo Go (no such module) and on iOS every call is a no-op
// and `backgroundSleep` returns undefined, so live-wait.ts falls back to a timer.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

interface BackgroundWait {
  sleep(ms: number): Promise<void>;
  keepAwake(timeoutMs: number): void;
  allowSleep(): void;
}

let found: BackgroundWait | undefined;

/** Looked up on first use, never at startup; only a positive answer is kept. */
function native(): BackgroundWait | undefined {
  if (!found && Platform.OS === "android")
    found = requireOptionalNativeModule<BackgroundWait>("BackgroundWait") ?? undefined;
  return found;
}

/** Waits `ms` in native code, so the wait ends with the app in the background or the screen off. */
export function backgroundSleep(ms: number): Promise<void> | undefined {
  return native()?.sleep(ms);
}

/** Keeps the processor awake for at most `timeoutMs`; call again to renew. */
export function keepAwake(timeoutMs: number): void {
  try {
    native()?.keepAwake(timeoutMs);
  } catch {
    // Without the lock the loop still runs, only slower with the screen off.
  }
}

export function allowSleep(): void {
  try {
    native()?.allowSleep();
  } catch {
    // Nothing held.
  }
}
