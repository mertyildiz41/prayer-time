# Prayer Time — Desktop

Electron-based desktop application for Prayer Time, supporting macOS, Windows, and Linux.

## Features

- Real-time prayer times
- System tray integration
- Native notifications
- Offline support
- Cross-platform compatibility

## Prerequisites

- Node.js 18+
- Yarn 3.x

## Setup

```bash
cd packages/desktop
yarn install
```

## Development

```bash
yarn dev
```

This starts the React dev server and launches Electron in development mode.

## Building & Packaging

```bash
yarn build
yarn dist   # create distribution packages
```

## Project structure

```
src/
├─ main.ts
├─ preload.ts
├─ App.tsx
└─ index.tsx

public/
└─ index.html
```

## Public sharing note

This README is prepared for public sharing. Remove any local or platform-specific notes before publishing.

## License

Released under the Apache License, Version 2.0. Refer to the repository-level `LICENSE` file.
