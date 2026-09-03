# ADR 25: Patient communications during the Phase 2 conversion

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 25, and the design and security documents this decision affects.

## Options

(a) first-party confirmations and reminders in Phase 2 through a BAA-covered messaging vendor, comms-partner API in Phase 5; (b) a schedule read and confirmation write-back API for one comms partner (Weave, RevenueWell, or NexHealth class) in Phase 2 instead

## Recommendation

(a)

## Why

A practice converting in Phase 2 already depends on a comms vendor that reads and writes its schedule; losing confirmations is a must-have regression and a no-show cost. First-party reminders are small; a partner API is a second integration and a second BAA on the critical path
