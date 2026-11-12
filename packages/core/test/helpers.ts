import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Finding } from '../src/types.js';

export const fixture = (rel: string): unknown => JSON.parse(readFileSync(resolve('fixtures', rel), 'utf8'));

export const byRule = (findings: Finding[], ruleId: string): Finding[] => findings.filter((f) => f.ruleId === ruleId);
export const verdicts = (findings: Finding[], ruleId: string): string[] =>
  byRule(findings, ruleId).map((f) => f.verdict);
export const errorsOf = (findings: Finding[], ruleId: string): Finding[] =>
  byRule(findings, ruleId).filter((f) => f.verdict === 'fail' && f.severity === 'error');
export const warningsOf = (findings: Finding[], ruleId: string): Finding[] =>
  byRule(findings, ruleId).filter((f) => f.verdict === 'fail' && f.severity === 'warning');
