# Hat Trick (sports scores app)

Clean sports scores app, NHL first, more leagues later. The app is called Hat Trick (Android package `io.github.peakears.hattrick`); the GitHub repo (`peakears/hat-trick`) and npm package use `hat-trick` too. Data comes from public APIs.

Free, open-source Android app (Expo / React Native), not published to app stores. Released and working on real devices (1.0.0, then 1.1.0 on 2026-11-19, 1.2.0 and 1.3.0 on 2026-11-20). Users install the APK attached to each GitHub Release, or build it themselves. Everything runs on the device: no backend server.

## Architecture (data flows up)

adapters -> domain model -> on-device cache -> Expo app UI

- `src/domain.ts`: league-agnostic types and the `LeagueAdapter` contract. Nothing here knows raw API shapes.
- `src/registry.ts`: `AdapterRegistry`, looks up an adapter by league id.
- `src/adapters/nhl/`: NHL adapter, split by responsibility:
  - `client.ts` HTTP (timeout, status checks), `errors.ts`, `constants.ts`
  - `raw-types.ts` zod schemas for raw responses (types inferred from them), `validate.ts` validation policy
  - `mappers.ts` raw -> domain, `adapter.ts` orchestration (fetch -> validate -> map)
  - `__fixtures__/` real responses recorded 2026-11-17, `nhl.test.ts` NHL tests
- `src/data/`: on-device data layer, the only thing the UI calls:
  - `sports-data.ts` `SportsData`: cache-first reads returning `Fetched<T>` (`{ data, meta }`), offline fallback to last known data, shared in-flight requests, `prune()`
  - `freshness.ts` TTL rules by game status, `store.ts` `KeyValueStore` interface + `MemoryStore`, `types.ts` `DataMeta`
- `src/ui/`: React Native code shared by screens:
  - `sports-data-context.tsx` creates the one `SportsData` (NHL adapter + `AsyncStorageStore`) and prunes on start; `LEAGUE` is the shown league
  - `use-polled.ts` `usePolled(key, load)`: loads through `SportsData`, re-polls at `meta.staleAt` (timing in `polling.ts`), pauses in the background, `refresh()` forces
  - `format.ts`, `polling.ts`: pure helpers with no React Native imports, tested in `ui.test.ts`. `format.ts` also holds `sortGamesForScores()` (Scores order: live, scheduled, final, postponed; then start time, then id), `recordLabel()`/`teamRecord()` (season record from standings) and the date picker conversions (`dateToPickerValue()`/`pickerValueToDate()`, local noon so DST cannot shift the day)
  - `favorites.ts` (pure: `toggleFavorite`, `involvesFavorite`), `reminders.ts` (pure: `planReminders` picks upcoming favourite-team games, `diffReminders` turns what is scheduled into the plan) with `reminders-native.ts` (the only `expo-notifications` code) and `use-reminders.ts` (sync on settings change and foreground; tap opens the game)
  - `updates.ts` (pure: version compare, GitHub release parsing, daily-limited `checkForUpdate`, dismissal) with `update-context.tsx` (`UpdateProvider`, `useUpdate()`, `APP_VERSION`) and `links.ts` (repo URLs, `reportProblemUrl`)
  - `broadcasts.ts` (pure: `channelsFor(game, region)` keeps one country's channels, national first then home/away feeds, one entry per network; `summarizeChannels` caps a Scores card at 3 and counts the rest as "+N"; `resolveRegion(preference, deviceRegion)`) with `use-tv-region.ts` (`useTvRegion()`: the `tvRegion` setting, or the phone's region from `expo-localization`, no permission and no network). `ChannelLine` (Scores card footer, national bold, nothing when empty) and `WhereToWatch` (full list on the game page)
  - `spoilers.ts` (pure: `Reveals` state, `isGameHidden` (only live and final games have a score to hide), `statusLabelFor` (a hidden final says just "Final", no OT/SO)) with `spoiler-context.tsx` (`SpoilerProvider` inside `SettingsProvider`, `useSpoilers()`; reveals are in memory only and reset when the shield is switched on). `components/ShieldUi.tsx` (`RevealButton`) and `ShieldBanner` ("Show all scores" on Scores). The shield only changes what is drawn: data is fetched and cached as usual. A hidden game also drops winner bold/dim styling on cards, the SOG pill, the box score and (for finals) season records, which the standings already count
  - `use-today.ts` `useScoresToday()`: the Scores tab's "Today", which rolls over at 5am local (`DAY_ROLLOVER_HOUR`) so late games stay under Today
  - `settings.ts` (pure: `Settings`, defaults, zod parse with per-field fallback, stored under `settings:v1`, outside `cache:`) and `settings-context.tsx` (`useSettings()`; applies the theme with `Appearance.setColorScheme` and holds the splash screen until it is loaded). `TeamLogo` reads `showLogos`
  - `components/`: `GameCard`, `StatTableView`, `TeamLogo` (expo-image, since NHL logos are SVG; abbreviation badge when there is no URL or `showLogos` is off), `States` (loading, error, offline banner), `Segmented` (2-3 option switch), `DatePickerButton` (native Android date dialog via `@react-native-community/datetimepicker`, with a "Today" button; renders nothing on iOS)
- `app/`: Expo Router routes. `(tabs)/` holds Scores (`index`), Standings, Leaders, Settings; `game/[id]` is the game page (score, season records, SOG, box score). The game page also loads standings (`usePolled("standings")`, same cache key as the Standings tab) for the season records, because the box score has none and the scores endpoint only has them before a game starts; records are hidden if standings fail, and show the current record even for older games. The root layout wraps the app in `SettingsProvider` (outermost) and `SportsDataProvider`. The root layout and `game/[id]` export an `ErrorBoundary` (`CrashScreen`), so a render error never leaves a blank screen.
- `app.json` holds static Expo config; `app.config.ts` adds `version` and Android `versionCode` from `package.json` (1.2.3 -> 1002003), so never put a version in `app.json`. The native `android/` project is generated by `expo prebuild` and not committed.
- `src/contract/league-adapter.contract.ts`: shared suite every `LeagueAdapter` must pass. A new league's test file calls `runLeagueAdapterContract()` with fixture-backed adapters.

## Rules

- Only an adapter may touch raw API shapes. Everything above it uses domain types.
- Validation policy: core fields (ids, teams, scores, game state, standings W/L) use plain zod and throw `NhlResponseError` on mismatch. Minor fields use `minor()` and are dropped with an `onWarning` call. Box score player rows use `lenientArray()`, so one bad row is dropped, not the whole game.
- Team ids are three-letter abbreviations (standings has no numeric id).
- The NHL API (api-web.nhle.com) is unofficial. `raw-types.ts` was verified against live responses on 2026-11-17; postponed game states and standings `clinchIndicator` are still unverified.
- All code outside tests must run in React Native (Hermes): no Node-only or browser-only APIs. `tsconfig.json` (extends `expo/tsconfig.base`) has no Node types to enforce this; tests use `tsconfig.test.json`. Hermes has no `AbortSignal.timeout`, so `client.ts` uses an `AbortController` and timer.
- The UI never calls adapters directly; screens call `SportsData` through `usePolled`, which polls around `meta.staleAt`. TTLs live in `freshness.ts` (live 20s, starting soon 1 min, final >1 day 7 days).
- Cached entries are stored under `cache:` keys with a `CACHE_VERSION`. Bump it whenever the shape of a domain type changes, or old cached data will be read as the new shape.
- Tests never hit the live API. Use recorded fixtures; simulate drift by editing a fixture in the test.
- API keys (for future leagues that need them) are entered by the user in the app and stored with `expo-secure-store`. Never commit keys; keyless leagues like NHL must work with no setup.
- Update checks (`src/ui/updates.ts`, `update-context.tsx`): the app asks `api.github.com/repos/peakears/hat-trick/releases/latest` at most once a day (switch in Settings; "Check now" forces it) and shows a banner on Scores plus a row in Settings > About. It never downloads or installs anything: it opens the release or APK link in the browser, and only links under `https://github.com/peakears/hat-trick/` are accepted. This and the NHL API are the app's only network calls; keep it that way and keep the README's privacy line true.
- Never commit league logos or other trademarked assets. Logo URLs are fetched from the API at runtime. The app's own icon in `assets/images/` is original artwork.

## On-device constraints

- Live updates come from polling while the app is open (live game ~15-30s, final rarely), driven by cache TTL.
- No server means no reliable push alerts while the app is closed (Android background tasks run every ~15 min at best). Scheduled local notifications are fine: puck drop reminders (#33) use `expo-notifications` date triggers, planned by the pure `src/ui/reminders.ts` and scheduled by `reminders-native.ts` (`use-reminders.ts` keeps them in sync with the settings and schedule on start and on foreground, looking 7 days ahead). Android may delay them a few minutes (no exact-alarm permission). Note `expo-notifications` bundles Google's Firebase Messaging on Android, which matters for F-Droid/IzzyOnDroid (#27).
- Android/iOS only: the NHL API is not expected to allow browser (CORS) requests, so an Expo web build would need a proxy.

## Next steps

1. ~~Housekeeping: `LICENSE` (MIT), README with disclaimer, `.gitignore`.~~ Done.
2. ~~Verify raw types against live responses.~~ Done.
3. ~~Add zod schemas at the adapter boundary.~~ Done.
4. ~~Add a shared contract test suite that any `LeagueAdapter` must pass.~~ Done.
5. ~~On-device cache, TTL by game status, last-known data offline.~~ Done.
6. ~~Expo Android app (SDK 58, Expo Router, AsyncStorage cache).~~ Done: released as 1.0.0 and tested on a real device (Samsung, Expo Go).
7. ~~APK builds in CI: version from `package.json`, signed APK on each GitHub Release, test APK on PRs.~~ Done. Before the first release with an APK, the maintainer creates the release keystore and adds its four secrets (README, "Release signing").
8. ~~App name, icon and splash screen.~~ Done: "Hat Trick", a blue LED dot-matrix "HT". Generated by `scripts/icons/generate.py` (SVGs in `assets/images/src/`) and rendered to `assets/images/*.png` by `scripts/icons/render.cjs`; change the script, not the PNGs. The generator is kept (rather than only the PNGs) so colour variants can be produced for alternate app icons in Settings (issue #9).
9. After 1.0. Shipped in 1.1.0: Settings tab, calendar date picker, live games first on Scores, season records and SOG pill on the game page. Shipped in 1.2.0: favourite teams, puck drop reminders, update check and Settings > About, Prettier and the draft-then-publish release flow. Shipped in 1.3.0: TV channels, spoiler shield, records on upcoming game cards, section headers on Scores. Still to do, roughly in this order (each has a GitHub issue with details; also open: team pages #52 (last 10 and goal difference live there, not as Standings columns), customization options #53, standings views #38, three stars #39, play-by-play #28, starting goalies #30, README screenshots #18 (later, nearer a finished app), clinched markers #25 (wait for the playoffs), goal summary #19, Dependabot #32, F-Droid/IzzyOnDroid audit #27, Obtainium README section #26, iOS IPA #44):
   - ~~**Settings tab** (#4): theme, "Show team logos", "Show betting info" (off, no effect until betting lands).~~ Done. New preferences go in `src/ui/settings.ts` (add a default and a `.catch()` schema field; no version bump needed).
   - ~~**Calendar date picker** (#5)~~ Done: `DatePickerButton` (native Android dialog via `@react-native-community/datetimepicker`, with a "Today" button) next to the date label; picking today keeps following today.
   - ~~**Favourite teams** (#6, #31)~~ Done: `favoriteTeams` (team ids) in the settings; `FavoriteStar` toggles a team from Standings and the game page; `sortGamesForScores(games, favorites)` puts their games first; game cards draw their names in the accent colour (no star, which crowded the status column); Standings marks them with an accent bar; Settings lists and clears them (`src/ui/favorites.ts`). Puck drop reminders (#33) build on it.
   - ~~**TV channels**~~ Done: `Game.broadcasts` (network, country, market national/home/away) from the NHL `tvBroadcasts` list (`/score` and box score), parsed with `lenientArray` so a bad listing is dropped, never failing the scores. Shown for the user's country only (`tvRegion` setting: Auto, Canada, US). The raw `network` strings are short codes ("SN", "ABTV " with a trailing space), so the mapper trims them. `CACHE_VERSION` was bumped because `Game` gained a field.
   - ~~**Spoiler shield** (#29)~~ Done: `spoilerShield` setting (off by default). Hides scores on Scores cards and the game page, and box scores, until tapped. Per-game reveal and "Show all scores". Standings and Leaders are deliberately not shielded.
   - ~~**Records on upcoming game cards** (#21)~~ Done: `GameSide.record` ("13-7-1") comes from the scores response, which only sends it before a game starts, so no standings fetch is needed. The card shows it on the right of each team row where the score will go. `CACHE_VERSION` is 3.
   - ~~**Section headers on Scores** (#23)~~ Done: `groupGamesForScores()` (same order as `sortGamesForScores`) feeds a `SectionList`: "Your teams" (favourite teams' games), then Live, Upcoming, Final, Postponed; empty sections are left out.
   - **Player pages** (#15): tap a player in a box score or on Leaders for bio (age from birth date, hometown, position, draft) and season/career/last-5 stats (goalie stats differ). Source: `api-web.nhle.com/v1/player/{id}/landing` (fields listed in the issue). Needs `LeagueAdapter.getPlayer()`, a `PlayerDetail` domain type, fixtures, a contract test and a `player/[id]` route. `StatRow.player.id` and `LeaderEntry.player.id` already hold the NHL id.
   - **Betting info** (#7) (odds/lines), only if a usable source exists, and only behind the settings switch. First check whether the NHL API exposes partner odds; otherwise a keyed odds API with a free tier, where each user enters their own key (stored with `expo-secure-store`, per the API key rule). Display only: no sportsbook links or affiliate codes (that would make the app commercial). Odds are restricted content in some places, so keep it opt-in and add a note in the README.
   - **Alternate app icons** (#9): colour variants generated by `scripts/icons/generate.py`, bundled in the APK as `activity-alias` entries and picked in Settings. Needs a config plugin for `expo prebuild`.
   - **Second league** (#8) (NBA or NFL first; both fit the game/standings/box score model, and unofficial keyless JSON endpoints exist for both). Needs a league switcher in the UI (replacing the fixed `LEAGUE` constant) and a new adapter that passes `runLeagueAdapterContract()`. PGA comes later: golf is tournaments and leaderboards rather than games between two teams, so it needs new domain types, not just an adapter.

## Commits and releases

- Commit messages must follow Conventional Commits (`type(scope): subject`). A husky `commit-msg` hook runs commitlint locally, and CI lints every pushed commit.
- Types: `feat` (new feature, minor bump), `fix` (bug fix, patch bump), `feat!:` or a `BREAKING CHANGE:` footer (major bump; minor while on 0.x). `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style` cause no release on their own (`perf` is listed in the changelog).
- Scopes are optional; use the area, e.g. `fix(nhl): ...`, `feat(app): ...`, `test(contract): ...`.
- release-please (`.github/workflows/release-please.yml`) keeps a release PR open with the next version and CHANGELOG. Merging it creates a draft GitHub Release for `vX.Y.Z` (`"draft": true` in `release-please-config.json`); the workflow builds the APK from the release commit, attaches it, and only then publishes the release, which creates the tag. Never edit the version in `package.json` or `.release-please-manifest.json` by hand.
- APKs: `.github/workflows/android-apk.yml` (`expo prebuild` + Gradle, JDK 17) is called by release-please.yml when a release is created (signed with the release key from the `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` secrets, attached to the draft release, which is then published) and by ci.yml on pull requests (debug key, workflow artifact). PR builds compile native code for `arm64-v8a` only; releases add `armeabi-v7a` (the `architectures` input). Never commit a keystore.
- Released 1.0.0, 1.1.0, 1.2.0 and 1.3.0 (plus patch 1.2.1). Normal features are `feat` (minor) and fixes are `fix` (patch); avoid breaking changes (major) unless there is a real reason.
- **Before merging a release PR**, update the docs first, in a `docs/release-X.Y` PR merged to `main` beforehand: the README roadmap (add the new version's line), the "Shipped in" and "Released" lines here, the open-issues list in Next steps, and any README feature text. Merging the release PR publishes straight away, so docs written afterwards describe a release that is already out. Open that docs PR as soon as the feature PRs are merged and the release PR appears, and check the release PR's version and changelog at the same time.
- Workflow: one branch per feature, cut from `main` (`feat/...`, `fix/...`, `docs/...`), one PR each, squash-merged (the PR title becomes the commit, so it must be a Conventional Commit). PR bodies have a summary and a Testing checklist (typecheck, tests, bundle, on a device).
- Several open feature PRs usually conflict in `src/ui/format.ts` and the import line of `src/ui/ui.test.ts` (both sides add code next to each other). Merge one, rebase the next onto `main`, keep both sides, run typecheck + tests, force-push with `--force-with-lease`.

## Commands

- `npm install`, `npm run typecheck` (app + tests), `npm test` (vitest)
- `npm run format` (Prettier, `printWidth` 120, config in `.prettierrc.json`, exclusions in `.prettierignore`); CI runs `npm run format:check` and fails on unformatted files. Run `npm run format` before committing.
- `npm start` (Expo dev server, open in Expo Go), `npm run android` (native build, needs the Android SDK)
- Testing with Expo Go: restarting the dev server (even with `-c`) does not reload the JS on the phone; Expo Go reconnects and keeps the old bundle. Press `r` in the dev server terminal (or shake the phone, Reload) after switching branches. The same reload can be sent from a script: open a WebSocket to `ws://localhost:8081/message` and send `{"version":2,"method":"reload"}`. `http://localhost:8081/json/list` shows which devices are connected.
- `CI=1 npx expo export --platform android --output-dir <tmp dir>` checks that Metro can bundle the app without a device.
- Add Expo packages with `npx expo install <pkg>` so versions match the SDK; `npx expo install --check` verifies. Where api.expo.dev is unreachable, take the version from `node_modules/expo/bundledNativeModules.json` and `npm install` it. `react-dom` is pinned to the same version as `react` (expo-router pulls it in for web).
- `npm audit` reports picomatch/minimatch ReDoS advisories via vitest and Metro/Expo CLI: build tooling only, nothing ships in the app. Do not run `npm audit fix --force` (it downgrades vitest and breaks Expo).
