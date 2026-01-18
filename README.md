# Prayer Time — Multi-platform

Prayer Time is a multi-platform application that provides accurate prayer times and notifications.
It targets web (PWA), mobile (React Native), and desktop (Electron) platforms with shared business logic and UI where possible.

## Project structure

```
packages/
├─ shared/    # Shared utilities, types, and core logic
├─ web/       # React PWA
├─ mobile/    # React Native app (iOS & Android)
└─ desktop/   # Electron desktop app

package.json  # Monorepo root
```

## Key features

- Real-time prayer times calculation
- Location-based updates
- Progressive Web App (offline support)
- Mobile apps for iOS and Android
- Desktop app for macOS, Windows, and Linux
- Shared utilities and components across platforms

## Prerequisites

- Node.js 18+
- Yarn 3.x
- For iOS development: Xcode (macOS)
- For Android development: Android Studio
- For Android development: JDK 17+

## Quick install (monorepo)

From the repository root:

```bash
yarn install
```

See each package's README for package-specific install and run commands.

## Development scripts (examples)

Web (dev server)

```bash
yarn workspace @prayer/web dev
```

Mobile (Metro / run on simulator)

```bash
yarn workspace @prayer/mobile start
yarn workspace @prayer/mobile ios
yarn workspace @prayer/mobile android
```

Desktop (Electron)

```bash
yarn workspace @prayer/desktop dev
```

## Building for production

Build each package using its README instructions (examples):

```bash
yarn workspace @prayer/web build
yarn workspace @prayer/mobile build
yarn workspace @prayer/desktop build
```

## Documentation

See the package READMEs for detailed setup and configuration:

- `packages/web/README.md`
- `packages/mobile/README.md`
- `packages/desktop/README.md`
- `packages/shared/README.md`

## Public sharing note

This repository has been cleaned for public sharing. Personal or environment-specific notes were removed.

If you plan to publish this project publicly, consider adding a `LICENSE` file and updating any credentials or private configuration files that may still be present.

## Contributing

Contributions are welcome. Please open issues or pull requests and follow the repo's code style and commit conventions.

## License

This project is distributed under the Apache License, Version 2.0. See the `LICENSE` file for the full text and remember to update the copyright notice with your name and the current year before publishing.
