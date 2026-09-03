# ADR 19: Clearinghouse partner

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 19, and the design and security documents this decision affects.

## Options

DentalXChange / Vyne Dental / Change Healthcare

## Recommendation

Choose one in Phase 1 (contract, BAA, certification suite) behind an adapter interface with exactly one implementation; never build payer connectivity; choose the claim-attachment vendor (NEA FastAttach or Vyne) in the same decision, filtered by breach history and incident-notification terms

## Why

Insurance is the top buying criterion and the largest build risk; EDI enrollment takes up to 30 business days per payer per practice and must start a full phase before claims ship. The vendor turns on pricing, Tennessee payer coverage, attachment support (Vyne owns NEA FastAttach), and certification friction: a commercial negotiation, not an architecture question
