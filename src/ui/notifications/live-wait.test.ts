import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWaiter, type WaitPorts } from "./live-wait";

const timers: WaitPorts = {
  nativeSleep: () => undefined,
  setTimer: (done, ms) => setTimeout(done, ms),
  clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

/** A native sleep the test ends by hand. */
function manualNative() {
  const pending: { resolve: () => void; reject: (e: Error) => void; ms: number }[] = [];
  const nativeSleep = (ms: number) => new Promise<void>((resolve, reject) => pending.push({ resolve, reject, ms }));
  return { nativeSleep, pending };
}

async function settled(p: Promise<void>): Promise<boolean> {
  let done = false;
  void p.then(() => (done = true));
  await vi.advanceTimersByTimeAsync(0);
  return done;
}

describe("createWaiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses the native wait when there is one, and no timer", async () => {
    const native = manualNative();
    const setTimer = vi.fn(timers.setTimer);
    const waiter = createWaiter({ ...timers, nativeSleep: native.nativeSleep, setTimer });
    const p = waiter.sleep(30_000);
    expect(native.pending.map((x) => x.ms)).toEqual([30_000]);
    expect(setTimer).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await settled(p)).toBe(false); // JS time passing does not end it: only the native wait does
    native.pending[0].resolve();
    expect(await settled(p)).toBe(true);
  });

  it("falls back to a timer where there is no native wait (Expo Go, iOS)", async () => {
    const p = createWaiter(timers).sleep(30_000);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(await settled(p)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled(p)).toBe(true);
  });

  it("falls back to a timer if the native wait fails", async () => {
    const native = manualNative();
    const p = createWaiter({ ...timers, nativeSleep: native.nativeSleep }).sleep(30_000);
    native.pending[0].reject(new Error("gone"));
    expect(await settled(p)).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await settled(p)).toBe(true);
  });

  it("wake() ends the wait at once, and the late native answer changes nothing", async () => {
    const native = manualNative();
    const waiter = createWaiter({ ...timers, nativeSleep: native.nativeSleep });
    const first = waiter.sleep(30_000);
    waiter.wake();
    expect(await settled(first)).toBe(true);

    const second = waiter.sleep(30_000);
    native.pending[0].resolve(); // the first wait's native answer arrives late
    expect(await settled(second)).toBe(false);
    native.pending[1].resolve();
    expect(await settled(second)).toBe(true);
  });

  it("wake() with no wait running does nothing", () => {
    expect(() => createWaiter(timers).wake()).not.toThrow();
  });
});
