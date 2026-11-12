# Design notes

Why DI Doctor exists, what it deliberately does not do, and the decisions behind the code. Background for contributors; the user-facing docs are the [README](../README.md), [integration guide](integration.md) and [simulator notes](simulator.md).

## The problem

Sales-tax-registered businesses in Pakistan must report invoices in real time to FBR's Digital Invoicing API, operated by PRAL. Global ERP, POS and accounting products do not support it, so local developers build the integrations themselves, and they run into the same things: terse error codes, interlinked field rules (HS code, sale type, rate, SRO, unit of measure), 28 sandbox scenarios whose applicability depends on the business, and no sample data. The official document also has traps: one of its own sample responses reports a top-level status code of "00" while the invoice was rejected at item level.

## Principles

1. **The spec is the only source of truth.** Every rule cites its section of the PRAL _Technical Specification for DI API_ v1.12. Nothing is invented; where the document is unclear, the answer is `cannot-verify` and the ambiguity is recorded in [spec-traps.md](spec-traps.md).
2. **Three verdicts, no guessing.** `pass`, `fail`, `cannot-verify`. Failures are `error` (FBR would reject) or `warning` (likely mistake the spec does not forbid).
3. **Technical correctness only, never tax advice.** DI Doctor never says which HS code, rate or sale type is right for a product.
4. **Our own words.** Error explanations and messages are written from scratch; the document is linked, not copied.
5. **Pure core.** `@di-doctor/core` has no network, no file I/O and no global state. The CLI, the local simulator server and the MCP server are thin wrappers.
6. **Privacy.** Nothing leaves the machine; fixtures use obviously fake identifiers.

## Decisions

| Decision                                                                               | Reason                                                                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax arithmetic is checked only for standard, reduced, zero-rated and exempt sale types | The spec defines the base only for those; Third Schedule, quantity-based and other sale types return cannot-verify instead of a false failure |
| 9-digit NTNs are cannot-verify                                                         | The spec contradicts itself (7 or 9 in one place, 7 or 13 elsewhere)                                                                          |
| Tax tolerance defaults to 1.00 PKR                                                     | Per-line rounding drifts by less than a rupee; a wrong rate is off by much more                                                               |
| The simulator reproduces the misleading-header response shape on purpose               | Integrations must handle it, because FBR sends it                                                                                             |
| Rules live in a registry, one file each                                                | Adding a rule is one file plus two fixtures, and the rules reference is generated from the registry                                           |
| Sandbox scenario tables are transcribed as printed, oddities noted                     | Two activity rows disagree with the rest; we surface the note rather than "fix" the table                                                     |

## Out of scope (for now)

Purchase invoices, provincial revenue authorities, reference-data lookups that need an FBR token, and anything that requires live FBR access. A future version may add token-based reference checks using the user's own token, cached locally.

## Spec version

v1.12, last updated 2025-07-24. The local PDF is never committed. If PRAL publishes a newer version, rules are re-verified section by section and the change is logged in `CHANGELOG.md`.
