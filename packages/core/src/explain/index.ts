/** Plain-English explanations of DI error codes (spec v1.12 §7). Text lives in data/errors.json, in our own words. */
import type { ErrorExplanation } from '../types.js';
import { SPEC_URL, ref } from '../spec.js';
import { checkResponse } from '../response/check-response.js';
import errors from '../data/errors.json' with { type: 'json' };

type Entry = Omit<ErrorExplanation, 'code' | 'known'>;
const table = errors as unknown as Record<string, Entry | string>;

export const KNOWN_ERROR_CODES: string[] = Object.keys(table)
  .filter((k) => !k.startsWith('_'))
  .sort();

/** Every known code with its one-line title, for `di-doctor codes`. */
export function listErrorCodes(): { code: string; title: string; side: 'sale' | 'purchase' }[] {
  return KNOWN_ERROR_CODES.map((code) => {
    const e = table[code] as Entry;
    return { code, title: e.title, side: e.side === 'purchase' ? 'purchase' : 'sale' };
  });
}

/** Accepts "0052", "52", " 0052 " and normalises to the 4-digit form FBR uses. */
export function normaliseCode(code: string): string {
  const t = code.trim();
  return /^\d{1,4}$/.test(t) ? t.padStart(4, '0') : t;
}

export function explainCode(code: string): ErrorExplanation {
  const c = normaliseCode(code);
  const entry = table[c];
  if (entry && typeof entry === 'object') return { code: c, known: true, ...entry };
  return {
    code: c,
    known: false,
    title: "Error code not in DI Doctor's list",
    meaning: `DI Doctor has no explanation for code ${c} yet. The official list of sales error codes is in spec v1.12 §7 and purchase codes in §8.`,
    commonCauses: [
      'The code may be newer than the document version DI Doctor follows',
      'Live responses sometimes use codes or wording not in the document',
    ],
    fieldsToCheck: [],
    fix: `Read the "error" text in the FBR response alongside the code, then look it up in the official document: ${SPEC_URL}`,
    specRef: ref('7, §8'),
    side: 'unknown',
  };
}

/** Explains every error code found in a full DI API response. Codes without a code value get no entry. */
export function explainResponse(response: unknown): ErrorExplanation[] {
  const check = checkResponse(response);
  const codes = [...new Set(check.problems.map((p) => p.errorCode).filter((c): c is string => !!c))];
  return codes.map(explainCode);
}
