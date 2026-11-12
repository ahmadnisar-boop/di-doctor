import type { Rule } from '../types.js';
import { findings, checkRegistrationNumber, isPresent } from '../helpers.js';

/** Required unless the buyer is Unregistered (spec v1.12 §4.1.2). */
export const h07BuyerId: Rule = {
  id: 'H07',
  title: 'buyerNTNCNIC is 7 or 13 digits (optional for unregistered buyers)',
  specRef: 'spec v1.12 §4.1.2, §7 (0002, 0009, 0402)',
  level: 'header',
  errorCode: '0002',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['buyerNTNCNIC'];
    if (invoice['buyerRegistrationType'] === 'Unregistered' && !isPresent(v)) {
      return [f.pass('buyerNTNCNIC', 'buyerNTNCNIC is empty, which is allowed for an unregistered buyer.')];
    }
    return [checkRegistrationNumber(f, 'buyerNTNCNIC', v, { missing: '0009', invalid: '0002' })];
  },
};
