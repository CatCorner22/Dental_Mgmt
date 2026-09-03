# ADR 1: Base branch for the empty `Dental_Mgmt` repo

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 1, and the design and security documents this decision affects.

## Options

(a) I create `main` from a README-only initial commit and open the draft PR against it; (b) you create `main` first

## Recommendation

(a). **Approving this plan is the permission for that one push to `main`**; nothing else is ever pushed anywhere but the feature branch

## Why

A PR needs a base; the branch instruction otherwise forbids pushing anywhere but the feature branch
