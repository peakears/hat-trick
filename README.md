# Hat Trick

A clean, open-source sports scores app for Android: the NHL, with the NBA on its way, and more leagues later.

Everything runs on your device: the app talks to public sports APIs directly, with no backend server to host.

> **Status: released.** The NHL app works on Android phones. Download the latest APK from [Releases](https://github.com/peakears/hat-trick/releases) (see [Install](#install)). New features are on the [Roadmap](#roadmap).

## Features

- **First-run setup:** on a fresh install, a few skippable steps pick which leagues you follow (more than one shows them together on Scores), your favourite teams in each (by division, with a switch between leagues), game start reminders and live scores (and which of your teams each covers), the spoiler shield and the TV channel country, and last the theme and accent colour (the screen recolours as you pick). Updating from an earlier version skips it. Run it again any time from **Settings > About > Run setup again**.
- **Scores** for any date, with live game clocks. A live game's card also shows each period's score and the game's top performer so far ("Top performer · J. Brunson NY · 31 PTS", or goals and assists in hockey), hidden by the spoiler shield. When a team scores in a live game, its score pops and glows for a moment (on Scores, the game page and the team page's next game card; just a glow with Android's "Remove animations" on). Games are grouped under Live, Upcoming and Final headers. Upcoming games show each team's season record. A week strip at the top shows the seven days around the one you are on (today's date in the accent colour): tap a day to go to it, swipe left or right to step a day (with a light tap you feel), or tap the calendar to jump to any date; tap the heading to return to today. Pull down to refresh on any screen (a light tap when you let go); a pull within 30 seconds of the last update is ignored, to save requests.
- **Favourite teams**, in any league: pick teams in each league you follow in first-run setup, or star any team on its team page. Their games show first on Scores (under **Your teams**, from every league in the All view) with the team name in the accent colour, and Standings marks them. Updating keeps the teams you starred before.
- **Game start reminders** (optional): a notification 10 to 60 minutes before your favourite teams' games in every league, in the sport's own words ("Puck drop in 30 minutes", "Tip-off in 30 minutes"), even with the app closed. Switch them off for any one team under **Settings > Favourite teams**.
- **Live scores** (optional, Android): an ongoing notification with your favourite teams' live score and clock in every league, kept up to date about every 30 seconds even after you close the app, plus scoring alerts: each goal (with the scorer) in hockey; in basketball, which scores too often for that, a change of lead from the 4th quarter on and the start of overtime; and the final. It starts when you open the app, or tap a game start reminder, near game time, and stops at the final or when you tap Stop. With the spoiler shield on it shows no scores and sends no scoring alerts. Switch it off for any one team under **Settings > Favourite teams**.
- **Special games:** a small tag names games the league marks as special, such as the Winter Classic, the Stadium Series or the Original 6 Series, on Scores, the game page and team pages.
- **TV channels:** each game shows where to watch it, for your country (Canada or US, from your phone's region, or set it in Settings). National channels are bold, and the Scores list shows the first three for games that have not finished. The game page has the full list, in one line under the score with the arena and city. Games with no listing for your country show nothing.
- **Spoiler shield** (optional, off by default): hides scores, goals, three stars, penalties, box scores and the play-by-play until you tap Show, for watching games on delay. Reveal one game or all games. Standings and leaders are not hidden. Nothing is saved, so every app launch starts hidden.
- **Game page:** score, each team's season record and shots on goal, where it is played (arena and city) and every TV channel, in two compact lines at the bottom of the score card, the three stars once a game is over (with player photos, and saves or goals, assists and ice time), a goal-by-goal summary (scorer, with "(2)" on their 2nd goal of the game and a Hat trick tag on the 3rd, which goal of the season it was, assists, power-play and empty-net tags, running score, and a play button for the goal's video), a **Videos** card once a game is over (the 3-minute recap and the condensed game; each video opens on nhl.com in a browser tab over the app, and Back returns to Hat Trick), a penalty summary once a game is over (who took it and drew it, the infraction, its length, each team's penalty minutes, and the power-play goal it led to; a long list shows the first five, with the rest behind Show more), a Box score page with player stats for both teams, and a **Play-by-play** card: a tab for each period, with that period's latest plays while the game is on (it follows the game into the next period) or its first plays once it is over, and **See all plays** for the full page, where every goal, shot, hit, faceoff, penalty and stoppage is listed by period (one period or all, every play or just goals and penalties). Goals show power-play, short-handed and empty-net tags and the score after them. For every league with game pages, a table of each period's score; for the NBA, each team's top performer and the teams' shooting, rebounds, assists and more side by side, and the attendance once it is reported. All hidden by the spoiler shield except the attendance.
- **Standings** by division (under Eastern and Western Conference headings), by conference, as the wild card race (each division's top three, then the wild card teams with a line under the last playoff spot), or for the whole league; the app remembers the view you picked. Tap a team (here or on a game page) for its team page: a card for its next game (opponent, puck drop and TV channels; a countdown on game day; the live score, clock and shots while it is on, hidden by the spoiler shield; tap it for the game page), record, points, streak, goal difference, last 10, home and road records, its division rank, its home arena, its recent and upcoming games (three of each, one compact line per game, with up to five behind "Show more"; each opens the game), and season stats for every skater and goalie.
- **Player pages:** tap a player in the three stars, Leaders, a box score or a team's season stats. Shows their photo, team, number and position, this season's stats, their last five games (each opens the game), a bio (age, birthplace, height and weight, shoots or catches, draft), career totals and every season, regular season or playoffs, with an option to include junior, minor and international leagues.
- **Stat leaders** for skaters (points, goals, assists, power-play goals, faceoff %, penalty minutes) and goalies (wins, save percentage, goals against average, shutouts): the top five in each, with **Show more** for the top 20. A **Player spotlight** button at the top lists the players the NHL is featuring right now; each opens their player page. Each board's leader is shown large, with their photo and how far ahead they are; everyone else has a bar sized against the leader.
- **Settings:** light, dark or system theme, a pure black (OLED) option for dark, an accent colour (blue, teal, green, orange, purple or pink), team logos and player photos on or off (off shows abbreviations and initials), haptic feedback (on by default; it also follows the phone's touch feedback setting), TV channel country, spoiler shield, game start reminders, live scores (with or without scoring alerts), a **Favourite teams** page (each team by league with its logo, its own Game start reminders and Live scores switches, and Remove), update checks, and **Run setup again**. **Settings > Diagnostics** lists problems the app had loading data (fields it did not understand, requests that failed), to share in a problem report.
- **Update notice:** a banner when a newer release is available, checked at most once a day (switchable). Tap **Update** in the banner (or in **Settings > About**) and the app downloads the new APK into its own private cache, checks its size and checksum, and opens Android's installer; you tap Install. You can cancel the download, and one that stops for 30 seconds is given up. The file is deleted afterwards, so nothing piles up in your Downloads folder. If that fails, **Open in browser** is the fallback. **Settings > About** shows the version with the release notes beside it (**What's new** when an update is waiting), and a "Report a problem" link that opens a GitHub issue with your app version filled in.
- **Works offline** with the last data it fetched. Live games refresh about every 20 seconds while the app is open.
- **NBA:** scores, standings (by division, conference or league, with win percentage and games behind; the Conference view lists each conference by seed, with the playoff, play-in and out bands marked) stat leaders (points, rebounds, assists, steals, blocks and 3-pointers per game), game pages (score, arena and a box score with starters and bench) team pages (record, win percentage, games back, home, road and last 10, recent and upcoming games, and the roster's season stats) and player pages (bio, draft, this season's averages, last five games, career, and every season, regular season and playoffs). Switch leagues with the row of league buttons at the top of Scores, Standings and Leaders; the app remembers your pick. On Scores each button shows how many games that league has on the day, with a red dot when one is live, and **All** (the default) lists every league's games for the day: your teams first, then each league under its own heading.
- No account, no ads, no tracking: the app talks only to the NHL's public API, ESPN's public API (for the NBA, only while you look at NBA data) and GitHub (the update notice, and the update itself when you tap Update). The diagnostics log stays on your phone unless you share it.

## Install

Each [release](https://github.com/peakears/hat-trick/releases) has an APK attached (`hat-trick-vX.Y.Z.apk`).

1. On your Android phone, open the latest release and download the `.apk`.
2. Open the downloaded file. Android asks you to allow installs from that app (your browser or Files): allow it, then tap **Install**.
3. To update, install the newer APK the same way. It replaces the old version and keeps your data. The app shows a notice when a newer release is available, and can install it for you (Android asks once to allow installs from Hat Trick).

Android may warn that the app is from an unknown developer, because it is not from the Play Store. That is expected for a sideloaded app.

The app contacts only the NHL's public API (for NHL data), ESPN's public API (for NBA data, only when you pick the NBA) and GitHub (once a day, to see whether a newer release exists; you can turn this off in Settings). The app only downloads an update when you tap Update, only from this project's GitHub releases, and Android's installer accepts it only if it is signed with the same release key.

Every pull request also gets a test APK, under **Artifacts** on its CI run. For a branch with no pull request, open **Actions**, pick **Test APK (manual)**, click **Run workflow** and choose the branch. Test APKs are signed with a different key than releases, so Android will not install one over a release (or the other way round): uninstall first.

## Getting started

Requires Node.js 22.13 or newer.

```sh
git clone https://github.com/peakears/hat-trick.git
cd hat-trick
npm install
npm run format:check
npm run typecheck
npm test
```

### Run it on your phone (quickest)

1. Install **Expo Go** from the Play Store.
2. Run `npm start` and scan the QR code with Expo Go. Your phone and computer must be on the same network (or use `npm start -- --tunnel`).

### Build an APK

Needs the Android SDK and a JDK (installing Android Studio gives you both), and a phone with USB debugging on or an emulator:

```sh
npx expo run:android --variant release
```

This builds the native project into `android/` (not committed) and installs the app. The release build is signed with a debug key, which is fine for your own devices. Android will not install it over an APK from the releases page (different key), so uninstall that first.

The NHL needs no API key or signup. Leagues added later may need a key; you will enter it in the app's settings, where it stays on your device. Never commit API keys to the repo.

## How it works

Data flows up through layers, and only the bottom layer knows any league's raw API format:

```
league adapters -> domain model -> on-device cache -> app UI
```

- `src/domain.ts`: league-agnostic types and the `LeagueAdapter` contract
- `src/registry.ts`: looks up an adapter by league id
- `src/adapters/nhl/`: the NHL adapter
- `src/data/`: on-device cache; refreshes live games every 20 seconds, keeps finished games for days, and serves the last known data when offline
- `src/ui/`: React Native pieces shared by screens, one folder per feature (data and polling, settings, scores, game, standings, notifications, updates and more) plus shared components
- `app/`: the screens, using [Expo Router](https://docs.expo.dev/router/introduction/) (one file per route): the Scores, Standings, Leaders and Settings tabs, and the game page

Settings (including favourite teams) are stored on the device, separately from cached data. Game start reminders are local notifications scheduled on the device. Live scores are checked by the app itself, from the same NHL API, while a followed game is on. The TV country is read from the phone's region setting, with no location permission and no network request. NBA data comes from ESPN's public API, and only while you look at it. The only other network request is the daily update check against GitHub. Videos are not played by the app: tapping one opens nhl.com's own page in a browser tab, only for nhl.com video links.

Adding a league means writing a new adapter that implements `LeagueAdapter` and passes the shared contract tests in `src/contract/`. Nothing above it changes: see [Adding a league](#adding-a-league) for the steps.

### Tech stack

- **App:** [Expo](https://expo.dev/) and React Native, written in TypeScript, with [Expo Router](https://docs.expo.dev/router/introduction/) for screens. Scores are set in [Barlow Semi Condensed](https://github.com/jpt/barlow) (SIL Open Font License), bundled with the app.
- **Data:** [zod](https://zod.dev/) validates the responses of the unofficial NHL API, AsyncStorage holds the on-device cache and settings, and expo-image draws team logos and player photos.
- **Tests and tooling:** [vitest](https://vitest.dev/) (tests run on recorded API responses, never the live API), Prettier, and commitlint with husky for Conventional Commits.
- **Releases:** GitHub Actions builds the APKs, and release-please keeps the release PR and changelog.

## Roadmap

What each version added is on the [Releases page](https://github.com/peakears/hat-trick/releases) and in [CHANGELOG.md](CHANGELOG.md).

Planned (each links to its issue):

- [Starting goalies](https://github.com/peakears/hat-trick/issues/30) on upcoming games
- [French translation](https://github.com/peakears/hat-trick/issues/86), with French team, city and arena names from the NHL API
- [Betting odds](https://github.com/peakears/hat-trick/issues/7), if a usable source exists (off by default)
- [More customization](https://github.com/peakears/hat-trick/issues/53) in Settings (colours, what each game card shows)
- [Alternate app icons](https://github.com/peakears/hat-trick/issues/9), picked in Settings
- [More leagues](https://github.com/peakears/hat-trick/issues/8) (NFL; golf later)

See the [changelog](CHANGELOG.md) for what changed in each release.

## Contributing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org), because releases are versioned from them:

| Commit                                             | Example                                 | Release                    |
| -------------------------------------------------- | --------------------------------------- | -------------------------- |
| `fix:`                                             | `fix(nhl): handle missing goalie stats` | patch (0.1.0 -> 0.1.1)     |
| `feat:`                                            | `feat: add NBA adapter`                 | minor (0.1.0 -> 0.2.0)     |
| `feat!:` or `BREAKING CHANGE:` footer              | `feat!: rename Game.startTime`          | major (minor while on 0.x) |
| `docs:`, `test:`, `refactor:`, `chore:`, `ci:` ... | `docs: fix typo`                        | none                       |

`npm install` sets up a git hook that checks each commit message. Releases are made by merging the release PR that release-please keeps open.

Work on a branch from `main`, one feature per pull request. CI runs typecheck and tests on every PR and builds a test APK. When testing with Expo Go, press `r` in the `npm start` terminal (or shake the phone and tap **Reload**) after switching branches: restarting the dev server alone does not reload the app on the phone.

### Adding a league

Each league is an adapter: a folder that turns one data source into the app's own types. The screens never know which league they are showing. Anything that differs between leagues reaches them as data from the adapter: period labels, which columns are empty, what a standings position means. Adding a league is mostly writing that folder. The NBA ([`src/adapters/nba/`](src/adapters/nba)) is the worked example; copy its layout.

#### 1. Pick a data source

- **Free and public**, and allowed to be read by an app like this one. No scraping of pages.
- **Reachable from the phone itself:** the app has no server, so every request goes straight from the device to the source.
- **No key, if possible.** If the source needs one, users enter their own in Settings and it is stored with `expo-secure-store`. Never commit a key, and the app must still work for every other league without one.
- **Enough for the three required screens:** a day's scores, standings and stat leaders. Game, team and player pages are optional.
- Add the source's hosts to the privacy line in [Features](#features) and [How it works](#how-it-works), and to the network rule in `CLAUDE.md`.

#### 2. Record fixtures

Tests never call the live API. They run on recorded responses (fixtures) in the adapter's `__fixtures__/` folder.

- Record each endpoint the adapter reads with `curl`, named after the endpoint and what it holds: `scoreboard-<date>.json`, `summary-<gameId>-<final|live|pre>.json`, `standings-now.json`.
- Cover the states the screens show: a scheduled game, a live game (ideally one in overtime and one between periods), a final game, and at least one team and one player.
- Trim what the adapter does not read (links, news, videos) to keep the files small, and write down how you trimmed them.
- In the adapter's own `CLAUDE.md`, record the commands you ran, which endpoint has which field, and what you have not seen yet (postponed games, playoffs). [`src/adapters/nba/CLAUDE.md`](src/adapters/nba/CLAUDE.md) shows the format.

#### 3. Write the adapter

One folder, `src/adapters/<league>/`, with the same files as the NBA's:

| File               | What it does                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `constants.ts`     | The league id, base URLs, leader categories, and other fixed lists                                        |
| `client.ts`        | HTTP: builds URLs, sends requests, turns failures into the adapter's error type                           |
| `errors.ts`        | `<League>ApiError` (the request failed) and `<League>ResponseError` (the response was not understood)     |
| `raw-types.ts`     | [zod](https://zod.dev/) schemas for the responses, with a "Verified on <date>" note on each               |
| `validate.ts`      | The validation policy, using the shared helpers in [`src/adapters/validate.ts`](src/adapters/validate.ts) |
| `mappers.ts`       | Raw responses to the app's types in [`src/domain.ts`](src/domain.ts)                                      |
| `adapter.ts`       | The `LeagueAdapter`: fetch, validate, map                                                                 |
| `<league>.test.ts` | Tests on the fixtures, including the contract suite (step 4)                                              |

How strict to be with each field:

- **Core fields fail the response:** ids, teams, scores, game state, standings wins and losses. Use plain zod, so a change in the source shows up as an error instead of wrong scores.
- **Minor fields are dropped with a warning:** a logo, a record, a TV channel. Use `minor()`. The warning reaches **Settings › Diagnostics**.
- **Lists drop bad items, not the whole list:** box score rows, goals, leaders. Use `lenientArray()`.
- **Extras are best effort:** when a screen adds data from a second request (the team page's schedule), catch its failure in the adapter, leave that part out and pass the failure on as a warning, so the rest of the screen still shows.
- Text the user sees uses Canadian spelling, including labels the adapter makes ("Centre", "Defence").

#### 4. Pass the contract suite

Every adapter must pass [`src/contract/league-adapter.contract.ts`](src/contract/league-adapter.contract.ts). In your test file, call `runLeagueAdapterContract()` with an adapter served from your fixtures, one whose requests always fail, and the dates and ids you recorded.

- **Required:** `getScores`, `getStandings`, `getLeaders`, and a `name` ("National Basketball Association").
- **Optional features**, one method each (`LeagueFeature` in `domain.ts`): `getGameDetail` (game page and box score), `getPlays` (play-by-play), `getTeam`, `getPlayer`, `getSpotlight`, `getSpecialEvents`. Leave a method out and the app hides everything that leads to it (game cards stop opening a page, for example). The suite skips it too; pass `[]` for its inputs.
- Start with the three required screens, ship, then add the pages one at a time.

#### 5. Describe the league's differences as data

These are the places a league differs. Each is a field the adapter fills, never a check in a screen:

- **Periods:** `Game.clock.label` and `PeriodScore.label` are worded by the adapter ("Q1", "2nd", "OT"). A live game lists every regulation period, with `null` scores for the ones not played yet.
- **Standings:** fill only the columns the league has (`points`, `otLosses`, `winPercent`, `gamesBehind`); empty columns are hidden. `conferenceRank` and `conferenceBands` mark seeds and what they mean (the NBA's playoffs, play-in and out). `wildCardSpots` and `wildCardRank` turn on the Wild Card view.
- **Leaders:** `leaderGroups` splits boards into choices (the NHL's Skaters and Goalies). Each board's `format` and `decimals` say how to show its values. Send each board best first, and the app works out whether lower is better.
- **Game page:** `teamStats`, `performers` (each team's top performer, for a league without three stars) and `standout` (the top performer on a live Scores card), with their lines worded by the adapter ("31 PTS, 8 REB", "2 G, 1 A").
- **Box scores and team stats:** `StatTable` columns are the adapter's, so any sport's stats fit.
- **Positions:** `PlayerDetail.positionName`, in words.
- If a sport needs something the domain cannot say (golf has no home and away), add a domain type first and bump `CACHE_VERSION` in `src/data/sports-data.ts`.

#### 6. Register it and give it a colour

- Register the adapter in `getServices()` in [`src/ui/data/sports-data-context.tsx`](src/ui/data/sports-data-context.tsx). It then appears in the league row on Scores, Standings and Leaders, and in the All view.
- Add its colour to `LEAGUE_TINTS` in [`src/ui/theme/palette.ts`](src/ui/theme/palette.ts): one shade for light and one for dark and pure black. `npm test` checks it reads on cards, the page and sunken panels in every scheme. It marks the league's name and bars only, never a fill under text.
- Team ids only need to be unique within the league: favourites are stored as `league:team`, so a `BOS` in two leagues is fine.
- Game start reminders work for every league: set `gameStartTerm` on the adapter ("Puck drop", "Tip-off") for the reminder's words, or it reads "Game start". Live scores work for every league too: `liveAlerts` says what to announce, each score (with the scorer, from the game page's goal list) or, for a sport that scores too often, late lead changes and overtime from the scores alone (with `regulationPeriods`).

#### 7. Before opening the pull request

- [ ] `npm run typecheck`, `npm test` and `npm run format:check` pass.
- [ ] `CI=1 npx expo export --platform android --output-dir <tmp dir>` bundles.
- [ ] On a phone, with the test APK from the pull request: the league row, Scores (All and the league alone), Standings, Leaders, and each page the adapter has, in light and dark, with the spoiler shield on and off.
- [ ] The README's Features and privacy lines name the league and its source.
- [ ] The adapter's `CLAUDE.md` lists its endpoints, fixtures and what is still unverified.

### Release signing (maintainers)

Releases are built by CI (`.github/workflows/android-apk.yml`) and signed with one release key. Android only installs an update over an APK signed with the same key, so create it once and keep a backup somewhere safe: if it is lost, every user has to uninstall to update.

```sh
keytool -genkeypair -v -keystore hat-trick-release.keystore -alias hat-trick \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 hat-trick-release.keystore   # macOS: base64 -i hat-trick-release.keystore
```

Then add four repository secrets (Settings > Secrets and variables > Actions):

| Secret                      | Value                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | the base64 output above                                                             |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password                                                               |
| `ANDROID_KEY_ALIAS`         | `hat-trick`                                                                         |
| `ANDROID_KEY_PASSWORD`      | the key password (the same as the keystore password unless you set a different one) |

Never commit the keystore (`*.keystore` is in `.gitignore`). Releases are created as drafts and published only after the signed APK is attached. If the secrets are missing or the build fails, the release stays an unpublished draft (visible only to maintainers) and the workflow says why.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to the National Hockey League, the National Basketball Association, ESPN or any team. NHL, NBA and team names and logos are trademarks of their respective owners, and player photos belong to the NHL, the NBA or ESPN. The app uses unofficial public APIs (`api-web.nhle.com` and ESPN's) that may change or stop working without notice. The repository contains no league logos, player photos or other trademarked assets; these images are loaded from the API at runtime.

This is a free, non-commercial project for personal use.

## Support

Hat Trick is free, with no ads or paid features. If you enjoy it, you can [buy me a coffee on Ko-fi](https://ko-fi.com/peakears).

[![Support me on Ko-fi](https://img.shields.io/badge/Ko--fi-buy%20me%20a%20coffee-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/peakears)

## License

[MIT](LICENSE). The bundled Barlow Semi Condensed font is under the [SIL Open Font License 1.1](https://openfontlicense.org).
