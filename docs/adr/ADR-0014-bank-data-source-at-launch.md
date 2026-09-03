# ADR 14: Bank data source at launch

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 14, and the design and security documents this decision affects.

## Options

(a) aggregator feed (Plaid or Finicity class) in Phase 1 with OFX/CSV statement import as fallback; (b) statement import only in Phase 1, aggregator later

## Recommendation

Both in Phase 1: build the statement importer first (it is the fallback forever and needs no vendor), pursue the aggregator agreement and BAA in parallel, and enable the feed per tenant when signed

## Why

The reconciliation screen must go green from independent data on day one of the pilot; the aggregator relationship, its BAA, and small-community-bank coverage are outside the team's control, so the importer is the floor and the feed is the ceiling
