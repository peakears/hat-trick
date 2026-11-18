import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { DataMeta, Fetched, FetchOptions } from "../data";
import { nextPollDelay } from "./polling";

export interface Polled<T> {
  data?: T;
  meta?: DataMeta;
  /** Set when a request failed with nothing cached to fall back on. */
  error?: Error;
  /** True until the first result (or error) for the current key. */
  loading: boolean;
  /** True during a pull-to-refresh. */
  refreshing: boolean;
  /** Pull-to-refresh: skips the cache. */
  refresh: () => void;
}

interface State<T> {
  key: string;
  data?: T;
  meta?: DataMeta;
  error?: Error;
  refreshing: boolean;
}

/**
 * Loads data through SportsData and polls it again around `meta.staleAt` while the app is in the
 * foreground. Polling stops in the background and resumes (with an immediate check) on return.
 *
 * `key` identifies what is loaded (e.g. the date); when it changes, the old data is cleared.
 */
export function usePolled<T>(key: string, load: (options: FetchOptions) => Promise<Fetched<T>>): Polled<T> {
  const [state, setState] = useState<State<T>>({ key, refreshing: false });
  const loadRef = useRef(load);
  const runRef = useRef<(force: boolean) => void>(() => {});

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0; // only the latest request may update state

    setState({ key, refreshing: false });

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (AppState.currentState === "background") return;
      timer = setTimeout(() => run(false), ms);
    };

    const run = async (force: boolean) => {
      clearTimeout(timer);
      const id = ++seq;
      try {
        const result = await loadRef.current({ force });
        if (!active || id !== seq) return;
        setState({ key, data: result.data, meta: result.meta, refreshing: false });
        schedule(nextPollDelay(result.meta, Date.now()));
      } catch (err) {
        if (!active || id !== seq) return;
        setState((s) => ({ ...s, error: err as Error, refreshing: false }));
        schedule(nextPollDelay(undefined, Date.now()));
      }
    };
    runRef.current = run;

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") run(false);
      else clearTimeout(timer);
    });

    run(false);
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [key]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true }));
    runRef.current(true);
  }, []);

  // Until the effect for a new key runs, don't show the previous key's data.
  const current = state.key === key ? state : { key, refreshing: false };
  return {
    data: current.data,
    meta: current.meta,
    error: current.error,
    loading: current.data === undefined && current.error === undefined,
    refreshing: current.refreshing,
    refresh,
  };
}
