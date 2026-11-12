import { describe, expect, it } from 'vitest';
import { RULES, validateInvoice } from '../src/index.js';
import { editDistance, nearestKey } from '../src/rules/helpers.js';
import { fixture } from './helpers.js';

describe('rule registry', () => {
  it('has unique ids in H/I order with titles and spec refs', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((i) => i.startsWith('H'))).toHaveLength(16);
    expect(ids.filter((i) => i.startsWith('I'))).toHaveLength(13);
    for (const r of RULES) {
      expect(r.title.length).toBeGreaterThan(10);
      expect(r.specRef).toMatch(/^spec v1\.12 §/);
      expect(['header', 'item']).toContain(r.level);
    }
  });
  it('every finding names its rule, title and spec section', () => {
    const r = validateInvoice(fixture('invoices/header-and-item-errors.json'), { environment: 'sandbox' });
    for (const f of r.findings) {
      expect(f.ruleId).toMatch(/^[HIF]\d{2}$/);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.specRef).toMatch(/spec v1\.12/);
      if (f.verdict === 'fail') expect(['error', 'warning']).toContain(f.severity);
      if (f.verdict === 'cannot-verify') expect(f.reason).toBeTruthy();
    }
    expect(r.summary.fail).toBeGreaterThanOrEqual(2);
  });
  it('a multi-item payload reports per-item paths', () => {
    const r = validateInvoice(fixture('invoices/multi-item-one-bad.json'), { environment: 'sandbox' });
    const bad = r.findings.filter((f) => f.verdict === 'fail' && f.severity === 'error');
    expect(bad.map((f) => f.path)).toEqual(['items[1].salesTaxApplicable']);
  });
});

describe('helpers', () => {
  it('editDistance', () => {
    expect(editDistance('uom', 'uoM')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('hscode', 'hsCode')).toBe(1);
  });
  it('nearestKey prefers case-insensitive exact, then distance ≤ 2', () => {
    expect(nearestKey('uom', ['uoM', 'rate'])).toBe('uoM');
    expect(nearestKey('ratee', ['uoM', 'rate'])).toBe('rate');
    expect(nearestKey('remarks', ['uoM', 'rate'])).toBeUndefined();
  });
});
