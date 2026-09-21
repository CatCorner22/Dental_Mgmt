import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { computeMonthPackage, packageHash, packageRows } from "./package";
import { activeMappings, decideMapping, listMappings, pendingMappings, proposeMapping } from "./mappings";
import { recordDecision } from "../controls/decisions";
import { SOLE_DECIDER_CONTROL } from "./soleDecider";

/**
 * GL mappings under maker-checker on the seeded Ridgeview tenant, as app_rw
 * (Increment 1.35): a proposal refused for bad input, a second proposal on
 * the same line refused, self-approval refused, a different person's approval
 * putting the account on the journal line, a rejection leaving the line
 * unmapped, and the table refusing an edit or a delete. Skipped without
 * PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;
const front = DEV_USERS[1]!;
const asOwner = { id: owner.id, name: owner.displayName };
const asFront = { id: front.id, name: front.displayName };
const month = new Date().toISOString().slice(0, 7);

describe.skipIf(!adminUrl)("GL mappings (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses an unknown bucket, kind, or side and an empty account, writing nothing", async () => {
    const bad = await tx((d) =>
      proposeMapping(d, { tenantId, actor: asOwner, glBucket: "moon", kind: "levitation", side: "sideways", accountCode: "", accountName: "", note: "" })
    );
    expect(bad).toMatchObject({ ok: false, status: 400 });
    if (bad.ok) return;
    expect(bad.errors).toHaveLength(5);
    expect(bad.errors[2]).toBe("The side must be debit or credit.");
    expect(await tx((d) => listMappings(d, tenantId))).toEqual([]);
  });

  it("takes one proposal per line, refuses a second, and refuses the proposer's own approval", async () => {
    const first = await tx(
      (d) => proposeMapping(d, { tenantId, actor: asFront, glBucket: "patient_ar", kind: "write_off", accountCode: "6100", accountName: "Courtesy write-offs", side: "debit", note: "Owner's chart." }),
      front
    );
    expect(first).toMatchObject({ ok: true });
    if (!first.ok) return;
    expect(first.mapping).toMatchObject({ status: "proposed", reasonCode: "*", proposedByName: front.displayName, decidedById: null, supersedesId: null });

    const second = await tx((d) =>
      proposeMapping(d, { tenantId, actor: asOwner, glBucket: "patient_ar", kind: "write_off", accountCode: "6199", accountName: "Other", side: "debit" })
    );
    expect(second).toMatchObject({ ok: false, status: 409 });
    if (second.ok) return;
    expect(second.errors[0]).toBe(`${front.displayName} has already proposed a mapping for this line; that proposal needs a decision first.`);

    const selfApprove = await tx((d) => decideMapping(d, { tenantId, actor: asFront, mappingId: first.mapping.id, decision: "approved" }), front);
    // Increment 1.75: the refusal now also counts the people who could decide
    // it, because the sentence on its own is useless to a practice that has
    // none. Ridgeview has one administrator, and the proposer here is not it.
    expect(selfApprove).toMatchObject({
      ok: false,
      status: 403,
      errors: ["You proposed this mapping; a different person must approve or reject it. 1 other administrator can."],
    });
    // The database refuses it too, whatever the service does.
    await expect(
      db.admin.query("UPDATE gl_mappings SET status = 'approved', decided_by_id = proposed_by_id, decided_by_name = 'x', decided_at = now() WHERE id = $1", [first.mapping.id])
    ).rejects.toThrow(/gl_mappings_maker_ne_checker/);
    expect((await tx((d) => pendingMappings(d, tenantId))).map((m) => m.id)).toEqual([first.mapping.id]);
  });

  it("puts the account on the journal line once a different person approves, and moves the package hash", async () => {
    const pending = (await tx((d) => pendingMappings(d, tenantId)))[0]!;
    const before = await tx((d) => computeMonthPackage(d, tenantId, month));
    const beforeHash = packageHash(before);
    expect(before.mappings).toEqual({ approved: 0, pending: 1, unmappedLines: before.journal.rows.length, decidedAlone: 0 });
    expect(before.tieOut.find((t) => t.key === "journal_mapped")).toMatchObject({ holds: false });
    expect(before.tieOut.find((t) => t.key === "journal_mapped")!.detail).toMatch(/1 proposal waiting for a second person/);

    const approved = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: pending.id, decision: "approved" }));
    expect(approved).toMatchObject({ ok: true });
    if (!approved.ok) return;
    expect(approved.mapping).toMatchObject({ status: "approved", decidedByName: owner.displayName });
    expect(approved.mapping.decidedAt).not.toBeNull();

    const chain = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 AND kind IN ('gl_mapping.proposed', 'gl_mapping.decided') ORDER BY seq",
      [tenantId]
    );
    expect(chain.rows.map((r) => r.kind)).toEqual(["gl_mapping.proposed", "gl_mapping.decided"]);
    expect(chain.rows[1].payload).toMatchObject({ mappingId: pending.id, decision: "approved", accountCode: "6100", proposedById: front.id });

    const after = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(after.mappings).toMatchObject({ approved: 1, pending: 0 });
    const writeOffLine = after.journal.rows.find((r) => r.bucket === "patient_ar" && r.kind === "write_off");
    if (writeOffLine) {
      expect(writeOffLine.account).toEqual({ code: "6100", name: "Courtesy write-offs", side: "debit" });
      expect(packageRows(after, packageHash(after)).find((r) => r.key === "patient_ar|write_off")?.label).toMatch(/→ 6100 Courtesy write-offs \(debit\)$/);
    }
    expect(packageHash(after)).not.toBe(beforeHash);
    expect((await tx((d) => activeMappings(d, tenantId))).size).toBe(1);

    // Deciding twice is refused, and the row cannot be edited or deleted.
    const again = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: pending.id, decision: "rejected" }));
    expect(again).toMatchObject({ ok: false, status: 409 });
    if (again.ok) return;
    expect(again.errors[0]).toBe(`This proposal was already approved by ${owner.displayName}.`);
    await expect(db.admin.query("UPDATE gl_mappings SET account_code = '9999' WHERE id = $1", [pending.id])).rejects.toThrow(/already decided|append-only/);
    await expect(db.admin.query("DELETE FROM gl_mappings WHERE id = $1", [pending.id])).rejects.toThrow(/append-only/);
    const missing = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: owner.id, decision: "approved" }));
    expect(missing).toMatchObject({ ok: false, status: 404 });
  });

  it("supersedes an approved mapping with the next proposal, and a rejection leaves the line as it was", async () => {
    const current = (await tx((d) => activeMappings(d, tenantId))).get("patient_ar|write_off|*")!;
    const next = await tx(
      (d) => proposeMapping(d, { tenantId, actor: asFront, glBucket: "patient_ar", kind: "write_off", accountCode: "6120", accountName: "Write-offs, revised", side: "debit" }),
      front
    );
    expect(next).toMatchObject({ ok: true });
    if (!next.ok) return;
    expect(next.mapping.supersedesId).toBe(current.id);
    // Until it is approved, the old mapping still governs.
    expect((await tx((d) => activeMappings(d, tenantId))).get("patient_ar|write_off|*")?.accountCode).toBe("6100");

    const rejected = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: next.mapping.id, decision: "rejected" }));
    expect(rejected).toMatchObject({ ok: true });
    expect((await tx((d) => activeMappings(d, tenantId))).get("patient_ar|write_off|*")?.accountCode).toBe("6100");
    expect(await tx((d) => pendingMappings(d, tenantId))).toEqual([]);
    expect((await tx((d) => listMappings(d, tenantId))).map((m) => m.status).sort()).toEqual(["approved", "rejected"]);
  });
});

/**
 * The practice that has only one person who may decide (Increment 1.75).
 *
 * Ridgeview's one administrator is the owner, and this product has no way to
 * appoint a second: no route writes `users.role`. So the owner proposing a
 * mapping is a mapping nobody may decide, every line stays unmapped, and no
 * month closes — which is the state every single-administrator practice's
 * first month-end lands in, not an edge case.
 */
describe.skipIf(!adminUrl)("deciding alone (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2], as = owner) {
    return withTenantTransaction(tenantId, as.id, fn, env);
  }

  // A bucket and kind this month's journal actually carries, so the count the
  // accountant reads is over mappings the month's own figures were read
  // through. A mapping in force that no line used is not a fact about the
  // month, and `computeMonthPackage` deliberately does not count it.
  const propose = (accountCode: string) =>
    tx((d) =>
      proposeMapping(d, {
        tenantId,
        actor: asOwner,
        glBucket: "patient_ar",
        kind: "patient_payment",
        accountCode,
        accountName: "Patient receivables",
        side: "credit",
      })
    );

  // Inside `MAX_REVIEW_DAYS`: a decision that stood for a century would not be
  // a decision with a review date.
  const reviewDay = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  const license = (kind: "accept_residual" | "monitor" = "accept_residual", reviewBy = reviewDay) =>
    tx((d) =>
      recordDecision(d, {
        tenantId,
        actor: asOwner,
        subjectKind: "control",
        subjectId: SOLE_DECIDER_CONTROL,
        kind,
        note: "This practice has one administrator and no way to appoint another.",
        reviewBy,
      })
    );

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses the sole administrator their own proposal, and names the act rather than a person", async () => {
    const proposed = await propose("1050");
    expect(proposed).toMatchObject({ ok: true });
    if (!proposed.ok) return;

    const refused = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: proposed.mapping.id, decision: "approved" }));
    expect(refused).toMatchObject({ ok: false, status: 403 });
    if (refused.ok) return;
    // Three sentences, because one is not enough: what is wrong, what to do,
    // and what this product cannot do for them.
    expect(refused.errors).toHaveLength(3);
    expect(refused.errors[0]).toBe("You proposed this mapping, and this practice has no other administrator who could decide it.");
    expect(refused.errors.join(" ")).toContain("accept-residual decision");
    expect(refused.errors.join(" ")).toContain("cannot yet appoint a second administrator");

    // And the database refuses it too, whatever the service does.
    await expect(
      db.admin.query("UPDATE gl_mappings SET status = 'approved', decided_by_id = proposed_by_id, decided_by_name = 'x', decided_at = now() WHERE id = $1", [proposed.mapping.id])
    ).rejects.toThrow(/gl_mappings_maker_ne_checker/);
  });

  it("licenses nothing on a decision that merely watches the control", async () => {
    // Monitoring records an intention and changes nothing about who may
    // decide. A licence that any decision granted would make the register a
    // switch rather than a record.
    const watched = await license("monitor");
    expect(watched).toMatchObject({ ok: true });
    const pending = (await tx((d) => pendingMappings(d, tenantId)))[0]!;
    expect(await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: pending.id, decision: "approved" }))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("lets the sole administrator decide once the practice has recorded that it has one", async () => {
    expect(await license()).toMatchObject({ ok: true });
    const pending = (await tx((d) => pendingMappings(d, tenantId)))[0]!;
    const decided = await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: pending.id, decision: "approved" }));
    expect(decided).toMatchObject({ ok: true });
    if (!decided.ok) return;
    // One pair of hands on both ends, and the row says so without a column
    // saying it: the ids it already carries are the whole of the evidence.
    expect(decided.mapping.decidedById).toBe(decided.mapping.proposedById);

    // The chain names it too, so a later reader does not have to infer it.
    const { rows } = await db.admin.query(
      "SELECT payload FROM domain_event WHERE kind = 'gl_mapping.decided' ORDER BY seq DESC LIMIT 1"
    );
    expect(rows[0].payload).toMatchObject({ decidedAlone: true });
    expect(typeof (rows[0].payload as { licensedBy?: unknown }).licensedBy).toBe("string");
  });

  it("tells the accountant, in the package the accountant receives", async () => {
    const pkg = await tx((d) => computeMonthPackage(d, tenantId, month));
    expect(pkg.mappings.decidedAlone).toBe(1);
    const mapped = pkg.tieOut.find((t) => t.key === "journal_mapped")!;
    expect(mapped.detail).toContain("decided by the person who proposed");
    expect(mapped.detail).toContain("under a recorded decision that this practice has one administrator");
    // And it rides in the export the accountant takes away.
    expect(packageRows(pkg, packageHash(pkg)).some((r) => r.key === "decided_by_one_person" && r.count === 1)).toBe(true);
  });

  it("puts the second pair of hands back when the decision is retired", async () => {
    const live = await tx((d) => recordDecision(d, {
      tenantId,
      actor: asOwner,
      subjectKind: "control",
      subjectId: SOLE_DECIDER_CONTROL,
      kind: "accept_residual",
      note: "Still one administrator, recorded again before retiring it.",
      reviewBy: reviewDay,
    }));
    expect(live).toMatchObject({ ok: true });
    if (!live.ok) return;
    const retired = await tx((d) => recordDecision(d, {
      tenantId,
      actor: asOwner,
      subjectKind: "control",
      subjectId: SOLE_DECIDER_CONTROL,
      kind: "retire",
      note: "A second administrator has joined this practice.",
      supersedesDecisionId: live.decision.id,
    }));
    expect(retired).toMatchObject({ ok: true });

    const next = await propose("1051");
    expect(next).toMatchObject({ ok: true });
    if (!next.ok) return;
    // Nothing was rewritten to make this true: the newest decision on the
    // subject is a retirement, so the register reads as undecided again and
    // the control tightens by itself.
    expect(await tx((d) => decideMapping(d, { tenantId, actor: asOwner, mappingId: next.mapping.id, decision: "approved" }))).toMatchObject({
      ok: false,
      status: 403,
    });
    await expect(
      db.admin.query("UPDATE gl_mappings SET status = 'approved', decided_by_id = proposed_by_id, decided_by_name = 'x', decided_at = now() WHERE id = $1", [next.mapping.id])
    ).rejects.toThrow(/gl_mappings_maker_ne_checker/);
  });
});
