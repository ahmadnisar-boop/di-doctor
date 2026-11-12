import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

export const h05SellerProvince: Rule = {
  id: 'H05',
  title: 'sellerProvince is present (value needs the province reference API)',
  specRef: 'spec v1.12 §4.1.2, §5.1',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['sellerProvince'];
    if (!isNonEmptyString(v)) return [f.fail('sellerProvince', 'sellerProvince is missing or empty.', 'Provide the province name as listed by FBR.')];
    return [f.cannotVerify('sellerProvince', `Seller province is "${v}".`, 'Province names come from the FBR province reference API, which needs a token. Not checked offline.')];
  },
};
