# ADR 2: What ships first after the foundation

**Status:** Accepted (owner, 2026-09-14)

The product identity is the full PMS from the first public page. Phase 1 is the money layer of that PMS, run beside the incumbent as a report-import shadow ledger — not a separately named controls product. See `docs/17-competitive-enhancement-review.md`.

## Context

See `docs/10-decisions-for-owner.md`, row 2, and the design and security documents this decision affects.

## Options

(a) clinical record first (notes, odontogram, perio); (b) chairside UX first with a research phase; (c) money and controls first as a financial layer run beside the incumbent PMS

## Recommendation

(c) in a **report-import** shape: the practice keeps posting in its incumbent; the new product imports day sheets, deposits, and the staff roster nightly, reconciles to the bank, detects SoD conflicts from roles, and surfaces variances and anomalies. No double entry. Enforcement waits for the ledger to be authoritative

## Why

The readable ledger and enforced controls are the unproven bet and the differentiator; the clinical core is the lowest-risk code (already built, 201 test files). Testing the thesis at about month 6 with a sellable standalone (priced in the $39–$115/month controls band) beats testing it at month 12 or later. The feasibility judge favored this order; the intuitiveness judge warned that dual entry is pilot poison, so import replaces entry
