import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AppState } from "react-native";
import type { DataMeta, Fetched, FetchOptions } from "../data";
import { canManualRefresh, nextPollDelay, shouldPoll } from "./polling";

export interface Polled<T> {
  data?: T;
  meta?: DataMeta;
  /** Set when a request failed with nothing cached to fall back on. */
  error?: Error;
  /** True until the first result (or error) for the current key. */
  loading: boolean;
  /** True during a pull-to-refresh. */
  refreshing: boolean;
  /** Pull-to-refresh and Retry: skips the cache, but is ignored for 30 seconds after fresh data arrived. */
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
 * foreground and the screen is focused. Polling stops in the background or when you leave the screen (tabs and
 * stacked screens stay mounted), and resumes with an immediate check on return. That check is cache-first, so it
 * costs no request while the data is still fresh.
 *
 * `key` identifies what is loaded (e.g. the date); when it changes, the old data is cleared.
 */
export function usePolled<T>(key: string, load: (options: FetchOptions) => Promise<Fetched<T>>): Polled<T> {
  const [state, setState] = useState<State<T>>({ key, refreshing: false });
  const loadRef = useRef(load);
  const runRef = useRef<(force: boolean) => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

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
      if (!shouldPoll(AppState.currentState, focusedRef.current)) return;
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
    pauseRef.current = () => clearTimeout(timer);

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && focusedRef.current) run(false);
      else clearTimeout(timer);
    });

    run(false);
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [key]);

  // Leaving the screen stops its timer; coming back checks at once (from the cache if still fresh) and resumes.
  // The first focus is skipped: the effect above has just loaded.
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused === wasFocused.current) return;
    wasFocused.current = focused;
    if (focused) runRef.current(false);
    else pauseRef.current();
  }, [focused]);

  // Until the effect for a new key runs, don't show the previous key's data.
  const current = state.key === key ? state : { key, refreshing: false };

  // Read by refresh() so it can stay a stable callback.
  const metaRef = useRef(current.meta);
  metaRef.current = current.meta;

  const refresh = useCallback(() => {
    // Pulling again right after an update does nothing: no spinner, no request.
    if (!canManualRefresh(metaRef.current, Date.now())) return;
    setState((s) => ({ ...s, refreshing: true }));
    runRef.current(true);
  }, []);

  return {
    data: current.data,
    meta: current.meta,
    error: current.error,
    loading: current.data === undefined && current.error === undefined,
    refreshing: current.refreshing,
    refresh,
  };
}
