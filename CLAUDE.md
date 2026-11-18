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
- `src/contract/league-adapter.contract.ts`: shared suite every `LeagueAdapter` must pass. A new league's test file calls `runLeagueAdapterContract()` with fixture-backed adapters.

## Rules

- Only an adapter may touch raw API shapes. Everything above it uses domain types.
- Validation policy: core fields (ids, teams, scores, game state, standings W/L) use plain zod and throw `NhlResponseError` on mismatch. Minor fields use `minor()` and are dropped with an `onWarning` call. Box score player rows use `lenientArray()`, so one bad row is dropped, not the whole game.
- Team ids are three-letter abbreviations (standings has no numeric id).
- The NHL API (api-web.nhle.com) is unofficial. `raw-types.ts` was verified against live responses on 2026-11-17; postponed game states and standings `clinchIndicator` are still unverified.
- Adapter code must run in React Native (Hermes): no Node-only or browser-only APIs. `tsconfig.json` has no Node types to enforce this; tests use `tsconfig.test.json`. `AbortSignal.timeout` in `client.ts` needs a fallback.
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
5. On-device cache (MMKV or SQLite), TTL by game status, last-known data offline.
6. Expo Android app.

## Commands

- `npm install`, `npm run typecheck` (app + tests), `npm test` (vitest)
- `npm audit` reports a picomatch ReDoS via vitest: dev-only, no patched version exists. Do not run `npm audit fix --force` (it downgrades vitest).
