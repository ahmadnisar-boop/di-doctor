# DI Doctor — Project Context

> Handoff document for Claude Code. Contains the owner's goals, research findings, validation results, scope, architecture, rules to implement, and the first prompts to run.
> Research date: November 2026. Spec version used: FBR DI API Technical Specification **v1.12** (last updated July 2025).

---

## 1. Owner and goals

- **Owner:** Ahmad Nisar — software engineer (full-time at a healthcare software house in Lahore, since Aug 2024). BS Software Engineering, PUCIT.
- **Skills:** C#/.NET, ASP.NET Core, Angular, Node.js, TypeScript, SQL Server, PostgreSQL, MongoDB, Docker, GitHub Actions, Jenkins, testing/CI.
- **Goal:** build a personal brand as a *problem-solver engineer* through open developer tools, shared on GitHub, dev.to, X and LinkedIn.
- **Brand line:** *"I build open developer tools for Pakistani tax and invoicing compliance."*
- **Time:** side project alongside a full-time job → keep scope small, ship often.
- **Constraint:** keep the employer's name, code and data out of this project. Confirm side work is allowed by the employment contract.

---

## 2. One-line pitch

**DI Doctor helps developers integrate with Pakistan's FBR Digital Invoicing API faster — it explains FBR errors in plain English, catches mistakes before sending, and reads FBR responses safely. Works with any programming language.**

---

## 3. The problem

### Background
- FBR Digital Invoicing is mandatory for sales-tax-registered businesses in Pakistan (rules under Sales Tax Rules 2006, Chapter XIV / Rule 150Q; phased rollout via SROs ending 31 Dec 2025).
- Invoices are sent in real time to the PRAL-operated DI API; FBR returns an invoice number + QR code.
- Adoption was slow: reports say only about one-third of registered taxpayers were issuing live digital invoices by end of March 2026. Since the Finance Act 2026 (from 1 July 2026), FBR can reportedly suspend non-integrated businesses' registration. (Most of these figures come from vendor blogs — verify on fbr.gov.pk before quoting publicly.)
- Global ERPs/POS/accounting tools don't support Pakistan's system, so local developers must build integrations.

### Pain points (evidence from public forums and guides)
1. **Confusing error messages.** Real examples: error 0052 (HS code does not match sale type), 0104 (sales tax amount doesn't match rate), 0007 (wrong sale type), 0044 (HS code empty), 0091 (extra tax must be empty), 0401 (seller NTN/CNIC token not authorized). Users say the errors don't give enough detail.
2. **Connected data rules.** HS code ↔ sale type ↔ rate ↔ SRO schedule ↔ SRO item serial no ↔ UOM must all match. Users ask each other for code lists.
3. **Scenario testing is hard.** 28 sandbox scenarios (SN001–SN028); which ones apply depends on business activity + sector. Reduced-rate (SN005) and return-related scenarios are common failure points. A public scenario-testing guide has ~180 comments of people stuck.
4. **No sample data.** Developers ask for working sample JSON per scenario.
5. **Access barriers.** Sandbox only after registration + IP whitelisting; sandbox sometimes slow/pending; production API has outages → retry logic needed.
6. **Rules change.** New SROs, tech-doc versions, and orders (e.g. a 72-hour correction window introduced in 2026).

### Spec traps found while reading v1.12 (our own observations)
These cause real bugs and are both product features and blog topics:
1. **Misleading top-level status.** One official sample response has top-level `statusCode: "00"` (valid) while `status` is `"invalid"` and the real error sits inside `invoiceStatuses[]`. Code that checks only the top-level `statusCode` will treat a failed invoice as successful.
2. **`invoiceStatuses` can be `null`** in an invalid response (header-level error) — code must handle both shapes.
3. **Field name mismatch:** the field table writes `buyeRegistrationType`; the JSON samples use `buyerRegistrationType`.
4. **Invoice type wording:** the field table lists "Sales Invoice"; JSON samples use `"Sale Invoice"`.
5. **Date format confusion:** some error messages mention `01-DEC-2021` / `dd-MMM-yy`, while field rules require `YYYY-MM-DD`.
6. **Error text differs** between the document and live responses (e.g. 0052 wording).
7. **Status casing differs:** `"Valid"`, `"Invalid"`, `"invalid"` all appear → compare case-insensitively.
8. Purchase error table repeats the same codes several times.

---

## 4. Target users

| User | Need | Priority |
|---|---|---|
| Developers at software houses building ERP/POS/billing for Pakistani clients | Integrate repeatedly, debug errors fast | **Primary** |
| In-house developers at businesses with custom systems | First-time integration | **Primary** |
| Freelancers hired for integration | Finish fast and correctly | **Primary** |
| Plugin builders (Odoo, ERPNext, Manager.io, etc.) | Pakistan support for global tools | Secondary |
| Accountants / business owners | Understand errors (via `explain` web page later) | Secondary |

**We do NOT compete** with licensed integrators or PRAL's free integration service. We help developers; integrators can use our tools too.

---

## 5. Validation summary (done before building)

| Check | Result |
|---|---|
| Problem real? | ✅ Strong evidence (forums, guides, adoption gap, legal mandate) |
| Spec available? | ✅ Public PDF on download1.fbr.gov.pk, marked "Privacy Level: Public" — but its disclaimer says content may not be reproduced without PRAL permission → write our own words, link to the doc |
| Competition | ✅ Gap: existing tools are Laravel/PHP packages, Odoo/ERPNext modules, paid services, vendor blog posts. No standalone, language-independent error explainer / validator / response checker found |
| Offline feasibility | ✅ Most v1 checks work offline (see §8). HS/rate/UOM/SRO consistency needs token-based reference APIs → later, with the user's own token |
| Spec version | ⚠️ v1.12 is the latest public version found; check IRIS portal for newer |
| Developer demand interviews | ❓ Owner to do in week 1 (3–5 developers) |
| Hidden live rules | ❓ Live system may enforce rules not in the doc → collect real responses |

**Verdict: GO.**

### Rejected ideas (for the record)
- Commit → social post generator ("ShipPost"): crowded (SmashLanding, HypeShip, Ship Social, buildlog, social-changelog, several MCP servers).
- README/doc truth checker: crowded (docproof, README Clew, docrot, others).
- Migration safety linter: crowded (Atlas, Squawk, EF Core analyzers, MCP linters).
- Healthcare tools (HL7/FHIR): avoided — overlaps the employer's business area.

---

## 6. Legal and ethical rules

- **Unofficial.** Name and README must not imply FBR/PRAL affiliation. Avoid "FBR" as the main product name.
- **README disclaimer (top):** "Unofficial developer tool. Not affiliated with FBR or PRAL. Not tax advice. Always verify against the latest official documentation."
- **Do not copy spec text.** Error explanations, rule descriptions and docs are written in our own words. Factual identifiers (error codes, field names, scenario IDs) are referenced, with a link to the official PDF.
- **Consider emailing PRAL** for permission / feedback once v1 works.
- **Never store or log real taxpayer identifiers.** Fixtures use fake values (e.g. `0000001`, `1111111111111`).
- **Technical correctness only.** Never recommend an HS code, rate or sale type for a product.
- Not legal advice — get proper advice if the project grows commercially.

---

## 7. Scope

### v1 (build now)
1. `check-response` — safe interpretation of DI responses
2. `validate` — offline pre-flight validation of an invoice payload
3. `explain` — error code / full response → plain-English explanation
4. `scenarios` — business activity + sector → applicable scenarios
5. MCP server exposing these four
6. `invoice.schema.json` published for any language

### Not in v1
- Local simulator (v2)
- Token-based reference data checks (HS ↔ sale type ↔ rate ↔ UOM ↔ SRO), STATL lookups (v2+)
- Web UI (v1.5 — simple static page for `explain`)
- SDKs for Node/.NET (later)
- Provincial authorities (PRA eIMS, SRB, etc.) (later)
- Purchase invoices (later — v1 focuses on sale invoices + debit notes)

---

## 8. Feature specifications

### 8.1 `check-response`
**Input:** DI API response JSON (+ optional HTTP status).
**Output:** `{ overall: "valid" | "invalid" | "unknown", fbrInvoiceNumber?, items: [...], problems: [...], warnings: [...] }`

Rules:
- Overall is valid **only if** top-level status is valid **and** every item in `invoiceStatuses` is valid.
- Never trust top-level `statusCode` alone (spec trap #1). Warn when top-level and item-level disagree.
- Handle `invoiceStatuses: null` (header-level error) and empty arrays.
- Compare status strings case-insensitively.
- HTTP 401 → auth/token problem; HTTP 500 → server-side, retryable; map to clear messages.
- Extract FBR invoice number(s) only for valid results.
- Unknown shape → `unknown` + explanation, never a guess.

### 8.2 `validate`
**Input:** invoice payload JSON + options `{ environment: "sandbox" | "production" }`.
**Output:** list of findings `{ ruleId, verdict: pass|fail|cannot-verify, path, message, fix, specRef }`.

Candidate rules from spec v1.12 (Claude Code must **re-verify each against the spec** and cite the section before implementing):

**Header**
- `invoiceType` required; one of `"Sale Invoice"`, `"Debit Note"` (warn on near-misses like "Sales Invoice").
- `invoiceDate` required; `YYYY-MM-DD`; real calendar date.
- `sellerNTNCNIC` required; digits only; 7 (NTN) or 13 (CNIC). (Error table also mentions 9-digit NTN for buyer in one place → flag as spec inconsistency, decide with owner.)
- `sellerBusinessName`, `sellerProvince`, `sellerAddress` required, non-empty.
- `buyerRegistrationType` required; `Registered` | `Unregistered`. Warn if the misspelled `buyeRegistrationType` key is present.
- `buyerNTNCNIC` required unless buyer is Unregistered; same digit rules.
- `buyerBusinessName`, `buyerProvince`, `buyerAddress` required.
- Seller and buyer IDs must not be identical (self-invoicing not allowed).
- `invoiceRefNo` required when `invoiceType` is Debit Note; length 22 (NTN-based) or 28 (CNIC-based).
- `scenarioId` required in sandbox (`SN001`–`SN028`); warn if present in production.
- `items` required, non-empty array.
- Province values come from a reference API → `cannot-verify` offline (only check non-empty string).

**Items**
- Required: `hsCode`, `productDescription`, `rate`, `uoM`, `quantity`, `totalValues`, `valueSalesExcludingST`, `fixedNotifiedValueOrRetailPrice`, `salesTaxApplicable`, `salesTaxWithheldAtSource`, `saleType`.
- Numeric fields must be numbers (not strings, null, or negative).
- `hsCode` format looks like `0000.0000` → **warn only** (format not formally specified).
- `rate` is a string like `"18%"`. If it is a simple percentage: check `salesTaxApplicable ≈ valueSalesExcludingST × rate` (small rounding tolerance; make tolerance configurable). If the rate is complex (e.g. "18% along with rupees 60 per kilogram") → `cannot-verify`.
- If `sroScheduleNo` is provided, `sroItemSerialNo` must be provided.
- `salesTaxWithheldAtSource` must be 0 or equal to sales tax (check exact spec wording first).
- Rate 5% not allowed when value of sales excl. ST > 20,000 (check spec).
- Sale type vs scenario: in sandbox, compare `saleType` to the scenario's expected sale type (from scenario data) → fail with clear message (common real error "Sale type not match with provided scenario").
- HS code ↔ sale type, UOM ↔ HS code, SRO validity → `cannot-verify` offline (needs reference APIs).

### 8.3 `explain`
**Input:** an error code (`"0052"`) or a full DI response.
**Output per error:** code, short title, plain-English meaning, common causes, fields to check, how to fix, related scenarios, link to spec section.
- Data lives in `packages/core/data/errors.json`, **written in our own words**.
- Unknown code → say so honestly + generic guidance + link to spec.
- Start with the most common real-world codes: 0052, 0104, 0007, 0013, 0044, 0046, 0091, 0099, 0300, 0401, 0402, 0002, 0005, 0078.

### 8.4 `scenarios`
**Input:** business activity (Manufacturer, Importer, Distributor, Wholesaler, Exporter, Retailer, Service Provider, Other) + sector (All Other Sectors, Steel, FMCG, Textile, Telecom, Petroleum, Electricity Distribution, Gas Distribution, Services, Automobile, CNG Stations, Pharmaceuticals, Wholesale/Retails).
**Output:** list of required scenario IDs with short descriptions + expected sale type.
- Data in `packages/core/data/scenarios.json` (scenario ID → short description in our words + sale type) and `activity-map.json` (activity + sector → scenario IDs), entered from spec §9–§10.
- Note: spec says SN026–SN028 apply only if registered as retailer in the sales tax profile → show as a note.

### 8.5 MCP server
Tools (thin wrappers over `core`):
| Tool | Input | Output |
|---|---|---|
| `di_check_response` | response JSON | structured result |
| `di_validate_invoice` | invoice JSON, environment | findings |
| `di_explain_error` | code or response | explanations |
| `di_list_scenarios` | activity, sector | scenarios |
Read-only, no network, clear tool descriptions. Setup example for README: `claude mcp add di-doctor -- npx di-doctor mcp`.

### 8.6 CLI
```
di-doctor check-response response.json
di-doctor validate invoice.json --env sandbox
di-doctor explain 0052
di-doctor explain response.json
di-doctor scenarios --activity Manufacturer --sector Textile
di-doctor mcp
```
- Flags: `--json` (machine output), `--no-color`.
- Exit codes: 0 = all pass, 1 = failures found, 2 = usage/input error.
- Output style example:
```
✗ items[0].salesTaxApplicable  (spec v1.12 §4.1.2)
  Problem: sales tax 150.00 doesn't match 18% of 1000.00 (expected 180.00)
  Fix:     recalculate sales tax from valueSalesExcludingST × rate
? items[0].hsCode ↔ saleType
  Cannot verify offline — needs FBR reference API (planned)
✓ 14 checks passed
```

---

## 9. Architecture

```
di-doctor/
├── packages/
│   ├── core/                 # pure logic, no I/O
│   │   ├── src/
│   │   │   ├── response/     # check-response
│   │   │   ├── validate/     # rules (one file per rule group)
│   │   │   ├── explain/
│   │   │   ├── scenarios/
│   │   │   └── types.ts      # Invoice, Item, Finding, Verdict
│   │   ├── data/
│   │   │   ├── errors.json
│   │   │   ├── scenarios.json
│   │   │   ├── activity-map.json
│   │   │   └── spec-version.json   # { "version": "1.12", "updated": "2025-07-24", "url": "..." }
│   │   └── test/
│   ├── cli/
│   └── mcp/
├── schema/invoice.schema.json
├── fixtures/                 # fake, anonymized samples (valid + invalid + real-error shapes)
├── docs/
│   ├── PROJECT_CONTEXT.md
│   └── spec-traps.md         # our notes on spec inconsistencies (own words)
├── spec/                     # local PDF only — in .gitignore
├── CLAUDE.md
└── README.md
```

**Design principles**
- CLI and MCP call the same `core` functions — logic written once.
- Rules are small, isolated, individually tested, each with `ruleId` + `specRef`.
- Data (errors, scenarios) separate from code → easy to update when the spec changes.
- Spec version shown in every output.

---

## 10. Testing

- vitest; every rule has pass + fail fixtures.
- Fixture set includes: official-sample-shaped valid payload (fake IDs), each common real-world error shape, the misleading-status response, `invoiceStatuses: null` response, debit note cases.
- Golden-output tests for CLI formatting.
- CI: GitHub Actions running lint + test on PRs.
- Later: collect anonymized real responses from users (with permission) to discover hidden live rules.

---

## 11. Naming and publishing

- Working name: **DI Doctor** (`di-doctor`). Check npm/GitHub availability first; alternatives: `invoicekit-pk`, `di-lint`.
- Description: "Unofficial developer toolkit for Pakistan FBR Digital Invoicing — explain errors, validate invoices, read responses safely."
- License: MIT.
- README order: one-line pitch → 30-second GIF → install (`npx di-doctor ...`) → examples → MCP setup → disclaimer → spec version → contributing.

---

## 12. Roadmap (realistic, side-project pace)

| When | What |
|---|---|
| Months 1–2 | v1: check-response, validate, explain, scenarios, MCP, JSON Schema, npm publish |
| v1.5 | Static web page for `explain` (helps accountants too) |
| Months 3–4 | v2: local DI simulator (develop before IP whitelisting; simulate outages) + Pakistani ID validators package |
| Later | Token-based reference checks (user's own token, local cache), Node/.NET SDKs, PK Tax Rules open dataset, provincial authorities (PRA eIMS, SRB) |

---

## 13. Content plan (brand)

Post on every milestone (draft with Claude Code, review before posting):
- dev.to: "The FBR Digital Invoicing response trap that hides failed invoices" (spec trap #1)
- dev.to series: "FBR DI error 0052/0104/0007 explained" (one per common error — searchable)
- LinkedIn: problem story + lessons, 2×/week
- X: build-in-public updates, 3–5×/week
- Answer developer questions where they already ask (Manager.io forum, ERPStuff, Facebook dev groups) — help first, link only when relevant.

---

## 14. Decisions on the open questions (2026-11-09)

1. **Employment contract** — owner confirmed side project is allowed.
2. **Spec version** — no public version newer than v1.12 found (web search, Nov 2026). The official v1.12 PDF on download1.fbr.gov.pk was last modified 2025-07-30. Stay on v1.12; recheck the FBR/IRIS docs page before each release.
3. **NTN digit rule** — never guess (hard rule 3):
   - 7 digits (NTN) or 13 digits (CNIC) → `pass`
   - 9 digits → `cannot-verify`, reason: "spec v1.12 is inconsistent about 9-digit NTNs" (link to `docs/spec-traps.md`)
   - any other length, or non-digits → `fail`
   - Re-check against the local spec PDF before implementing; revise if the spec is clearer than our notes.
4. **Tax math tolerance** — default ±1.00 PKR absolute difference between `salesTaxApplicable` and `valueSalesExcludingST × rate`, configurable via options (`taxTolerance`). Reason: amounts are in rupees with up to 2 decimals; per-line rounding can drift by under a rupee, while a real wrong-rate mistake is usually much larger. Tighten later if real FBR responses show stricter checking.
5. **Product name** — keep **`di-doctor`**. Free on npm (checked 2026-11-09); no conflicting GitHub repo. Backups `invoicekit-pk` and `di-lint` are also free. Reserve the npm name early with the first publish.
6. **Contact PRAL** — after v1 works end to end, before the public npm release and first launch post. Ask for feedback and confirm they're fine with us referencing error codes and linking the spec.

---

## 15. Week 1 plan

- **Days 1–2:** interview 3–5 developers ("Which FBR error wasted the most time?"); LinkedIn post asking the same; Claude Code planning.
- **Days 3–5:** scaffold monorepo; build `check-response`; start `validate`.
- **Days 6–7:** publish first dev.to post on the response trap.

---

## 16. First prompts for Claude Code (run in order, Plan Mode)

**Prompt 1 — understand & plan**
```
Read CLAUDE.md and docs/PROJECT_CONTEXT.md, then read the spec PDF in spec/.
Produce a plan for the v1 monorepo (core, cli, mcp). List every validation rule
you will implement with its spec section, and mark which are pass/fail vs
cannot-verify offline. List every spec inconsistency you find and questions
for me. Don't write code yet.
```

**Prompt 2 — scaffold**
```
Scaffold the pnpm monorepo exactly as planned: packages/core, cli, mcp,
vitest, tsup, eslint, GitHub Actions CI, .gitignore (include spec/ and .env).
Add MIT license and a README skeleton with the disclaimer. No features yet.
```

**Prompt 3 — first feature**
```
Implement check-response in core with full tests (valid, invalid item,
misleading top-level status, invoiceStatuses null, unknown shape, HTTP 401/500).
Then wire it to the CLI. Show me sample CLI output.
```

**Prompt 4 onward:** `validate` (rule groups one at a time) → `explain` (start with the 14 common codes) → `scenarios` → MCP server → JSON Schema → npm publish dry run.
