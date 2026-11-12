/**
 * Shared types for DI Doctor.
 * Field names follow the JSON samples in spec v1.12 §4.1.1 / §4.1.2.
 */

export type Verdict = 'pass' | 'fail' | 'cannot-verify';

export interface Finding {
  /** Stable rule identifier, e.g. "H03" or "I04". */
  ruleId: string;
  /** One-line name of the rule. */
  title: string;
  verdict: Verdict;
  /** Only meaningful when verdict is "fail". Warnings never affect the exit code. */
  severity?: 'error' | 'warning';
  /** JSON path of the offending value, e.g. "items[0].salesTaxApplicable". */
  path: string;
  /** What is wrong (or what was checked, for pass). */
  message: string;
  /** How to fix it. */
  fix?: string;
  /** Why we could not verify (only for cannot-verify). */
  reason?: string;
  /** Spec citation, e.g. "spec v1.12 §4.1.2". */
  specRef: string;
  /** FBR error code the spec ties to this failure, when documented. Used by the simulator. */
  errorCode?: string;
}

export type Environment = 'sandbox' | 'production';

export interface ValidateOptions {
  environment: Environment;
  /** Allowed absolute difference (PKR) between declared and computed sales tax. Default 1.00. */
  taxTolerance?: number;
  /** Seller's business activity as registered with FBR (spec §10). With `sector`, enables the scenario-applicability check. */
  activity?: string;
  /** Seller's sector (spec §10). */
  sector?: string;
}

export interface ValidationResult {
  findings: Finding[];
  summary: { pass: number; fail: number; warnings: number; cannotVerify: number };
  specVersion: string;
}

/** Invoice header as described in spec v1.12 §4.1.2. Values are deliberately `unknown`: we validate, not assume. */
export type InvoiceInput = Record<string, unknown>;

export type ResponseOverall = 'valid' | 'invalid' | 'unknown';

export interface ResponseItemStatus {
  itemSNo: string | null;
  status: 'valid' | 'invalid' | 'unknown';
  invoiceNo?: string;
  errorCode?: string;
  error?: string;
}

export interface ResponseProblem {
  /** Where the problem was found: "header", "items[0]", "http". */
  where: string;
  errorCode?: string;
  message: string;
}

export interface ResponseCheck {
  overall: ResponseOverall;
  /** FBR invoice number. Only set when overall is "valid". */
  fbrInvoiceNumber?: string;
  /** Kind of response detected from its shape. */
  kind: 'post' | 'validate' | 'unknown';
  items: ResponseItemStatus[];
  problems: ResponseProblem[];
  warnings: string[];
  specVersion: string;
}

export interface CheckResponseOptions {
  /** HTTP status code of the response, if known. */
  httpStatus?: number;
}

export interface ErrorExplanation {
  code: string;
  title: string;
  meaning: string;
  commonCauses: string[];
  fieldsToCheck: string[];
  fix: string;
  relatedScenarios?: string[];
  specRef: string;
  /** Sales codes come from spec §7, purchase codes from §8. */
  side: 'sale' | 'purchase' | 'unknown';
  /** False when the code is not in our list; the other fields then hold generic guidance. */
  known: boolean;
}

export interface ScenarioInfo {
  id: string;
  description: string;
  saleType: string;
  /** Extra note from the spec, e.g. retailer-only scenarios. */
  note?: string;
}

export interface ScenarioListResult {
  activity: string;
  sector: string;
  scenarios: ScenarioInfo[];
  notes: string[];
  specVersion: string;
}
