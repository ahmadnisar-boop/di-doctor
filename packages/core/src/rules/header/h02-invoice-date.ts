import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** spec v1.12 §4.1.2; §7 0005/0113 confirm YYYY-MM-DD despite their own message text mentioning other formats. */
export const h02InvoiceDate: Rule = {
  id: 'H02',
  title: 'invoiceDate is a real date in YYYY-MM-DD',
  specRef: 'spec v1.12 §4.1.2, §7 (0005, 0042, 0043)',
  level: 'header',
  errorCode: '0005',
  check({ invoice }) {
    const f = findings(this);
    const v = invoice['invoiceDate'];
    if (!isNonEmptyString(v))
      return [
        f.fail('invoiceDate', 'invoiceDate is missing or empty.', 'Provide the invoice date as YYYY-MM-DD.', {
          errorCode: '0042',
        }),
      ];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim()))
      return [
        f.fail(
          'invoiceDate',
          `invoiceDate "${v}" is not in YYYY-MM-DD format.`,
          'Use YYYY-MM-DD, for example 2025-05-25, with no time part.',
        ),
      ];
    if (!isRealDate(v.trim()))
      return [
        f.fail('invoiceDate', `invoiceDate "${v}" is not a real calendar date.`, 'Check the month and day values.', {
          errorCode: '0043',
        }),
      ];
    return [f.pass('invoiceDate', `invoiceDate "${v}" is well-formed.`)];
  },
};
