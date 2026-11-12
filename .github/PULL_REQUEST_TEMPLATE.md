## What

<!-- One or two sentences. -->

## Checklist

- [ ] Every new or changed rule cites its spec v1.12 section in a code comment and in `specRef`.
- [ ] No text copied from the spec; explanations and messages are in our own words.
- [ ] Verdicts are `pass`, `fail` or `cannot-verify`; nothing is guessed.
- [ ] Each rule has at least one passing and one failing (or cannot-verify) fixture; fixtures use fake identifiers only.
- [ ] `pnpm lint`, `pnpm test` and `pnpm docs:rules` run clean; `docs/rules.md` is up to date.
- [ ] `CHANGELOG.md` has an entry under Unreleased.
