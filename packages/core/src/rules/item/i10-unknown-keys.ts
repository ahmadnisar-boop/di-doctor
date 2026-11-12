import type { Rule } from '../types.js';
import { findings, nearestKey, ITEM_KEYS } from '../helpers.js';

export const i10UnknownItemKeys: Rule = {
  id: 'I10',
  title: 'No unknown or misspelled item fields',
  specRef: 'spec v1.12 §4.1.1, §4.1.2',
  level: 'item',
  check({ item, index }) {
    const f = findings(this);
    const known = ITEM_KEYS as readonly string[];
    const unknown = Object.keys(item!).filter((k) => !known.includes(k));
    if (unknown.length === 0) return [f.pass(`items[${index}]`, 'All item fields are known.')];
    return unknown.map((k) => {
      const near = nearestKey(k, known);
      return f.fail(
        `items[${index}].${k}`,
        near ? `"${k}" is not a DI item field; did you mean "${near}"?` : `"${k}" is not a DI item field.`,
        near ? `Rename "${k}" to "${near}". Field names are case-sensitive (note "uoM", "hsCode").` : 'Remove the field or check its spelling against the spec sample.',
        { severity: 'warning' },
      );
    });
  },
};
