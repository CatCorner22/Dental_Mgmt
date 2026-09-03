# ADR 7a: Runtime SoD hard block on reconciliation clearance in tiny offices

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 7a, and the design and security documents this decision affects.

## Options

(a) hard refuse: whoever posted payments or prepared the deposit that day cannot clear that day's variance, no exceptions; (b) degrade to owner-only clearance when no other eligible person exists, and record the degraded state as a finding; (c) detect-and-decide only, no runtime block

## Recommendation

(b)

## Why

Keeps the control alive (someone other than the poster looks at the bank) without forcing the owner into daily clerical work or getting the control disabled; (c) would make the reconciliation screen recorded, not enforced. Only four pairs are blocked at runtime at all: this one, self-approval of vendor master changes, self-approval of payroll, and requester = approver
