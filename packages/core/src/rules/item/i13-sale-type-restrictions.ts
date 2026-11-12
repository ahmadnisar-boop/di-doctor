import type { Rule } from '../types.js';
import { findings } from '../helpers.js';
import { getSaleType } from '../sale-types.js';

/** Sale-type-specific rules the spec mentions by error code but does not define precisely. */
export const i13SaleTypeRestrictions: Rule = {
  id: 'I13',
  title:
    'Sale-type-specific FBR restrictions (steel, cotton ginners, electricity units, petroleum levy, FED, Third Schedule, potassium chlorate)',
  specRef: 'spec v1.12 §7 (0050, 0056, 0077, 0087, 0089, 0096, 0098, 0100, 0101, 0102, 0103)',
  level: 'item',
  check({ item, index }) {
    const st = getSaleType(item!['saleType']);
    if (!st || st.restrictions.length === 0) return [];
    const f = findings(this);
    const list = st.restrictions.map((r) => `${r.code}: ${r.note}`).join(' ');
    return [
      f.cannotVerify(
        `items[${index}].saleType`,
        `FBR applies extra checks to "${st.saleType}".`,
        `${list} DI Doctor cannot verify these offline.`,
      ),
    ];
  },
};
