import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: ['esm'],
  // Inline the workspace packages' declarations too, so the published package is self-contained.
  dts: { entry: { index: 'src/index.ts' }, resolve: [/^@di-doctor\//] },
  clean: true,
  target: 'node20',
  sourcemap: true,
  // Bundle the workspace packages so `npm install di-doctor` is self-contained.
  noExternal: [/^@di-doctor\//],
});
