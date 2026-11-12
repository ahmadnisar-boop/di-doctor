import saleTypes from '../data/sale-types.json' with { type: 'json' };
import { normalise } from './helpers.js';

export type TaxBase = 'simple-percent' | 'retail-price' | 'quantity' | 'unspecified';
export interface SaleTypeInfo {
  saleType: string;
  taxBase: TaxBase;
  restrictions: { code: string; note: string }[];
}

export const SALE_TYPES: readonly SaleTypeInfo[] = saleTypes.types as SaleTypeInfo[];

/** Case- and whitespace-insensitive lookup (spec §9 and its own samples disagree on casing). */
export function getSaleType(value: unknown): SaleTypeInfo | undefined {
  if (typeof value !== 'string') return undefined;
  const n = normalise(value);
  return SALE_TYPES.find((s) => normalise(s.saleType) === n);
}
