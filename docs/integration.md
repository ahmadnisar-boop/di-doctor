# Integration guide

How to use DI Doctor from an ERP, a script, a CI pipeline, or an AI assistant. All commands accept `--json`; all file arguments accept `-` for stdin.

## The recommended flow

```
build payload ──▶ di-doctor validate ──▶ (dev) di-doctor serve ──▶ FBR sandbox ──▶ di-doctor check-response ──▶ store invoice number
                     offline, instant         FBR-shaped answers       real answers        never trust statusCode alone
```

1. **Validate offline** on every payload before sending. Fail fast on `error` findings; log `warning` findings; treat `cannot-verify` as "FBR may still reject this for a reason we cannot see".
2. **During development**, point your base URL at `di-doctor serve` so your code exercises real response shapes, `401`s and outages without FBR access.
3. **In sandbox and production**, pass every FBR response through `check-response` and act on `overall`, not on the top-level `statusCode`.
4. When FBR rejects, run `explain` on the response to get the cause and fix in plain English.

## CLI from any language

```sh
# validate (exit 1 on failures)
di-doctor validate - --env sandbox --json < invoice.json

# one-shot simulated response
di-doctor simulate invoice.json --env sandbox --strict-shape --json

# interpret a real response
di-doctor check-response response.json --http-status 200 --json
```

Exit codes: `0` ok, `1` failures found (or simulated rejection), `2` bad input or usage.

## HTTP (simulator)

```sh
di-doctor serve --port 8787 --token dev-token --chaos 0.1 --latency 200
curl -s -X POST http://127.0.0.1:8787/di_data/v1/di/validateinvoicedata_sb \
  -H 'Authorization: Bearer dev-token' -H 'Content-Type: application/json' \
  -d @invoice.json
```

Set your application's DI base URL to `http://127.0.0.1:8787` and keep the FBR paths. See [`simulator.md`](simulator.md) for what it can and cannot catch.

## Node / TypeScript library

```ts
import {
  validateInvoice,
  checkResponse,
  simulate,
  explainCode,
  explainResponse,
  listScenarios,
  RULES,
} from 'di-doctor'; // or '@di-doctor/core'

// 1. pre-flight
const v = validateInvoice(payload, { environment: 'sandbox', activity: 'Manufacturer', sector: 'Textile' });
const errors = v.findings.filter((f) => f.verdict === 'fail' && f.severity === 'error');

// 2. read a real response
const r = checkResponse(body, { httpStatus: res.status });
if (r.overall === 'valid') persist(r.fbrInvoiceNumber);
else for (const p of r.problems) log(p.errorCode, p.message, explainCode(p.errorCode ?? '').fix);

// 3. tests: FBR-shaped responses without FBR
const sim = simulate(payload, { environment: 'sandbox', endpoint: 'post', now: Date.now(), strictShape: true });
```

Types: `Finding { ruleId, title, verdict, severity?, path, message, fix?, reason?, specRef, errorCode? }`, `ValidationResult { findings, summary, specVersion }`, `ResponseCheck { overall, fbrInvoiceNumber?, kind, items, problems, warnings, specVersion }`, `SimulatedResponse { httpStatus, result, body, diagnostics, errors }`.

All functions are pure and synchronous. No network, no file I/O, no global state.

## JSON Schema (any language)

Validate payloads with any JSON Schema 2020-12 validator using [`schema/invoice.schema.json`](../schema/invoice.schema.json). It catches structure and type mistakes, including misspelled field names. It cannot express the arithmetic or cross-field rules; use the CLI or library for those.

## MCP (AI assistants)

```sh
claude mcp add di-doctor -- npx di-doctor mcp
```

| Tool                   | Input                                                                               | Output                              |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| `di_validate_invoice`  | invoice (object or JSON string), environment, optional taxTolerance/activity/sector | findings + summary                  |
| `di_check_response`    | response, optional httpStatus                                                       | overall verdict, problems, warnings |
| `di_explain_error`     | code, or response                                                                   | explanations                        |
| `di_list_scenarios`    | activity, sector                                                                    | scenarios with expected sale types  |
| `di_simulate_response` | invoice, environment, optional endpoint/strictShape                                 | simulated FBR response              |

## CI

```yaml
- run: npx di-doctor validate fixtures/my-invoice.json --env sandbox
```

Fails the job on `error` findings. Combine with `di-doctor serve &` to run your integration tests against the simulator.
