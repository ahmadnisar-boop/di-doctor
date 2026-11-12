# Sandbox simulator

`di-doctor serve` runs a local HTTP server that answers like the FBR Digital Invoicing API, and `simulate()` / `di-doctor simulate` give you the same answer for one payload. The goal is to let you build and test your integration before you have FBR sandbox access, and to reproduce FBR's response shapes in your automated tests.

## Fidelity statement

The simulator enforces **exactly the rules documented in spec v1.12**, as listed in [`rules.md`](rules.md). A payload is rejected when any rule fails with severity `error`. Warnings and `cannot-verify` findings never reject; they are returned as diagnostics.

It **cannot** check anything that depends on FBR's own data:

| FBR check                                                 | Code(s)                            | Why not                                             |
| --------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| HS code vs sale type                                      | 0052                               | Needs the item and rate reference APIs (§5.3, §5.8) |
| Unit of measure vs HS code                                | 0096, 0097, 0099                   | Needs the HS-to-UOM reference API (§5.9)            |
| SRO schedule / item validity                              | 0077, 0078                         | Needs the SRO reference APIs (§5.7, §5.10)          |
| Province names                                            | 0073, 0074                         | Needs the province reference API (§5.1)             |
| Seller / buyer registration status                        | 0001, 0082, 0083, 0106, 0107       | Needs the STATL APIs (§5.11, §5.12)                 |
| Token ↔ seller binding                                    | 0401, 0402                         | No token data                                       |
| Third Schedule, potassium chlorate and quantity-based tax | 0102, 0103, 0105                   | Formulas are not in the spec                        |
| Debit note vs original invoice                            | 0029, 0034, 0035, 0057, 0067       | Needs the original invoice                          |
| Sector and activity restrictions                          | 0056, 0086, 0087, 0093, 0100, 0101 | Needs the taxpayer profile                          |
| totalValues                                               | 0085                               | No formula in the spec                              |

**Passing the simulator does not guarantee FBR acceptance.** Live FBR behaviour also differs from the document in places (see [`spec-traps.md`](spec-traps.md)).

## Response shapes

| Situation                                                                     | Shape                                                                                                                                     | Spec   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Header-level failure (any `error` finding whose path is not inside `items[]`) | `statusCode "01"`, `status "Invalid"`, `errorCode`, `error`, `invoiceStatuses: null`                                                      | §4.1.4 |
| Item-level failure only                                                       | `statusCode "00"`, `status "Invalid"`, per-item entries with `"01"` and the code; valid items `"00"/"Valid"`; every `invoiceNo` is `null` | §4.1.5 |
| Valid, `post` endpoint                                                        | `invoiceNumber`, `dated`, per-item `invoiceNo` = `<invoiceNumber>-<n>`                                                                    | §4.1.3 |
| Valid, `validate` endpoint                                                    | no `invoiceNumber`; `errorCode: null` on header and items                                                                                 | §4.2.3 |

- The first failing rule (in registry order) supplies the code and message. FBR's own ordering is not documented.
- The invoice number is `<sellerNTNCNIC>DI<milliseconds>`: 22 characters for a 7-digit NTN, 28 for a 13-digit CNIC, consistent with the lengths the spec gives for `invoiceRefNo`.
- `dated` is formatted in Pakistan Standard Time (UTC+5) like the spec samples.
- Messages are DI Doctor's own words, not FBR's. Where the spec documents no code for a condition (for example sale type vs scenario mismatch, or an empty `items` list), `errorCode` is `""` and the `_simulator.note` says so.
- The spec does not show what FBR returns when some items pass and others fail in one invoice; the simulator marks the passing items `Valid` with `invoiceNo: null`.

## Metadata

Unless `--strict-shape` is used, every body carries a `_simulator` object: a note, the spec version, `rulesFailed` (rule id, path, code) and `diagnostics` (what could not be judged). Strip it with `--strict-shape` when you need byte-for-byte FBR shapes.

## Server behaviour

| Request                                              | Response                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Missing or malformed `Authorization: Bearer <token>` | `401` (§3.1, §4.1.6). With `--token X`, only `X` is accepted.      |
| Unknown path                                         | `404` with the list of served paths                                |
| Non-JSON body                                        | `400`                                                              |
| `--chaos <fraction>`                                 | That fraction of invoice requests get `500`, for retry-logic tests |
| `--latency <ms>`                                     | Every response delayed                                             |
| `GET /_health`                                       | `200` with the route list                                          |

Paths are the real ones: `/di_data/v1/di/postinvoicedata_sb`, `/di_data/v1/di/validateinvoicedata_sb` (sandbox) and the same without `_sb` (production rules: no `scenarioId` required). The real API routes sandbox vs production by token; the simulator routes by path.
