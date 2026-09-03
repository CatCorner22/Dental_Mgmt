# ADR 3: Ledger model

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 3, and the design and security documents this decision affects.

## Options

(a) single-entry append-only postings with explicit payment allocations and GL bucket tags; (b) full double-entry journal with debit/credit lines

## Recommendation

(a), with the domain-model design's database-enforced invariants (append-only role, reversal must mirror an unreversed original, allocations never exceed payment, approval id required above threshold, balances only as views)

## Why

Readability by a front-desk temp is the whole point; debit/credit vocabulary must never reach a screen. Confirm with your CPA before Phase 2
