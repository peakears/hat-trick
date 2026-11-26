# NFL adapter

Facts about ESPN's NFL data that the code depends on. Loaded only when working in this folder; the root CLAUDE.md has the rules (validation policy, fixtures first, CACHE_VERSION). The source, hosts and response shapes are the NBA's (`src/adapters/nba/CLAUDE.md`), with football's stats: read that file too.

ESPN's site API: unofficial and undocumented, no key, and **reachable from Claude sessions**, so fixtures are recorded here with curl.

## Which endpoint has what

- `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD`: the day's games (US Eastern date: a game at 8:20 pm ET is on that day, though its UTC time is the next). **Without `dates` it returns the whole week** (Thursday to Monday), with `week.number`. Per event: `status.type.state` (`pre`, `in`, `post`) and `name`, `period` (1-4, 5 is overtime, 0 before kickoff) and `displayClock`; competitors with `score` as a string, `records` (`type: "total"` is the season record, "6-5" or "6-4-1" with a tie) and `linescores` (`{ value, period }` per quarter played). Competitors have **no `leaders`** (the NBA's do): the game's passing, rushing and receiving leaders are on `competitions[0].leaders` (`name` "passingYards", a `displayValue` line "17/29, 198 YDS, 1 TD, 2 INT", the athlete's `shortName`, and the team as ESPN's numeric id, not the abbreviation). Not used yet: those leaders, `situation` (live: down, distance, possession; its shape is under Unverified), `notes`, `broadcasts`.
- `site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3`: two conferences ("American Football Conference", "National Football Conference"), each four divisions ("AFC East") of four teams. Entries are **not sorted**: `playoffSeed` is the conference seed (1-16, the league's tiebreakers; 1-4 are the division leaders), which orders each division and becomes `conferenceRank`; `CONFERENCE_BANDS` marks seeds 1-7 as the playoffs. Stats by `name`: `wins`, `losses`, `ties`, `winPercent` (a tie counts as half a win), `streak` ("W6"), `Home` and `Road` ("4-2", "2-1-1" with a tie), `vs. Div.`, `vs. Conf.`, `pointsFor`, `pointsAgainst`, `differential`. `gamesBehind` is behind the **division** leader, unlike the NBA's (conference), so it is not mapped. Points for and against are not mapped yet (the domain's `goalsFor` is hockey).
- `site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?...&isqualified=true&limit=N&sort=<group>.<stat>:desc`: the top N players by one stat, one request per board (`LEADER_CATEGORIES`). Groups: `general`, `passing`, `rushing`, `receiving`, `defensive`, `defensiveinterceptions`, `scoring`, `returning`, `kicking`, `punting`, each with its `names`. **The sort key's group is case-sensitive and differs from the response's name**: `defensiveInterceptions.interceptions` sorts (lower case answers 400), and the response calls the group `defensiveinterceptions`; the mapper matches groups ignoring case. Values are season totals (sacks in halves, passer rating with many decimals). Qualified players only: about 53 passers, 59 rushers, 175 receivers.
- `site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=<id>` (not used yet, for the game page): the NBA's shape, with `boxscore.players[]` holding **ten groups per team** (passing, rushing, receiving, fumbles, defensive, interceptions, kickReturns, puntReturns, kicking, punting), each with `keys`, `labels` and athletes' `stats`; `boxscore.teams` 25 team stats by `name` (firstDowns, thirdDownEff "2-8", totalYards, turnovers, possessionTime "19:20"); `scoringPlays` (`type.abbreviation` "TD", "FG", `text` "Brandon McManus 43 Yd Field Goal", `awayScore`, `homeScore`, `period.number`, `clock.displayValue`, `team`); `drives`; `leaders`; `gameInfo.venue`. About 600 KB final.
- Team ids are ESPN's abbreviations (`BUF`, `LAR`, `WSH`, `JAX`), the same in every endpoint.

## Fixtures

Recorded 2026-11-26 about 8:50 am ET (the morning of Thanksgiving: GB at LAR, final the night before), and Thanksgiving's scoreboard at 1:18 pm ET (CHI at DET live, DET 3-0 with 8:31 left in Q1; PHI at DAL and KC at BUF scheduled):

```sh
cd src/adapters/nfl/__fixtures__
B=https://site.api.espn.com/apis/site/v2/sports/football/nfl
curl -s "$B/scoreboard?dates=20261125" -o scoreboard-2026-11-25.json   # GB 13 at LAR 26, final
curl -s "$B/scoreboard?dates=20261126" -o scoreboard-2026-11-26.json   # at 1:18 pm ET: CHI at DET live, 2 scheduled
curl -s "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3" -o standings-now.json
L="https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=20"
for s in passing.passingYards passing.passingTouchdowns passing.QBRating rushing.rushingYards rushing.rushingTouchdowns \
  receiving.receivingYards receiving.receptions receiving.receivingTouchdowns defensive.sacks defensive.totalTackles \
  defensiveInterceptions.interceptions; do curl -s "$L&sort=$s:desc" -o leaders-$s.json; done
```

Trimmed after recording, keeping everything the adapter reads: scoreboards lose `links`, `headlines`, `tickets`, `odds`, `highlights`, `broadcasts` and `geoBroadcasts` at every level; standings lose `links` and `seasons`. A leaders file keeps only the board's own group, in `categories` (`name` and `names`) and in each athlete's (`name` and `values`); athletes lose `links`, `teams`, ids other than `id`, `status`, `age` and `slug`, and `teamLogos` is cut to its first.

## Unverified

Verified on 2026-11-26: a live game is `STATUS_IN_PROGRESS` (state `in`, `period` 1, `displayClock` "8:31", one linescore per quarter started). Its competition has a `situation` (not mapped yet): `down` 2, `distance` 8, `yardLine` 22, `downDistanceText` "2nd & 8 at DET 22", `shortDownDistanceText` "2nd & 8", `possessionText` "DET 22", `possession` (ESPN's numeric team id, "3"), `isRedZone`, `homeTimeouts`, `awayTimeouts`, and `lastPlay` (`text`, `type`, the drive so far, win probability).

Not yet seen: halftime and the end of a quarter (by name, as the NBA's), overtime, a tied final, a postponed game, the playoffs (more than one overtime).
