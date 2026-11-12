import type { Rule } from '../types.js';
import { findings, isNum } from '../helpers.js';

export const i05WithheldAtSource: Rule = {
  id: 'I05',
  title: 'salesTaxWithheldAtSource is 0 or equal to salesTaxApplicable',
  specRef: 'spec v1.12 §7 (0008, 0050)',
  level: 'item',
  errorCode: '0008',
  check({ item, index }) {
    const w = item!['salesTaxWithheldAtSource'];
    const tax = item!['salesTaxApplicable'];
    if (!isNum(w) || !isNum(tax)) return [];
    const f = findings(this);
    const path = `items[${index}].salesTaxWithheldAtSource`;
    if (w === 0 || Math.abs(w - tax) < 0.005)
      return [f.pass(path, 'salesTaxWithheldAtSource is 0 or equals salesTaxApplicable.')];
    return [
      f.fail(
        path,
        `salesTaxWithheldAtSource ${w.toFixed(2)} is neither 0 nor equal to salesTaxApplicable ${tax.toFixed(2)}.`,
        'Set it to 0 or to exactly the sales tax amount.',
      ),
    ];
  },
};
