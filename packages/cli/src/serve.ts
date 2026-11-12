/**
 * Local DI sandbox simulator server. Same paths as FBR (spec v1.12 §4.1.1, §4.1.2, §4.2.1, §4.2.2), Bearer auth (§3.1),
 * HTTP 401/500 behaviour (§4.1.6). Uses node:http only. Core stays pure; this file is the only network code in the CLI.
 */
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { simulate, SPEC_VERSION } from '@di-doctor/core';
import type { Environment } from '@di-doctor/core';

export interface ServeOptions {
  port?: number;
  host?: string;
  /** Require this exact Bearer token. Default: any non-empty token is accepted. */
  token?: string;
  /** Fraction of invoice requests (0–1) answered with HTTP 500, for retry-logic testing. */
  chaos?: number;
  /** Artificial delay in ms before answering. */
  latency?: number;
  /** Drop the `_simulator` metadata from bodies. */
  strictShape?: boolean;
  activity?: string;
  sector?: string;
  taxTolerance?: number;
  now?: () => number;
  random?: () => number;
  log?: (line: string) => void;
}

const ROUTES: Record<string, { endpoint: 'post' | 'validate'; environment: Environment }> = {
  '/di_data/v1/di/postinvoicedata_sb': { endpoint: 'post', environment: 'sandbox' },
  '/di_data/v1/di/validateinvoicedata_sb': { endpoint: 'validate', environment: 'sandbox' },
  '/di_data/v1/di/postinvoicedata': { endpoint: 'post', environment: 'production' },
  '/di_data/v1/di/validateinvoicedata': { endpoint: 'validate', environment: 'production' },
};

export const ROUTE_PATHS = Object.keys(ROUTES);

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createServer(opts: ServeOptions = {}): Server {
  const log = opts.log ?? ((line: string) => console.log(line));
  const now = opts.now ?? Date.now;
  const random = opts.random ?? Math.random;

  return createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/_health') {
      send(res, 200, { ok: true, simulator: 'di-doctor', specVersion: SPEC_VERSION, routes: ROUTE_PATHS });
      return;
    }
    const route = ROUTES[path];
    if (!route) {
      send(res, 404, {
        error: `Unknown path ${path}. The simulator serves: ${ROUTE_PATHS.join(', ')} and GET /_health.`,
      });
      return;
    }
    if (req.method !== 'POST') {
      send(res, 405, { error: `Use POST for ${path}.` });
      return;
    }

    // Spec §3.1: Bearer token in the Authorization header; §4.1.6: 401 otherwise.
    const auth = req.headers.authorization ?? '';
    const m = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    const token = m?.[1];
    if (!token || (opts.token !== undefined && token !== opts.token)) {
      log(`${path} → 401 (missing or wrong Bearer token)`);
      send(res, 401, {
        error: 'Unauthorized',
        hint: 'Send "Authorization: Bearer <token>". The real API routes sandbox vs production by the token; this simulator routes by path.',
      });
      return;
    }

    if (opts.latency) await sleep(opts.latency);
    if (opts.chaos && random() < opts.chaos) {
      log(`${path} → 500 (chaos)`);
      send(res, 500, { error: 'Internal Server Error (simulated outage; retry with the same payload)' });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      log(`${path} → 400 (body is not JSON)`);
      send(res, 400, { error: 'Request body is not valid JSON.' });
      return;
    }

    const r = simulate(payload, {
      environment: route.environment,
      endpoint: route.endpoint,
      now: now(),
      ...(opts.strictShape ? { strictShape: true } : {}),
      ...(opts.taxTolerance !== undefined ? { taxTolerance: opts.taxTolerance } : {}),
      ...(opts.activity !== undefined ? { activity: opts.activity } : {}),
      ...(opts.sector !== undefined ? { sector: opts.sector } : {}),
    });
    const codes = r.errors.map((e) => `${e.ruleId}${e.errorCode ? `/${e.errorCode}` : ''}`).join(', ');
    log(
      `${path} → ${r.result.toUpperCase()}${codes ? ` [${codes}]` : ''}${r.diagnostics.length ? ` (${r.diagnostics.length} diagnostics)` : ''}`,
    );
    send(res, r.httpStatus, r.body);
  });
}

export function listen(server: Server, opts: ServeOptions = {}): Promise<{ port: number; host: string }> {
  const host = opts.host ?? '127.0.0.1';
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 8787, host, () => {
      const addr = server.address();
      resolve({ port: typeof addr === 'object' && addr ? addr.port : (opts.port ?? 8787), host });
    });
  });
}
