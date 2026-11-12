import type { Rule } from '../types.js';
import { findings, isNonEmptyString } from '../helpers.js';

/** The pairing is our inference from §7 0077/0078 (see docs/spec-traps.md), so this is a warning. */
export const i07SroItemSerial: Rule = {
  id: 'I07',
  title: 'sroItemSerialNo accompanies sroScheduleNo',
  specRef: 'spec v1.12 §7 (0077, 0078), §5.10',
  level: 'item',
  check({ item, index }) {
    if (!isNonEmptyString(item!['sroScheduleNo'])) return [];
    const f = findings(this);
    const path = `items[${index}].sroItemSerialNo`;
    if (isNonEmptyString(item!['sroItemSerialNo']))
      return [f.pass(path, 'sroScheduleNo and sroItemSerialNo are both set.')];
    return [
      f.fail(
        path,
        'sroScheduleNo is set but sroItemSerialNo is empty.',
        'FBR usually expects the SRO item serial number alongside the schedule. Get the value from the SRO item reference API.',
        { severity: 'warning' },
      ),
    ];
  },
};
