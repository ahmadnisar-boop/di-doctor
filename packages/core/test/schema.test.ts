import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { fixture } from './helpers.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajvFormats.default(ajv);
const invoiceSchema = ajv.compile(JSON.parse(readFileSync('schema/invoice.schema.json', 'utf8')));
const responseSchema = ajv.compile(JSON.parse(readFileSync('schema/response.schema.json', 'utf8')));

/** Fixtures that break structure/type rules the schema can express. Everything else must pass the schema. */
const STRUCTURALLY_INVALID = new Set([
  'bad-date.json',
  'debit-note-missing-ref.json',
  'header-and-item-errors.json',
  'misspelled-buyer-key.json',
  'missing-items.json',
  'missing-required-fields.json',
  'sales-invoice-near-miss.json',
  'string-numbers.json',
  'unknown-keys.json',
]);

describe('invoice.schema.json', () => {
  for (const file of readdirSync('fixtures/invoices').filter((f) => f.endsWith('.json'))) {
    it(`${file} is ${STRUCTURALLY_INVALID.has(file) ? 'rejected' : 'accepted'}`, () => {
      const ok = invoiceSchema(fixture(`invoices/${file}`));
      if (ok !== !STRUCTURALLY_INVALID.has(file)) throw new Error(JSON.stringify(invoiceSchema.errors, null, 2));
    });
  }
  it('rejects unknown keys so typos surface in any language', () => {
    expect(invoiceSchema({ ...(fixture('invoices/valid-sandbox-sn001.json') as object), extra: 1 })).toBe(false);
    expect(invoiceSchema.errors?.[0]?.keyword).toBe('additionalProperties');
  });
  it('requires buyerNTNCNIC for registered buyers and invoiceRefNo for debit notes', () => {
    const base = fixture('invoices/valid-sandbox-sn001.json') as Record<string, unknown>;
    expect(invoiceSchema({ ...base, buyerNTNCNIC: '' })).toBe(false);
    expect(invoiceSchema({ ...base, buyerRegistrationType: 'Unregistered', buyerNTNCNIC: '' })).toBe(true);
    expect(invoiceSchema({ ...base, invoiceType: 'Debit Note', invoiceRefNo: 'short' })).toBe(false);
  });
});

describe('response.schema.json', () => {
  const accepted = ['valid-post.json', 'valid-validate.json', 'invalid-header-null-statuses.json', 'invalid-misleading-header.json', 'valid-header-failed-item.json'];
  for (const file of accepted) it(`${file} is accepted`, () => expect(responseSchema(fixture(`responses/${file}`))).toBe(true));
  for (const file of ['unknown-shape.json', 'inner-only.json']) it(`${file} is rejected`, () => expect(responseSchema(fixture(`responses/${file}`))).toBe(false));
});
