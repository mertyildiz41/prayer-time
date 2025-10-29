# Getting Started

This guide helps you set up the Prayer Time monorepo locally for development.

## Prerequisites

- Node.js 18+
- Yarn 3.x
- Git
- (Optional) Xcode / Android Studio for mobile development

## Quick steps

1. Clone the repository:

```bash
git clone <repo-url>
cd prayer-time
```

2. Install dependencies (from repo root):

```bash
yarn install
```

3. Start the web app (example):

```bash
yarn workspace @prayer/web dev
```

4. Open packages' READMEs for package-specific instructions.

## Notes

- Use the workspace scripts defined in each package for platform-specific builds and runs.
- If you need to set environment variables, create a `.env` file per package and do not commit secrets.
- The project is licensed under Apache 2.0 (see `LICENSE`).
