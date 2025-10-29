# Install Node.js, npm, and Yarn

Prayer Time development requires Node.js 18 or newer plus Yarn 3.x. Follow these quick steps.

## 1. Install Node.js (includes npm)

- Go to https://nodejs.org and download the current LTS installer (v18+).
- Run the installer. Accept defaults.
- Restart your terminal when finished.

Verify:

```bash
node --version
npm --version
```

Both commands should print versions.

## 2. Install Yarn 3.x

```bash
npm install --global yarn
yarn --version
```

## 3. Install repo dependencies

From the repo root:

```bash
cd /Users/mertyildiz/Documents/GitHub/prayer-time
yarn install
```

## 4. Run a package

For example, start the desktop app:

```bash
yarn workspace @prayer/desktop dev
```

## Troubleshooting

- Update PATH if `node` or `yarn` is not found.
- If install fails, rerun with administrator/`sudo` (macOS). Always trust official installers only.

## Public sharing note

This guide contains no personal data and is safe to include in the public repository.
