# ADR 4: Launch customer and pilot shape

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 4, and the design and security documents this decision affects.

## Options

(a) Cornerstone, **all three locations under one tenant**, for the Phase 1 financial layer and Phase 2 conversion, with a 1–3 dentist practice recruited through the D.8 interviews for the Phase 3 clinical pilot; (b) recruit a true single-location 1–3 dentist practice for every phase and keep Cornerstone for the Phase 5 group tier; (c) one Cornerstone location only

## Recommendation

(a), never (c)

## Why

Cornerstone (about 30 staff, three sites, on Curve Hero) exercises SoD and location scoping early and is the only partner in hand, but it is larger than the target segment, so the clinical pilot needs a small practice too. The critic showed that (c) is unsound: office is a per-encounter property in this practice (staff rotate; patients visit any site), so a one-location shadow ledger would produce variances that are pilot-boundary artifacts, not control findings. Ascend's "DSO-skewed, not ready for the hustle" critique is what happens when group features pull the scope; the roadmap's durations assume the small practice, not Cornerstone, drives the Phase 3 design
