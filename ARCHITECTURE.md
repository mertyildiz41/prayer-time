# Architecture Overview

Prayer Time ships as a monorepo containing shared business logic and three platform targets (web, mobile, desktop).

## High-level layout

```
packages/
├─ shared/   # Types, calculator, utilities
├─ web/      # React PWA
├─ mobile/   # React Native (iOS/Android)
└─ desktop/  # Electron + React
```

All packages consume the shared module for prayer-time calculations and TypeScript types. Each platform manages its own entry point, bundler, and platform-specific configuration.

## Data flow

1. UI requests prayer times for a given date/location.
2. Shared `PrayerTimeCalculator` computes times using configured methods/madhhab.
3. Platform component renders results, optionally storing preferences locally (AsyncStorage on mobile, local storage on web, Electron store on desktop).

## Platform notes

- **Web**: React, Vite/CRA tooling, service worker, installable PWA.
- **Mobile**: React Native, Metro bundler, uses native APIs for geolocation/notifications.
- **Desktop**: Electron main process handles lifecycle, preload exposes safe IPC bridge, React renders the UI.

## Shared package contents

- `types.ts` — Entities (`DailyPrayerTimes`, `Location`, `AppSettings`).
- `calculator.ts` — Exports `PrayerTimeCalculator` with helpers to find next prayer and countdown.
- `constants.ts` — Calculation methods, denominations, locales.
- `utils.ts` — Formatting, debounce/throttle utilities.

## Build & scripts

- Use Yarn workspaces; run commands via `yarn workspace <name> <script>`.
- Production builds live under each package (`build/`, `dist/`, platform-specific output).
- Continuous integration can invoke individual workspace builds in parallel.

## License

The codebase is provided under the Apache License 2.0; see the repository `LICENSE` file for terms.

## Public sharing note

This document omits internal credentials and is safe to publish. Update environment variable names or architecture diagrams as the system evolves.
