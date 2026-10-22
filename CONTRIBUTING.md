# Contributing

## Commit messages

Every commit message is a [Conventional Commit](https://www.conventionalcommits.org/): `type(scope)!: subject`.

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.
- Scope is optional. Usual scopes: write, sing, library, crowd, agent, qloo, spotify, musicbrainz, store, api, brand, repo, release, deps.
- `!` marks a breaking change.

The `commit-msg` hook (simple-git-hooks, installed by `pnpm install`) enforces this. History before the adoption commit (`chore(repo): enforce Conventional Commits`) is not linted.

## Releases

Releases are automated. A push to `main` runs `.github/workflows/release.yml`:
1. semantic-release works out the next version from the Conventional Commits since the last tag: `fix` gives a patch, `feat` a minor, and `!` a major.
2. Vercel deploys that version to production.
3. A smoke check reads `/api/version`.
4. Only then are the tag and the GitHub release (with generated notes) made.

Nothing is committed back, and `package.json`'s version is not bumped. Run the local gates (lint, typecheck, test, build) before every push; the workflow doesn't. To preview the next version: `GITHUB_TOKEN=$(gh auth token) npx semantic-release --dry-run --no-ci`.
