import type { Rule } from '../types.js';
import { findings, isNum } from '../helpers.js';
import { parseSimpleRate } from '../../validate/rate.js';

/** Brief message of §7 0079 fills in the placeholders as 20,000 and 5%. */
export const i06FivePercentLimit: Rule = {
  id: 'I06',
  title: '5% rate is not used when valueSalesExcludingST is above 20,000',
  specRef: 'spec v1.12 §7 (0079)',
  level: 'item',
  errorCode: '0079',
  check({ item, index }) {
    const pct = parseSimpleRate(item!['rate']);
    const value = item!['valueSalesExcludingST'];
    if (pct === null || !isNum(value)) return [];
    const f = findings(this);
    const path = `items[${index}].rate`;
    if (pct === 5 && value > 20000) {
      return [f.fail(path, `rate is 5% but valueSalesExcludingST ${value.toFixed(2)} is above 20,000.`, 'FBR does not accept 5% above that value. Which rate applies instead is a tax question; check with your tax adviser.')];
    }
    return [f.pass(path, '5%-above-20,000 rule does not apply.')];
  },
};
