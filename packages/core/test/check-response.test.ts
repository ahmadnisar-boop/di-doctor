import { describe, expect, it } from 'vitest';
import { checkResponse } from '../src/response/check-response.js';
import { fixture } from './helpers.js';

describe('checkResponse', () => {
  it('valid post response (spec §4.1.3): valid, with FBR invoice number', () => {
    const r = checkResponse(fixture('responses/valid-post.json'));
    expect(r.overall).toBe('valid');
    expect(r.kind).toBe('post');
    expect(r.fbrInvoiceNumber).toBe('0000001DI1747119701593');
    expect(r.problems).toHaveLength(0);
    expect(r.items[0]?.status).toBe('valid');
  });

  it('valid validate-endpoint response (spec §4.2.3): valid, no invoice number', () => {
    const r = checkResponse(fixture('responses/valid-validate.json'));
    expect(r.overall).toBe('valid');
    expect(r.kind).toBe('validate');
    expect(r.fbrInvoiceNumber).toBeUndefined();
  });

  it('header-level rejection with invoiceStatuses null (spec §4.1.4)', () => {
    const r = checkResponse(fixture('responses/invalid-header-null-statuses.json'));
    expect(r.overall).toBe('invalid');
    expect(r.items).toHaveLength(0);
    expect(r.problems).toEqual([
      { where: 'header', errorCode: '0052', message: 'Provide proper HS Code with invoice no. null' },
    ]);
  });

  it('misleading header: statusCode 00 but status invalid (spec §4.1.5)', () => {
    const r = checkResponse(fixture('responses/invalid-misleading-header.json'));
    expect(r.overall).toBe('invalid');
    expect(r.problems[0]).toMatchObject({ where: 'items[0]', errorCode: '0046' });
    expect(r.warnings.some((w) => w.includes('statusCode is "00"'))).toBe(true);
  });

  it('header says Valid but one item failed: invalid, no invoice number, warning', () => {
    const r = checkResponse(fixture('responses/valid-header-failed-item.json'));
    expect(r.overall).toBe('invalid');
    expect(r.fbrInvoiceNumber).toBeUndefined();
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ where: 'items[1]', errorCode: '0104' });
    expect(r.warnings.some((w) => w.includes('item(s) failed'))).toBe(true);
  });

  it('status casing is ignored', () => {
    const body = {
      validationResponse: { statusCode: '00', status: 'VALID', invoiceStatuses: [{ itemSNo: '1', status: 'valid' }] },
    };
    expect(checkResponse(body).overall).toBe('valid');
  });

  it('unknown shape: unknown, never guesses', () => {
    const r = checkResponse(fixture('responses/unknown-shape.json'));
    expect(r.overall).toBe('unknown');
    expect(r.problems[0]?.where).toBe('body');
  });

  it('non-object input is unknown', () => {
    expect(checkResponse('nope').overall).toBe('unknown');
    expect(checkResponse(null).overall).toBe('unknown');
  });

  it('inner validationResponse object alone is accepted with a warning', () => {
    const r = checkResponse(fixture('responses/inner-only.json'));
    expect(r.overall).toBe('valid');
    expect(r.warnings[0]).toMatch(/inner validationResponse/);
  });

  it('HTTP 401 → invalid with auth problem (spec §4.1.6)', () => {
    const r = checkResponse(fixture('responses/unknown-shape.json'), { httpStatus: 401 });
    expect(r.overall).toBe('invalid');
    expect(r.problems[0]).toMatchObject({ where: 'http' });
    expect(r.problems[0]?.message).toMatch(/401/);
  });

  it('HTTP 500 → unknown, retryable; valid body cannot override it', () => {
    const r = checkResponse(fixture('responses/valid-post.json'), { httpStatus: 500 });
    expect(r.overall).toBe('unknown');
    expect(r.fbrInvoiceNumber).toBeUndefined();
    expect(r.problems[0]?.message).toMatch(/Retry/);
  });

  it('HTTP 200 changes nothing', () => {
    expect(checkResponse(fixture('responses/valid-post.json'), { httpStatus: 200 }).overall).toBe('valid');
  });

  it('reports the spec version', () => {
    expect(checkResponse({}).specVersion).toBe('1.12');
  });
});
