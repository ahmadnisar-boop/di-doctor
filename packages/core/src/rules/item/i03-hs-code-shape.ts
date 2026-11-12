import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

/** The format is only shown by example ("0101.2100") in §4.1.2 and §5.3, so this is a warning. */
export const i03HsCodeShape: Rule = {
  id: 'I03',
  title: 'hsCode looks like NNNN.NNNN',
  specRef: 'spec v1.12 §4.1.2, §5.3',
  level: 'item',
  check({ item, index }) {
    const v = item!['hsCode'];
    if (!isNonEmptyString(v)) return [];
    const f = findings(this);
    const path = `items[${index}].hsCode`;
    if (/^\d{4}\.\d{4}$/.test(v.trim())) return [f.pass(path, 'hsCode looks like NNNN.NNNN.')];
    return [f.fail(path, `hsCode "${v}" does not look like the NNNN.NNNN form used in the spec samples.`, "Check the code against FBR's item list. The format is only shown by example, so this is a warning.", { severity: 'warning' })];
  },
};
