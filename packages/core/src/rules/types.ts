import type { Finding, InvoiceInput, ValidateOptions, ScenarioInfo } from '../types.js';

export type Obj = Record<string, unknown>;

export interface RuleContext {
  invoice: InvoiceInput;
  options: ValidateOptions;
  /** Resolved sandbox scenario, when scenarioId is valid. */
  scenario?: ScenarioInfo;
  /** Current item and its index; only set for item-level rules. */
  item?: Obj;
  index?: number;
}

export interface Rule {
  /** Stable id: H01… for header rules, I01… for item rules. */
  id: string;
  /** One line, shown by `di-doctor rules`. */
  title: string;
  /** Spec citation, e.g. "spec v1.12 §4.1.2". */
  specRef: string;
  level: 'header' | 'item';
  /** Default FBR error code for failures of this rule, when the spec documents one. Findings may override per case. */
  errorCode?: string;
  check(ctx: RuleContext): Finding[];
}
