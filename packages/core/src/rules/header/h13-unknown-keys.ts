import type { Rule } from '../types.js';
import { findings, nearestKey, HEADER_KEYS } from '../helpers.js';

/** Field names are case-sensitive; the spec's own table misspells buyerRegistrationType, so typos are common. */
export const h13UnknownHeaderKeys: Rule = {
  id: 'H13',
  title: 'No unknown or misspelled header fields',
  specRef: 'spec v1.12 §4.1.1, §4.1.2',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    const known = HEADER_KEYS as readonly string[];
    const unknown = Object.keys(invoice).filter((k) => !known.includes(k));
    if (unknown.length === 0) return [f.pass('$', 'All header fields are known.')];
    return unknown.map((k) => {
      const near = nearestKey(k, known);
      const typoNote =
        k === 'buyeRegistrationType'
          ? ' This is the typo from the spec field table; the samples use the correct spelling.'
          : '';
      return f.fail(
        k,
        near ? `"${k}" is not a DI field; did you mean "${near}"?${typoNote}` : `"${k}" is not a DI field.`,
        near
          ? `Rename "${k}" to "${near}". Field names are case-sensitive.`
          : 'Remove the field or check its spelling against the spec sample.',
        { severity: 'warning' },
      );
    });
  },
};
