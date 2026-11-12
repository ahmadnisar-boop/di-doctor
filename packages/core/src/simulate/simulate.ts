/**
 * Local sandbox simulator. Runs the same rules as `validateInvoice` and shapes the outcome like the DI API would
 * (spec v1.12 §4.1.3 valid, §4.1.4 header-level rejection, §4.1.5 item-level rejection, §4.2.3/§4.2.4 validate endpoint).
 *
 * Fidelity: only rules the spec documents are enforced. Checks that need FBR reference data pass through as
 * diagnostics. Passing the simulator does not guarantee FBR acceptance. Pure: the clock is injected via `now`.
 */
import type { Environment, Finding } from '../types.js';
import { SPEC_VERSION } from '../spec.js';
import { runRules } from '../rules/registry.js';

export interface SimulateOptions {
  environment: Environment;
  /** Which DI endpoint to imitate. `post` issues invoice numbers; `validate` does not. Default `post`. */
  endpoint?: 'post' | 'validate';
  /** Clock in ms since epoch (inject Date.now() from the caller; kept out of core so the function stays pure). */
  now: number;
  /** Omit the `_simulator` metadata so the body is byte-for-byte FBR-shaped. */
  strictShape?: boolean;
  taxTolerance?: number;
  activity?: string;
  sector?: string;
}

export interface SimulatedItemStatus {
  itemSNo: string;
  statusCode: '00' | '01';
  status: 'Valid' | 'Invalid';
  invoiceNo?: string | null;
  errorCode: string | null;
  error: string;
}

export interface SimulatorMeta {
  note: string;
  specVersion: string;
  rulesFailed: { ruleId: string; path: string; errorCode: string | null }[];
  diagnostics: { ruleId: string; verdict: Finding['verdict']; severity?: Finding['severity']; path: string; message: string }[];
}

export interface SimulatedResponse {
  httpStatus: 200;
  result: 'valid' | 'invalid';
  body: Record<string, unknown>;
  /** Warnings and cannot-verify findings: things FBR might still reject that the simulator cannot judge. */
  diagnostics: Finding[];
  /** Error-severity findings that drove the simulated rejection. */
  errors: Finding[];
}

/** Pakistan Standard Time (UTC+5), formatted like the spec samples: "2025-05-13 12:01:41". */
export function formatPkt(nowMs: number): string {
  const d = new Date(nowMs + 5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

const UNMAPPED_NOTE = 'No FBR error code is documented for this condition; the simulator sends an empty errorCode with our own message.';

export function simulate(invoice: unknown, opts: SimulateOptions): SimulatedResponse {
  const endpoint = opts.endpoint ?? 'post';
  const ruleOpts = {
    environment: opts.environment,
    ...(opts.taxTolerance !== undefined ? { taxTolerance: opts.taxTolerance } : {}),
    ...(opts.activity !== undefined ? { activity: opts.activity } : {}),
    ...(opts.sector !== undefined ? { sector: opts.sector } : {}),
  };
  const findings = runRules(invoice, ruleOpts);
  const errors = findings.filter((f) => f.verdict === 'fail' && f.severity === 'error');
  const diagnostics = findings.filter((f) => f.verdict === 'cannot-verify' || (f.verdict === 'fail' && f.severity === 'warning'));

  const headerErrors = errors.filter((f) => !/^items\[\d+\]/.test(f.path));
  const byItem = new Map<number, Finding[]>();
  for (const f of errors) {
    const m = /^items\[(\d+)\]/.exec(f.path);
    if (!m) continue;
    const i = Number(m[1]);
    byItem.set(i, [...(byItem.get(i) ?? []), f]);
  }

  const inv = (typeof invoice === 'object' && invoice !== null && !Array.isArray(invoice) ? invoice : {}) as Record<string, unknown>;
  const items = Array.isArray(inv['items']) ? inv['items'] : [];
  const dated = formatPkt(opts.now);
  const meta = (failed: Finding[]): SimulatorMeta => ({
    note: `Simulated by DI Doctor from spec v${SPEC_VERSION} rules. Passing here does not guarantee FBR acceptance; checks that need FBR reference data are listed under diagnostics.${failed.some((f) => !f.errorCode) ? ' ' + UNMAPPED_NOTE : ''}`,
    specVersion: SPEC_VERSION,
    rulesFailed: failed.map((f) => ({ ruleId: f.ruleId, path: f.path, errorCode: f.errorCode ?? null })),
    diagnostics: diagnostics.map((f) => ({ ruleId: f.ruleId, verdict: f.verdict, ...(f.severity ? { severity: f.severity } : {}), path: f.path, message: f.message })),
  });
  const withMeta = (body: Record<string, unknown>, failed: Finding[]) => (opts.strictShape ? body : { ...body, _simulator: meta(failed) });

  // Header-level rejection (spec v1.12 §4.1.4): the error sits at the top and invoiceStatuses is null.
  if (headerErrors.length > 0) {
    const first = headerErrors[0]!;
    const body = {
      dated,
      validationResponse: { statusCode: '01', status: 'Invalid', errorCode: first.errorCode ?? '', error: first.message, invoiceStatuses: null },
    };
    return { httpStatus: 200, result: 'invalid', body: withMeta(body, headerErrors), diagnostics, errors };
  }

  // Item-level rejection (spec v1.12 §4.1.5): header statusCode stays "00" while status is "Invalid". This trap is reproduced on purpose.
  if (byItem.size > 0) {
    const statuses: SimulatedItemStatus[] = items.map((_, i) => {
      const errs = byItem.get(i);
      const first = errs?.[0];
      const s: SimulatedItemStatus = first
        ? { itemSNo: String(i + 1), statusCode: '01', status: 'Invalid', errorCode: first.errorCode ?? '', error: first.message }
        : { itemSNo: String(i + 1), statusCode: '00', status: 'Valid', errorCode: endpoint === 'validate' ? null : '', error: '' };
      if (endpoint === 'post') s.invoiceNo = null;
      return s;
    });
    const body = {
      dated,
      validationResponse: {
        statusCode: '00',
        status: 'Invalid',
        ...(endpoint === 'validate' ? { errorCode: null } : {}),
        error: '',
        invoiceStatuses: statuses,
      },
    };
    return { httpStatus: 200, result: 'invalid', body: withMeta(body, errors), diagnostics, errors };
  }

  // Valid (spec v1.12 §4.1.3 / §4.2.3). Invoice number = seller number + "DI" + millisecond timestamp,
  // which gives the 22 (NTN) or 28 (CNIC) characters the spec mentions for invoiceRefNo.
  const seller = typeof inv['sellerNTNCNIC'] === 'string' ? inv['sellerNTNCNIC'].trim() : '';
  const invoiceNumber = `${seller}DI${opts.now}`;
  if (endpoint === 'post') {
    const body = {
      invoiceNumber,
      dated,
      validationResponse: {
        statusCode: '00',
        status: 'Valid',
        error: '',
        invoiceStatuses: items.map((_, i) => ({ itemSNo: String(i + 1), statusCode: '00', status: 'Valid', invoiceNo: `${invoiceNumber}-${i + 1}`, errorCode: '', error: '' })),
      },
    };
    return { httpStatus: 200, result: 'valid', body: withMeta(body, []), diagnostics, errors };
  }
  const body = {
    dated,
    validationResponse: {
      statusCode: '00',
      status: 'Valid',
      errorCode: null,
      error: '',
      invoiceStatuses: items.map((_, i) => ({ itemSNo: String(i + 1), statusCode: '00', status: 'Valid', errorCode: null, error: '' })),
    },
  };
  return { httpStatus: 200, result: 'valid', body: withMeta(body, []), diagnostics, errors };
}
