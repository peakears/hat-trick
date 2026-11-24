# NBA adapter

Facts about ESPN's NBA data that the code depends on. Loaded only when working in this folder; the root CLAUDE.md has the rules (validation policy, fixtures first, CACHE_VERSION).

ESPN's site API: unofficial and undocumented, no key, and **reachable from Claude sessions** (unlike the NHL API), so fixtures can be recorded here with curl. Responses are large but gzip well (a leaders request is about 17 KB on the wire); React Native's fetch asks for gzip.

## Which endpoint has what

- `site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD`: the day's games (US Eastern date, like the NHL's). Per event: `status.type.state` (`pre`, `in`, `post`) and `name` (`STATUS_SCHEDULED`, `STATUS_IN_PROGRESS`, `STATUS_HALFTIME`, `STATUS_END_PERIOD`, `STATUS_FINAL`, `STATUS_POSTPONED`, ...), `period` (5 is the first overtime) and `displayClock`; competitors with `score` as a string ("0" before tip-off), `records` (`type: "total"` is the season record) and the team's `logo`; the venue and city. Per competitor, `linescores` (`{ value, period }`, one per period played; mapped to `Game.periods`, kept only when they add up to the score; while live, all four quarters are listed, those not played yet with null scores) and `leaders` (the team's top `points`, `rebounds`, `assists` and `rating`, whose `displayValue` is a line like "23 PTS, 8 REB"; the game's top scorer becomes `Game.standout`, with the rating line when it is the same player). Also there but not used yet: `broadcasts`/`geoBroadcasts` (US only), `notes` (NBA Cup and similar).
- `site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3`: conferences, then divisions (without `level=3`, conferences only; the site/v2 standings path is an empty stub). Entries are **not sorted**: `playoffSeed` is the conference seed with the league's tiebreakers, and the mapper orders each division by it. Stats by `name`: `wins`, `losses`, `winPercent`, `gamesBehind` (conference), `streak` (`displayValue` "L4"), `Home`, `Road`, `Last Ten Games` ("3-7" in `displayValue`). `points` is not standings points (it is a negative number) and is not mapped; `pointsFor`/`pointsAgainst` are not mapped either (the domain's `goalsFor` is hockey).
- `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?...&isqualified=true&limit=N&sort=<group>.<stat>:desc`: the top N players by one stat, one request per board (`LEADER_CATEGORIES`). Each athlete's stats are arrays per group (`general`, `offensive`, `defensive`) in the order of the top-level `categories[].names`. Values have many decimals; the mapper rounds to one, as ESPN shows them. No team names, only `teamShortName` (the abbreviation) and `teamLogos`.
- Team ids are ESPN's abbreviations, 2 to 4 letters (`NY`, `GS`, `UTAH`, `WSH`), the same in every endpoint.
- `site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=<id>` (game page): `header.competitions[0]` has the teams (`logos`, a list), scores as strings (absent before tip-off), `linescores` (one per period played) and `record` (season record, used only before the game). A final game's header `status` has **only `type`**: no period or clock, so the mapper counts `linescores` for overtime. `boxscore.players[]` is one entry per team with one statistics group: `keys` name the columns, `labels` head them, each athlete's `stats` are strings in that order ("8-19"), with `starter` and `didNotPlay` (empty `stats`); absent before tip-off. `gameInfo.venue` has the arena and city, and `gameInfo.attendance` the crowd (on a final game; absent live). `boxscore.teams` is each team's totals by `name` (`TEAM_GAME_STATS` picks the game page's team stats); **before tip-off it holds season averages**, so the mapper reads it only live or final. Each team's top performer is its top scorer in `boxscore.players`. Most of the 480 KB response is `plays`, `news`, `videos` and `winprobability`, which are not read.
- `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/<abbrev>/athletes/statistics` (team page stats): `results[0].leaders` is every player who has played, by points per game, each with groups `general`, `offensive`, `defensive` of stats by `name` with `displayValue` (`TEAM_STAT_COLUMNS` picks them). Takes the abbreviation like the team id. (The leaders endpoint's `team=` filter is ignored: it returns every team's players.)
- `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/<abbrev>/schedule` (team page games, an extra): the whole regular season; per event the status is on `competitions[0].status` (not the event, unlike the scoreboard), scores are `{ value, displayValue }`, and `venue` is there for the home arena.
- `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/<id>?region=us&lang=en` (player page): bio as display strings only: `displayDOB` ("2/23/1997", **month first only with `region=us`**: without it the order follows ESPN's guess at the locale, and "23/2/1997" came back here), `displayHeight` (`6' 4"`), `displayWeight` ("215 lbs"), `displayBirthPlace` ("Kitchener, ON"), `displayDraft` ("2016: Rd 1, Pk 7 (DEN)", the pick counted overall; absent for an undrafted player); `position.name` ("Center", turned into "Centre"); `team`; `statsSummary` (this season's PTS, REB, AST, FG%). Most of its 150 KB is the team's whole roster, videos and standings, which are not read. (The roster endpoint, `.../teams/<abbrev>/roster`, has an ISO `dateOfBirth`, but no draft.)
- `.../athletes/<id>/stats?region=us&lang=en[&seasontype=3]`: one line per season and team (oldest first) in category `averages`, by `names`, with the career line in `totals`. `seasontype=3` is the playoffs, **but a player with none gets the regular season back** (filter `seasontype` `value` "2"): the mapper keeps a playoffs answer only if it says "3", and the adapter asks only when the regular season's filter `options` include "3".
- `.../athletes/<id>/gamelog?region=us&lang=en`: this season's games by id in `events` (opponent, `atVs`, `gameDate` in UTC), stats in `seasonTypes[].categories[].events[]` by the top-level `names`; preseason is a season type of its own and is skipped.
- Also there, not used yet: `.../teams/<abbrev>` (team info), `site/v3/.../leaders` (every category's top 10 in one 2.4 MB response, too big to use). In the summary: `leaders`, `injuries`, `seasonseries`, `plays`.

## Fixtures

Recorded 2026-11-22 around 10:20 pm ET (5 finals, one in OT, and 2 live games) plus 2026-11-24 (scheduled) and 2026-11-23 around 10:40 pm ET (6 finals and 4 live: one in overtime, one at the end of the 1st; trimmed of links, headlines and broadcasts, with `summary-401910043-live.json`, LAC at HOU late in the 4th, trimmed like the other summaries); the summaries, DEN's team files and the players just after midnight ET on 2026-11-23:

```sh
cd src/adapters/nba/__fixtures__
B=https://site.api.espn.com/apis/site/v2/sports/basketball/nba
curl -s "$B/scoreboard?dates=20261122" -o scoreboard-2026-11-22.json
curl -s "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3" -o standings-now.json
curl -s "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=20&sort=offensive.avgPoints:desc" -o leaders-offensive.avgPoints.json
curl -s "$B/summary?event=401910032" -o summary-401910032-final.json   # DEN 151, CHI 145 (OT)
curl -s "$B/summary?event=401909314" -o summary-401909314-pre.json     # DET at ORL, scheduled
curl -s "$B/teams/DEN/athletes/statistics" -o team-DEN-athletes-statistics.json
curl -s "$B/teams/DEN/schedule" -o team-DEN-schedule.json
A=https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes; Q="region=us&lang=en"
for id in 3936299 4065813; do  # Jamal Murray (ten seasons, playoffs), Alpha Diallo (rookie, undrafted)
  curl -s "$A/$id?$Q" -o athlete-$id.json
  curl -s "$A/$id/stats?$Q" -o athlete-$id-stats.json
  curl -s "$A/$id/gamelog?$Q" -o athlete-$id-gamelog.json
done
curl -s "$A/3936299/stats?$Q&seasontype=3" -o athlete-3936299-stats-playoffs.json
```

The summaries and team files are trimmed too (from 1.7 MB to 260 KB in all), keeping everything the adapter reads: a summary keeps only `header`, `boxscore` and `gameInfo` (without officials and venue images), and athletes lose `links`; team logos are cut to the first, stats lose `description` and `displayName`, and schedule events lose `links`, `broadcasts`, `tickets` and per-team `leaders`. An athlete keeps only the fields in `RawAthleteSchema` (and `status`, `fullName`, `displayExperience`), with its team cut to its id, names and first logo; stats and game logs lose `glossary`, team details beyond the names, and links and logos.

Leader fixtures are trimmed after recording, to about a fifth of their size: per athlete, `links` and `teams` (team history) are removed and `teamLogos` is cut to its first entry. Nothing the adapter reads is removed:

```sh
python3 -c 'import json,sys
for p in sys.argv[1:]:
    s=json.load(open(p))
    for a in s["athletes"]:
        a["athlete"].pop("links",None); a["athlete"].pop("teams",None); a["athlete"]["teamLogos"]=a["athlete"].get("teamLogos",[])[:1]
    json.dump(s,open(p,"w"),separators=(",",":"))' leaders-*.json
```

## Unverified

Seen only by name in the recorded responses, not as a live state: `STATUS_HALFTIME`, `STATUS_POSTPONED` (and `CANCELED`, `SUSPENDED`), multiple overtimes, the play-in and playoffs, and NBA Cup games (`notes`). Verified on 2026-11-23: a live summary's header `status` has `period` and `displayClock` (and `STATUS_END_PERIOD` shows `displayClock` "0.1", which the mapper does not show). The summary's `plays`, `winprobability`, `leaders`, `injuries` and `seasonseries` are not recorded in the fixtures yet (they are trimmed out).
