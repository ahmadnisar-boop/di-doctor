import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDiDoctorServer } from '../src/server.js';

const fixture = (rel: string) => JSON.parse(readFileSync(`fixtures/${rel}`, 'utf8')) as Record<string, unknown>;
let client: Client;

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createDiDoctorServer();
  await server.connect(a);
  client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(b);
});
afterAll(async () => {
  await client.close();
});

const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args });
  const content = r.content as { type: string; text: string }[];
  return JSON.parse(content[0]!.text) as Record<string, unknown>;
};

describe('MCP server', () => {
  it('lists the five tools', async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      'di_check_response',
      'di_explain_error',
      'di_list_scenarios',
      'di_simulate_response',
      'di_validate_invoice',
    ]);
  });
  it('di_check_response catches the misleading header', async () => {
    const r = await call('di_check_response', { response: fixture('responses/invalid-misleading-header.json') });
    expect(r['overall']).toBe('invalid');
  });
  it('di_check_response accepts a JSON string and httpStatus', async () => {
    const r = await call('di_check_response', {
      response: readFileSync('fixtures/responses/valid-post.json', 'utf8'),
      httpStatus: 500,
    });
    expect(r['overall']).toBe('unknown');
  });
  it('di_validate_invoice returns findings and summary', async () => {
    const r = await call('di_validate_invoice', {
      invoice: fixture('invoices/tax-mismatch.json'),
      environment: 'sandbox',
    });
    expect((r['summary'] as { fail: number }).fail).toBe(1);
  });
  it('di_validate_invoice with activity/sector runs H16', async () => {
    const r = await call('di_validate_invoice', {
      invoice: fixture('invoices/valid-sandbox-sn001.json'),
      environment: 'sandbox',
      activity: 'Manufacturer',
      sector: 'Steel',
    });
    const findings = r['findings'] as { ruleId: string; verdict: string }[];
    expect(findings.find((f) => f.ruleId === 'H16')?.verdict).toBe('fail');
  });
  it('di_explain_error by code and by response', async () => {
    const byCode = (await client.callTool({ name: 'di_explain_error', arguments: { code: '52' } })).content as {
      text: string;
    }[];
    expect(JSON.parse(byCode[0]!.text)[0].code).toBe('0052');
    const byResp = (
      await client.callTool({
        name: 'di_explain_error',
        arguments: { response: fixture('responses/invalid-header-null-statuses.json') },
      })
    ).content as { text: string }[];
    expect(JSON.parse(byResp[0]!.text)[0].code).toBe('0052');
  });
  it('di_list_scenarios', async () => {
    const r = await call('di_list_scenarios', { activity: 'Manufacturer', sector: 'Textile' });
    expect((r['scenarios'] as { id: string }[]).map((s) => s.id)).toContain('SN009');
  });
  it('di_simulate_response returns the FBR shape', async () => {
    const r = await call('di_simulate_response', {
      invoice: fixture('invoices/valid-sandbox-sn001.json'),
      environment: 'sandbox',
      strictShape: true,
    });
    expect(r['result']).toBe('valid');
    expect(r['body']).toHaveProperty('invoiceNumber');
    expect(r['body']).not.toHaveProperty('_simulator');
  });
  it('rejects a bad environment via the input schema', async () => {
    const r = await client.callTool({ name: 'di_validate_invoice', arguments: { invoice: {}, environment: 'live' } });
    expect(r.isError).toBe(true);
  });
});
