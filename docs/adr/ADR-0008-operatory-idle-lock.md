# ADR 8: Operatory idle lock

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 8, and the design and security documents this decision affects.

## Options

5 / 10 / 15 minutes

## Recommendation

10 minutes on the operatory device profile with a server-side session kill; 30 minutes at desks; 12-hour absolute; PIN re-entry restores the exact caret position; hard author switch wipes local state

## Why

5 minutes fires mid-procedure on gloved staff and turns focus complaints into session-loss complaints; 15 exceeds what most HIPAA risk-analysis reviewers accept for shared clinical devices; the current dismissible client overlay is not a control
