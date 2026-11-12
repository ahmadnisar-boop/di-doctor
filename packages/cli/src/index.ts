/**
 * Library entry point of the `di-doctor` package: everything from core, so `import { validateInvoice } from 'di-doctor'` works.
 * The relative path (instead of `@di-doctor/core`) lets tsup inline both the code and the type declarations,
 * so the published package is self-contained.
 */
export * from '../../core/src/index.js';
