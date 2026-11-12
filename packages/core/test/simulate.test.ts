import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { simulate, formatPkt, checkResponse, validateInvoice } from '../src/index.js';
import { fixture } from './helpers.js';

const NOW = Date.UTC(2025, 4, 13, 7, 1, 41, 593); // 2025-05-13 12:01:41 PKT
const sb = (over: Partial<Parameters<typeof simulate>[1]> = {}) => ({ environment: 'sandbox' as const, now: NOW, endpoint: 'post' as const, ...over });

describe('formatPkt', () => {
  it('formats in Pakistan Standard Time like the spec samples', () => expect(formatPkt(NOW)).toBe('2025-05-13 12:01:41'));
});

describe('simulate: valid invoice', () => {
  it('post endpoint matches the §4.1.3 shape with a 22-char invoice number for a 7-digit NTN', () => {
    const r = simulate(fixture('invoices/valid-sandbox-sn001.json'), sb());
    expect(r.result).toBe('valid');
    expect(r.errors).toEqual([]);
    const body = r.body as { invoiceNumber: string; dated: string; validationResponse: Record<string, unknown>; _simulator: unknown };
    expect(body.invoiceNumber).toBe(`0000001DI${NOW}`);
    expect(body.invoiceNumber).toHaveLength(22);
    expect(body.dated).toBe('2025-05-13 12:01:41');
    expect(body.validationResponse).toEqual({
      statusCode: '00',
      status: 'Valid',
      error: '',
      invoiceStatuses: [{ itemSNo: '1', statusCode: '00', status: 'Valid', invoiceNo: `0000001DI${NOW}-1`, errorCode: '', error: '' }],
    });
    expect(body._simulator).toBeDefined();
  });
  it('13-digit CNIC seller gives a 28-char invoice number', () => {
    const inv = { ...(fixture('invoices/valid-sandbox-sn001.json') as object), sellerNTNCNIC: '0000000000001' };
    expect((simulate(inv, sb()).body as { invoiceNumber: string }).invoiceNumber).toHaveLength(28);
  });
  it('validate endpoint matches the §4.2.3 shape (no invoice number, null error codes)', () => {
    const r = simulate(fixture('invoices/valid-sandbox-sn001.json'), sb({ endpoint: 'validate' }));
    expect(r.body).not.toHaveProperty('invoiceNumber');
    expect((r.body as { validationResponse: unknown }).validationResponse).toEqual({
      statusCode: '00',
      status: 'Valid',
      errorCode: null,
      error: '',
      invoiceStatuses: [{ itemSNo: '1', statusCode: '00', status: 'Valid', errorCode: null, error: '' }],
    });
  });
  it('strictShape drops the metadata', () => {
    expect(simulate(fixture('invoices/valid-sandbox-sn001.json'), sb({ strictShape: true })).body).not.toHaveProperty('_simulator');
  });
  it('diagnostics carry the cannot-verify findings', () => {
    const r = simulate(fixture('invoices/valid-sandbox-sn001.json'), sb());
    expect(r.diagnostics.map((d) => d.ruleId)).toContain('I09');
    expect(r.diagnostics.every((d) => d.verdict === 'cannot-verify' || d.severity === 'warning')).toBe(true);
  });
});

describe('simulate: header-level rejection (§4.1.4)', () => {
  it('puts the first header error at the top with invoiceStatuses null', () => {
    const r = simulate(fixture('invoices/header-and-item-errors.json'), sb());
    expect(r.result).toBe('invalid');
    const vr = (r.body as { validationResponse: Record<string, unknown> }).validationResponse;
    expect(vr['statusCode']).toBe('01');
    expect(vr['status']).toBe('Invalid');
    expect(vr['errorCode']).toBe('0043');
    expect(vr['invoiceStatuses']).toBeNull();
    expect(r.body).not.toHaveProperty('invoiceNumber');
  });
  it('non-object payload is a header-level rejection', () => {
    const r = simulate('nope', sb());
    expect(r.result).toBe('invalid');
    expect((r.body as { validationResponse: { invoiceStatuses: unknown } }).validationResponse.invoiceStatuses).toBeNull();
  });
  it('empty items list is a header-level rejection with no documented code', () => {
    const r = simulate(fixture('invoices/missing-items.json'), sb());
    const vr = (r.body as { validationResponse: Record<string, unknown> }).validationResponse;
    expect(vr['errorCode']).toBe('');
    expect((r.body as { _simulator: { note: string } })._simulator.note).toMatch(/No FBR error code is documented/);
  });
});

describe('simulate: item-level rejection (§4.1.5)', () => {
  it('reproduces the misleading header: statusCode 00, status Invalid, error inside invoiceStatuses', () => {
    const r = simulate(fixture('invoices/tax-mismatch.json'), sb());
    expect(r.result).toBe('invalid');
    const vr = (r.body as { validationResponse: { statusCode: string; status: string; invoiceStatuses: Record<string, unknown>[] } }).validationResponse;
    expect(vr.statusCode).toBe('00');
    expect(vr.status).toBe('Invalid');
    expect(vr.invoiceStatuses[0]).toMatchObject({ itemSNo: '1', statusCode: '01', status: 'Invalid', invoiceNo: null, errorCode: '0104' });
  });
  it('multi-item: only the bad item fails, others Valid, no invoice numbers', () => {
    const r = simulate(fixture('invoices/multi-item-one-bad.json'), sb());
    const st = (r.body as { validationResponse: { invoiceStatuses: Record<string, unknown>[] } }).validationResponse.invoiceStatuses;
    expect(st.map((s) => s['status'])).toEqual(['Valid', 'Invalid', 'Valid']);
    expect(st.every((s) => s['invoiceNo'] === null)).toBe(true);
  });
  it('validate endpoint uses null error codes for valid items (§4.2.4)', () => {
    const r = simulate(fixture('invoices/multi-item-one-bad.json'), sb({ endpoint: 'validate' }));
    const st = (r.body as { validationResponse: { invoiceStatuses: Record<string, unknown>[]; errorCode: unknown } }).validationResponse;
    expect(st.errorCode).toBeNull();
    expect(st.invoiceStatuses[0]).toEqual({ itemSNo: '1', statusCode: '00', status: 'Valid', errorCode: null, error: '' });
    expect(st.invoiceStatuses[1]).not.toHaveProperty('invoiceNo');
  });
  it('warnings never cause a rejection', () => {
    const r = simulate(fixture('invoices/sro-without-serial.json'), sb());
    expect(r.result).toBe('valid');
    expect(r.diagnostics.some((d) => d.ruleId === 'I07')).toBe(true);
  });
  it('Third Schedule invoice is not rejected by the tax-math rule', () => {
    expect(simulate(fixture('invoices/third-schedule.json'), sb()).result).toBe('valid');
  });
});

describe('simulate ↔ checkResponse round trip over every invoice fixture', () => {
  const files = readdirSync('fixtures/invoices').filter((f) => f.endsWith('.json'));
  for (const file of files) {
    for (const endpoint of ['post', 'validate'] as const) {
      it(`${file} (${endpoint})`, () => {
        const inv = fixture(`invoices/${file}`);
        const env = file.includes('production') ? 'production' : 'sandbox';
        const v = validateInvoice(inv, { environment: env });
        const r = simulate(inv, { environment: env, now: NOW, endpoint, strictShape: true });
        const c = checkResponse(r.body);
        expect(r.result).toBe(v.summary.fail > 0 ? 'invalid' : 'valid');
        expect(c.overall).toBe(r.result);
        const codes = r.errors.map((e) => e.errorCode).filter(Boolean);
        for (const p of c.problems) if (p.errorCode) expect(codes).toContain(p.errorCode);
        if (r.result === 'valid' && endpoint === 'post') expect(c.fbrInvoiceNumber).toMatch(/^\d+DI\d{13}$/);
      });
    }
  }
});
