# CLAUDE.md — DI Doctor

Unofficial, open-source developer toolkit for Pakistan's FBR Digital Invoicing (DI) API.
Background and design decisions: `docs/DESIGN.md` — read it before planning.

## What we build (v1)

- `check-response` — read FBR responses safely (item-level errors, misleading status codes)
- `validate` — offline pre-flight checks on an invoice JSON
- `explain` — FBR error code / response → plain English cause + fix
- `scenarios` — business activity + sector → required sandbox scenarios
- MCP server exposing the four tools above
- Published JSON Schema so any language can validate

## Hard rules

1. **Spec is the source of truth.** Source: FBR "Technical Specification for DI API" v1.12 (local copy in `spec/`, git-ignored). Never invent a rule. Every validation rule cites its spec section in a code comment, e.g. `// spec v1.12 §4.1.2`.
2. **Never copy spec text** into the repo (error tables, descriptions). Write explanations in our own words and link to the official document.
3. **Three verdicts, never guess:** `pass`, `fail`, `cannot-verify`. If a rule needs data we don't have (e.g. reference APIs), return `cannot-verify` with a reason.
4. **Not tax advice.** We check technical correctness only. Never tell users which HS code, rate or sale type is "correct" for their product.
5. **Privacy:** never log, store or send real NTN/CNIC/STRN values. Fixtures use obviously fake data.
6. **No network in v1.** `core` is pure functions: no network, no file I/O, no global state.
7. **Tests for every rule:** at least one passing and one failing fixture.
8. **User-facing messages in simple English:** what is wrong → why → how to fix → spec link.
9. Never commit `spec/`, tokens, or `.env`.
10. Don't name the employer or use any employer code/data anywhere in this repo.

## Tech

- TypeScript, Node.js LTS, pnpm workspaces monorepo: `packages/core`, `packages/cli`, `packages/mcp`
- Tests: vitest. Build: tsup. CLI: commander. MCP: official `@modelcontextprotocol/sdk`.
- Use current stable versions; check before adding any dependency. Keep dependencies minimal.

## Workflow

- Start every non-trivial task in Plan Mode and wait for approval.
- Small commits with clear messages. Ask before pushing.
- Run `pnpm test` and `pnpm lint` before saying a task is done.
- If the spec is unclear or inconsistent, stop and list the question instead of choosing silently.
