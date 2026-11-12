/** Ordered rule registry. Adding a rule = one file in header/ or item/, one import here, and pass + fail fixtures. */
import type { Finding, InvoiceInput, ValidateOptions } from '../types.js';
import type { Rule, RuleContext, Obj } from './types.js';
import { getScenario } from '../scenarios/index.js';
import { findings } from './helpers.js';

import { h01InvoiceType } from './header/h01-invoice-type.js';
import { h02InvoiceDate } from './header/h02-invoice-date.js';
import { h03SellerId } from './header/h03-seller-id.js';
import { h04SellerNameAddress } from './header/h04-seller-name-address.js';
import { h05SellerProvince } from './header/h05-seller-province.js';
import { h06BuyerRegistrationType } from './header/h06-buyer-registration-type.js';
import { h07BuyerId } from './header/h07-buyer-id.js';
import { h08BuyerNameAddressProvince } from './header/h08-buyer-name-address-province.js';
import { h09SelfInvoicing } from './header/h09-self-invoicing.js';
import { h10DebitNoteRef } from './header/h10-debit-note-ref.js';
import { h11ScenarioId } from './header/h11-scenario-id.js';
import { h12Items } from './header/h12-items.js';
import { h13UnknownHeaderKeys } from './header/h13-unknown-keys.js';
import { h14DebitNoteOriginal } from './header/h14-debit-note-original.js';
import { h15RegistrationStatus } from './header/h15-registration-status.js';
import { h16ScenarioApplicability } from './header/h16-scenario-applicability.js';

import { i01RequiredFields } from './item/i01-required-fields.js';
import { i02DecimalFields } from './item/i02-decimal-fields.js';
import { i03HsCodeShape } from './item/i03-hs-code-shape.js';
import { i04TaxMath } from './item/i04-tax-math.js';
import { i05WithheldAtSource } from './item/i05-withheld-at-source.js';
import { i06FivePercentLimit } from './item/i06-five-percent-limit.js';
import { i07SroItemSerial } from './item/i07-sro-item-serial.js';
import { i08ScenarioSaleType } from './item/i08-scenario-sale-type.js';
import { i09ReferenceData } from './item/i09-reference-data.js';
import { i10UnknownItemKeys } from './item/i10-unknown-keys.js';
import { i11SaleTypeKnown } from './item/i11-sale-type-known.js';
import { i12TotalValues } from './item/i12-total-values.js';
import { i13SaleTypeRestrictions } from './item/i13-sale-type-restrictions.js';

export const RULES: readonly Rule[] = [
  h01InvoiceType,
  h02InvoiceDate,
  h03SellerId,
  h04SellerNameAddress,
  h05SellerProvince,
  h06BuyerRegistrationType,
  h07BuyerId,
  h08BuyerNameAddressProvince,
  h09SelfInvoicing,
  h10DebitNoteRef,
  h11ScenarioId,
  h12Items,
  h13UnknownHeaderKeys,
  h14DebitNoteOriginal,
  h15RegistrationStatus,
  h16ScenarioApplicability,
  i01RequiredFields,
  i02DecimalFields,
  i03HsCodeShape,
  i04TaxMath,
  i05WithheldAtSource,
  i06FivePercentLimit,
  i07SroItemSerial,
  i08ScenarioSaleType,
  i09ReferenceData,
  i10UnknownItemKeys,
  i11SaleTypeKnown,
  i12TotalValues,
  i13SaleTypeRestrictions,
];

const NOT_OBJECT: Rule = {
  id: 'F00',
  title: 'Payload is a JSON object',
  specRef: 'spec v1.12 §4.1.1',
  level: 'header',
  check: () => [],
};

export function runRules(input: unknown, options: ValidateOptions): Finding[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return [findings(NOT_OBJECT).fail('$', 'Payload is not a JSON object.', 'Send the invoice as a single JSON object (spec v1.12 §4.1.1 object model).')];
  }
  const invoice = input as InvoiceInput;
  const sid = typeof invoice['scenarioId'] === 'string' ? invoice['scenarioId'] : '';
  const scenario = sid ? getScenario(sid) : undefined;
  const base: RuleContext = scenario ? { invoice, options, scenario } : { invoice, options };

  const out: Finding[] = [];
  for (const rule of RULES) if (rule.level === 'header') out.push(...rule.check(base));

  const items = invoice['items'];
  if (Array.isArray(items)) {
    items.forEach((it, index) => {
      if (typeof it !== 'object' || it === null || Array.isArray(it)) {
        out.push(findings(i01RequiredFields).fail(`items[${index}]`, 'Item is not a JSON object.', 'Each entry in items must be an object with the item fields.', { specRef: 'spec v1.12 §4.1.1' }));
        return;
      }
      const ctx: RuleContext = { ...base, item: it as Obj, index };
      for (const rule of RULES) if (rule.level === 'item') out.push(...rule.check(ctx));
    });
  }
  return out;
}
