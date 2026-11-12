import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { createServer, listen } from '../src/serve.js';

const invoice = (name: string) => readFileSync(`fixtures/invoices/${name}.json`, 'utf8');
const logs: string[] = [];
let server: Server;
let base = '';

beforeAll(async () => {
  server = createServer({ port: 0, log: (l) => logs.push(l), now: () => 1747119701593 });
  const { port } = await listen(server, { port: 0 });
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (path: string, body: string, headers: Record<string, string> = { authorization: 'Bearer test-token' }) =>
  fetch(base + path, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });

describe('serve', () => {
  it('GET /_health', async () => {
    const r = await fetch(base + '/_health');
    expect(r.status).toBe(200);
    expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
  });
  it('401 without a Bearer token (spec §3.1, §4.1.6)', async () => {
    const r = await post('/di_data/v1/di/postinvoicedata_sb', invoice('valid-sandbox-sn001'), {});
    expect(r.status).toBe(401);
    expect(logs.some((l) => l.includes('401'))).toBe(true);
  });
  it('404 for unknown paths, 405 for GET on an invoice path', async () => {
    expect((await post('/nope', '{}')).status).toBe(404);
    expect((await fetch(base + '/di_data/v1/di/postinvoicedata_sb')).status).toBe(405);
  });
  it('400 for a non-JSON body', async () => {
    expect((await post('/di_data/v1/di/postinvoicedata_sb', '{not json')).status).toBe(400);
  });
  it('valid sandbox post returns the FBR-shaped valid body with an invoice number', async () => {
    const r = await post('/di_data/v1/di/postinvoicedata_sb', invoice('valid-sandbox-sn001'));
    expect(r.status).toBe(200);
    const body = (await r.json()) as { invoiceNumber: string; validationResponse: { status: string }; _simulator: unknown };
    expect(body.invoiceNumber).toBe('0000001DI1747119701593');
    expect(body.validationResponse.status).toBe('Valid');
    expect(body._simulator).toBeDefined();
  });
  it('tax mismatch returns the misleading-header shape with 0104 inside invoiceStatuses', async () => {
    const r = await post('/di_data/v1/di/postinvoicedata_sb', invoice('tax-mismatch'));
    const body = (await r.json()) as { validationResponse: { statusCode: string; status: string; invoiceStatuses: { errorCode: string }[] } };
    expect(body.validationResponse.statusCode).toBe('00');
    expect(body.validationResponse.status).toBe('Invalid');
    expect(body.validationResponse.invoiceStatuses[0]?.errorCode).toBe('0104');
    expect(logs.some((l) => l.includes('I04/0104'))).toBe(true);
  });
  it('production path requires no scenarioId and validate path issues no invoice number', async () => {
    const r = await post('/di_data/v1/di/validateinvoicedata', invoice('valid-production'));
    const body = (await r.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('invoiceNumber');
    expect((body['validationResponse'] as { status: string }).status).toBe('Valid');
  });
});

describe('serve options', () => {
  it('--token requires the exact token; --chaos 1 always 500s; --strict-shape drops metadata', async () => {
    const s = createServer({ token: 'secret', chaos: 1, strictShape: true, log: () => {} });
    const { port } = await listen(s, { port: 0 });
    const b = `http://127.0.0.1:${port}`;
    try {
      const wrong = await fetch(b + '/di_data/v1/di/postinvoicedata_sb', { method: 'POST', body: '{}', headers: { authorization: 'Bearer nope' } });
      expect(wrong.status).toBe(401);
      const chaos = await fetch(b + '/di_data/v1/di/postinvoicedata_sb', { method: 'POST', body: '{}', headers: { authorization: 'Bearer secret' } });
      expect(chaos.status).toBe(500);
    } finally {
      await new Promise<void>((r) => s.close(() => r()));
    }
    const s2 = createServer({ strictShape: true, log: () => {} });
    const l2 = await listen(s2, { port: 0 });
    try {
      const r = await fetch(`http://127.0.0.1:${l2.port}/di_data/v1/di/postinvoicedata_sb`, { method: 'POST', body: invoice('valid-sandbox-sn001'), headers: { authorization: 'Bearer x' } });
      expect(await r.json()).not.toHaveProperty('_simulator');
    } finally {
      await new Promise<void>((r) => s2.close(() => r()));
    }
  });
});
