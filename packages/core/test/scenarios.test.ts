import { describe, expect, it } from 'vitest';
import { ACTIVITIES, SECTORS, allScenarios, getScenario, listScenarios } from '../src/scenarios/index.js';

describe('scenario data (spec §9)', () => {
  it('has all 28 scenarios with sale types', () => {
    const all = allScenarios();
    expect(all).toHaveLength(28);
    expect(all[0]?.id).toBe('SN001');
    expect(all.every((s) => s.saleType.length > 0 && s.description.length > 0)).toBe(true);
  });
  it('marks SN026–SN028 as retailer-only', () => {
    expect(getScenario('SN026')?.note).toMatch(/retailer/);
    expect(getScenario('SN001')?.note).toBeUndefined();
  });
  it('is case-insensitive on id and returns undefined for unknown', () => {
    expect(getScenario('sn005')?.saleType).toBe('Goods at Reduced Rate');
    expect(getScenario('SN099')).toBeUndefined();
  });
});

describe('listScenarios (spec §10)', () => {
  it('covers 8 activities and 13 sectors', () => {
    expect(ACTIVITIES).toHaveLength(8);
    expect(SECTORS).toHaveLength(13);
  });
  it('Manufacturer / Textile = base set + SN009', () => {
    const r = listScenarios('Manufacturer', 'Textile');
    if ('error' in r) throw new Error(r.error);
    expect(r.scenarios.map((s) => s.id)).toEqual([
      'SN001',
      'SN002',
      'SN005',
      'SN006',
      'SN007',
      'SN015',
      'SN016',
      'SN017',
      'SN021',
      'SN022',
      'SN024',
      'SN009',
    ]);
    expect(r.notes).toEqual([]);
  });
  it('Manufacturer / Steel is only the steel scenarios', () => {
    const r = listScenarios('Manufacturer', 'Steel');
    if ('error' in r) throw new Error(r.error);
    expect(r.scenarios.map((s) => s.id)).toEqual(['SN003', 'SN004', 'SN011']);
  });
  it('Distributor / FMCG de-duplicates SN008 and adds the retailer note', () => {
    const r = listScenarios('distributor', 'fmcg');
    if ('error' in r) throw new Error(r.error);
    expect(r.scenarios.map((s) => s.id)).toEqual(['SN008', 'SN026', 'SN027', 'SN028']);
    expect(r.notes[0]).toMatch(/retailer/);
  });
  it('Service Provider / Wholesale / Retails', () => {
    const r = listScenarios('Service Provider', 'Wholesale/Retails');
    if ('error' in r) throw new Error(r.error);
    expect(r.scenarios.map((s) => s.id)).toEqual(['SN026', 'SN027', 'SN028', 'SN008', 'SN018', 'SN019']);
  });
  it('flags the Manufacturer / Pharmaceuticals oddity', () => {
    const r = listScenarios('Manufacturer', 'Pharmaceuticals');
    if ('error' in r) throw new Error(r.error);
    expect(r.scenarios.map((s) => s.id)).not.toContain('SN025');
    expect(r.notes.some((n) => n.includes('SN025'))).toBe(true);
  });
  it('unknown activity or sector returns the valid lists', () => {
    const r = listScenarios('Farmer', 'Steel');
    expect('error' in r).toBe(true);
    if ('error' in r) {
      expect(r.error).toMatch(/activity "Farmer"/);
      expect(r.activities).toEqual(ACTIVITIES);
    }
  });
  it('every activity/sector pair resolves to known scenarios', () => {
    for (const a of ACTIVITIES)
      for (const s of SECTORS) {
        const r = listScenarios(a, s);
        if ('error' in r) throw new Error(r.error);
        expect(r.scenarios.length).toBeGreaterThan(0);
        expect(new Set(r.scenarios.map((x) => x.id)).size).toBe(r.scenarios.length);
      }
  });
});
