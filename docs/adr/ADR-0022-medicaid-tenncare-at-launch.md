# ADR 22: Medicaid (TennCare) at launch

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 22, and the design and security documents this decision affects.

## Options

(a) ship TennCare claim, prior-authorization, EPSDT, and documentation rules in Phase 2 with the first payer set; (b) exclude Medicaid-heavy practices from the launch segment, say so on the trust page, and schedule TennCare for Phase 4 after the commercial payer set is stable

## Recommendation

(b), stated publicly

## Why

Medicaid program-integrity audits are the most common enforcement exposure for small dental offices and carry documentation rules stricter than commercial payers; doing them half-way in Phase 2 reproduces the exact claims complaint the product targets. Pediatric and rural Tennessee practices are Medicaid-heavy, so (b) narrows the launch market and must be an explicit, published limitation
