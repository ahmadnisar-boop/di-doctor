import type { Rule } from '../types.js';
import { findings, isNonEmptyString, REGISTRATION_TYPES } from '../helpers.js';

export const h06BuyerRegistrationType: Rule = {
  id: 'H06',
  title: 'buyerRegistrationType is "Registered" or "Unregistered"',
  specRef: 'spec v1.12 §4.1.2, §7 (0012, 0053)',
  level: 'header',
  errorCode: '0053',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['buyerRegistrationType'];
    if (!isNonEmptyString(v))
      return [
        f.fail(
          'buyerRegistrationType',
          'buyerRegistrationType is missing or empty.',
          'Set it to "Registered" or "Unregistered".',
          { errorCode: '0012' },
        ),
      ];
    if ((REGISTRATION_TYPES as readonly string[]).includes(v))
      return [f.pass('buyerRegistrationType', `buyerRegistrationType is "${v}".`)];
    return [
      f.fail(
        'buyerRegistrationType',
        `buyerRegistrationType "${v}" is not recognised.`,
        'Use exactly "Registered" or "Unregistered" (case-sensitive).',
      ),
    ];
  },
};
