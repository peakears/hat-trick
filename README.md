# Sports Scores

A clean, open-source sports scores app for Android. NHL first, more leagues later.

Everything runs on your device: the app talks to public sports APIs directly, with no backend server to host.

> **Status: early development.** The NHL app runs, but has not had much testing on real devices yet. See [Roadmap](#roadmap).

## Features

- Scores for any date, with live game clocks
- Standings
- Stat leaders
- Box scores
- Works offline with the last data it fetched

## Install

Each [release](https://github.com/peakears/sports-scores/releases) has an APK attached (`sports-scores-vX.Y.Z.apk`).

1. On your Android phone, open the latest release and download the `.apk`.
2. Open the downloaded file. Android asks you to allow installs from that app (your browser or Files): allow it, then tap **Install**.
3. To update, install the newer APK the same way. It replaces the old version and keeps your data.

Android may warn that the app is from an unknown developer, because it is not from the Play Store. That is expected for a sideloaded app.

Every pull request also gets a test APK, under **Artifacts** on its CI run. Test APKs are signed with a different key than releases, so Android will not install one over a release (or the other way round): uninstall first.

## Getting started

Requires Node.js 22.13 or newer.

```sh
git clone https://github.com/peakears/sports-scores.git
cd sports-scores
npm install
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
- `src/ui/`: React Native pieces shared by screens (polling hook, components, formatting)
- `app/`: the screens, using [Expo Router](https://docs.expo.dev/router/introduction/) (one file per route)

Adding a league means writing a new adapter that implements `LeagueAdapter` and passes the shared contract tests in `src/contract/`. Nothing above it changes.

## Roadmap

1. ~~Project housekeeping~~
2. ~~Verify NHL data types against live API responses~~
3. ~~Runtime validation of API responses (zod)~~
4. ~~Shared contract tests for adapters~~
5. ~~On-device cache, refreshed based on game status~~
6. Android app (Expo / React Native): scores, standings, leaders and box scores work; needs real-device testing
7. Game-start notifications, favorite teams, more leagues

## Contributing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org), because releases are versioned from them:

| Commit | Example | Release |
|---|---|---|
| `fix:` | `fix(nhl): handle missing goalie stats` | patch (0.1.0 -> 0.1.1) |
| `feat:` | `feat: add NBA adapter` | minor (0.1.0 -> 0.2.0) |
| `feat!:` or `BREAKING CHANGE:` footer | `feat!: rename Game.startTime` | major (minor while on 0.x) |
| `docs:`, `test:`, `refactor:`, `chore:`, `ci:` ... | `docs: fix typo` | none |

`npm install` sets up a git hook that checks each commit message. Releases are made by merging the release PR that release-please keeps open.

### Release signing (maintainers)

Releases are built by CI (`.github/workflows/android-apk.yml`) and signed with one release key. Android only installs an update over an APK signed with the same key, so create it once and keep a backup somewhere safe: if it is lost, every user has to uninstall to update.

```sh
keytool -genkeypair -v -keystore sports-scores-release.keystore -alias sports-scores \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 sports-scores-release.keystore   # macOS: base64 -i sports-scores-release.keystore
```

Then add four repository secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 output above |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `sports-scores` |
| `ANDROID_KEY_PASSWORD` | the key password (the same as the keystore password unless you set a different one) |

Never commit the keystore (`*.keystore` is in `.gitignore`). If the secrets are missing, the release still happens but no APK is attached, and the workflow says why.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to the National Hockey League or any team. NHL and team names and logos are trademarks of their respective owners. The app uses an unofficial public API (`api-web.nhle.com`) that may change or stop working without notice. The repository contains no league logos or other trademarked assets; logo images are loaded from the API at runtime.

This is a free, non-commercial project for personal use.

## License

[MIT](LICENSE)
