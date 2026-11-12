import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

export const h08BuyerNameAddressProvince: Rule = {
  id: 'H08',
  title: 'buyerBusinessName, buyerAddress and buyerProvince are present',
  specRef: 'spec v1.12 §4.1.2, §5.1, §7 (0010)',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    const out = [];
    out.push(isNonEmptyString(invoice['buyerBusinessName']) ? f.pass('buyerBusinessName', 'buyerBusinessName is present.') : f.fail('buyerBusinessName', 'buyerBusinessName is missing or empty.', 'Provide the buyer business name.', { errorCode: '0010' }));
    out.push(isNonEmptyString(invoice['buyerAddress']) ? f.pass('buyerAddress', 'buyerAddress is present.') : f.fail('buyerAddress', 'buyerAddress is missing or empty.', 'Provide the buyer address.'));
    const prov = invoice['buyerProvince'];
    out.push(
      isNonEmptyString(prov)
        ? f.cannotVerify('buyerProvince', `Buyer province is "${prov}".`, 'Province names come from the FBR province reference API, which needs a token. Not checked offline.')
        : f.fail('buyerProvince', 'buyerProvince is missing or empty.', 'Provide the province name as listed by FBR.'),
    );
    return out;
  },
};
