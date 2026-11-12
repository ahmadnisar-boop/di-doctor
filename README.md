# DI Doctor

> **Unofficial developer tool. Not affiliated with FBR or PRAL. Not tax advice. Always verify against the latest official documentation.**

DI Doctor helps developers integrate with Pakistan's FBR Digital Invoicing (DI) API faster. It validates invoice payloads offline, explains every FBR error code in plain English, reads FBR responses safely, lists the sandbox scenarios you must pass, and runs a **local sandbox simulator** so you can integrate before you have FBR access. Works with any language: JSON in, JSON out.

Everything is derived from the official *Technical Specification for DI API* v1.12 (PRAL, July 2025). Every check cites the section it comes from. Three verdicts, never a guess:

| Verdict | Meaning |
|---|---|
| `pass` | The spec's rule holds for this payload. |
| `fail` | The spec's rule is broken. `error` failures would be rejected by FBR; `warning` failures are likely mistakes the spec does not explicitly forbid. |
| `cannot-verify` | The spec mentions a rule but checking it needs data we don't have offline (FBR reference APIs, your taxpayer profile, the original invoice). The reason is always given. |

## Install

```sh
npm install -g di-doctor      # CLI + simulator + MCP server
# or run once without installing
npx di-doctor --help
```

Library use in Node/TypeScript: `npm install di-doctor` (or `@di-doctor/core` for the pure functions only).

## 60-second tour

**1. Validate before you send.**
```sh
di-doctor validate invoice.json --env sandbox
```
```
✗ items[0].salesTaxApplicable  (I04, spec v1.12 §7 (0104, 0102, 0103, 0105), §5.8, FBR code 0104)
  Problem: salesTaxApplicable 150.00 does not match 18% of 1000.00 (expected 180.00, difference 30.00).
  Fix:     Recalculate sales tax per line as valueSalesExcludingST × rate, rounded to 2 decimals.
? hsCode ↔ saleType ↔ rate ↔ uoM ↔ SRO consistency (needs FBR reference APIs)  (I09, items[0])
  FBR rejects HS codes that do not fit the sale type (0052) ... Planned for a later version.
✓ 21 passed  ✗ 1 failed  ? 6 cannot verify offline
```
Add `--activity Manufacturer --sector Textile` to also check that your `scenarioId` applies to your business.

**2. Simulate the sandbox locally.**
```sh
di-doctor serve                      # http://127.0.0.1:8787, same paths as FBR
curl -s -X POST http://127.0.0.1:8787/di_data/v1/di/postinvoicedata_sb \
  -H 'Authorization: Bearer any-token' -H 'Content-Type: application/json' \
  -d @invoice.json
```
Point your ERP's base URL at the simulator and keep the FBR paths. You get FBR-shaped responses, including the trap where the top-level `statusCode` is `"00"` while an item failed, `401` without a Bearer token, and optional `--chaos 0.2` outages and `--latency 300` delays for testing your retry logic. One-shot version: `di-doctor simulate invoice.json --env sandbox`.

**3. Read the real response safely.**
```sh
di-doctor check-response response.json
```
Never trust the top-level `statusCode` alone. `check-response` combines header and item results, handles `invoiceStatuses: null`, and returns the FBR invoice number only when the invoice was actually accepted.

**4. Understand an error.**
```sh
di-doctor explain 0052            # or: di-doctor explain response.json
di-doctor codes                   # all 108 codes DI Doctor can explain
```

**5. Find your scenarios.**
```sh
di-doctor scenarios --activity Retailer --sector FMCG
```

Every command accepts `--json` for machine-readable output and `-` as the file argument to read stdin. Exit codes: `0` all good, `1` failures found, `2` bad input or usage. `di-doctor rules` lists every validation rule with its spec reference.

## Use from code

```ts
import { validateInvoice, checkResponse, simulate, explainCode, listScenarios } from 'di-doctor';

const result = validateInvoice(invoice, { environment: 'sandbox' });
if (result.summary.fail > 0) console.log(result.findings.filter((f) => f.verdict === 'fail'));

const verdict = checkResponse(fbrResponseBody, { httpStatus: 200 });
if (verdict.overall === 'valid') save(verdict.fbrInvoiceNumber);
```
All functions are pure: no network, no file I/O, no global state. Full API: [`docs/integration.md`](docs/integration.md).

## Use from an AI assistant (MCP)

```sh
claude mcp add di-doctor -- npx di-doctor mcp
```
Tools: `di_validate_invoice`, `di_check_response`, `di_explain_error`, `di_list_scenarios`, `di_simulate_response`. Read-only, no network.

## Use from any language (JSON Schema)

[`schema/invoice.schema.json`](schema/invoice.schema.json) (request) and [`schema/response.schema.json`](schema/response.schema.json) (response), JSON Schema 2020-12. The invoice schema sets `additionalProperties: false` so misspelled field names surface immediately.

## What the simulator can and cannot catch

The simulator enforces exactly the rules documented in the spec: field presence and types, date and identifier formats, the sales-tax arithmetic for standard/reduced/zero/exempt sale types, withholding rules, the 5%-above-20,000 rule, debit-note references, sandbox scenario IDs and their expected sale types. It cannot check what FBR checks against its own reference data: HS code vs sale type (0052), unit of measure vs HS code (0099), SRO validity, province names, registration status, Third Schedule and quantity-based tax formulas, or sector-specific restrictions. Those appear as `diagnostics` in every simulated response so you know what remains. **Passing the simulator does not guarantee FBR acceptance.** Details: [`docs/simulator.md`](docs/simulator.md).

## Rules and spec notes

- [`docs/rules.md`](docs/rules.md): every rule, generated from the code.
- [`docs/spec-traps.md`](docs/spec-traps.md): inconsistencies we found in the official document and how DI Doctor handles each.

## Privacy

Nothing leaves your machine. The simulator binds to `127.0.0.1` by default. All fixtures use obviously fake identifiers.

## Spec version

v1.12, last updated 2025-07-24. Official document link: `packages/core/src/data/spec-version.json`. If FBR publishes a newer version, please open an issue.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Adding a rule is one file plus a passing and a failing fixture.

## License

MIT
