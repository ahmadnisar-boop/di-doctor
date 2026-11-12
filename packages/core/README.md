# @di-doctor/core

Pure functions behind [DI Doctor](https://github.com/ahmadnisar-boop/di-doctor), the unofficial developer toolkit for Pakistan's FBR Digital Invoicing API. No network, no file I/O, no global state.

```ts
import { validateInvoice, checkResponse, simulate, explainCode, listScenarios } from '@di-doctor/core';

const result = validateInvoice(invoice, { environment: 'sandbox' });
const verdict = checkResponse(fbrResponseBody, { httpStatus: 200 });
```

- `validateInvoice` — offline pre-flight rules, each citing the spec section, with `pass` / `fail` / `cannot-verify` verdicts
- `checkResponse` — safe reading of DI API responses, including the misleading top-level status case
- `simulate` — FBR-shaped responses for a payload, for tests and local development
- `explainCode`, `explainResponse` — plain-English explanations of every documented error code
- `listScenarios`, `getScenario` — sandbox scenarios per business activity and sector
- `RULES` — the rule registry, for tooling and documentation

Most users want the [`di-doctor`](https://www.npmjs.com/package/di-doctor) package, which includes this core plus the CLI, the local simulator server and the MCP server. Full documentation and the disclaimer are in the repository README. Unofficial; not affiliated with FBR or PRAL; not tax advice.
