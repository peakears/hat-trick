# Sports Scores

A clean, open-source sports scores app for Android. NHL first, more leagues later.

Everything runs on your device: the app talks to public sports APIs directly, with no backend server to host.

> **Status: early development.** The NHL data layer exists; the Android app does not yet. See [Roadmap](#roadmap).

## Features (planned)

- Scores for any date, with live game clocks
- Standings
- Stat leaders
- Box scores
- Works offline with the last data it fetched

## Getting started

Requires Node.js 18 or newer.

```sh
git clone https://github.com/peakears/sports-scores.git
cd sports-scores
npm install
npm run typecheck
npm test
```

The NHL needs no API key or signup. Leagues added later may need a key; you will enter it in the app's settings, where it stays on your device. Never commit API keys to the repo.

## How it works

Data flows up through layers, and only the bottom layer knows any league's raw API format:

```
league adapters -> domain model -> on-device cache -> app UI
```

- `src/domain.ts`: league-agnostic types and the `LeagueAdapter` contract
- `src/registry.ts`: looks up an adapter by league id
- `src/adapters/nhl/`: the NHL adapter

Adding a league means writing a new adapter that implements `LeagueAdapter` and passes the shared contract tests in `src/contract/`. Nothing above it changes.

## Roadmap

1. ~~Project housekeeping~~
2. ~~Verify NHL data types against live API responses~~
3. ~~Runtime validation of API responses (zod)~~
4. ~~Shared contract tests for adapters~~
5. On-device cache, refreshed based on game status
6. Android app (Expo / React Native)

## Disclaimer

This project is not affiliated with, endorsed by, or connected to the National Hockey League or any team. NHL and team names and logos are trademarks of their respective owners. The app uses an unofficial public API (`api-web.nhle.com`) that may change or stop working without notice. The repository contains no league logos or other trademarked assets; logo images are loaded from the API at runtime.

This is a free, non-commercial project for personal use.

## License

[MIT](LICENSE)
