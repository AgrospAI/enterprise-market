# Development Guide

How to set up, run, test, and contribute to the marketplace locally. For what
the project is, its data sources, and deployment, see [README.md](README.md).

## Contents

- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables and secrets](#environment-variables-and-secrets)
- [Available scripts](#available-scripts)
- [Code quality](#code-quality)
- [Running with Docker](#running-with-docker)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Tool                                                     | Version            | Notes                                        |
| -------------------------------------------------------- | ------------------ | -------------------------------------------- |
| [Node.js](https://nodejs.org/)                           | 22 (see `.nvmrc`)  | Run `nvm use` in the repo root               |
| npm                                                      | Bundled with Node  | Use npm; the lockfile is `package-lock.json` |
| [Infisical CLI](https://infisical.com/docs/cli/overview) | Latest             | Needed to pull/push shared secrets           |
| GNU Make, Bash                                           | Any recent version | Used by `Makefile` and `scripts/`            |
| Docker (optional)                                        | Any recent version | Only for running the production image        |

The `make secrets-*` commands check `infisical login status` and run
`infisical login` for you when your session is missing or expired. The repo is
already linked to the Infisical project through the committed
`.infisical.json`.

## Getting started

```bash
git clone https://github.com/deltaDAO/enterprise-market.git
cd enterprise-market
nvm use                 # switch to the Node version in .nvmrc
make secrets-pull       # write .env from Infisical (dev environment)
npm install             # also installs the Husky git hooks
npm start               # http://localhost:8008
```

`npm start` first runs `scripts/pregenerate.sh`, which writes generated files
under `content/` (repo and network metadata, runtime config). These are
regenerated on every start and build; don't edit them by hand.

No Infisical access? Copy the template and fill in the values yourself:

```bash
cp .env.example .env
```

## Environment variables and secrets

`.env` is the file the app reads. It is git-ignored and must never be
committed. Shared values live in [Infisical](https://infisical.com/), and the
`Makefile` syncs between the two:

| Command             | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `make secrets-pull` | Overwrite `.env` from Infisical. The previous file is kept as `.env.bak`. |
| `make secrets-diff` | Show which keys differ between `.env` and Infisical (values are masked).  |
| `make secrets-push` | Create or update Infisical keys from `.env`. Never deletes keys.          |

All targets use the `dev` environment by default. Target another one with
`INFISICAL_ENV`, e.g. `make secrets-pull INFISICAL_ENV=staging`. Run
`make secrets-diff SHOW_VALUES=1` only when you actually need to see the
unmasked values.

### Adding a new environment variable

1. Add it to `.env` with its value.
2. Document it in `.env.example` with a comment explaining its purpose and
   leave the value empty. This file is the reference for every variable.
3. Prefix it with `NEXT_PUBLIC_` **only** if the browser needs it. Those
   values are inlined into the client bundle at build time and are public.
   Secrets (API keys, tokens, client secrets) must not use the prefix.
4. Check what will change, then share it with the team:

   ```bash
   make secrets-diff
   make secrets-push
   ```

5. If the variable must exist in deployed environments, add it there too and
   mention it in your pull request.

## Available scripts

| Script                  | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `npm start`             | Generate content and start the dev server on port 8008                         |
| `npm run build`         | Generate content and create a production build                                 |
| `npm run start-docker`  | Serve an existing production build on port 8008                                |
| `npm test`              | Full check: pregenerate, lint, type-check, and unit tests                      |
| `npm run jest`          | Unit tests only                                                                |
| `npm run jest:watch`    | Unit tests in watch mode                                                       |
| `npm run lint`          | ESLint                                                                         |
| `npm run lint:fix`      | ESLint with auto-fix                                                           |
| `npm run format`        | Format the codebase with Prettier                                              |
| `npm run type-check`    | TypeScript checks without emitting files                                       |
| `npm run knip`          | Report unused files, exports, and dependencies                                 |
| `npm run set-barge-env` | Point the app at a local [Barge](https://github.com/oceanprotocol/barge) stack |

## Code quality

- **Formatting:** Prettier, configured in `.prettierrc`. A Husky pre-commit
  hook formats staged files automatically.
- **Linting and types:** ESLint (`.eslintrc`) and TypeScript. Neither runs on
  commit, so run `npm test` before opening a pull request.
- **Commits:** follow [Conventional Commits](https://www.conventionalcommits.org/),
  e.g. `fix(asset): ...`, `feat: ...`, `style(brand): ...`.
- **Pull requests:** keep them focused, describe what changed and why, and list
  any new environment variables. Code owners are defined in
  `.github/CODEOWNERS`.

## Running with Docker

`docker-compose.yml` runs the published image with your local `.env`:

```bash
docker compose up -d     # http://localhost:8008
docker compose logs -f
docker compose down
```

To test local changes in a container, build the image from the `Dockerfile`
instead (`docker build -t enterprise-market .`). `NEXT_PUBLIC_*` values are
fixed at build time, so pass them as build arguments rather than only at
runtime.
