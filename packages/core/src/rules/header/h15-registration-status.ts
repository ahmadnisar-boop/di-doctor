import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

/** Registration status comes from the STATL / Get_Reg_Type reference APIs (§5.11, §5.12). */
export const h15RegistrationStatus: Rule = {
  id: 'H15',
  title: 'Seller and buyer sales-tax registration status (needs STATL reference API)',
  specRef: 'spec v1.12 §5.11, §5.12, §7 (0001, 0082, 0083, 0106, 0107)',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    const out = [];
    if (isNonEmptyString(invoice['sellerNTNCNIC'])) {
      out.push(
        f.cannotVerify(
          'sellerNTNCNIC',
          'Seller registration status not checked.',
          'FBR rejects sellers that are not active for sales tax (0001/0082) or whose number does not match the token (0083). Needs the STATL reference API.',
        ),
      );
    }
    if (isNonEmptyString(invoice['buyerNTNCNIC']) && invoice['buyerRegistrationType'] === 'Registered') {
      out.push(
        f.cannotVerify(
          'buyerNTNCNIC',
          'Buyer registration status not checked.',
          'FBR checks that a "Registered" buyer is actually active for sales tax (0106/0107). Needs the STATL / Get_Reg_Type reference API.',
        ),
      );
    }
    return out;
  },
};
