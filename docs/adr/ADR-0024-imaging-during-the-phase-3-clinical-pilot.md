# ADR 24: Imaging during the Phase 3 clinical pilot

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 24, and the design and security documents this decision affects.

## Options

(a) DICOM/JPEG import with a reference viewer in Phase 3 so images and interpretations live in the encounter, sensor bridge in Phase 4; (b) imaging stays in the incumbent during Phase 3 with an explicit interpretation-linking workaround and a dated exit

## Recommendation

(a)

## Why

A clinical record without images is not a chart of record, and Tennessee counts radiographs and interpretations as record components; (b) recreates the two-application hop the merge exists to remove
