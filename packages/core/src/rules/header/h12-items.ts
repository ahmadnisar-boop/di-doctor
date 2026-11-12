import type { Rule } from '../types.js';
import { findings } from '../helpers.js';

export const h12Items: Rule = {
  id: 'H12',
  title: 'items is a non-empty array',
  specRef: 'spec v1.12 §4.1.1',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['items'];
    if (Array.isArray(v) && v.length > 0) return [f.pass('items', `${v.length} item(s) present.`)];
    return [f.fail('items', 'items must be a non-empty array.', 'Add at least one line item.')];
  },
};
