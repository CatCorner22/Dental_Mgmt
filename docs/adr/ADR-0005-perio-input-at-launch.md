# ADR 5: Perio input at launch

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 5, and the design and security documents this decision affects.

## Options

(a) voice from day one (depends on an on-device or BAA speech engine that does not exist yet); (b) keyboard grammar first, voice layered on through the existing engine seam

## Recommendation

(b), with the speech-engine decision started in Phase 0

## Why

Hygienist speed must not depend on an unbuilt engine; the browser recognizer sends audio off-device and cannot hear PHI
