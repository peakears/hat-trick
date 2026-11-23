# NBA adapter

Facts about ESPN's NBA data that the code depends on. Loaded only when working in this folder; the root CLAUDE.md has the rules (validation policy, fixtures first, CACHE_VERSION).

ESPN's site API: unofficial and undocumented, no key, and **reachable from Claude sessions** (unlike the NHL API), so fixtures can be recorded here with curl. Responses are large but gzip well (a leaders request is about 17 KB on the wire); React Native's fetch asks for gzip.

## Which endpoint has what

- `site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD`: the day's games (US Eastern date, like the NHL's). Per event: `status.type.state` (`pre`, `in`, `post`) and `name` (`STATUS_SCHEDULED`, `STATUS_IN_PROGRESS`, `STATUS_HALFTIME`, `STATUS_END_PERIOD`, `STATUS_FINAL`, `STATUS_POSTPONED`, ...), `period` (5 is the first overtime) and `displayClock`; competitors with `score` as a string ("0" before tip-off), `records` (`type: "total"` is the season record) and the team's `logo`; the venue and city. Also there but not used yet: `broadcasts`/`geoBroadcasts` (US only), `linescores` per quarter, `leaders` per game, `notes` (NBA Cup and similar).
- `site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3`: conferences, then divisions (without `level=3`, conferences only; the site/v2 standings path is an empty stub). Entries are **not sorted**: `playoffSeed` is the conference seed with the league's tiebreakers, and the mapper orders each division by it. Stats by `name`: `wins`, `losses`, `winPercent`, `gamesBehind` (conference), `streak` (`displayValue` "L4"), `Home`, `Road`, `Last Ten Games` ("3-7" in `displayValue`). `points` is not standings points (it is a negative number) and is not mapped; `pointsFor`/`pointsAgainst` are not mapped either (the domain's `goalsFor` is hockey).
- `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?...&isqualified=true&limit=N&sort=<group>.<stat>:desc`: the top N players by one stat, one request per board (`LEADER_CATEGORIES`). Each athlete's stats are arrays per group (`general`, `offensive`, `defensive`) in the order of the top-level `categories[].names`. Values have many decimals; the mapper rounds to one, as ESPN shows them. No team names, only `teamShortName` (the abbreviation) and `teamLogos`.
- Team ids are ESPN's abbreviations, 2 to 4 letters (`NY`, `GS`, `UTAH`, `WSH`), the same in all three endpoints.
- Also there, not used yet: `.../summary?event=<id>` (box score, plays: for a game page), `.../teams/<abbrev>` and `.../teams/<abbrev>/schedule` (team page), `site/v3/.../leaders` (every category's top 10 in one 2.4 MB response, too big to use).

## Fixtures

Recorded 2026-11-22 around 10:20 pm ET (5 finals, one in OT, and 2 live games) plus 2026-11-24 (scheduled):

```sh
cd src/adapters/nba/__fixtures__
B=https://site.api.espn.com/apis/site/v2/sports/basketball/nba
curl -s "$B/scoreboard?dates=20261122" -o scoreboard-2026-11-22.json
curl -s "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3" -o standings-now.json
curl -s "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=20&sort=offensive.avgPoints:desc" -o leaders-offensive.avgPoints.json
```

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

Seen only by name in the recorded responses, not as a live state: `STATUS_HALFTIME`, `STATUS_END_PERIOD`, `STATUS_POSTPONED` (and `CANCELED`, `SUSPENDED`), multiple overtimes, the play-in and playoffs, and NBA Cup games (`notes`).
