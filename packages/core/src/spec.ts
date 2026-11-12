import specVersion from './data/spec-version.json' with { type: 'json' };

export const SPEC_VERSION = specVersion.version;
export const SPEC_URL = specVersion.url;

/** Builds a citation string like "spec v1.12 §4.1.2". */
export const ref = (section: string): string => `spec v${SPEC_VERSION} §${section}`;
