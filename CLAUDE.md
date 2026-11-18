# Sports API App

Clean sports scores app, NHL first, more leagues later. Data comes from public APIs.

Free, open-source Android app (Expo / React Native), not published to app stores. Users clone and build it themselves. Everything runs on the device: no backend server.

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
  - `format.ts`, `polling.ts`: pure helpers with no React Native imports, tested in `ui.test.ts`
  - `components/`: `GameCard`, `StatTableView`, `TeamLogo` (expo-image, since NHL logos are SVG), `States` (loading, error, offline banner)
- `app/`: Expo Router routes. `(tabs)/` holds Scores (`index`), Standings, Leaders; `game/[id]` is the box score.
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
- Never commit league logos or other trademarked assets. Logo URLs are fetched from the API at runtime.

## On-device constraints

- Live updates come from polling while the app is open (live game ~15-30s, final rarely), driven by cache TTL.
- No server means no reliable push alerts while the app is closed (Android background tasks run every ~15 min at best). Scheduled local notifications (e.g. game starting) are fine.
- Android/iOS only: the NHL API is not expected to allow browser (CORS) requests, so an Expo web build would need a proxy.

## Next steps

1. ~~Housekeeping: `LICENSE` (MIT), README with disclaimer, `.gitignore`.~~ Done.
2. ~~Verify raw types against live responses.~~ Done.
3. ~~Add zod schemas at the adapter boundary.~~ Done.
4. ~~Add a shared contract test suite that any `LeagueAdapter` must pass.~~ Done.
5. ~~On-device cache, TTL by game status, last-known data offline.~~ Done.
6. Expo Android app (SDK 58, Expo Router, AsyncStorage cache). Screens built and the bundle compiles; still needs testing on a real device or emulator. When it works, release 1.0.0.
7. APK builds in CI, before 1.0.0:
   - First fix the version: `app.json` hard-codes `version` 0.1.0 and release-please only bumps `package.json`. Derive `version` and Android `versionCode` from `package.json` (e.g. an `app.config.ts`), so every APK reports the release version and updates install over older ones.
   - Release job: when release-please creates a release, build a signed release APK (`expo prebuild` + Gradle) and upload it to that GitHub Release (e.g. `sports-scores-vX.Y.Z.apk`).
   - Optional: build the APK on PRs too and keep it as a short-lived workflow artifact for testing a branch.
   - Signing: one keystore, created once and stored as GitHub repo secrets (keystore + passwords), never committed. Updates only install over an APK signed with the same key, so keep a backup.
8. Later: game-start local notifications, favorite teams, a league picker once there is a second league.

## Commits and releases

- Commit messages must follow Conventional Commits (`type(scope): subject`). A husky `commit-msg` hook runs commitlint locally, and CI lints every pushed commit.
- Types: `feat` (new feature, minor bump), `fix` (bug fix, patch bump), `feat!:` or a `BREAKING CHANGE:` footer (major bump; minor while on 0.x). `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style` cause no release on their own (`perf` is listed in the changelog).
- Scopes are optional; use the area, e.g. `fix(nhl): ...`, `feat(app): ...`, `test(contract): ...`.
- release-please (`.github/workflows/release-please.yml`) keeps a release PR open with the next version and CHANGELOG. Merging it tags `vX.Y.Z` and creates a GitHub Release. Never edit the version in `package.json` or `.release-please-manifest.json` by hand.
- The project stays on 0.x until the Android app works; then release 1.0.0 (a `Release-As: 1.0.0` footer on a commit forces it).

## Commands

- `npm install`, `npm run typecheck` (app + tests), `npm test` (vitest)
- `npm start` (Expo dev server, open in Expo Go), `npm run android` (native build, needs the Android SDK)
- `CI=1 npx expo export --platform android --output-dir <tmp dir>` checks that Metro can bundle the app without a device.
- Add Expo packages with `npx expo install <pkg>` so versions match the SDK; `npx expo install --check` verifies. `react-dom` is pinned to the same version as `react` (expo-router pulls it in for web).
- `npm audit` reports picomatch/minimatch ReDoS advisories via vitest and Metro/Expo CLI: build tooling only, nothing ships in the app. Do not run `npm audit fix --force` (it downgrades vitest and breaks Expo).
