/** Sandbox scenarios (spec v1.12 §9) and which ones apply per business activity and sector (§10). */
import type { ScenarioInfo, ScenarioListResult } from '../types.js';
import { SPEC_VERSION } from '../spec.js';
import scenariosData from '../data/scenarios.json' with { type: 'json' };
import activityMap from '../data/activity-map.json' with { type: 'json' };

type ScenarioEntry = { description: string; saleType: string; note?: string };
const scenarios = scenariosData as unknown as Record<string, ScenarioEntry | string>;
const map = activityMap.map as Record<string, Record<string, string[]>>;

export const ACTIVITIES: string[] = activityMap.activities;
export const SECTORS: string[] = activityMap.sectors;
export const RETAILER_ONLY = ['SN026', 'SN027', 'SN028'];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
const resolve = (list: string[], v: string): string | undefined => list.find((x) => norm(x) === norm(v));

export function getScenario(id: string): ScenarioInfo | undefined {
  const key = id.trim().toUpperCase();
  const e = scenarios[key];
  if (!e || typeof e !== 'object') return undefined;
  const info: ScenarioInfo = { id: key, description: e.description, saleType: e.saleType };
  if (e.note) info.note = e.note;
  return info;
}

export function allScenarios(): ScenarioInfo[] {
  return Object.keys(scenarios)
    .filter((k) => !k.startsWith('_'))
    .map((k) => getScenario(k)!)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type ScenarioLookupError = { error: string; activities: string[]; sectors: string[] };

export function listScenarios(activity: string, sector: string): ScenarioListResult | ScenarioLookupError {
  const a = resolve(ACTIVITIES, activity);
  const s = resolve(SECTORS, sector);
  if (!a || !s) {
    const what = !a && !s ? `activity "${activity}" and sector "${sector}"` : !a ? `activity "${activity}"` : `sector "${sector}"`;
    return { error: `Unknown ${what}. Use one of the values listed (spec v${SPEC_VERSION} §10).`, activities: ACTIVITIES, sectors: SECTORS };
  }
  const ids = map[a]?.[s] ?? [];
  const list = ids.map((id) => getScenario(id)).filter((x): x is ScenarioInfo => !!x);
  const notes: string[] = [];
  if (list.some((x) => RETAILER_ONLY.includes(x.id))) notes.push('SN026, SN027 and SN028 only apply if you are registered as a retailer in your sales tax profile (spec §9 note).');
  if (a === 'Manufacturer' && s === 'Pharmaceuticals') notes.push('Spec §10 lists no SN025 for Manufacturer / Pharmaceuticals although other activities in this sector have it. Copied as printed; confirm with FBR.');
  return { activity: a, sector: s, scenarios: list, notes, specVersion: SPEC_VERSION };
}
