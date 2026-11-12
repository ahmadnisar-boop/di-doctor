#!/usr/bin/env node
/** DI Doctor CLI. The only module that touches the file system or process. Everything else is pure. */
import { readFileSync } from 'node:fs';
import { Command, InvalidArgumentError } from 'commander';
import type { Finding, ErrorExplanation, ResponseCheck } from '@di-doctor/core';
import { SPEC_VERSION, SPEC_URL, RULES, checkResponse, validateInvoice, explainCode, explainResponse, listErrorCodes, listScenarios, simulate } from '@di-doctor/core';
import { createServer, listen } from './serve.js';

const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_USAGE = 2;

const useColor = process.stdout.isTTY && !process.env['NO_COLOR'] && !process.argv.includes('--no-color');
const c = (code: string, s: string) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s: string) => c('31', s);
const yellow = (s: string) => c('33', s);
const green = (s: string) => c('32', s);
const dim = (s: string) => c('2', s);
const bold = (s: string) => c('1', s);

/** Reads a JSON file, or stdin when the argument is "-". */
function readJson(file: string): unknown {
  let text: string;
  try {
    text = file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
  } catch {
    console.error(file === '-' ? 'Cannot read JSON from stdin.' : `Cannot read file: ${file}`);
    process.exit(EXIT_USAGE);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`File is not valid JSON: ${file}\n${(e as Error).message}`);
    process.exit(EXIT_USAGE);
  }
}

const footer = () => dim(`Checked against spec v${SPEC_VERSION}. Not tax advice. ${SPEC_URL}`);

function printResponse(r: ResponseCheck): void {
  const label = r.overall === 'valid' ? green('VALID') : r.overall === 'invalid' ? red('INVALID') : yellow('UNKNOWN');
  console.log(`${bold('Overall:')} ${label}  ${dim(`(${r.kind} response)`)}`);
  if (r.fbrInvoiceNumber) console.log(`${bold('FBR invoice number:')} ${r.fbrInvoiceNumber}`);
  for (const p of r.problems) console.log(`${red('✗')} ${p.where}${p.errorCode ? ` [${p.errorCode}]` : ''}: ${p.message}`);
  for (const w of r.warnings) console.log(`${yellow('!')} ${w}`);
  if (r.items.length) {
    console.log(bold('Items:'));
    for (const it of r.items) {
      const mark = it.status === 'valid' ? green('✓') : it.status === 'invalid' ? red('✗') : yellow('?');
      console.log(`  ${mark} item ${it.itemSNo}${it.invoiceNo ? ` ${dim(it.invoiceNo)}` : ''}${it.errorCode ? ` [${it.errorCode}] ${it.error ?? ''}` : ''}`);
    }
  }
  if (r.problems.some((p) => p.errorCode)) console.log(dim('Tip: run `di-doctor explain <file>` for plain-English explanations of these codes.'));
  console.log(footer());
}

/**
 * Failures and warnings are always printed in full. cannot-verify findings are grouped per rule unless --verbose,
 * because they repeat for every item and would bury the real problems.
 */
function printFindings(findings: Finding[], summary: { pass: number; fail: number; warnings: number; cannotVerify: number }, verbose: boolean): void {
  const order = (f: Finding) => (f.verdict === 'fail' ? (f.severity === 'warning' ? 1 : 0) : 2);
  const shown = findings.filter((f) => f.verdict !== 'pass').sort((a, b) => order(a) - order(b));
  const groups = new Map<string, Finding[]>();
  for (const f of shown) {
    if (f.verdict === 'fail') {
      const mark = f.severity === 'warning' ? yellow('!') : red('✗');
      console.log(`${mark} ${f.path}  ${dim(`(${f.ruleId}, ${f.specRef}${f.errorCode ? `, FBR code ${f.errorCode}` : ''})`)}`);
      console.log(`  Problem: ${f.message}`);
      if (f.fix) console.log(`  Fix:     ${f.fix}`);
    } else if (verbose) {
      console.log(`${yellow('?')} ${f.path}  ${dim(`(${f.ruleId}, ${f.specRef})`)}`);
      console.log(`  ${f.message}`);
      console.log(`  Cannot verify offline: ${f.reason ?? ''}`);
    } else {
      groups.set(f.ruleId, [...(groups.get(f.ruleId) ?? []), f]);
    }
  }
  for (const [ruleId, list] of groups) {
    const first = list[0]!;
    const where = list.length === 1 ? first.path : `${list.length} places`;
    console.log(`${yellow('?')} ${first.title}  ${dim(`(${ruleId}, ${where})`)}`);
    console.log(`  ${first.reason ?? first.message}`);
  }
  if (groups.size) console.log(dim('  Use --verbose to see every cannot-verify finding.'));
  const parts = [green(`✓ ${summary.pass} passed`)];
  if (summary.fail) parts.push(red(`✗ ${summary.fail} failed`));
  if (summary.warnings) parts.push(yellow(`! ${summary.warnings} warning(s)`));
  if (summary.cannotVerify) parts.push(yellow(`? ${summary.cannotVerify} cannot verify offline`));
  console.log(parts.join('  '));
  console.log(footer());
}

function printExplanation(e: ErrorExplanation): void {
  console.log(`${bold(e.code)} — ${e.title}${e.known ? '' : yellow(' (unknown to DI Doctor)')}`);
  console.log(`  What it means:  ${e.meaning}`);
  if (e.commonCauses.length) {
    console.log('  Common causes:');
    for (const x of e.commonCauses) console.log(`    - ${x}`);
  }
  if (e.fieldsToCheck.length) console.log(`  Check fields:   ${e.fieldsToCheck.join(', ')}`);
  console.log(`  How to fix:     ${e.fix}`);
  if (e.relatedScenarios?.length) console.log(`  Scenarios:      ${e.relatedScenarios.join(', ')}`);
  console.log(`  Reference:      ${e.specRef}`);
}

const program = new Command();
program
  .name('di-doctor')
  .description('Unofficial toolkit for Pakistan FBR Digital Invoicing: read responses safely, validate payloads offline, explain errors, list sandbox scenarios.')
  .version('0.0.1')
  .option('--json', 'machine-readable JSON output')
  .option('--verbose', 'show every cannot-verify finding instead of grouping them per rule')
  .option('--no-color', 'disable colours')
  // Must be set before .command() calls: subcommands copy exit settings when they are created.
  .exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version' || err.code === 'commander.help') process.exit(EXIT_OK);
    process.exit(EXIT_USAGE);
  });

program
  .command('check-response')
  .description('Read a DI API response safely (catches the misleading top-level status).')
  .argument('<file>', 'response JSON file, or - for stdin')
  .option('--http-status <code>', 'HTTP status code received', (v) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new InvalidArgumentError('must be an integer');
    return n;
  })
  .action((file: string, o: { httpStatus?: number }) => {
    const opts = o.httpStatus !== undefined ? { httpStatus: o.httpStatus } : {};
    const r = checkResponse(readJson(file), opts);
    if (program.opts()['json']) console.log(JSON.stringify(r, null, 2));
    else printResponse(r);
    process.exitCode = r.overall === 'valid' ? EXIT_OK : EXIT_FAIL;
  });

program
  .command('validate')
  .description('Offline pre-flight checks on an invoice payload.')
  .argument('<file>', 'invoice JSON file, or - for stdin')
  .requiredOption('--env <environment>', 'sandbox | production', (v: string) => {
    if (v !== 'sandbox' && v !== 'production') throw new InvalidArgumentError('must be "sandbox" or "production"');
    return v;
  })
  .option('--tolerance <pkr>', 'allowed sales-tax rounding difference in PKR (default 1.00)', (v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new InvalidArgumentError('must be a non-negative number');
    return n;
  })
  .option('--activity <name>', 'seller business activity (enables the scenario-applicability check, spec §10)')
  .option('--sector <name>', 'seller sector')
  .action((file: string, o: { env: 'sandbox' | 'production'; tolerance?: number; activity?: string; sector?: string }) => {
    const r = validateInvoice(readJson(file), {
      environment: o.env,
      ...(o.tolerance !== undefined ? { taxTolerance: o.tolerance } : {}),
      ...(o.activity !== undefined ? { activity: o.activity } : {}),
      ...(o.sector !== undefined ? { sector: o.sector } : {}),
    });
    if (program.opts()['json']) console.log(JSON.stringify(r, null, 2));
    else printFindings(r.findings, r.summary, Boolean(program.opts()['verbose']));
    process.exitCode = r.summary.fail > 0 ? EXIT_FAIL : EXIT_OK;
  });

program
  .command('explain')
  .description('Explain an FBR error code, or every error in a response file.')
  .argument('<codeOrFile>', 'error code like 0052, or a response JSON file')
  .action((arg: string) => {
    const list = /^\s*\d{1,4}\s*$/.test(arg) ? [explainCode(arg)] : explainResponse(readJson(arg));
    if (program.opts()['json']) console.log(JSON.stringify(list, null, 2));
    else if (list.length === 0) console.log('No error codes found in that response.');
    else {
      list.forEach((e, i) => {
        if (i) console.log('');
        printExplanation(e);
      });
      console.log(footer());
    }
    process.exitCode = EXIT_OK;
  });

program
  .command('scenarios')
  .description('List the sandbox scenarios required for a business activity and sector.')
  .requiredOption('--activity <name>', 'e.g. Manufacturer, Importer, Retailer')
  .requiredOption('--sector <name>', 'e.g. "All Other Sectors", Steel, Textile')
  .action((o: { activity: string; sector: string }) => {
    const r = listScenarios(o.activity, o.sector);
    if ('error' in r) {
      if (program.opts()['json']) console.log(JSON.stringify(r, null, 2));
      else {
        console.error(r.error);
        console.error(`Activities: ${r.activities.join(', ')}`);
        console.error(`Sectors:    ${r.sectors.join(', ')}`);
      }
      process.exitCode = EXIT_USAGE;
      return;
    }
    if (program.opts()['json']) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`${bold(`${r.activity} / ${r.sector}`)}: ${r.scenarios.length} scenario(s)`);
      for (const s of r.scenarios) console.log(`  ${bold(s.id)}  ${s.description}\n         sale type: ${s.saleType}`);
      for (const n of r.notes) console.log(`${yellow('!')} ${n}`);
      console.log(footer());
    }
    process.exitCode = EXIT_OK;
  });

const envParser = (v: string) => {
  if (v !== 'sandbox' && v !== 'production') throw new InvalidArgumentError('must be "sandbox" or "production"');
  return v;
};
const numParser = (what: string, min = 0, max = Infinity) => (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new InvalidArgumentError(`${what} must be a number between ${min} and ${max}`);
  return n;
};

program
  .command('simulate')
  .description('Show the response the FBR sandbox would most likely return for this payload (documented rules only).')
  .argument('<file>', 'invoice JSON file, or - for stdin')
  .requiredOption('--env <environment>', 'sandbox | production', envParser)
  .option('--endpoint <endpoint>', 'post | validate (default: post)', (v) => {
    if (v !== 'post' && v !== 'validate') throw new InvalidArgumentError('must be "post" or "validate"');
    return v;
  })
  .option('--strict-shape', 'omit the _simulator metadata so the body is exactly FBR-shaped')
  .option('--activity <name>', 'seller business activity (enables the scenario-applicability check)')
  .option('--sector <name>', 'seller sector')
  .option('--tolerance <pkr>', 'allowed sales-tax rounding difference in PKR (default 1.00)', numParser('tolerance'))
  .action((file: string, o: { env: 'sandbox' | 'production'; endpoint?: 'post' | 'validate'; strictShape?: boolean; activity?: string; sector?: string; tolerance?: number }) => {
    const r = simulate(readJson(file), {
      environment: o.env,
      endpoint: o.endpoint ?? 'post',
      now: Date.now(),
      ...(o.strictShape ? { strictShape: true } : {}),
      ...(o.activity !== undefined ? { activity: o.activity } : {}),
      ...(o.sector !== undefined ? { sector: o.sector } : {}),
      ...(o.tolerance !== undefined ? { taxTolerance: o.tolerance } : {}),
    });
    if (program.opts()['json']) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(bold(`Simulated ${o.endpoint ?? 'post'} response (${o.env}): `) + (r.result === 'valid' ? green('VALID') : red('INVALID')));
      console.log(JSON.stringify(r.body, null, 2));
      if (r.diagnostics.length) console.log(yellow(`! ${r.diagnostics.length} diagnostic(s) the simulator cannot judge; run \`di-doctor validate\` for details.`));
      console.log(dim('Passing the simulator does not guarantee FBR acceptance.'));
      console.log(footer());
    }
    process.exitCode = r.result === 'valid' ? EXIT_OK : EXIT_FAIL;
  });

program
  .command('serve')
  .description('Run a local sandbox simulator with the same paths as the FBR DI API.')
  .option('--port <port>', 'port (default 8787)', numParser('port', 0, 65535))
  .option('--host <host>', 'bind address (default 127.0.0.1)')
  .option('--token <token>', 'require this exact Bearer token (default: any non-empty token)')
  .option('--chaos <fraction>', 'fraction of requests answered with HTTP 500 (0–1)', numParser('chaos', 0, 1))
  .option('--latency <ms>', 'delay every response by this many ms', numParser('latency'))
  .option('--strict-shape', 'omit the _simulator metadata from bodies')
  .option('--activity <name>', 'seller business activity (enables the scenario-applicability check)')
  .option('--sector <name>', 'seller sector')
  .option('--tolerance <pkr>', 'allowed sales-tax rounding difference in PKR (default 1.00)', numParser('tolerance'))
  .action(async (o: { port?: number; host?: string; token?: string; chaos?: number; latency?: number; strictShape?: boolean; activity?: string; sector?: string; tolerance?: number }) => {
    const opts = {
      ...(o.port !== undefined ? { port: o.port } : {}),
      ...(o.host !== undefined ? { host: o.host } : {}),
      ...(o.token !== undefined ? { token: o.token } : {}),
      ...(o.chaos !== undefined ? { chaos: o.chaos } : {}),
      ...(o.latency !== undefined ? { latency: o.latency } : {}),
      ...(o.strictShape ? { strictShape: true } : {}),
      ...(o.activity !== undefined ? { activity: o.activity } : {}),
      ...(o.sector !== undefined ? { sector: o.sector } : {}),
      ...(o.tolerance !== undefined ? { taxTolerance: o.tolerance } : {}),
      log: (line: string) => console.log(dim(new Date().toISOString()) + '  ' + line),
    };
    const server = createServer(opts);
    try {
      const { port, host } = await listen(server, opts);
      console.log(`${bold('DI Doctor sandbox simulator')} listening on http://${host}:${port}`);
      console.log('  POST /di_data/v1/di/postinvoicedata_sb       sandbox post');
      console.log('  POST /di_data/v1/di/validateinvoicedata_sb   sandbox validate');
      console.log('  POST /di_data/v1/di/postinvoicedata          production post');
      console.log('  POST /di_data/v1/di/validateinvoicedata      production validate');
      console.log('  GET  /_health');
      console.log(dim('Send "Authorization: Bearer <any token>". Point your ERP base URL here and keep the same paths. Ctrl+C to stop.'));
      console.log(footer());
    } catch (e) {
      console.error(`Cannot start server: ${(e as Error).message}`);
      process.exitCode = EXIT_USAGE;
    }
  });

program
  .command('mcp')
  .description('Start the MCP server (stdio) exposing DI Doctor tools to AI assistants.')
  .action(async () => {
    const { runStdio } = await import('@di-doctor/mcp');
    await runStdio();
  });

program
  .command('rules')
  .description('List every validation rule with its spec reference and FBR error code.')
  .option('--markdown', 'print as a Markdown table (used to generate docs/rules.md)')
  .action((o: { markdown?: boolean }) => {
    if (program.opts()['json']) {
      console.log(JSON.stringify(RULES.map(({ id, title, specRef, level, errorCode }) => ({ id, title, specRef, level, errorCode: errorCode ?? null })), null, 2));
    } else if (o.markdown) {
      console.log('# Validation rules');
      console.log('');
      console.log(`Generated by \`pnpm docs:rules\` from the rule registry. Spec v${SPEC_VERSION}. Do not edit by hand.`);
      console.log('');
      console.log('Every rule returns `pass`, `fail` or `cannot-verify`. Failures are `error` (exit code 1, simulator rejects) or `warning` (reported only). The code column is the FBR error code the spec ties to the failure; the simulator emits it.');
      console.log('');
      console.log('| ID | Level | Rule | Spec | Code |');
      console.log('|---|---|---|---|---|');
      for (const r of RULES) console.log(`| ${r.id} | ${r.level} | ${r.title.replace(/\|/g, '\\|')} | ${r.specRef.replace(/^spec v[\d.]+ /, '')} | ${r.errorCode ?? ''} |`);
    } else {
      for (const r of RULES) console.log(`${bold(r.id)}  ${r.title}\n      ${dim(`${r.level} · ${r.specRef}${r.errorCode ? ` · code ${r.errorCode}` : ''}`)}`);
      console.log(footer());
    }
    process.exitCode = EXIT_OK;
  });

program
  .command('codes')
  .description('List every FBR error code DI Doctor can explain.')
  .option('--side <side>', 'sale | purchase | all', 'all')
  .action((o: { side: string }) => {
    const list = listErrorCodes().filter((c) => o.side === 'all' || c.side === o.side);
    if (program.opts()['json']) console.log(JSON.stringify(list, null, 2));
    else {
      for (const c of list) console.log(`${bold(c.code)}  ${c.title}${c.side === 'purchase' ? dim('  (purchase)') : ''}`);
      console.log(dim(`${list.length} codes. Run \`di-doctor explain <code>\` for details.`));
      console.log(footer());
    }
    process.exitCode = EXIT_OK;
  });

program.parse();
