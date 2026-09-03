# ADR 10: Offline behavior

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 10, and the design and security documents this decision affects.

## Options

(a) read-only degraded mode (schedule, alerts, chart summaries) in v1; (b) plus queued clinical-note and perio capture reconciled on reconnect

## Recommendation

(a) in v1, (b) designed for v2 with measured outage minutes as the input

## Why

No cloud PMS documents any offline mode, so (a) already leads; queued writes on shared devices are a PHI residue risk the privacy panels flagged
