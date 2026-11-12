import { describe, expect, it } from 'vitest';
import { explainCode, explainResponse, listErrorCodes, KNOWN_ERROR_CODES, normaliseCode } from '../src/explain/index.js';
import { fixture } from './helpers.js';

describe('explainCode', () => {
  it('knows every code in spec §7 (86 sales) and §8 (22 purchase)', () => {
    expect(KNOWN_ERROR_CODES).toHaveLength(108);
    const codes = listErrorCodes();
    expect(codes.filter((c) => c.side === 'sale')).toHaveLength(86);
    expect(codes.filter((c) => c.side === 'purchase')).toHaveLength(22);
    expect(codes.map((c) => c.code)).toEqual([...codes.map((c) => c.code)].sort());
    for (const c of ['0001', '0113', '0156', '0177']) expect(KNOWN_ERROR_CODES).toContain(c);
    for (const c of ['0052', '0104', '0007', '0013', '0044', '0046', '0091', '0099', '0300', '0401', '0402', '0002', '0005', '0078']) {
      expect(KNOWN_ERROR_CODES).toContain(c);
    }
  });
  it('returns a full explanation for a known code', () => {
    const e = explainCode('0052');
    expect(e.known).toBe(true);
    expect(e.title).toMatch(/HS code/i);
    expect(e.fieldsToCheck).toContain('items[].hsCode');
    expect(e.specRef).toMatch(/§7/);
  });
  it('normalises short codes', () => {
    expect(normaliseCode('52')).toBe('0052');
    expect(explainCode(' 52 ').code).toBe('0052');
  });
  it('is honest about unknown codes', () => {
    const e = explainCode('9999');
    expect(e.known).toBe(false);
    expect(e.side).toBe('unknown');
    expect(e.fix).toMatch(/https:\/\//);
  });
  it('every entry has the required fields and no spec text copied verbatim', () => {
    for (const c of KNOWN_ERROR_CODES) {
      const e = explainCode(c);
      expect(e.title.length).toBeGreaterThan(5);
      expect(e.meaning.length).toBeGreaterThan(20);
      expect(e.fix.length).toBeGreaterThan(10);
      expect(e.commonCauses.length).toBeGreaterThan(0);
      expect(e.specRef).toMatch(e.side === 'purchase' ? /§8/ : /§7/);
    }
  });
  it('purchase codes are explained and labelled', () => {
    const e = explainCode('0170');
    expect(e.known).toBe(true);
    expect(e.side).toBe('purchase');
    expect(e.title).toMatch(/purchase/);
  });
});

describe('explainResponse', () => {
  it('explains header-level error', () => {
    const list = explainResponse(fixture('responses/invalid-header-null-statuses.json'));
    expect(list.map((e) => e.code)).toEqual(['0052']);
  });
  it('explains item-level errors once per code', () => {
    const list = explainResponse(fixture('responses/valid-header-failed-item.json'));
    expect(list.map((e) => e.code)).toEqual(['0104']);
  });
  it('returns nothing for a valid response', () => {
    expect(explainResponse(fixture('responses/valid-post.json'))).toEqual([]);
  });
});
