import type { Rule } from '../types.js';
import { findings, checkRegistrationNumber } from '../helpers.js';

export const h03SellerId: Rule = {
  id: 'H03',
  title: 'sellerNTNCNIC is 7 (NTN) or 13 (CNIC) digits',
  specRef: 'spec v1.12 §4.1.2, §7 (0108, 0401)',
  level: 'header',
  errorCode: '0108',
  check({ invoice }) {
    return [checkRegistrationNumber(findings(this), 'sellerNTNCNIC', invoice['sellerNTNCNIC'], { missing: '0108', invalid: '0108' })];
  },
};
