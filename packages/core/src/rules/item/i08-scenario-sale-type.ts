import type { Rule } from '../types.js';
import { findings, isNonEmptyString, normalise } from '../helpers.js';

/** Casing differs between §9 and the samples, so the comparison ignores case and spacing. No §7 code documents this failure. */
export const i08ScenarioSaleType: Rule = {
  id: 'I08',
  title: 'saleType matches the sandbox scenario',
  specRef: 'spec v1.12 §9',
  level: 'item',
  check({ item, index, options, scenario }) {
    if (options.environment !== 'sandbox' || !scenario) return [];
    const st = item!['saleType'];
    if (!isNonEmptyString(st)) return [];
    const f = findings(this);
    const path = `items[${index}].saleType`;
    if (normalise(st) === normalise(scenario.saleType))
      return [f.pass(path, `saleType matches scenario ${scenario.id}.`)];
    return [
      f.fail(
        path,
        `saleType "${st}" does not match scenario ${scenario.id}, which expects "${scenario.saleType}".`,
        `Use "${scenario.saleType}" for ${scenario.id}, or change scenarioId.`,
      ),
    ];
  },
};
