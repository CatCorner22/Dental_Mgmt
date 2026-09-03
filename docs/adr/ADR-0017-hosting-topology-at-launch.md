# ADR 17: Hosting topology at launch

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 17, and the design and security documents this decision affects.

## Options

(a) single region + cross-region backups + point-in-time recovery + a documented failover runbook, promoted to two-region active/passive at Phase 4; (b) two regions active/passive from Phase 0

## Recommendation

(a)

## Why

Two-region operations is a burden a solo team cannot carry in Phase 0; the market's outage complaint is answered first by the status page, restore drills, and read-only degraded mode; redundancy is promoted when there are paying practices and an SLA with credits to honor
