import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { computeMonthPackage, isMonth, packageHash, packageRows, recordPackageExport, toCsv } from "@/lib/cpa/package";

type Body = { month?: string; format?: string };

/**
 * Exports the month-end package as JSON or CSV and records the export on
 * the chain with its hash and row count (Increment 1.34). Administrator
 * rank: an export is an egress of the practice's figures.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Body;
    const user = ctx.access.user;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const month = String(body.month ?? thisMonth);
    const format = body.format === "csv" ? "csv" : body.format === "json" || body.format === undefined ? "json" : null;
    if (!isMonth(month)) return Response.json({ error: "The month must be a calendar month (YYYY-MM)." }, { status: 400 });
    if (month > thisMonth) return Response.json({ error: "A month that has not started has no package yet." }, { status: 400 });
    if (!format) return Response.json({ error: "The format must be json or csv." }, { status: 400 });

    const { pkg, hash, rows } = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      const pkg = await computeMonthPackage(db, user.tenantId, month);
      const hash = packageHash(pkg);
      const rows = packageRows(pkg, hash);
      await recordPackageExport(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        month,
        format,
        packageHash: hash,
        rowCount: rows.length,
        entryCount: pkg.journal.entryCount,
        totalCents: pkg.journal.totalCents,
      });
      return { pkg, hash, rows };
    });
    const filename = `month-end-${month}.${format}`;
    const body_ = format === "csv" ? toCsv(rows) : JSON.stringify({ package: pkg, packageHash: hash, rows }, null, 2);
    return new Response(body_, {
      status: 200,
      headers: {
        "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "x-package-hash": hash,
        "x-package-rows": String(rows.length),
      },
    });
  },
  { minRank: "admin" }
);
