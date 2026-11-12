import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cli = (...args: string[]) => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'packages/cli/src/cli.ts', ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

describe('CLI', () => {
  it('check-response: misleading header exits 1 and says INVALID', () => {
    const r = cli('check-response', 'fixtures/responses/invalid-misleading-header.json');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Overall: INVALID/);
    expect(r.out).toMatch(/0046/);
  });
  it('check-response: valid exits 0 with invoice number', () => {
    const r = cli('check-response', 'fixtures/responses/valid-post.json');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/FBR invoice number: 0000001DI/);
  });
  it('validate: tax mismatch exits 1 and names the field', () => {
    const r = cli('validate', 'fixtures/invoices/tax-mismatch.json', '--env', 'sandbox');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/items\[0\]\.salesTaxApplicable/);
    expect(r.out).toMatch(/spec v1\.12/);
  });
  it('validate: valid fixture exits 0', () => {
    expect(cli('validate', 'fixtures/invoices/valid-sandbox-sn001.json', '--env', 'sandbox').code).toBe(0);
  });
  it('validate --json emits parseable JSON', () => {
    const r = cli('--json', 'validate', 'fixtures/invoices/valid-sandbox-sn001.json', '--env', 'sandbox');
    const parsed = JSON.parse(r.out) as { summary: { fail: number } };
    expect(parsed.summary.fail).toBe(0);
  });
  it('validate: bad --env exits 2', () => {
    expect(cli('validate', 'fixtures/invoices/valid-sandbox-sn001.json', '--env', 'live').code).toBe(2);
  });
  it('explain 0052 prints an explanation', () => {
    const r = cli('explain', '0052');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^0052 — /);
  });
  it('explain <response file> explains every code', () => {
    expect(cli('explain', 'fixtures/responses/invalid-header-null-statuses.json').out).toMatch(/0052/);
  });
  it('scenarios lists ids', () => {
    const r = cli('scenarios', '--activity', 'Manufacturer', '--sector', 'Textile');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/12 scenario/);
    expect(r.out).toMatch(/SN009/);
  });
  it('scenarios with unknown sector exits 2 and lists valid values', () => {
    const r = cli('scenarios', '--activity', 'Manufacturer', '--sector', 'Mining');
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/Sectors:/);
  });
  it('missing file exits 2', () => {
    expect(cli('check-response', 'nope.json').code).toBe(2);
  });
});

describe('CLI: simulate, stdin, rules, codes', () => {
  it('simulate prints an FBR-shaped body and exits 1 for a rejected payload', () => {
    const r = cli('--json', 'simulate', 'fixtures/invoices/tax-mismatch.json', '--env', 'sandbox');
    expect(r.code).toBe(1);
    const parsed = JSON.parse(r.out) as { result: string; body: { validationResponse: { invoiceStatuses: { errorCode: string }[] } } };
    expect(parsed.result).toBe('invalid');
    expect(parsed.body.validationResponse.invoiceStatuses[0]?.errorCode).toBe('0104');
  });
  it('reads JSON from stdin with -', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'packages/cli/src/cli.ts', 'validate', '-', '--env', 'sandbox'], {
      encoding: 'utf8',
      input: readFileSync('fixtures/invoices/valid-sandbox-sn001.json', 'utf8'),
      env: { ...process.env, NO_COLOR: '1' },
    });
    expect(r.status).toBe(0);
  });
  it('rules lists every rule; --markdown renders a table', () => {
    const r = cli('rules');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/H01/);
    expect(r.out).toMatch(/I13/);
    expect(cli('rules', '--markdown').out).toMatch(/^\| ID \| Level \| Rule \| Spec \| Code \|/m);
  });
  it('codes lists 108 codes', () => {
    expect(cli('codes').out).toMatch(/108 codes/);
    expect(cli('codes', '--side', 'purchase').out).toMatch(/22 codes/);
  });
});

describe('CLI: output grouping', () => {
  it('groups cannot-verify findings by default and expands them with --verbose', () => {
    const plain = cli('validate', 'fixtures/invoices/multi-item-one-bad.json', '--env', 'sandbox');
    expect(plain.out).toMatch(/3 places/);
    expect(plain.out).toMatch(/Use --verbose/);
    const verbose = cli('--verbose', 'validate', 'fixtures/invoices/multi-item-one-bad.json', '--env', 'sandbox');
    expect(verbose.out).not.toMatch(/Use --verbose/);
    expect((verbose.out.match(/Cannot verify offline/g) ?? []).length).toBeGreaterThan(5);
  });
  it('prints the FBR code next to a failing rule', () => {
    expect(cli('validate', 'fixtures/invoices/tax-mismatch.json', '--env', 'sandbox').out).toMatch(/FBR code 0104/);
  });
});
