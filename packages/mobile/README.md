# Prayer Time — Mobile

React Native mobile application for Prayer Time (iOS & Android).

## Features

- Real-time prayer times
- Location-based updates
- Push notifications
- Offline caching
- Dark mode and multiple languages

## Prerequisites

- Node.js 18+
- Yarn 3.x
- Xcode (for iOS)
- Android Studio (for Android)

## Setup

```bash
cd packages/mobile
yarn install
```

For iOS:

```bash
cd ios
pod install
cd ..
yarn ios
```

For Android:

```bash
yarn android
```

## Development

```bash
yarn start
yarn ios
yarn android
```

## Building for release

See package scripts for `build:ios` and `build:android`.

## Public sharing note

This README is prepared for public sharing. Remove any local build artifacts or credentials prior to
publishing.

## License

Released under the Apache License, Version 2.0. See the root `LICENSE` file for details.
