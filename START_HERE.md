# Start Here

Welcome to the Prayer Time monorepo. Use this page as a quick orientation.

## Repository map

```
/ (root)
├─ README.md
├─ GETTING_STARTED.md
├─ RUN_INSTRUCTIONS.md
├─ INSTALL_NODEJS.md
├─ ARCHITECTURE.md
└─ packages/
   ├─ shared/
   ├─ web/
   ├─ mobile/
   └─ desktop/
```

## First steps

1. Read `README.md` for an overview.
2. Install prerequisites following `INSTALL_NODEJS.md`.
3. Run `yarn install` at the repository root.
4. Open `GETTING_STARTED.md` for development workflows.

## Common commands

```bash
yarn workspace @prayer/web dev
yarn workspace @prayer/mobile start
yarn workspace @prayer/desktop dev
```

## Need more detail?

- `RUN_INSTRUCTIONS.md` consolidates run/build commands.
- Package READMEs contain platform-specific notes.
- `ARCHITECTURE.md` documents the shared approach and platform responsibilities.

## License

The project is released under the Apache License 2.0. See the repository `LICENSE` file.

## Public sharing note

This document is trimmed for public consumption. Remove or update any environment paths if you fork the project for another account.
