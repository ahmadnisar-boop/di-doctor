# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Repository prepared for public release: design notes replace the private planning document, per-package READMEs, complete package metadata, code of conduct, Prettier formatting, CI on Node 20/22/24, pinned-major GitHub Actions, idempotent release workflow.

## [0.1.0] - 2026-11-12

First release. Based on the FBR/PRAL *Technical Specification for DI API* v1.12 (July 2025).

### Added
- `validate`: 29 offline pre-flight rules (16 header, 13 item), each citing its spec section and returning `pass`, `fail` or `cannot-verify`. Sales-tax arithmetic is checked only for sale types whose base the spec defines; everything else is reported honestly as cannot-verify.
- `check-response`: safe reading of DI API responses, including the case where the top-level status code says valid while an item failed, null item lists, and HTTP 401/500.
- `explain`: plain-English cause and fix for all 86 sales error codes and 22 purchase error codes in the spec.
- `scenarios`: required sandbox scenarios for every business activity and sector, with the expected sale type.
- `simulate` and `serve`: a local sandbox simulator producing FBR-shaped responses with the real endpoint paths, Bearer auth, and optional simulated outages and latency.
- MCP server (`di-doctor mcp`) with five read-only tools.
- JSON Schema 2020-12 for the invoice payload and the API response.
- `rules` and `codes` commands, `--json` output, stdin support, exit codes 0/1/2.
- Documentation: integration guide, simulator fidelity statement, generated rules reference, and notes on 22 inconsistencies found in the spec.

[Unreleased]: https://github.com/ahmadnisar-boop/di-doctor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ahmadnisar-boop/di-doctor/releases/tag/v0.1.0
