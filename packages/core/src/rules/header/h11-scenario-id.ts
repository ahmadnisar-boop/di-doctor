import type { Rule } from '../types.js';
import { findings, isNonEmptyString, isPresent, SCENARIO_ID } from '../helpers.js';

/** "Required for Sandbox only" (spec v1.12 §4.1.2); IDs from §9. */
export const h11ScenarioId: Rule = {
  id: 'H11',
  title: 'scenarioId is SN001–SN028 in sandbox and absent in production',
  specRef: 'spec v1.12 §4.1.2, §9',
  level: 'header',
  check({ invoice, options }) {
    const f = findings(this);
    const v = invoice['scenarioId'];
    if (options.environment === 'sandbox') {
      if (!isNonEmptyString(v))
        return [
          f.fail(
            'scenarioId',
            'scenarioId is required in sandbox.',
            'Set scenarioId to one of SN001–SN028. Run `di-doctor scenarios` to see which apply to you.',
          ),
        ];
      if (SCENARIO_ID.test(v.trim())) return [f.pass('scenarioId', `scenarioId is ${v}.`)];
      return [
        f.fail('scenarioId', `scenarioId "${v}" is not one of SN001–SN028.`, 'Use the exact format SN001 … SN028.'),
      ];
    }
    if (isPresent(v))
      return [
        f.fail(
          'scenarioId',
          'scenarioId is set but this is a production payload.',
          'The spec only requires scenarioId in sandbox. Remove it for production unless FBR told you otherwise.',
          { severity: 'warning' },
        ),
      ];
    return [f.pass('scenarioId', 'scenarioId not set (not needed in production).')];
  },
};
