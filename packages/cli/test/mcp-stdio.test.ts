import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** End-to-end: `di-doctor mcp` over stdio, the way an assistant would launch it. */
let client: Client;

beforeAll(async () => {
  client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'packages/cli/src/cli.ts', 'mcp'],
      stderr: 'pipe',
    }),
  );
});
afterAll(async () => {
  await client.close();
});

describe('di-doctor mcp (stdio)', () => {
  it('serves the tools and answers a call', async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toContain('di_explain_error');
    const r = await client.callTool({ name: 'di_explain_error', arguments: { code: '0104' } });
    const content = r.content as { text: string }[];
    expect(JSON.parse(content[0]!.text)[0].title).toMatch(/Sales tax amount does not match/);
  });
});
