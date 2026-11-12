import { describe, expect, it } from 'vitest';
import { validateInvoice } from '../src/validate/index.js';
import type { ValidateOptions } from '../src/types.js';
import { byRule, errorsOf, fixture, verdicts, warningsOf } from './helpers.js';

const sandbox = { environment: 'sandbox' as const };
const production = { environment: 'production' as const };
const valid = () => fixture('invoices/valid-sandbox-sn001.json') as Record<string, unknown>;
const run = (inv: unknown, opts: ValidateOptions = sandbox) => validateInvoice(inv, opts).findings;

describe('validate: payload shape', () => {
  it('rejects non-object payloads', () => {
    const r = validateInvoice([], sandbox);
    expect(r.findings[0]).toMatchObject({ ruleId: 'F00', verdict: 'fail' });
    expect(r.summary.fail).toBe(1);
  });
  it('valid sandbox fixture has no errors', () => {
    const r = validateInvoice(valid(), sandbox);
    expect(r.summary.fail).toBe(0);
    expect(r.summary.warnings).toBe(0);
    expect(r.specVersion).toBe('1.12');
  });
});

describe('H01 invoiceType', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H01')).toEqual(['pass']));
  it('fail when missing', () => expect(verdicts(run({ ...valid(), invoiceType: '' }), 'H01')).toEqual(['fail']));
  it('fail on unknown value with code 0003, missing with 0011', () => {
    expect(errorsOf(run({ ...valid(), invoiceType: 'Credit Note' }), 'H01')[0]?.errorCode).toBe('0003');
    expect(errorsOf(run({ ...valid(), invoiceType: '' }), 'H01')[0]?.errorCode).toBe('0011');
  });
  it('cannot-verify on "Sales Invoice" (spec inconsistency)', () => {
    const f = byRule(run(fixture('invoices/sales-invoice-near-miss.json')), 'H01')[0];
    expect(f?.verdict).toBe('cannot-verify');
    expect(f?.reason).toMatch(/Sale Invoice/);
  });
});

describe('H02 invoiceDate', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H02')).toEqual(['pass']));
  it('fail on DD-MM-YYYY', () => expect(verdicts(run(fixture('invoices/bad-date.json')), 'H02')).toEqual(['fail']));
  it('fail on impossible date', () =>
    expect(verdicts(run({ ...valid(), invoiceDate: '2025-02-30' }), 'H02')).toEqual(['fail']));
  it('fail when missing', () => expect(verdicts(run({ ...valid(), invoiceDate: null }), 'H02')).toEqual(['fail']));
});

describe('H03 sellerNTNCNIC', () => {
  it('pass 7 digits', () => expect(verdicts(run(valid()), 'H03')).toEqual(['pass']));
  it('pass 13 digits', () =>
    expect(verdicts(run({ ...valid(), sellerNTNCNIC: '0000000000001' }), 'H03')).toEqual(['pass']));
  it('cannot-verify 9 digits', () =>
    expect(verdicts(run(fixture('invoices/nine-digit-ntn.json')), 'H03')).toEqual(['cannot-verify']));
  it('fail on other length', () =>
    expect(verdicts(run({ ...valid(), sellerNTNCNIC: '12345' }), 'H03')).toEqual(['fail']));
  it('fail on non-digits', () =>
    expect(verdicts(run({ ...valid(), sellerNTNCNIC: '00000-01' }), 'H03')).toEqual(['fail']));
  it('fail on JSON number', () => {
    const f = byRule(run({ ...valid(), sellerNTNCNIC: 1 }), 'H03')[0];
    expect(f?.verdict).toBe('fail');
    expect(f?.fix).toMatch(/leading zeros/);
  });
});

describe('H04 seller name/address', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H04')).toEqual(['pass', 'pass']));
  it('fail when name missing', () =>
    expect(errorsOf(run(fixture('invoices/missing-required-fields.json')), 'H04').map((f) => f.path)).toEqual([
      'sellerBusinessName',
    ]));
});

describe('H05 sellerProvince', () => {
  it('cannot-verify when present', () => expect(verdicts(run(valid()), 'H05')).toEqual(['cannot-verify']));
  it('fail when empty', () => expect(verdicts(run({ ...valid(), sellerProvince: ' ' }), 'H05')).toEqual(['fail']));
});

describe('H06 buyerRegistrationType', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H06')).toEqual(['pass']));
  it('fail on wrong casing', () =>
    expect(errorsOf(run({ ...valid(), buyerRegistrationType: 'registered' }), 'H06')).toHaveLength(1));
  it('misspelled key: H13 warns with the right name, H06 reports the field missing', () => {
    const f = run(fixture('invoices/misspelled-buyer-key.json'));
    const w = warningsOf(f, 'H13')[0];
    expect(w?.path).toBe('buyeRegistrationType');
    expect(w?.message).toMatch(/did you mean "buyerRegistrationType"/);
    expect(errorsOf(f, 'H06')[0]?.errorCode).toBe('0012');
  });
});

describe('H07 buyerNTNCNIC', () => {
  it('pass for registered buyer with 13 digits', () => expect(verdicts(run(valid()), 'H07')).toEqual(['pass']));
  it('pass when empty for unregistered buyer', () => {
    const f = byRule(run(fixture('invoices/valid-production.json'), production), 'H07')[0];
    expect(f?.verdict).toBe('pass');
    expect(f?.message).toMatch(/unregistered/);
  });
  it('fail when empty for registered buyer', () =>
    expect(verdicts(run({ ...valid(), buyerNTNCNIC: '' }), 'H07')).toEqual(['fail']));
  it('still checked when provided for unregistered buyer', () => {
    expect(verdicts(run({ ...valid(), buyerRegistrationType: 'Unregistered', buyerNTNCNIC: '12' }), 'H07')).toEqual([
      'fail',
    ]);
  });
});

describe('H08 buyer name/address/province', () => {
  it('pass + cannot-verify province', () =>
    expect(verdicts(run(valid()), 'H08')).toEqual(['pass', 'pass', 'cannot-verify']));
  it('fail when address missing', () =>
    expect(errorsOf(run(fixture('invoices/missing-required-fields.json')), 'H08').map((f) => f.path)).toEqual([
      'buyerAddress',
    ]));
});

describe('H09 self-invoicing', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H09')).toEqual(['pass']));
  it('fail when identical', () =>
    expect(verdicts(run(fixture('invoices/self-invoice.json')), 'H09')).toEqual(['fail']));
  it('not evaluated when buyer is empty', () =>
    expect(byRule(run({ ...valid(), buyerNTNCNIC: '' }), 'H09')).toHaveLength(0));
});

describe('H10 invoiceRefNo for debit notes', () => {
  it('pass with 22 chars', () =>
    expect(verdicts(run(fixture('invoices/debit-note-valid.json')), 'H10')).toEqual(['pass']));
  it('pass with 28 chars', () =>
    expect(verdicts(run({ ...valid(), invoiceType: 'Debit Note', invoiceRefNo: '1'.repeat(28) }), 'H10')).toEqual([
      'pass',
    ]));
  it('fail when missing', () =>
    expect(verdicts(run(fixture('invoices/debit-note-missing-ref.json')), 'H10')).toEqual(['fail']));
  it('fail on wrong length', () =>
    expect(verdicts(run({ ...valid(), invoiceType: 'Debit Note', invoiceRefNo: 'INV-1' }), 'H10')).toEqual(['fail']));
  it('not evaluated for sale invoices', () => expect(byRule(run(valid()), 'H10')).toHaveLength(0));
});

describe('H11 scenarioId', () => {
  it('pass in sandbox', () => expect(verdicts(run(valid()), 'H11')).toEqual(['pass']));
  it('fail in sandbox when missing', () =>
    expect(verdicts(run({ ...valid(), scenarioId: undefined }), 'H11')).toEqual(['fail']));
  it('fail in sandbox on SN029', () =>
    expect(verdicts(run({ ...valid(), scenarioId: 'SN029' }), 'H11')).toEqual(['fail']));
  it('pass in production when absent', () =>
    expect(verdicts(run(fixture('invoices/valid-production.json'), production), 'H11')).toEqual(['pass']));
  it('warning in production when present', () =>
    expect(warningsOf(run(fixture('invoices/prod-with-scenario.json'), production), 'H11')).toHaveLength(1));
});

describe('H12 items', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H12')).toEqual(['pass']));
  it('fail on empty array', () =>
    expect(verdicts(run(fixture('invoices/missing-items.json')), 'H12')).toEqual(['fail']));
  it('fail when not an array', () => expect(verdicts(run({ ...valid(), items: {} }), 'H12')).toEqual(['fail']));
});

describe('H13 unknown header keys', () => {
  it('pass', () => expect(verdicts(run(valid()), 'H13')).toEqual(['pass']));
  it('warns per unknown key with nearest match', () => {
    const w = warningsOf(run(fixture('invoices/unknown-keys.json')), 'H13');
    expect(w.map((x) => x.path).sort()).toEqual(['remarks', 'scenarioID']);
    expect(w.find((x) => x.path === 'scenarioID')?.message).toMatch(/"scenarioId"/);
    expect(w.find((x) => x.path === 'remarks')?.message).not.toMatch(/did you mean/);
  });
});

describe('H14 debit note vs original invoice', () => {
  it('cannot-verify for debit notes', () =>
    expect(verdicts(run(fixture('invoices/debit-note-valid.json')), 'H14')).toEqual(['cannot-verify']));
  it('not evaluated for sale invoices', () => expect(byRule(run(valid()), 'H14')).toHaveLength(0));
});

describe('H15 registration status', () => {
  it('cannot-verify for seller and registered buyer', () =>
    expect(byRule(run(valid()), 'H15').map((f) => f.path)).toEqual(['sellerNTNCNIC', 'buyerNTNCNIC']));
  it('only seller for unregistered buyer', () =>
    expect(byRule(run(fixture('invoices/valid-production.json'), production), 'H15').map((f) => f.path)).toEqual([
      'sellerNTNCNIC',
    ]));
});

describe('H16 scenario applicability', () => {
  it('not evaluated without activity and sector', () => expect(byRule(run(valid()), 'H16')).toHaveLength(0));
  it('pass when the scenario is in the §10 list', () =>
    expect(
      verdicts(run(valid(), { environment: 'sandbox', activity: 'Manufacturer', sector: 'Textile' }), 'H16'),
    ).toEqual(['pass']));
  it('fail when it is not', () => {
    const f = errorsOf(run(valid(), { environment: 'sandbox', activity: 'Manufacturer', sector: 'Steel' }), 'H16')[0];
    expect(f?.message).toMatch(/SN001 is not in the scenario list/);
    expect(f?.fix).toMatch(/SN003, SN004, SN011/);
  });
  it('warning for unknown activity', () =>
    expect(
      warningsOf(run(valid(), { environment: 'sandbox', activity: 'Farmer', sector: 'Steel' }), 'H16'),
    ).toHaveLength(1));
});
