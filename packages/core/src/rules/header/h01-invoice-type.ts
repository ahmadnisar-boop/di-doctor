import type { Rule } from '../types.js';
import { findings, isNonEmptyString, INVOICE_TYPES } from '../helpers.js';

/** spec v1.12 §4.1.2: field table says "Sales Invoice"; every sample and the document-type list (§5.2) say "Sale Invoice". */
export const h01InvoiceType: Rule = {
  id: 'H01',
  title: 'invoiceType is "Sale Invoice" or "Debit Note"',
  specRef: 'spec v1.12 §4.1.2, §5.2, §7 (0003, 0011)',
  level: 'header',
  errorCode: '0003',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['invoiceType'];
    if (!isNonEmptyString(v)) return [f.fail('invoiceType', 'invoiceType is missing or empty.', 'Set invoiceType to "Sale Invoice" or "Debit Note".', { errorCode: '0011' })];
    if ((INVOICE_TYPES as readonly string[]).includes(v)) return [f.pass('invoiceType', `invoiceType is "${v}".`)];
    if (v === 'Sales Invoice') {
      return [f.cannotVerify('invoiceType', 'invoiceType is "Sales Invoice".', 'The spec field table lists "Sales Invoice" but every sample and the document-type reference list use "Sale Invoice". We recommend "Sale Invoice". See docs/spec-traps.md.')];
    }
    return [f.fail('invoiceType', `invoiceType "${v}" is not recognised.`, 'Use exactly "Sale Invoice" or "Debit Note" (case-sensitive).')];
  },
};
