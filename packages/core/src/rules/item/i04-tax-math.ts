import type { Rule } from '../types.js';
import { findings, isPresent, isNum, DEFAULT_TAX_TOLERANCE } from '../helpers.js';
import { parseSimpleRate, round2 } from '../../validate/rate.js';
import { getSaleType } from '../sale-types.js';

/**
 * salesTaxApplicable ≈ valueSalesExcludingST × rate (spec v1.12 §7 0104), but only where that base is the documented one:
 * sale types with taxBase "simple-percent", no discount (the spec does not say whether the rate applies before or after
 * discount), no fixed/retail price (Third Schedule uses it as the base, §7 0102), and a plain "N%" rate (§5.8 lists compound rates).
 */
export const i04TaxMath: Rule = {
  id: 'I04',
  title: 'salesTaxApplicable matches valueSalesExcludingST × rate (simple-percentage sale types only)',
  specRef: 'spec v1.12 §7 (0104, 0102, 0103, 0105), §5.8',
  level: 'item',
  errorCode: '0104',
  check({ item, index, options }) {
    const f = findings(this);
    const p = (k: string) => `items[${index}].${k}`;
    const rate = item!['rate'];
    const value = item!['valueSalesExcludingST'];
    const tax = item!['salesTaxApplicable'];
    if (!isPresent(rate) || !isNum(value) || !isNum(tax)) return []; // I01 / I02 report those

    const pct = parseSimpleRate(rate);
    if (pct === null) {
      return [f.cannotVerify(p('rate'), `rate "${String(rate)}" is not a simple percentage.`, 'Compound or named rates (for example "18% along with rupees 60 per kilogram", or "Exempt") cannot be recomputed offline.')];
    }
    const st = getSaleType(item!['saleType']);
    if (st && st.taxBase !== 'simple-percent') {
      const why =
        st.taxBase === 'retail-price'
          ? 'FBR computes tax for this sale type from the retail price with the Third Schedule formula (error 0102), which the spec does not give.'
          : st.taxBase === 'quantity'
            ? 'FBR computes tax for this sale type from quantity (error 0103/0105); the formula is not in the spec.'
            : 'The spec does not say what base FBR uses to recompute tax for this sale type.';
      return [f.cannotVerify(p('salesTaxApplicable'), `Tax math not checked for sale type "${st.saleType}".`, why)];
    }
    if (!st) {
      return [f.cannotVerify(p('salesTaxApplicable'), 'Tax math not checked: sale type is not in the §9 list.', 'DI Doctor only knows the tax base for the sale types listed in spec §9.')];
    }
    const discount = item!['discount'];
    if (isNum(discount) && discount !== 0) {
      return [f.cannotVerify(p('salesTaxApplicable'), 'Tax math not checked because discount is non-zero.', 'The spec does not say whether the rate applies before or after discount.')];
    }
    const fixed = item!['fixedNotifiedValueOrRetailPrice'];
    if (isNum(fixed) && fixed !== 0) {
      return [f.cannotVerify(p('salesTaxApplicable'), 'Tax math not checked because fixedNotifiedValueOrRetailPrice is non-zero.', 'A notified or retail price usually changes the tax base (Third Schedule, error 0102); the spec does not give the formula.')];
    }
    const tol = options.taxTolerance ?? DEFAULT_TAX_TOLERANCE;
    const expected = round2((value * pct) / 100);
    const diff = Math.abs(tax - expected);
    if (diff <= tol) return [f.pass(p('salesTaxApplicable'), `salesTaxApplicable ${tax.toFixed(2)} matches ${pct}% of ${value.toFixed(2)} (±${tol.toFixed(2)}).`)];
    return [
      f.fail(
        p('salesTaxApplicable'),
        `salesTaxApplicable ${tax.toFixed(2)} does not match ${pct}% of ${value.toFixed(2)} (expected ${expected.toFixed(2)}, difference ${diff.toFixed(2)}).`,
        'Recalculate sales tax per line as valueSalesExcludingST × rate, rounded to 2 decimals.',
      ),
    ];
  },
};
