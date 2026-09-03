# ADR 6: Owner alerting

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 6, and the design and security documents this decision affects.

## Options

(a) weekly digest only; (b) digest plus a small hard-event push channel

## Recommendation

(b), six named events: after-hours refund, retroactive-dated entry, waived dual control, deposit variance over threshold, audit-chain verification failure, new device on a financial role

## Why

Batching is right for patterns; those six events are the ones the embezzlement research says are caught by chance today, and they are the only push notifications the PMS ever sends
