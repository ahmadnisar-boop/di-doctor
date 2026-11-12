import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

export const h04SellerNameAddress: Rule = {
  id: 'H04',
  title: 'sellerBusinessName and sellerAddress are present',
  specRef: 'spec v1.12 §4.1.2',
  level: 'header',
  check({ invoice }) {
    const f = findings(this);
    return (['sellerBusinessName', 'sellerAddress'] as const).map((field) =>
      isNonEmptyString(invoice[field]) ? f.pass(field, `${field} is present.`) : f.fail(field, `${field} is missing or empty.`, `Provide a non-empty string for ${field}.`),
    );
  },
};
