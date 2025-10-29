# Run Instructions

This document summarizes common commands to run and build the project.

## Development (examples)

Web (development server):

```bash
yarn workspace @prayer/web dev
```

Mobile (Metro / run on simulator):

```bash
yarn workspace @prayer/mobile start
yarn workspace @prayer/mobile ios
yarn workspace @prayer/mobile android
```

Desktop (Electron dev):

```bash
yarn workspace @prayer/desktop dev
```

## Building for production (examples)

```bash
yarn workspace @prayer/web build
yarn workspace @prayer/mobile build
yarn workspace @prayer/desktop build
```

## Tests

Run package-specific tests using the workspace or package scripts, for example:

```bash
yarn workspace @prayer/web test
```

## Notes

- Adjust workspace names if your package scopes are different.
- For CI, prefer using dedicated build steps for each package.

## License

All code is covered by the Apache License 2.0 (see `LICENSE`).
