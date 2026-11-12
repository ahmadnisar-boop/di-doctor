import type { Finding } from '../types.js';
import type { Rule } from './types.js';

export interface FailOptions {
  severity?: 'error' | 'warning' | undefined;
  errorCode?: string | undefined;
  specRef?: string | undefined;
}

/** Finding builders bound to one rule, so each rule file stays short. */
export function findings(rule: Pick<Rule, 'id' | 'title' | 'specRef' | 'errorCode'>) {
  const base = { ruleId: rule.id, title: rule.title };
  return {
    pass: (path: string, message: string, specRef = rule.specRef): Finding => ({ ...base, verdict: 'pass', path, message, specRef }),
    fail: (path: string, message: string, fix: string, o: FailOptions = {}): Finding => {
      const f: Finding = { ...base, verdict: 'fail', severity: o.severity ?? 'error', path, message, fix, specRef: o.specRef ?? rule.specRef };
      const code = o.errorCode ?? rule.errorCode;
      if (code && f.severity === 'error') f.errorCode = code;
      return f;
    },
    cannotVerify: (path: string, message: string, reason: string, specRef = rule.specRef): Finding => ({ ...base, verdict: 'cannot-verify', path, message, reason, specRef }),
  };
}

export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export const isPresent = (v: unknown): boolean => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function describeValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === '') return 'an empty string';
  if (typeof v === 'string') return `the string "${v}"`;
  if (typeof v === 'number') return 'not a finite number';
  return `of type ${typeof v}`;
}

/** Levenshtein distance, used to suggest the nearest known field name. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** Nearest known key: exact-ignoring-case first, then edit distance ≤ 2. */
export function nearestKey(key: string, known: readonly string[]): string | undefined {
  const ci = known.find((k) => k.toLowerCase() === key.toLowerCase());
  if (ci) return ci;
  let best: { k: string; d: number } | undefined;
  for (const k of known) {
    const d = editDistance(key.toLowerCase(), k.toLowerCase());
    if (d <= 2 && (!best || d < best.d)) best = { k, d };
  }
  return best?.k;
}

/**
 * Shared NTN/CNIC check. Spec v1.12 §4.1.2 samples say "7 or 13 digit"; §7 0401/0402 say 13-digit CNIC or 7-digit NTN;
 * §7 0002 also mentions a 9-digit NTN, which contradicts the others → cannot-verify, never guess.
 */
export function checkRegistrationNumber(
  f: ReturnType<typeof findings>,
  path: string,
  value: unknown,
  codes: { missing?: string; invalid?: string },
): Finding {
  if (typeof value === 'number') {
    return f.fail(path, `${path} is a JSON number; FBR expects a string.`, 'Send the NTN/CNIC as a string of digits so leading zeros are kept.', { errorCode: codes.invalid });
  }
  if (!isNonEmptyString(value)) {
    return f.fail(path, `${path} is missing or empty.`, 'Provide the 7-digit NTN or 13-digit CNIC as a string.', { errorCode: codes.missing });
  }
  const v = value.trim();
  if (!/^\d+$/.test(v)) {
    return f.fail(path, `${path} contains characters other than digits.`, 'Remove dashes, spaces and letters; send digits only.', { errorCode: codes.invalid });
  }
  if (v.length === 7 || v.length === 13) return f.pass(path, `${path} is ${v.length} digits (NTN or CNIC).`);
  if (v.length === 9) {
    return f.cannotVerify(path, `${path} is 9 digits.`, 'Spec v1.12 is inconsistent: error 0002 mentions a 9-digit NTN, while 0401/0402 and the samples only allow 7 or 13 digits. See docs/spec-traps.md.');
  }
  return f.fail(path, `${path} is ${v.length} digits; expected 7 (NTN) or 13 (CNIC).`, 'Check the registration number length.', { errorCode: codes.invalid });
}

/** Header keys exactly as spelled in the spec v1.12 §4.1.1 JSON samples. */
export const HEADER_KEYS = [
  'invoiceType',
  'invoiceDate',
  'sellerNTNCNIC',
  'sellerBusinessName',
  'sellerProvince',
  'sellerAddress',
  'buyerNTNCNIC',
  'buyerBusinessName',
  'buyerProvince',
  'buyerAddress',
  'buyerRegistrationType',
  'invoiceRefNo',
  'scenarioId',
  'items',
] as const;

/** Item keys exactly as spelled in the spec v1.12 §4.1.1 JSON samples. */
export const ITEM_KEYS = [
  'hsCode',
  'productDescription',
  'rate',
  'uoM',
  'quantity',
  'totalValues',
  'valueSalesExcludingST',
  'fixedNotifiedValueOrRetailPrice',
  'salesTaxApplicable',
  'salesTaxWithheldAtSource',
  'extraTax',
  'furtherTax',
  'sroScheduleNo',
  'fedPayable',
  'discount',
  'saleType',
  'sroItemSerialNo',
] as const;

/** Required item fields per spec v1.12 §4.1.2 item table. */
export const REQUIRED_ITEM_FIELDS = [
  'hsCode',
  'productDescription',
  'rate',
  'uoM',
  'quantity',
  'totalValues',
  'valueSalesExcludingST',
  'fixedNotifiedValueOrRetailPrice',
  'salesTaxApplicable',
  'salesTaxWithheldAtSource',
  'saleType',
] as const;

/** Fields typed "Number (Decimal)" in spec v1.12 §4.1.2. */
export const DECIMAL_FIELDS = {
  required: ['quantity', 'totalValues', 'valueSalesExcludingST', 'fixedNotifiedValueOrRetailPrice', 'salesTaxApplicable', 'salesTaxWithheldAtSource'],
  optional: ['extraTax', 'furtherTax', 'fedPayable', 'discount'],
} as const;

export const INVOICE_TYPES = ['Sale Invoice', 'Debit Note'] as const;
export const REGISTRATION_TYPES = ['Registered', 'Unregistered'] as const;
export const SCENARIO_ID = /^SN0(0[1-9]|1\d|2[0-8])$/; // SN001–SN028, spec v1.12 §9
export const DEFAULT_TAX_TOLERANCE = 1.0;
