# ADR 21: Tenancy and package layout

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 21, and the design and security documents this decision affects.

## Options

(a) shared database with RLS + pnpm-workspaces monorepo (`apps/pms`, `packages/clinical-core`, `controls-engine`, `db`, `verifier`); (b) shared database with everything in one Next app under `src/lib`; (c) schema-per-tenant or database-per-tenant

## Recommendation

(a)

## Why

Shared DB with RLS as a tested backstop is the cheapest safe option and all four designs agree; the package split lets the clinical core and controls engine stay pure (`runTextAudit`, `evaluateRelease`) and be verified independently, which the byteaudit pattern already proves works in the dental repo. Schema-per-tenant is a documented later path for large groups, not a launch cost
