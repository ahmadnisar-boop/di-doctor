import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';
import { getSaleType } from '../sale-types.js';

/** §9 lists 28 sale types; the full transaction-type list comes from the reference API (§5.5), so unknown values are cannot-verify. */
export const i11SaleTypeKnown: Rule = {
  id: 'I11',
  title: 'saleType is one of the sale types listed in the spec',
  specRef: 'spec v1.12 §9, §5.5, §7 (0013)',
  level: 'item',
  check({ item, index }) {
    const v = item!['saleType'];
    if (!isNonEmptyString(v)) return [];
    const f = findings(this);
    const path = `items[${index}].saleType`;
    const st = getSaleType(v);
    if (st) {
      const note = st.saleType === v.trim() ? '' : ` (the spec table spells it "${st.saleType}")`;
      return [f.pass(path, `saleType "${v}" is listed in the spec${note}.`)];
    }
    return [f.cannotVerify(path, `saleType "${v}" is not one of the 28 sale types in spec §9.`, 'FBR\'s full transaction-type list comes from the reference API (§5.5) and may contain more values. If this is a typo, FBR will answer with error 0013.')];
  },
};
