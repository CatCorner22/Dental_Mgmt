import { CPA_SEAT_ENTITLEMENT } from "@/lib/auth/seats";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { computeMonthPackage, isMonth, listPackageExports, packageHash, PACKAGE_SCHEMA_VERSION } from "@/lib/cpa/package";
import { loadMonthClose } from "@/lib/cpa/close";

/**
 * The CPA month-end package for `month` (YYYY-MM, default the current
 * month), computed from rows on every read with its hash and the exports
 * already taken. Manager rank and above; nothing here names anyone.
 */
export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const month = new URL(req.url).searchParams.get("month") ?? thisMonth;
    if (!isMonth(month)) return Response.json({ error: "The month must be a calendar month (YYYY-MM)." }, { status: 400 });
    if (month > thisMonth) return Response.json({ error: "The package reads rows that exist; a month that has not started has none yet." }, { status: 400 });
    const { pkg, exports, close } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      pkg: await computeMonthPackage(db, user.tenantId, month),
      exports: await listPackageExports(db, user.tenantId, month),
      close: await loadMonthClose(db, user.tenantId, month),
    }));
    const hash = packageHash(pkg);
    // A frozen hash compares only against a package of the same shape. Where the
    // close was taken under an earlier schema the two are incomparable, and saying
    // "changed" would be a claim the hashes cannot support (Increment 1.43).
    const schemaChanged = close ? close.packageSchema !== PACKAGE_SCHEMA_VERSION : false;
    return Response.json({
      month,
      inProgress: month === thisMonth,
      close,
      packageSchema: PACKAGE_SCHEMA_VERSION,
      /** True when this month was closed under a different package shape, so the hashes do not compare. */
      schemaChanged,
      /** True when the rows moved after the month was closed: a correction posted since. Only meaningful within one schema. */
      changedSinceClose: close && !schemaChanged ? close.packageHash !== hash : false,
      /**
       * The two figures the close froze in their own columns, checked against the
       * package as it computes now. No schema change touches them, so this answers
       * even where the hashes cannot.
       */
      frozenFiguresHold: close
        ? pkg.journal.entryCount === close.entryCount && pkg.journal.totalCents === close.totalCents
        : true,
      package: pkg,
      packageHash: hash,
      exports,
      /** True when the rows changed after the last export of this month. */
      changedSinceLastExport: exports[0] ? exports[0].packageHash !== hash : false,
      computedAt: new Date().toISOString(),
    });
  },
  // The outside accountant reaches this and no other screen (Increment 1.49).
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
