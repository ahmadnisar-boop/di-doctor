import type { Rule } from '../types.js';
import { findings, isPresent, REQUIRED_ITEM_FIELDS } from '../helpers.js';

/** Per-field codes from spec v1.12 §7 where the spec ties an "empty" message to a field. */
const CODES: Partial<Record<(typeof REQUIRED_ITEM_FIELDS)[number], string>> = {
  saleType: '0013',
  hsCode: '0044',
  rate: '0046',
  salesTaxApplicable: '0018',
  valueSalesExcludingST: '0021',
  quantity: '0021',
  salesTaxWithheldAtSource: '0022',
  fixedNotifiedValueOrRetailPrice: '0090',
  uoM: '0099',
};

export const i01RequiredFields: Rule = {
  id: 'I01',
  title: 'All required item fields are present',
  specRef: 'spec v1.12 §4.1.2, §7',
  level: 'item',
  check({ item, index }) {
    const f = findings(this);
    const missing = REQUIRED_ITEM_FIELDS.filter((k) => !isPresent(item![k]));
    if (missing.length === 0) return [f.pass(`items[${index}]`, 'All required item fields are present.')];
    return missing.map((k) => f.fail(`items[${index}].${k}`, `${k} is missing or empty.`, `Provide ${k} on every item.`, { errorCode: CODES[k] }));
  },
};
