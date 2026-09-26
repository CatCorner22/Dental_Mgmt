import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { PACKAGE_SCHEMA_VERSION } from "../cpa/package";
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

  describe("a proof that lapses, and a person who has left", () => {
    // Increment 1.65.
    const codeRows = async () =>
      (
        await db.admin.query(
          "SELECT attempted_at FROM notice_sends WHERE tenant_id = $1 AND kind = 'proof_code' ORDER BY attempted_at, id",
          [tenantId]
        )
      ).rows;

    beforeAll(async () => {
      // Its own address, proved at a pinned past date, so the lapse arithmetic
      // is exact: proved on 2026-09-03 stands until 2027-09-03, and the window
      // opens thirty days before that.
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-lapse.example"));
      const codes = memoryTransport();
      const provedOn = new Date("2026-09-03T09:00:00.000Z");
      await tx((d) =>
        sendProofCode(d, {
          tenantId,
          userId: owner.id,
          userName: owner.displayName,
          seat: "owner",
          practiceName: "Ridgeview Dental",
          appUrl: "https://app.example",
          transport: codes,
          at: provedOn,
          pause: async () => {},
          unlimited: true,
        })
      );
      const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(codes.sent[0].message.body)?.[1] ?? "";
      expect(await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code, provedOn))).toMatchObject({
        ok: true,
      });
    });

    it("asks for a new code inside the last thirty days, before anything stops", async () => {
      // The proof lapses on 2027-09-03, so the window opened on 2027-08-04:
      // the round asks inside it rather than letting the notices stop in
      // silence a month later.
      const before = (await codeRows()).length;
      await round(new Date("2027-09-01T09:00:00.000Z"));
      expect((await codeRows()).length).toBe(before + 1);
    });

    it("asks once per window rather than every day", async () => {
      const before = (await codeRows()).length;
      await round(new Date("2027-09-02T09:00:00.000Z"));
      await round(new Date("2027-09-05T09:00:00.000Z"));
      expect((await codeRows()).length).toBe(before);
    });

    it("stops sending once the proof has lapsed, and says which it is", async () => {
      const report = await round(new Date("2027-10-05T09:00:00.000Z"));
      expect(report.unreachable).toBe(1);
      expect(report.sent).toBe(0);
      const { rows } = await db.admin.query(
        "SELECT detail FROM notice_sends WHERE tenant_id = $1 AND kind = 'notices' AND outcome = 'unreachable' ORDER BY attempted_at DESC, id DESC LIMIT 1",
        [tenantId]
      );
      // A lapsed proof is no proof, and refuses exactly as a never-proved one
      // does — what differs is the reason, because "nobody ever said" and
      // "nobody has said lately" call for different things from the reader.
      expect(rows[0].detail).toMatch(/The proof that this address reaches you lapsed on \d{4}-\d{2}-\d{2}/);
    });

    it("sends nothing at all to somebody who has left the practice", async () => {
      // A defect until this increment: a deactivated account kept receiving the
      // practice's notices at an address nobody had revisited. Not counted as
      // unreachable — that count is about people the round could not reach, and
      // this is a person it must not reach.
      await db.admin.query("UPDATE users SET active = false WHERE id = $1", [owner.id]);
      const report = await round(new Date("2027-10-06T09:00:00.000Z"));
      expect(report.considered).toBe(0);
      expect(report.unreachable).toBe(0);
      expect(report.sent).toBe(0);
      await db.admin.query("UPDATE users SET active = true WHERE id = $1", [owner.id]);
    });
  });

  describe("telling the accountant that a month closed", () => {
    // Increment 1.66. The outside accountant's seat reaches the month-end
    // package and nothing else, and learned that a month had closed only by
    // signing in to look.
    const cpa = DEV_USERS.find((u) => u.username === "ridgeview-cpa")!;

    function asCpa<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
      return withTenantTransaction(tenantId, cpa.id, fn, env);
    }

    const packageRows = async () =>
      (
        await db.admin.query(
          "SELECT recipient_id, subject, body FROM notice_sends WHERE tenant_id = $1 AND kind = 'package' ORDER BY attempted_at, id",
          [tenantId]
        )
      ).rows;

    /**
     * A close row, written directly.
     *
     * What is under test here is the round's sending rule, not the closing of
     * a month — that path has its own suite, which posts a real entry, maps it
     * through maker-checker and watches the hash freeze. The fields this
     * message reads are plain scalars, and the tie-outs it reports come from
     * the real `computeMonthPackage`, so the fixture stands in for one act and
     * nothing else.
     */
    const closeAMonth = async (month: string, closedAt: string, hash: string) => {
      await db.admin.query(
        `INSERT INTO month_closes (id, tenant_id, month, period_start, period_end, package_hash, package_schema,
                                   entry_count, total_cents, closed_by_id, closed_by_name, closed_at)
         VALUES (gen_random_uuid(), $1, $2, ($2 || '-01')::date, (($2 || '-01')::date + interval '1 month - 1 day')::date,
                 $3, $4, 412, 1234500, $5, 'Riley Owner', $6::timestamptz)`,
        [tenantId, month, hash, PACKAGE_SCHEMA_VERSION, owner.id, closedAt]
      );
    };

    beforeAll(async () => {
      // The accountant says where to send, and proves it, exactly as anybody
      // does: nothing about this seat is exempt from Increment 1.61.
      await asCpa((d) => setAddress(d, tenantId, cpa.id, cpa.displayName, "pat@cpa.example"));
      const codes = memoryTransport();
      await asCpa((d) =>
        sendProofCode(d, {
          tenantId,
          userId: cpa.id,
          userName: cpa.displayName,
          seat: "accountant",
          practiceName: "Ridgeview Dental",
          appUrl: "https://app.example",
          transport: codes,
          pause: async () => {},
        })
      );
      const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(codes.sent[0].message.body)?.[1] ?? "";
      expect(await asCpa((d) => proveAddress(d, tenantId, cpa.id, cpa.displayName, code))).toMatchObject({ ok: true });
      await closeAMonth("2026-07", "2026-08-02T10:00:00.000Z", "a".repeat(64));
    });

    it("tells the accountant, with the fingerprint and no money", async () => {
      const before = (await packageRows()).length;
      const report = await round(new Date("2026-08-03T09:00:00.000Z"));
      // This is also the regression for a defect this increment found: the
      // accountant's seat owes nothing, and until now a seat that owed nothing
      // left the round's loop outright — taking the digest and the package with
      // it. Owing nothing is the ordinary case for both.
      expect(report.nothingOwed).toBeGreaterThan(0);
      expect(report.packagesSent).toBe(1);
      const sent = await packageRows();
      expect(sent).toHaveLength(before + 1);
      const latest = sent[sent.length - 1];
      expect(latest.recipient_id).toBe(cpa.id);
      expect(latest.subject).toBe("Ridgeview Dental: 2026-07 is closed");
      // The fingerprint travels by a different channel from the artefact, which
      // is the point of sending anything at all.
      expect(latest.body).toContain("a".repeat(64));
      // And the figures do not travel at all: an export is the accountant
      // taking them while signed in; a message is the product pushing them into
      // a mailbox.
      expect(latest.body).not.toMatch(/\$|1234500|12,345/);
      expect(latest.body).toContain("No figure from the month is in this message");
    });

    it("tells nobody else", async () => {
      const sent = await packageRows();
      expect(sent.every((r) => r.recipient_id === cpa.id)).toBe(true);
    });

    it("does not tell them twice about the same close", async () => {
      const before = (await packageRows()).length;
      expect((await round(new Date("2026-08-04T09:00:00.000Z"))).packagesSent).toBe(0);
      expect((await round(new Date("2026-08-20T09:00:00.000Z"))).packagesSent).toBe(0);
      expect((await packageRows()).length).toBe(before);
    });

    it("tells them again when the next month closes", async () => {
      const before = (await packageRows()).length;
      await closeAMonth("2026-08", "2026-09-02T10:00:00.000Z", "b".repeat(64));
      const report = await round(new Date("2026-09-03T09:00:00.000Z"));
      expect(report.packagesSent).toBe(1);
      const sent = await packageRows();
      expect(sent).toHaveLength(before + 1);
      expect(sent[sent.length - 1].subject).toBe("Ridgeview Dental: 2026-08 is closed");
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
          `INSERT INTO notice_rounds (id, tenant_id, ran_at, considered, sent, failed, unchanged, nothing_owed, unreachable, digests_sent, digests_failed, packages_sent, packages_failed)
           VALUES (gen_random_uuid(), $1, now(), 5, 1, 0, 0, 0, 0, 0, 0, 0, 0)`,
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
