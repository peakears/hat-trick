# NHL adapter

Facts about the NHL API that the code depends on. Loaded only when working in this folder; the root CLAUDE.md has the rules (validation policy, fixtures first, CACHE_VERSION).

Base URL `https://api-web.nhle.com/v1`: unofficial, no key, unreachable from Claude sessions. Text fields are localized objects (`{ default, fr, cs, ... }`); the mappers read `default` only (#86 is French).

## Which endpoint has what

- `/score/{date}`: the day's games and, per game, the goals in the order scored (scorer's `goalsToDate`, the season total including that goal). No special events.
- `/gamecenter/{id}/boxscore`: the game and player stats. No goals and no special event, and no team records (the game page gets those from the standings).
- `/gamecenter/{id}/landing`: the three stars (`summary.threeStars`, final games only), the penalties (`summary.penalties`, grouped by period, no player ids, `teamAbbrev` a localized object) and `specialEvent`. Read only for final games, so live landings are unverified.
- `getGameDetail` = box score + `/score/{gameDate}` for the goals (best effort) + the landing for final games (best effort), joined by player id for the stars' saves and TOI. `gameDetailFreshness` re-checks a final game every 2 min for 6 h after puck drop until the stars arrive.
- `/standings/now`: league, conference, division and wild card order (`leagueSequence`, `conferenceSequence`, `divisionSequence`, `wildcardSequence`; a wild card 0 means the team holds a division spot), plus `wildCardIndicator`.
- `/skater-stats-leaders/current`, `/goalie-stats-leaders/current`: `categories` and `limit` query params; the API returns only `limit` players, and the test fixture server trims to it the same way. Faceoff win % is a 0-1 fraction.
- `/player-spotlight`: a bare array in the league's `sortId` order, with team codes but no team names.
- `/club-stats/{team}/now`: season stats; no team name, and `season` is a string.
- `/club-schedule-season/{team}/now`: the team's season, games in the `/score` shape plus `specialEvent`; no city. `TeamDetail.arena` is the venue most home games use.
- `/schedule/{date}`: seven days of games starting on the date asked for. Read only for `specialEvent` (`getSpecialEvents`, asked for each week's Monday).
- `/player/{id}/landing`: everything on the player page in one request. Seasons come oldest first; `sequence` is not an order outside the NHL.
- Not used yet: roster, play-by-play (#28). There is no coach in these endpoints.

## Verified and unverified

Each schema in `raw-types.ts` says when it was verified against a live response. Still unverified: postponed game states, standings `clinchIndicator` (absent early in the season), goal strength `"sh"`, goalModifier `"penalty-shot"`, `goalsToDate` on shootout and playoff goals, the landing for live games, penalty types other than minor and penalty shot (and a bench minor's missing player), and the player landing for a retired or teamless player (`currentTeamAbbrev` is treated as optional). How a Winter Classic or Stadium Series is named in `specialEvent` has not been seen yet.
