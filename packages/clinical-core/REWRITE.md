# Smile Notes tests that need a rewrite after the lift

Lifting the clinical libraries while leaving the Next app and skill docs
behind fails tests that read those trees. Failures are tracked here. They
are not a reason to leave PHI-blocking rules in place.

Excluded from `vitest` in this increment (they import files that are not
in the package):

| File | What failed | Rewrite |
|---|---|---|
| `src/lib/vocab/reference-parity.test.ts` | Opens `skill/references/terminology-and-style.md` at the Smile Notes repo root | Retarget at a copied excerpt or drop once the skill docs live in this monorepo |
| `src/lib/audit/severity-style.test.ts` ("no component defines its own ramp") | Opens `src/components/builder/AuditPanel.tsx` | Keep the shared-ramp unit tests; rewrite the component-scan when `apps/pms` owns AuditPanel |

The rest of the lifted suite (1,358 tests) passed on the first run. PHI
outbound-boundary invert remains a Phase 3 rewrite, not an Increment 0.1
change to `runTextAudit`.
