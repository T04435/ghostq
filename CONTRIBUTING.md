# Contributing

## Commit messages

Every commit message is a [Conventional Commit](https://www.conventionalcommits.org/): `type(scope)!: subject`.

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.
- Scope is optional. Usual scopes: write, sing, library, crowd, agent, qloo, spotify, musicbrainz, store, api, brand, repo, release, deps.
- `!` marks a breaking change.

The `commit-msg` hook (simple-git-hooks, installed by `pnpm install`) enforces this. History before the adoption commit (`chore(repo): enforce Conventional Commits`) is not linted.

## Release notes

`NEXT_TAG=v1.1.0 pnpm release-notes` prints the notes for unreleased conventional commits (git-cliff, config in `cliff.toml`).
