/**
 * MCP server exposing DI Doctor's pure functions as tools. Read-only, no network, no file I/O.
 * Inputs accept either a JSON object or a JSON string so assistants can pass payloads either way.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  checkResponse,
  validateInvoice,
  explainCode,
  explainResponse,
  listScenarios,
  simulate,
  ACTIVITIES,
  SECTORS,
  SPEC_VERSION,
  SPEC_URL,
} from '@di-doctor/core';

const jsonInput = z
  .union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.string()])
  .describe('A JSON object, or a JSON string.');
const environment = z.enum(['sandbox', 'production']);

function parseJson(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });

export function createDiDoctorServer(): McpServer {
  const server = new McpServer(
    { name: 'di-doctor', version: '0.1.0' },
    {
      instructions: `Unofficial toolkit for Pakistan FBR Digital Invoicing (spec v${SPEC_VERSION}). Technical checks only, never tax advice. Verdicts are pass, fail or cannot-verify; never guess beyond them. Official document: ${SPEC_URL}`,
    },
  );

  server.registerTool(
    'di_check_response',
    {
      title: 'Check a DI API response',
      description:
        'Read an FBR Digital Invoicing API response safely. Returns overall valid/invalid/unknown, the FBR invoice number when valid, per-item statuses, problems and warnings. Catches the case where the top-level statusCode is "00" but an item failed.',
      inputSchema: {
        response: jsonInput,
        httpStatus: z
          .number()
          .int()
          .optional()
          .describe('HTTP status code received, if known (401 and 500 are handled specially).'),
      },
    },
    async ({ response, httpStatus }) =>
      text(checkResponse(parseJson(response), httpStatus !== undefined ? { httpStatus } : {})),
  );

  server.registerTool(
    'di_validate_invoice',
    {
      title: 'Validate an invoice payload offline',
      description:
        'Run every documented pre-flight rule on an invoice JSON before sending it to FBR. Each finding has a rule id, verdict (pass / fail / cannot-verify), severity, path, message, fix and spec reference.',
      inputSchema: {
        invoice: jsonInput,
        environment,
        taxTolerance: z
          .number()
          .min(0)
          .optional()
          .describe('Allowed sales-tax rounding difference in PKR (default 1.00).'),
        activity: z
          .string()
          .optional()
          .describe(
            `Seller business activity, one of: ${ACTIVITIES.join(', ')}. With sector, enables the scenario-applicability check.`,
          ),
        sector: z
          .string()
          .optional()
          .describe(`Seller sector, one of: ${SECTORS.join(', ')}.`),
      },
    },
    async ({ invoice, environment: env, taxTolerance, activity, sector }) =>
      text(
        validateInvoice(parseJson(invoice), {
          environment: env,
          ...(taxTolerance !== undefined ? { taxTolerance } : {}),
          ...(activity !== undefined ? { activity } : {}),
          ...(sector !== undefined ? { sector } : {}),
        }),
      ),
  );

  server.registerTool(
    'di_explain_error',
    {
      title: 'Explain an FBR error code or response',
      description:
        'Plain-English explanation of an FBR DI error code (e.g. "0052"), or of every error code found in a full response. Covers all 86 sales and 22 purchase codes in the spec; unknown codes are reported honestly.',
      inputSchema: {
        code: z.string().optional().describe('Error code such as 0052.'),
        response: jsonInput.optional().describe('A full DI API response to explain instead of a single code.'),
      },
    },
    async ({ code, response }) => {
      if (code !== undefined) return text([explainCode(code)]);
      if (response !== undefined) return text(explainResponse(parseJson(response)));
      return text({ error: 'Provide either code or response.' });
    },
  );

  server.registerTool(
    'di_list_scenarios',
    {
      title: 'List sandbox scenarios for a business',
      description: `Which sandbox scenarios (SN001–SN028) a taxpayer must pass, from the seller's business activity and sector (spec §10), with each scenario's expected sale type. Activities: ${ACTIVITIES.join(', ')}. Sectors: ${SECTORS.join(', ')}.`,
      inputSchema: { activity: z.string(), sector: z.string() },
    },
    async ({ activity, sector }) => text(listScenarios(activity, sector)),
  );

  server.registerTool(
    'di_simulate_response',
    {
      title: 'Simulate the FBR sandbox response',
      description:
        'Return the response the FBR DI API would most likely give for this payload, in the exact FBR shape, using only the rules the spec documents. Diagnostics list what the simulator cannot judge. Passing here does not guarantee FBR acceptance.',
      inputSchema: {
        invoice: jsonInput,
        environment,
        endpoint: z
          .enum(['post', 'validate'])
          .optional()
          .describe('post issues invoice numbers; validate does not. Default post.'),
        strictShape: z.boolean().optional().describe('Omit the _simulator metadata.'),
      },
    },
    async ({ invoice, environment: env, endpoint, strictShape }) =>
      text(
        simulate(parseJson(invoice), {
          environment: env,
          endpoint: endpoint ?? 'post',
          now: Date.now(),
          ...(strictShape ? { strictShape: true } : {}),
        }),
      ),
  );

  return server;
}
