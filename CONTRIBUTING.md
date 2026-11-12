# Contributing

Thanks for helping Pakistani developers ship FBR integrations with less pain.

## Ground rules

1. **The spec is the source of truth.** Every rule cites its section of the PRAL _Technical Specification for DI API_ v1.12. Never invent a rule. If the spec is unclear, the rule returns `cannot-verify` with the reason, and the ambiguity goes into `docs/spec-traps.md`.
2. **Never copy spec text.** Error explanations, messages and docs are written in our own words. Codes, field names and scenario IDs are fine to reference.
3. **Three verdicts:** `pass`, `fail`, `cannot-verify`. `fail` is `error` (FBR would reject) or `warning` (likely mistake, not explicitly forbidden).
4. **Not tax advice.** Never tell users which HS code, rate or sale type is right for their product.
5. **Fake data only.** Fixtures use `0000001` and `1111111111111`. Never commit real NTN/CNIC/STRN values, tokens or the spec PDF.

## Setup

```sh
pnpm install
pnpm test        # vitest across packages
pnpm lint        # tsc + eslint
pnpm build       # tsup, all packages
pnpm cli --help  # run the CLI from source
```

## Adding a validation rule

1. Create `packages/core/src/rules/header/hNN-name.ts` or `rules/item/iNN-name.ts` exporting a `Rule` (see any existing one). Give it an `id`, a one-line `title`, the `specRef`, and an `errorCode` only if the spec ties the condition to one.
2. Register it in `packages/core/src/rules/registry.ts` (order matters: it is the order findings are printed and the order the simulator picks the first error).
3. Add at least one fixture that passes and one that fails (or returns cannot-verify) under `fixtures/invoices/`, and tests in `packages/core/test/`.
4. Run `pnpm docs:rules` to regenerate `docs/rules.md` (CI fails if it is stale).

## Adding or improving an error explanation

Edit `packages/core/src/data/errors.json`. Keep the fields: `title`, `meaning`, `commonCauses`, `fieldsToCheck`, `fix`, `side`, `specRef`, optional `relatedScenarios`. Own words only.

## Reporting a difference between the spec and the live API

Open an issue with the request (fake identifiers) and the exact response. Live behaviour that the document does not describe is the most valuable thing you can contribute.

## Commits and pull requests

Small commits, conventional prefixes (`feat`, `fix`, `docs`, `chore`, `test`). `main` is protected: every change arrives through a pull request, must pass CI on Node 20, 22 and 24, and commits must be signed (SSH or GPG signing registered on your GitHub account). Squash merges are used, so a PR may contain several commits.

## Releases (maintainers)

1. Add a `## [x.y.z]` section to `CHANGELOG.md` in a PR and merge it.
2. `pnpm release x.y.z` bumps the package versions and opens a signed release PR.
3. After it is merged, `pnpm release x.y.z --tag` tags the merged commit and pushes the tag. The Release workflow builds, attaches tarballs to the GitHub Release and publishes the packages.
