# ADR 001: Keep the initial system in a monorepo

- **Status:** Accepted
- **Date:** 2026-08-27

## Context

The project has multiple runtime components: an HTTP API, a background worker, a fake payment gateway, and a small web UI. They share TypeScript contracts and evolve around one checkout workflow.

Splitting those components into separate repositories would add release, dependency, and local-development overhead before any independent team or deployment lifecycle exists.

## Decision

Use a pnpm workspace monorepo with runtime applications under `apps/` and shared code under `packages/`.

Runtime boundaries remain explicit even though source control is shared.

## Consequences

### Positive

- one command installs all dependencies
- shared contracts are version-consistent
- CI can validate the complete system
- local setup is easier to understand
- architectural boundaries remain visible without repository sprawl

### Negative

- CI may eventually need path-based optimization
- independent deployment permissions are not represented by repository boundaries

If those costs become real rather than hypothetical, this decision can be revisited.
