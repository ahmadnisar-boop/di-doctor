import { describe, expect, it } from 'vitest';
import { validateInvoice, parseSimpleRate } from '../src/validate/index.js';
import { byRule, errorsOf, fixture, verdicts, warningsOf } from './helpers.js';

const sandbox = { environment: 'sandbox' as const };
const valid = () => fixture('invoices/valid-sandbox-sn001.json') as { items: Record<string, unknown>[] } & Record<string, unknown>;
const withItem = (over: Record<string, unknown>, header: Record<string, unknown> = {}) => {
  const v = valid();
  return { ...v, ...header, items: [{ ...v.items[0], ...over }] };
};
const run = (inv: unknown, opts: { environment: 'sandbox' | 'production'; taxTolerance?: number } = sandbox) => validateInvoice(inv, opts).findings;

describe('parseSimpleRate', () => {
  it('parses simple percentages', () => {
    expect(parseSimpleRate('18%')).toBe(18);
    expect(parseSimpleRate(' 0% ')).toBe(0);
    expect(parseSimpleRate('17.5%')).toBe(17.5);
  });
  it('returns null for anything else', () => {
    expect(parseSimpleRate('18% along with rupees 60 per kilogram')).toBeNull();
    expect(parseSimpleRate('Exempt')).toBeNull();
    expect(parseSimpleRate(18)).toBeNull();
    expect(parseSimpleRate(undefined)).toBeNull();
  });
});

describe('I01 required item fields', () => {
  it('pass', () => expect(verdicts(run(valid()), 'I01')).toEqual(['pass']));
  it('fail per missing field', () => {
    const f = errorsOf(run(fixture('invoices/missing-required-fields.json')), 'I01');
    expect(f.map((x) => x.path).sort()).toEqual(['items[0].hsCode', 'items[0].saleType']);
  });
  it('fail when an item is not an object', () => expect(verdicts(run({ ...valid(), items: [1] }), 'I01')).toEqual(['fail']));
});

describe('I02 decimal fields are numbers', () => {
  it('pass', () => expect(verdicts(run(valid()), 'I02')).toEqual(['pass']));
  it('fail on strings, warning on null optional', () => {
    const f = run(fixture('invoices/string-numbers.json'));
    expect(errorsOf(f, 'I02').map((x) => x.path).sort()).toEqual(['items[0].quantity', 'items[0].salesTaxApplicable']);
    expect(warningsOf(f, 'I02').map((x) => x.path)).toEqual(['items[0].discount']);
  });
  it('absent optional fields are fine', () => {
    const inv = valid();
    delete inv.items[0]!['discount'];
    expect(verdicts(run(inv), 'I02')).toEqual(['pass']);
  });
});

describe('I03 hsCode shape', () => {
  it('pass', () => expect(verdicts(run(valid()), 'I03')).toEqual(['pass']));
  it('warning on odd shape', () => expect(warningsOf(run(withItem({ hsCode: '1234' })), 'I03')).toHaveLength(1));
});

describe('I04 sales tax vs rate', () => {
  it('pass when exact', () => expect(verdicts(run(valid()), 'I04')).toEqual(['pass']));
  it('pass within default tolerance of 1.00', () => expect(verdicts(run(withItem({ salesTaxApplicable: 180.9 })), 'I04')).toEqual(['pass']));
  it('fail outside tolerance with expected value in message', () => {
    const f = errorsOf(run(fixture('invoices/tax-mismatch.json')), 'I04')[0];
    expect(f?.path).toBe('items[0].salesTaxApplicable');
    expect(f?.message).toMatch(/expected 180\.00/);
  });
  it('tolerance is configurable', () => {
    expect(verdicts(run(withItem({ salesTaxApplicable: 180.9 }), { environment: 'sandbox', taxTolerance: 0.5 }), 'I04')).toEqual(['fail']);
  });
  it('cannot-verify for compound rates', () => {
    const f = byRule(run(fixture('invoices/complex-rate.json')), 'I04')[0];
    expect(f?.verdict).toBe('cannot-verify');
  });
  it('skipped when amounts are not numbers (I02 reports those)', () => {
    expect(byRule(run(withItem({ salesTaxApplicable: '180' })), 'I04')).toHaveLength(0);
  });
  it('cannot-verify for Third Schedule goods (retail-price base), never a false fail', () => {
    const f = byRule(run(fixture('invoices/third-schedule.json')), 'I04')[0];
    expect(f?.verdict).toBe('cannot-verify');
    expect(f?.reason).toMatch(/0102/);
  });
  it('cannot-verify when discount is non-zero', () => expect(byRule(run(fixture('invoices/with-discount.json')), 'I04')[0]?.verdict).toBe('cannot-verify'));
  it('cannot-verify when a fixed/retail price is given on a simple-percent sale type', () => {
    expect(byRule(run(withItem({ fixedNotifiedValueOrRetailPrice: 500 })), 'I04')[0]?.verdict).toBe('cannot-verify');
  });
  it('cannot-verify for sale types with an unspecified base (steel)', () => expect(byRule(run(fixture('invoices/steel-sector.json')), 'I04')[0]?.verdict).toBe('cannot-verify'));
  it('cannot-verify for a sale type not in §9', () => expect(byRule(run(fixture('invoices/unknown-sale-type.json')), 'I04')[0]?.verdict).toBe('cannot-verify'));
  it('carries error code 0104 on failure', () => expect(errorsOf(run(fixture('invoices/tax-mismatch.json')), 'I04')[0]?.errorCode).toBe('0104'));
});

describe('I10 unknown item keys', () => {
  it('pass', () => expect(verdicts(run(valid()), 'I10')).toEqual(['pass']));
  it('warns with nearest match, including casing-only mistakes', () => {
    const w = warningsOf(run(fixture('invoices/unknown-keys.json')), 'I10');
    expect(w.map((x) => x.path).sort()).toEqual(['items[0].internalSku', 'items[0].uom']);
    expect(w.find((x) => x.path === 'items[0].uom')?.message).toMatch(/"uoM"/);
  });
});

describe('I11 saleType known', () => {
  it('pass with casing note', () => {
    const f = byRule(run(valid()), 'I11')[0];
    expect(f?.verdict).toBe('pass');
    expect(f?.message).toMatch(/spells it "Goods at Standard Rate \(default\)"/);
  });
  it('cannot-verify for a value outside §9', () => expect(verdicts(run(fixture('invoices/unknown-sale-type.json')), 'I11')).toEqual(['cannot-verify']));
  it('not evaluated when empty (I01 reports it)', () => expect(byRule(run(withItem({ saleType: '' })), 'I11')).toHaveLength(0));
});

describe('I12 totalValues', () => {
  it('always cannot-verify when numeric', () => expect(verdicts(run(valid()), 'I12')).toEqual(['cannot-verify']));
  it('skipped when not numeric', () => expect(byRule(run(withItem({ totalValues: 'x' })), 'I12')).toHaveLength(0));
});

describe('I13 sale-type restrictions', () => {
  it('none for standard rate', () => expect(byRule(run(valid()), 'I13')).toHaveLength(0));
  it('cannot-verify listing codes for steel', () => {
    const f = byRule(run(fixture('invoices/steel-sector.json')), 'I13')[0];
    expect(f?.verdict).toBe('cannot-verify');
    expect(f?.reason).toMatch(/0101/);
  });
});

describe('error codes on item failures', () => {
  it('I01 maps per field', () => {
    const f = errorsOf(run(fixture('invoices/missing-required-fields.json')), 'I01');
    expect(Object.fromEntries(f.map((x) => [x.path, x.errorCode]))).toEqual({ 'items[0].hsCode': '0044', 'items[0].saleType': '0013' });
  });
  it('I02 → 0300, I05 → 0008, I06 → 0079', () => {
    expect(errorsOf(run(fixture('invoices/string-numbers.json')), 'I02')[0]?.errorCode).toBe('0300');
    expect(errorsOf(run(fixture('invoices/stwh-partial.json')), 'I05')[0]?.errorCode).toBe('0008');
    expect(errorsOf(run(fixture('invoices/five-percent-over-limit.json')), 'I06')[0]?.errorCode).toBe('0079');
  });
  it('warnings never carry a code', () => {
    const all = run(fixture('invoices/unknown-keys.json'));
    expect(all.filter((f) => f.severity === 'warning').every((f) => f.errorCode === undefined)).toBe(true);
  });
});


describe('I05 salesTaxWithheldAtSource', () => {
  it('pass when 0', () => expect(verdicts(run(valid()), 'I05')).toEqual(['pass']));
  it('pass when equal to sales tax', () => expect(verdicts(run(withItem({ salesTaxWithheldAtSource: 180 })), 'I05')).toEqual(['pass']));
  it('fail when partial', () => expect(verdicts(run(fixture('invoices/stwh-partial.json')), 'I05')).toEqual(['fail']));
});

describe('I06 5% above 20,000', () => {
  it('pass when rule does not apply', () => expect(verdicts(run(valid()), 'I06')).toEqual(['pass']));
  it('fail when 5% and value above 20,000', () => expect(verdicts(run(fixture('invoices/five-percent-over-limit.json')), 'I06')).toEqual(['fail']));
  it('pass when 5% and value at the limit', () => {
    expect(verdicts(run(withItem({ rate: '5%', valueSalesExcludingST: 20000, salesTaxApplicable: 1000, saleType: 'Goods at Reduced Rate' }, { scenarioId: 'SN005' })), 'I06')).toEqual(['pass']);
  });
});

describe('I07 SRO schedule needs item serial', () => {
  it('pass when both set', () => expect(verdicts(run(withItem({ sroScheduleNo: 'SRO123', sroItemSerialNo: '9' })), 'I07')).toEqual(['pass']));
  it('warning when serial missing', () => expect(warningsOf(run(fixture('invoices/sro-without-serial.json')), 'I07')).toHaveLength(1));
  it('not evaluated when no schedule', () => expect(byRule(run(valid()), 'I07')).toHaveLength(0));
});

describe('I08 saleType matches scenario (sandbox)', () => {
  it('pass, ignoring casing differences between §9 and samples', () => expect(verdicts(run(valid()), 'I08')).toEqual(['pass']));
  it('fail on mismatch with expected sale type in message', () => {
    const f = errorsOf(run(fixture('invoices/wrong-scenario-saletype.json')), 'I08')[0];
    expect(f?.message).toMatch(/Goods at Reduced Rate/);
  });
  it('not evaluated in production', () => expect(byRule(run(fixture('invoices/valid-production.json'), { environment: 'production' }), 'I08')).toHaveLength(0));
  it('not evaluated for unknown scenario id', () => expect(byRule(run({ ...valid(), scenarioId: 'SN099' }), 'I08')).toHaveLength(0));
});

describe('I09 reference-data pairings', () => {
  it('always cannot-verify, once per item', () => {
    const inv = valid();
    inv.items.push({ ...inv.items[0] });
    expect(verdicts(run(inv), 'I09')).toEqual(['cannot-verify', 'cannot-verify']);
  });
});

describe('summary', () => {
  it('counts verdicts and severities separately', () => {
    const r = validateInvoice(fixture('invoices/sro-without-serial.json'), sandbox);
    expect(r.summary.fail).toBe(0);
    expect(r.summary.warnings).toBe(1);
    expect(r.summary.cannotVerify).toBeGreaterThan(0);
    expect(r.summary.pass).toBeGreaterThan(0);
  });
});
