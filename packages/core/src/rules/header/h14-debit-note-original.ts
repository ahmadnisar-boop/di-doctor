import type { Rule } from '../types.js';
import { findings } from '../helpers.js';

/** Debit note rules that compare against the original invoice (§7 0029, 0034, 0035, 0057, 0067) cannot run offline. */
export const h14DebitNoteOriginal: Rule = {
  id: 'H14',
  title: 'Debit Note checks against the original invoice (date, 180-day window, amounts, existence)',
  specRef: 'spec v1.12 §7 (0029, 0034, 0035, 0057, 0067)',
  level: 'header',
  check({ invoice }) {
    if (invoice['invoiceType'] !== 'Debit Note') return [];
    const f = findings(this);
    return [
      f.cannotVerify(
        'invoiceRefNo',
        'Debit Note vs original invoice not checked.',
        'FBR checks that the referenced invoice exists, that the note date is on or after the original date and within 180 days, and that the sales tax does not exceed the original. That needs the original invoice, which DI Doctor does not have.',
      ),
    ];
  },
};
