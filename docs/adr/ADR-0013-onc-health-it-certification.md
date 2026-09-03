# ADR 13: ONC health-IT certification

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 13, and the design and security documents this decision affects.

## Options

(a) pursue before API v1; (b) do not pursue; publish OpenAPI v1 and a FHIR R4 subset without certification; (c) defer to Phase 4

## Recommendation

Decide and record before API v1 ships in Phase 2; default (b) unless a payer, group, or state program requires certification

## Why

Certification is a regulatory project with real cost (HTI-series obligations, developer information-blocking exposure) and little dental-market pull today, but the API and export shape (FHIR resources, USCDI fields) are cheaper to choose correctly once than to retrofit; as counsel you are best placed to make this call
