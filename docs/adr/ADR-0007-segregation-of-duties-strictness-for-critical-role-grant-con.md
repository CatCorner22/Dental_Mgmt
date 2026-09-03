# ADR 7: Segregation-of-duties strictness for critical role-grant conflicts

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 7, and the design and security documents this decision affects.

## Options

(a) the owner alone may accept residual risk by recording a decision with a review date in the same request; (b) the grant sits pending until a distinct second admin decides; (c) a per-tenant switch between the two, defaulting to (a)

## Recommendation

(c)

## Why

A one-owner, one-office-manager practice cannot operate under a mandatory-second-admin rule (the owner is the only other admin), so the strict mode would be disabled in week one; groups and larger practices should be able to require it. Either way the decision is append-only, attributed, and surfaces on the owner home
