# Sports API App

Clean sports scores app, NHL first, more leagues later. Data comes from public APIs.

Free, open-source Android app (Expo / React Native), not published to app stores. Users clone and build it themselves. Everything runs on the device: no backend server.

## Architecture (data flows up)

adapters -> domain model -> on-device cache -> Expo app UI

- `src/domain.ts`: league-agnostic types and the `LeagueAdapter` contract. Nothing here knows raw API shapes.
- `src/registry.ts`: `AdapterRegistry`, looks up an adapter by league id.
- `src/adapters/nhl/`: NHL adapter, split by responsibility:
  - `client.ts` HTTP (timeout, status checks), `errors.ts`, `constants.ts`
  - `raw-types.ts` raw response shapes, `mappers.ts` raw -> domain, `adapter.ts` orchestration

## Rules

- Only an adapter may touch raw API shapes. Everything above it uses domain types.
- Team ids are three-letter abbreviations (standings has no numeric id).
- The NHL API (api-web.nhle.com) is unofficial. Box score fields, clock fields and standings division/streak fields in `raw-types.ts` were not verified against live responses yet.
- Adapter code must run in React Native (Hermes): no Node-only or browser-only APIs. `AbortSignal.timeout` in `client.ts` needs a fallback.
- API keys (for future leagues that need them) are entered by the user in the app and stored with `expo-secure-store`. Never commit keys; keyless leagues like NHL must work with no setup.
- Never commit league logos or other trademarked assets. Logo URLs are fetched from the API at runtime.

## On-device constraints

- Live updates come from polling while the app is open (live game ~15-30s, final rarely), driven by cache TTL.
- No server means no reliable push alerts while the app is closed (Android background tasks run every ~15 min at best). Scheduled local notifications (e.g. game starting) are fine.
- Android/iOS only: the NHL API is not expected to allow browser (CORS) requests, so an Expo web build would need a proxy.

## Next steps

1. ~~Housekeeping: `LICENSE` (MIT), README with disclaimer, `.gitignore`.~~ Done.
2. Verify raw types against live responses (curl the endpoints).
3. Add zod schemas at the adapter boundary (fail loudly on API drift).
4. Add a shared contract test suite that any `LeagueAdapter` must pass.
5. On-device cache (MMKV or SQLite), TTL by game status, last-known data offline.
6. Expo Android app.

## Commands

- `npm install`, `npm run typecheck`
