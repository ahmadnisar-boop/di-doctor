import type { Rule } from '../types.js';
import { findings } from '../helpers.js';
import { listScenarios } from '../../scenarios/index.js';

/** Only runs when the caller tells us the seller's activity and sector (spec v1.12 §10). */
export const h16ScenarioApplicability: Rule = {
  id: 'H16',
  title: "scenarioId applies to the seller's business activity and sector",
  specRef: 'spec v1.12 §10',
  level: 'header',
  check({ options, scenario }) {
    if (options.environment !== 'sandbox' || !options.activity || !options.sector || !scenario) return [];
    const f = findings(this);
    const r = listScenarios(options.activity, options.sector);
    if ('error' in r)
      return [
        f.fail('scenarioId', r.error, `Activities: ${r.activities.join(', ')}. Sectors: ${r.sectors.join(', ')}.`, {
          severity: 'warning',
        }),
      ];
    const ids = r.scenarios.map((s) => s.id);
    if (ids.includes(scenario.id))
      return [f.pass('scenarioId', `${scenario.id} applies to ${r.activity} / ${r.sector}.`)];
    return [
      f.fail(
        'scenarioId',
        `${scenario.id} is not in the scenario list for ${r.activity} / ${r.sector}.`,
        `Applicable scenarios: ${ids.join(', ')}.`,
      ),
    ];
  },
};
