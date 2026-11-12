import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

export const h09SelfInvoicing: Rule = {
  id: 'H09',
  title: 'Seller and buyer are different parties',
  specRef: 'spec v1.12 §7 (0058)',
  level: 'header',
  errorCode: '0058',
  check({ invoice }) {
    const f = findings(this);
    const s = invoice['sellerNTNCNIC'];
    const b = invoice['buyerNTNCNIC'];
    if (!isNonEmptyString(s) || !isNonEmptyString(b)) return [];
    if (s.trim() === b.trim())
      return [
        f.fail(
          'buyerNTNCNIC',
          'Seller and buyer registration numbers are identical.',
          'FBR rejects self-invoicing. Use the real buyer number.',
        ),
      ];
    return [f.pass('buyerNTNCNIC', 'Seller and buyer are different parties.')];
  },
};
