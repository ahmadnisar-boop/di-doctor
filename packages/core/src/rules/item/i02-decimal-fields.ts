import type { Rule } from '../types.js';
import { findings, isPresent, isNum, describeValue, DECIMAL_FIELDS } from '../helpers.js';

export const i02DecimalFields: Rule = {
  id: 'I02',
  title: 'Amount fields are JSON numbers',
  specRef: 'spec v1.12 §4.1.2, §7 (0300)',
  level: 'item',
  errorCode: '0300',
  check({ item, index }) {
    const f = findings(this);
    const p = (k: string) => `items[${index}].${k}`;
    const out = [];
    for (const k of DECIMAL_FIELDS.required) {
      const v = item![k];
      if (!isPresent(v)) continue; // reported by I01
      if (!isNum(v))
        out.push(
          f.fail(
            p(k),
            `${k} is ${describeValue(v)}; FBR expects a decimal number.`,
            'Send a JSON number, not a string or null.',
          ),
        );
    }
    for (const k of DECIMAL_FIELDS.optional) {
      if (!(k in item!)) continue;
      const v = item![k];
      if (v === null || v === '')
        out.push(
          f.fail(
            p(k),
            `${k} is ${describeValue(v)}.`,
            `Send 0 instead of ${describeValue(v)} for optional amounts that do not apply.`,
            { severity: 'warning' },
          ),
        );
      else if (!isNum(v))
        out.push(f.fail(p(k), `${k} is ${describeValue(v)}; FBR expects a decimal number.`, 'Send a JSON number.'));
    }
    return out.length ? out : [f.pass(`items[${index}]`, 'All amount fields are numbers.')];
  },
};
