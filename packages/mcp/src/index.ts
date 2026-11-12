export { createDiDoctorServer } from './server.js';

/** Starts the server on stdio. Used by `di-doctor mcp`. */
export async function runStdio(): Promise<void> {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { createDiDoctorServer } = await import('./server.js');
  const server = createDiDoctorServer();
  await server.connect(new StdioServerTransport());
}
