# @helios/web

The modern Next.js + TypeScript web dashboard for the HELIOS platform.

## Responsibilities

- Render the interactive developer interface for HELIOS.
- Provide drag-and-drop specification uploads and interactive AST visualization.
- Display deterministic security findings, compliance score breakdowns, and API diff visualizations.
- Provide an interactive copilot panel for Ollama-backed AI assistance with AST validation safeguards.

## Architecture Guidelines

- All core logic lives in `packages/*`. `apps/web` is strictly a presentation and API consumption layer.
- Must run cleanly in local dev mode via `pnpm --filter @helios/web dev`.
