import type { Rule } from '../types.js';
import { findings, isNum } from '../helpers.js';

/** totalValues is "Total Sales Value (Including Tax)" but the spec gives no formula and its own sample sends 0.00. */
export const i12TotalValues: Rule = {
  id: 'I12',
  title: 'totalValues consistency (no formula in the spec)',
  specRef: 'spec v1.12 §4.1.2, §7 (0085)',
  level: 'item',
  check({ item, index }) {
    if (!isNum(item!['totalValues'])) return [];
    const f = findings(this);
    return [f.cannotVerify(`items[${index}].totalValues`, 'totalValues not checked.', 'The spec describes it as the total including tax but gives no formula, and its own sample sends 0.00 next to a 1000.00 value. Copy what FBR accepted for you in sandbox.')];
  },
};
