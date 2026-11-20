import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Game } from "../domain";
import { useSettings } from "./settings-context";
import {
  NO_REVEALS,
  areTablesHidden,
  isGameHidden,
  revealAllGames,
  revealGame,
  revealTables,
  statusLabelFor,
  type Reveals,
} from "./spoilers";

interface SpoilerContextValue {
  /** The Settings switch. */
  enabled: boolean;
  /** True while this game's score, box score and result-revealing details should be hidden. */
  isHidden: (game: Pick<Game, "id" | "status">) => boolean;
  /** Status text that does not give the result away while the game is hidden. */
  statusLabel: (game: Game) => string;
  /** Standings and Leaders. */
  tablesHidden: boolean;
  /** "Show all scores" was tapped, so there is nothing left to reveal on Scores. */
  allRevealed: boolean;
  reveal: (gameId: string) => void;
  revealAll: () => void;
  revealTables: () => void;
}

const SpoilerContext = createContext<SpoilerContextValue | null>(null);

/** Holds what the user has tapped to show. Kept in memory only, so every app launch starts shielded. */
export function SpoilerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const enabled = settings.spoilerShield;
  const [reveals, setReveals] = useState<Reveals>(NO_REVEALS);

  // Turning the shield on (again) starts from everything hidden.
  useEffect(() => {
    if (enabled) setReveals(NO_REVEALS);
  }, [enabled]);

  const isHidden = useCallback(
    (game: Pick<Game, "id" | "status">) => isGameHidden(game, enabled, reveals),
    [enabled, reveals],
  );
  const statusLabel = useCallback(
    (game: Game) => statusLabelFor(game, isGameHidden(game, enabled, reveals)),
    [enabled, reveals],
  );

  const value = useMemo<SpoilerContextValue>(
    () => ({
      enabled,
      isHidden,
      statusLabel,
      tablesHidden: areTablesHidden(enabled, reveals),
      allRevealed: reveals.all,
      reveal: (gameId) => setReveals((r) => revealGame(r, gameId)),
      revealAll: () => setReveals((r) => revealAllGames(r)),
      revealTables: () => setReveals((r) => revealTables(r)),
    }),
    [enabled, reveals, isHidden, statusLabel],
  );
  return <SpoilerContext.Provider value={value}>{children}</SpoilerContext.Provider>;
}

export function useSpoilers(): SpoilerContextValue {
  const value = useContext(SpoilerContext);
  if (!value) throw new Error("useSpoilers must be used inside SpoilerProvider");
  return value;
}
