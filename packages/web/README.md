# Prayer Time — Web (PWA)

Progressive Web App for Prayer Time that works on modern browsers and can be installed on devices.

## Features

- Real-time prayer times
- Location detection and updates
- Browser notifications
- Offline support via service worker
- Responsive layout and theming

## Setup

```bash
cd packages/web
yarn install
```

## Development

```bash
yarn web:dev
```

App runs at `http://localhost:3000` by default.

## Building

```bash
yarn web:build
```

## PWA features

- Service worker for offline caching
- Web App Manifest (`public/manifest.json`)
- Installable on mobile and desktop

## Public sharing note

This README is prepared for public sharing. Replace any hosting credentials or environment-specific
secrets before publishing.

## License

Released under the Apache License, Version 2.0. See the repo-level `LICENSE` file.
