import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

/** spec v1.12 §4.1.2: 22 digits for NTN-based, 28 for CNIC-based invoice numbers. */
export const h10DebitNoteRef: Rule = {
  id: 'H10',
  title: 'Debit Note carries the original invoice number in invoiceRefNo (22 or 28 characters)',
  specRef: 'spec v1.12 §4.1.2, §7 (0026)',
  level: 'header',
  errorCode: '0026',
  check({ invoice }) {
    if (invoice['invoiceType'] !== 'Debit Note') return [];
    const f = findings(this);
    const v = invoice['invoiceRefNo'];
    if (!isNonEmptyString(v)) return [f.fail('invoiceRefNo', 'invoiceRefNo is required for a Debit Note.', 'Put the FBR invoice number of the original invoice in invoiceRefNo.')];
    const len = v.trim().length;
    if (len === 22 || len === 28) return [f.pass('invoiceRefNo', `invoiceRefNo has ${len} characters.`)];
    return [f.fail('invoiceRefNo', `invoiceRefNo has ${len} characters; the spec says 22 (NTN-based) or 28 (CNIC-based).`, 'Use the full FBR-issued invoice number of the original invoice.')];
  },
};
