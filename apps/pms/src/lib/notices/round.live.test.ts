import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { setAddress } from "./addresses";
import { proveAddress, sendProofCode } from "./proof";
import { lastCompleteWeek, lastRound, runNoticeRound } from "./round";
import { memoryTransport, refusingTransport, type Transport } from "./transport";

/**
 * The round that runs without anybody pressing anything (Increment 1.62).
 *
 * The rules worth proving are the two that make a schedule bearable: it does
 * not repeat itself, and it does not go quiet on a debt nobody acts on. And
 * the one that makes a schedule trustworthy: every round leaves a row, so a
 * scheduler that died never looks like a practice that owes nothing.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;

describe.skipIf(!adminUrl)("a notice round (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The round itself runs with no acting user, exactly as the CLI runs it. */
  function asRound<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, "", fn, env);
  }

  const round = async (at: Date, transport: Transport = memoryTransport()) =>
    asRound((d) =>
      runNoticeRound(d, {
        tenantId,
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport,
        at,
        pause: async () => {},
      })
    );

  const noticeRows = async () =>
    (
      await db.admin.query(
        "SELECT outcome, notice_count, attempted_at FROM notice_sends WHERE tenant_id = $1 AND kind = 'notices' ORDER BY attempted_at, id",
        [tenantId]
      )
    ).rows;

  const day = (d: string) => new Date(`2026-09-${d}T09:00:00.000Z`);

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

  it("runs, and leaves a row, before anybody has given an address at all", async () => {
    // The row is the point. A round that wrote nothing when it had nothing to
    // do would make a scheduler that died look exactly like a practice that
    // owes nothing, and telling those apart is the whole job.
    const report = await round(day("01"));
    expect(report.considered).toBe(0);
    expect(report.sent).toBe(0);
    const held = await tx((d) => lastRound(d, tenantId));
    expect(held?.roundId).toBe(report.roundId);
    expect(held?.ranAt).toBe(day("01").toISOString());
  });

  it("counts an address nobody has proved as unreachable rather than sending to it", async () => {
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview.example"));
    const report = await round(day("02"));
    expect(report.considered).toBe(1);
    expect(report.unreachable).toBe(1);
    expect(report.sent).toBe(0);
    expect((await noticeRows()).map((r) => r.outcome)).toEqual(["unreachable"]);
  });

  it("sends once the address is proved", async () => {
    const codeTransport = memoryTransport();
    await tx((d) =>
      sendProofCode(d, {
        tenantId,
        userId: owner.id,
        userName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport: codeTransport,
        pause: async () => {},
      })
    );
    const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(codeTransport.sent[0].message.body)?.[1] ?? "";
    expect(await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code))).toMatchObject({ ok: true });

    const transport = memoryTransport();
    const report = await round(day("03"), transport);
    expect(report.sent).toBe(1);
    expect(transport.sent[0].to).toBe("riley@ridgeview.example");
    expect((await noticeRows()).map((r) => r.outcome)).toEqual(["unreachable", "sent"]);
  });

  it("stays quiet the next day, because it would say exactly what it said", async () => {
    const before = (await noticeRows()).length;
    const report = await round(day("04"));
    expect(report.unchanged).toBe(1);
    expect(report.sent).toBe(0);
    // Nothing happened, so nothing is written: the round's own row carries the
    // count, which is where a reader looks for what the sender did.
    expect((await noticeRows()).length).toBe(before);
  });

  it("makes a second round in the same minute a no-op, so the schedule may be wrong", async () => {
    const before = (await noticeRows()).length;
    await round(day("04"));
    await round(day("04"));
    expect((await noticeRows()).length).toBe(before);
    // Each run still leaves its own row: three rounds happened, and a reader
    // asking "is the sender alive" gets a yes each time.
    const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM notice_rounds WHERE tenant_id = $1", [tenantId]);
    expect(rows[0].n).toBe(6);
  });

  it("says it again once a week has passed, so an ignored debt keeps knocking", async () => {
    const before = (await noticeRows()).length;
    const report = await round(day("10"));
    expect(report.sent).toBe(1);
    expect((await noticeRows()).length).toBe(before + 1);
  });

  it("does not let a failed send count as having told them", async () => {
    // Increment 1.59 made a failure visible; this keeps it from also being
    // silencing. A message the transport refused reached nobody, so it must
    // not start the clock that keeps the next round quiet.
    //
    // The 17th is a week past the last message that landed, so the round wants
    // to send and the transport refuses. The 18th is one day later: if that
    // failure counted as having told them, the round would read it as said
    // yesterday and stay quiet. It sends, because the last thing that actually
    // reached this person is still the 10th, and that is eight days old.
    const refused = await round(day("17"), refusingTransport("The provider refused it.", "permanent"));
    expect(refused.failed).toBe(1);
    expect(refused.sent).toBe(0);
    const next = await round(day("18"));
    expect(next.sent).toBe(1);
    expect(next.unchanged).toBe(0);
  });

  it("leaves somebody who withdrew out of the round entirely", async () => {
    // They decided that. Counting them among the people this round could not
    // reach would file a decision as a failure.
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, null));
    const report = await round(day("19"));
    expect(report.considered).toBe(0);
    expect(report.unreachable).toBe(0);
  });

  it("records the round on the chain with nobody as its actor", async () => {
    const { rows } = await db.admin.query(
      "SELECT actor_user_id, payload FROM domain_event WHERE tenant_id = $1 AND kind = 'notice.round_ran' ORDER BY seq",
      [tenantId]
    );
    expect(rows.length).toBeGreaterThan(0);
    // Nobody did it, so the chain names nobody rather than borrowing a person.
    expect(rows.every((r) => r.actor_user_id === null)).toBe(true);
    const text = JSON.stringify(rows.map((r) => r.payload));
    expect(text).not.toContain("ridgeview.example");
  });

  describe("the week's digest, on its own rule", () => {
    // Increment 1.64. The digest answers a different question from the notices
    // — "has a week passed?" rather than "has anything changed?" — and its
    // counts move every day, so the change-or-stale rule would make it daily,
    // which is the noise that rule exists to prevent.
    //
    // A fresh address, proved, well clear of everything above: the cases here
    // are about the digest and must not be refused first by something else.
    const monday = new Date("2026-11-02T09:00:00.000Z");

    const digestRows = async () =>
      (
        await db.admin.query(
          "SELECT subject, body, notice_count, attempted_at FROM notice_sends WHERE tenant_id = $1 AND kind = 'digest' ORDER BY attempted_at, id",
          [tenantId]
        )
      ).rows;

    beforeAll(async () => {
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-week.example"));
      const codes = memoryTransport();
      await tx((d) =>
        sendProofCode(d, {
          tenantId,
          userId: owner.id,
          userName: owner.displayName,
          seat: "owner",
          practiceName: "Ridgeview Dental",
          appUrl: "https://app.example",
          transport: codes,
          pause: async () => {},
        })
      );
      const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(codes.sent[0].message.body)?.[1] ?? "";
      expect(await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code))).toMatchObject({ ok: true });
    });

    it("names the seven days ending on the Sunday before, whatever day it runs", () => {
      // A fixed boundary rather than a rolling window: a rolling one would name
      // a different week on Monday than on Tuesday, and a message whose subject
      // changed daily would be a new message daily.
      expect(lastCompleteWeek(new Date("2026-11-02T09:00:00Z"))).toMatchObject({ start: "2026-10-26", end: "2026-11-01" });
      expect(lastCompleteWeek(new Date("2026-11-05T23:00:00Z"))).toMatchObject({ start: "2026-10-26", end: "2026-11-01" });
      // On a Sunday the week that ended is the one before, not the one in progress.
      expect(lastCompleteWeek(new Date("2026-11-08T12:00:00Z"))).toMatchObject({ start: "2026-10-26", end: "2026-11-01" });
      expect(lastCompleteWeek(new Date("2026-11-09T00:30:00Z"))).toMatchObject({ start: "2026-11-02", end: "2026-11-08" });
    });

    it("sends the week's digest, naming the week and no person and no money", async () => {
      // The rounds above each sent their own week's digest, so these cases
      // measure what this round added rather than what the table holds — an
      // absolute count here would be asserting the suite's history.
      const before = (await digestRows()).length;
      const report = await round(monday);
      expect(report.digestsSent).toBe(1);
      const sent = await digestRows();
      expect(sent).toHaveLength(before + 1);
      const latest = sent[sent.length - 1];
      expect(latest.subject).toBe("Ridgeview Dental: your week, 2026-10-26 to 2026-11-01");
      // Safe to send for a property the product proved for another purpose: the
      // digest's queries carry no person dimension, so no count names anyone.
      expect(latest.body).toContain("No count names a person, and no amount of money is in this message.");
      expect(latest.body).not.toMatch(/\$\d/);
      expect(latest.body).not.toContain(owner.displayName);
    });

    it("says that reading it is not stamping it", async () => {
      // The digest is acknowledged on the screen, by an act. A message that
      // implied otherwise would quietly retire a control.
      const sent = await digestRows();
      expect(sent[sent.length - 1].body).toContain("Reading this is not stamping it");
      const { rows } = await db.admin.query("SELECT count(*)::int AS n FROM digest_acks WHERE tenant_id = $1", [tenantId]);
      expect(rows[0].n).toBe(0);
    });

    it("does not send it again later the same week", async () => {
      const before = (await digestRows()).length;
      // Later the same day, and again three days on: the week has not ended, so
      // there is nothing new to report.
      expect((await round(new Date("2026-11-02T18:00:00.000Z"))).digestsSent).toBe(0);
      expect((await round(new Date("2026-11-05T09:00:00.000Z"))).digestsSent).toBe(0);
      expect((await digestRows()).length).toBe(before);
    });

    it("sends it again once another week has ended", async () => {
      const before = (await digestRows()).length;
      const report = await round(new Date("2026-11-09T09:00:00.000Z"));
      expect(report.digestsSent).toBe(1);
      const sent = await digestRows();
      expect(sent).toHaveLength(before + 1);
      expect(sent[sent.length - 1].subject).toBe("Ridgeview Dental: your week, 2026-11-02 to 2026-11-08");
    });

    it("counts the digest beside the notices rather than inside them", async () => {
      // considered = sent + failed + unchanged + nothing_owed + unreachable is
      // about each person's notices, and the database refuses a row that breaks
      // it. A digest is a second message to the same person, so folding it in
      // would make that invariant say nothing about anything.
      const held = await tx((d) => lastRound(d, tenantId));
      expect(held).not.toBeNull();
      expect(held!.considered).toBe(held!.sent + held!.failed + held!.unchanged + held!.nothingOwed + held!.unreachable);
      expect(held!.digestsSent).toBe(1);
    });
  });

  describe("what the database holds past the service", () => {
    async function refusalFrom(fn: () => Promise<unknown>): Promise<string> {
      try {
        await fn();
      } catch (e) {
        const err = e as { message: string; cause?: { message?: string } };
        return err.cause?.message ?? err.message;
      }
      throw new Error("expected the database to refuse this, and it did not");
    }

    it("refuses counts that do not account for everybody considered", async () => {
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_rounds (id, tenant_id, ran_at, considered, sent, failed, unchanged, nothing_owed, unreachable, digests_sent, digests_failed)
           VALUES (gen_random_uuid(), $1, now(), 5, 1, 0, 0, 0, 0, 0, 0)`,
          [tenantId]
        )
      );
      expect(why).toMatch(/notice_rounds_counts_add_up/);
    });

    it("refuses an edit and a delete", async () => {
      const { rows } = await db.admin.query("SELECT id FROM notice_rounds WHERE tenant_id = $1 LIMIT 1", [tenantId]);
      await expect(db.admin.query("UPDATE notice_rounds SET sent = sent WHERE id = $1", [rows[0].id])).rejects.toThrow(
        /append-only/
      );
      await expect(db.admin.query("DELETE FROM notice_rounds WHERE id = $1", [rows[0].id])).rejects.toThrow(/append-only/);
    });
  });
});
