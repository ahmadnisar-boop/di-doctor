/**
 * Safe reading of DI API responses.
 * Shapes covered: spec v1.12 §4.1.3 (valid post), §4.1.4 (invalid, header-level, invoiceStatuses null),
 * §4.1.5 (misleading: header statusCode "00" + status "invalid" + item error), §4.2.3/§4.2.4 (validate endpoint).
 * HTTP codes: §4.1.6.
 */
import type { CheckResponseOptions, ResponseCheck, ResponseItemStatus, ResponseProblem } from '../types.js';
import { SPEC_VERSION } from '../spec.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);

/** Normalises "Valid" / "invalid" / "VALID" to a three-way status. Spec samples mix casing (§4.1.3 vs §4.1.5). */
function normStatus(v: unknown): 'valid' | 'invalid' | 'unknown' {
  const s = str(v)?.trim().toLowerCase();
  if (s === 'valid') return 'valid';
  if (s === 'invalid') return 'invalid';
  return 'unknown';
}

export function checkResponse(input: unknown, opts: CheckResponseOptions = {}): ResponseCheck {
  const result: ResponseCheck = {
    overall: 'unknown',
    kind: 'unknown',
    items: [],
    problems: [],
    warnings: [],
    specVersion: SPEC_VERSION,
  };

  // HTTP layer first (spec v1.12 §4.1.6). A non-200 status is reported even if a body is present.
  const http = opts.httpStatus;
  let httpBlocks = false;
  if (http !== undefined && http !== 200) {
    httpBlocks = true;
    if (http === 401) {
      result.problems.push({
        where: 'http',
        message:
          'HTTP 401 Unauthorized: the request was rejected before the invoice was processed. Check the Bearer token, that it matches the environment (sandbox vs production) and the seller NTN/CNIC.',
      });
    } else if (http === 500) {
      result.problems.push({
        where: 'http',
        message: 'HTTP 500: FBR server-side error. The invoice was probably not processed. Retry later with the same payload; contact PRAL if it persists.',
      });
    } else {
      result.problems.push({ where: 'http', message: `HTTP ${http}: not a status the spec describes (200, 401, 500). Treat the invoice as not submitted.` });
    }
  }

  // Locate the validationResponse object.
  let vr: Obj | undefined;
  if (isObj(input) && isObj(input['validationResponse'])) {
    vr = input['validationResponse'];
    result.kind = typeof input['invoiceNumber'] === 'string' ? 'post' : 'validate';
  } else if (isObj(input) && ('statusCode' in input || 'status' in input) && 'invoiceStatuses' in input) {
    // Caller passed the inner object only.
    vr = input;
    result.kind = 'validate';
    result.warnings.push('Input looks like the inner validationResponse object, not the full response. Pass the whole response body to detect the FBR invoice number.');
  }

  if (!vr) {
    if (!httpBlocks) {
      result.problems.push({ where: 'body', message: 'Unrecognised response shape: no validationResponse object found. Not guessing; check you passed the raw DI API response body.' });
    }
    result.overall = http === 401 ? 'invalid' : 'unknown';
    return result;
  }

  // Header level.
  const headerStatus = normStatus(vr['status']);
  const headerCode = str(vr['statusCode'])?.trim();
  let headerValid: boolean | undefined = headerStatus === 'valid' ? true : headerStatus === 'invalid' ? false : undefined;
  if (headerValid === undefined && headerCode !== undefined) {
    headerValid = headerCode === '00' ? true : headerCode === '01' ? false : undefined;
    if (headerValid !== undefined) result.warnings.push('No readable top-level status; fell back to statusCode. Treat with care.');
  }

  // Item level. invoiceStatuses may be null for header-level rejections (spec v1.12 §4.1.4).
  const rawItems = vr['invoiceStatuses'];
  const items: ResponseItemStatus[] = Array.isArray(rawItems)
    ? rawItems.map((it, i) => {
        const o = isObj(it) ? it : {};
        const entry: ResponseItemStatus = { itemSNo: str(o['itemSNo']) ?? String(i + 1), status: normStatus(o['status']) };
        const invoiceNo = str(o['invoiceNo']);
        const errorCode = str(o['errorCode']);
        const error = str(o['error']);
        if (invoiceNo) entry.invoiceNo = invoiceNo;
        if (errorCode) entry.errorCode = errorCode;
        if (error) entry.error = error;
        return entry;
      })
    : [];
  result.items = items;

  const failedItems = items.filter((it) => it.status !== 'valid');
  const problems: ResponseProblem[] = [];

  if (headerValid === false && failedItems.length === 0) {
    const p: ResponseProblem = { where: 'header', message: str(vr['error'])?.trim() || 'Rejected at header level without an error message.' };
    const code = str(vr['errorCode'])?.trim();
    if (code) p.errorCode = code;
    problems.push(p);
  }
  for (const it of failedItems) {
    const idx = items.indexOf(it);
    const p: ResponseProblem = {
      where: `items[${idx}]`,
      message: it.status === 'unknown' ? `Item ${it.itemSNo}: status is missing or unreadable.` : it.error || `Item ${it.itemSNo} rejected without an error message.`,
    };
    if (it.errorCode) p.errorCode = it.errorCode;
    problems.push(p);
  }
  result.problems.push(...problems);

  // Warnings about the traps.
  if (headerCode === '00' && headerValid === false) {
    result.warnings.push('Top-level statusCode is "00" but status is "invalid". Never decide on statusCode alone (spec v1.12 §4.1.5 sample).');
  }
  if (headerValid === true && failedItems.length > 0) {
    result.warnings.push(`Top-level status says valid but ${failedItems.length} item(s) failed. The invoice is NOT accepted.`);
  }
  if (headerValid === true && !Array.isArray(rawItems)) {
    result.warnings.push('Top-level status is valid but invoiceStatuses is missing or null, so item-level results could not be confirmed.');
  }
  if (headerValid === undefined) {
    result.warnings.push('Could not read the top-level status or statusCode.');
  }

  // Overall verdict: valid only when header AND every item are valid AND HTTP did not block.
  const allItemsValid = items.length > 0 && failedItems.length === 0;
  if (httpBlocks) {
    result.overall = http === 401 ? 'invalid' : 'unknown';
  } else if (headerValid === true && (allItemsValid || !Array.isArray(rawItems))) {
    result.overall = 'valid';
  } else if (headerValid === false || failedItems.some((it) => it.status === 'invalid')) {
    result.overall = 'invalid';
  } else {
    result.overall = 'unknown';
  }

  if (result.overall === 'valid' && result.kind === 'post' && isObj(input)) {
    const n = str(input['invoiceNumber']);
    if (n) result.fbrInvoiceNumber = n;
  }
  return result;
}
