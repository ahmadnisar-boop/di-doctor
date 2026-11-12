import type { Rule } from '../types.js';
import { findings } from '../helpers.js';

export const i09ReferenceData: Rule = {
  id: 'I09',
  title: 'hsCode ↔ saleType ↔ rate ↔ uoM ↔ SRO consistency (needs FBR reference APIs)',
  specRef: 'spec v1.12 §5.8, §5.9, §5.10, §7 (0052, 0099)',
  level: 'item',
  check({ index }) {
    const f = findings(this);
    return [
      f.cannotVerify(
        `items[${index}]`,
        'hsCode ↔ saleType ↔ rate ↔ uoM ↔ SRO consistency not checked.',
        'FBR rejects HS codes that do not fit the sale type (0052) and units that do not fit the HS code (0099). Those pairings come from reference APIs that need a token. Planned for a later version.',
      ),
    ];
  },
};
