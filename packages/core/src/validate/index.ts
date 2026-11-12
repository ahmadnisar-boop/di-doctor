import type { Finding, ValidateOptions, ValidationResult } from '../types.js';
import { SPEC_VERSION } from '../spec.js';
import { runRules } from '../rules/registry.js';

export { DEFAULT_TAX_TOLERANCE } from '../rules/helpers.js';
export { parseSimpleRate } from './rate.js';

/** Offline pre-flight validation of a DI invoice payload. Pure: no I/O, no network. */
export function validateInvoice(input: unknown, opts: ValidateOptions): ValidationResult {
  const findings = runRules(input, opts);
  return { findings, summary: summarise(findings), specVersion: SPEC_VERSION };
}

export function summarise(findings: Finding[]): ValidationResult['summary'] {
  const s = { pass: 0, fail: 0, warnings: 0, cannotVerify: 0 };
  for (const f of findings) {
    if (f.verdict === 'pass') s.pass++;
    else if (f.verdict === 'cannot-verify') s.cannotVerify++;
    else if (f.severity === 'warning') s.warnings++;
    else s.fail++;
  }
  return s;
}
