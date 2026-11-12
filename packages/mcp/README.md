# @di-doctor/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server exposing [DI Doctor](https://github.com/ahmadnisar-boop/di-doctor)'s tools to AI assistants. Read-only, no network.

Most users start it through the CLI:

```sh
claude mcp add di-doctor -- npx di-doctor mcp
```

Programmatic use:

```ts
import { createDiDoctorServer, runStdio } from '@di-doctor/mcp';
```

Tools: `di_validate_invoice`, `di_check_response`, `di_explain_error`, `di_list_scenarios`, `di_simulate_response`. Unofficial; not affiliated with FBR or PRAL; not tax advice.
