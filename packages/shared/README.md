# Shared package — Prayer Time

This package contains shared logic, types, and utilities used by the web, mobile, and desktop apps.

## Structure

```
src/
├─ calculator.ts     # Prayer time calculation logic
├─ types.ts          # TypeScript interfaces
├─ constants.ts      # Constants
├─ utils.ts          # Utility helpers
└─ index.ts          # Exports
```

## Key exports

- PrayerTimeCalculator — calculate prayer times for a date and location
- formatTime(date) — format a Date object as HH:MM
- debounce / throttle utilities

## Building

```bash
cd packages/shared
yarn build
```

## Development

```bash
yarn workspace @prayer/shared build
```

## Public sharing note

This package README is safe for public sharing. Keep any private keys or environment-specific
configs out of the repository before publishing.

## License

Released under the Apache License, Version 2.0. See the repository `LICENSE` file.
