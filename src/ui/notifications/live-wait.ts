// The live score loop's wait between checks (#137), pure. React Native's JS timers only fire while the app is in
// front, so in the background the wait has to come from native code (background-wait-native.ts); a timer is the
// fallback where that is missing (Expo Go, iOS) or fails.

/** How long one wake lock renewal lasts: a check plus the wait after it, with room to spare. */
export const KEEP_AWAKE_MS = 120_000;

export interface WaitPorts {
  /** A wait that keeps running in the background, or undefined where there is none. */
  nativeSleep: (ms: number) => Promise<void> | undefined;
  setTimer: (done: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
}

export interface Waiter {
  /** Waits `ms`, or less if `wake()` is called. */
  sleep(ms: number): Promise<void>;
  /** Ends the current wait now (the Stop button). */
  wake(): void;
}

export function createWaiter(ports: WaitPorts): Waiter {
  let wake: (() => void) | undefined;
  return {
    sleep(ms) {
      return new Promise((resolve) => {
        let timer: unknown;
        const done = () => {
          if (wake !== done) return; // already ended (woken, or the other source fired first)
          wake = undefined;
          if (timer !== undefined) ports.clearTimer(timer);
          resolve();
        };
        wake = done;
        const native = ports.nativeSleep(ms);
        if (native) {
          native.then(done, () => {
            if (wake === done) timer = ports.setTimer(done, ms);
          });
        } else {
          timer = ports.setTimer(done, ms);
        }
      });
    },
    wake() {
      wake?.();
    },
  };
}
