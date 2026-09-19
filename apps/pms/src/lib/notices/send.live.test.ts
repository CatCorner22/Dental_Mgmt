import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { setAddress } from "./addresses";
import { proveAddress, sendProofCode } from "./proof";
import { collectOutstanding } from "./outstanding";
import { lastSend, sendNotices } from "./send";
import { flakyTransport, memoryTransport, refusingTransport, unconfiguredTransport } from "./transport";

/**
 * Sending, and failing to send (Increment 1.59).
 *
 * The rule worth proving is the one the table exists for: an attempt that
 * failed leaves a row saying so. A product that swallowed a failure would be
 * worse than one that never sent, because its reader would believe they had
 * been told.
 *
 * Increment 1.60 adds the half that makes a failure actionable: a refusal that
 * can pass is tried again, one that cannot is not, and every attempt leaves its
 * own row — so how many times the practice tried is answered by counting rows
 * rather than by a number beside them that the rows could contradict.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;

describe.skipIf(!adminUrl)("sending what each seat owes (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The seeded practice owes an unattested month, so there is always something to send. */
  const base = async (transport: Parameters<typeof sendNotices>[1]["transport"]) => ({
    tenantId,
    recipientId: owner.id,
    recipientName: owner.displayName,
    seat: "owner" as const,
    practiceName: "Ridgeview Dental",
    appUrl: "https://app.example",
    notices: await tx((d) => collectOutstanding(d, tenantId)),
    transport,
    // The rule under test is how many attempts happen and what each one leaves,
    // never how long the product waits between them; a suite that slept the
    // real pauses would prove `setTimeout` works and little else.
    pause: async () => {},
  });

  /**
   * The sends that carried notices.
   *
   * Three kinds of message reach a person through this table and the same
   * retry rule. Since Increment 1.64 each row says which it was, so this suite
   * — which is about sending what a seat owes — reads that kind by name rather
   * than inferring it from a count.
   */
  const rows = async () =>
    (
      await db.admin.query(
        "SELECT outcome, address, detail, failure_kind, subject, body, notice_count FROM notice_sends WHERE tenant_id = $1 AND kind = 'notices' ORDER BY attempted_at, id",
        [tenantId]
      )
    ).rows;

  /**
   * Proves the address on file, the way a person does.
   *
   * Since Increment 1.61 an address nobody has proved is not a destination, so
   * every case below that expects a message to leave needs this first. It runs
   * the real path rather than writing a proof row, because a fixture that
   * skipped the path would let the path break without this suite noticing.
   */
  const proveTheAddress = async () => {
    const transport = memoryTransport();
    const asked = await tx((d) =>
      sendProofCode(d, {
        tenantId,
        userId: owner.id,
        userName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport,
        pause: async () => {},
      })
    );
    expect(asked.ok).toBe(true);
    const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(transport.sent[0].message.body)?.[1] ?? "";
    expect(await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code))).toMatchObject({ ok: true });
  };

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

  it("records that something was owed and there was nowhere to send it", async () => {
    // Nobody has given an address yet. Not an error, and not nothing: the
    // practice owes something and no one will hear about it.
    const result = await tx(async (d) => sendNotices(d, await base(memoryTransport())));
    expect(result.outcome).toBe("unreachable");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.address).toBeNull();
    expect(result.record.detail).toContain("Nobody has said where to send these");
    expect(result.record.noticeCount).toBeGreaterThan(0);
    const all = await rows();
    expect(all.map((r) => r.outcome)).toEqual(["unreachable"]);
    // The message was still built, so a reader can see what would have gone.
    expect(all[0].subject).toContain("Ridgeview Dental");
  });

  it("records a failure with the transport's own words, and says nothing arrived", async () => {
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview.example"));
    await proveTheAddress();
    const transport = unconfiguredTransport("This practice has no way to send messages yet.");
    const result = await tx(async (d) => sendNotices(d, await base(transport)));
    expect(result.outcome).toBe("failed");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.detail).toBe("This practice has no way to send messages yet.");
    // The address it tried is kept, because "where did it try" is the question.
    expect(result.record.address).toBe("riley@ridgeview.example");
    // Increment 1.60: nothing is configured, so no retry could reach an outcome
    // and exactly one attempt happened.
    expect(result.record.failureKind).toBe("permanent");
    expect(result.attempts).toBe(1);
    expect((await rows()).map((r) => r.outcome)).toEqual(["unreachable", "failed"]);
  });

  it("tries a transient refusal again, and the attempt that worked ends the act", async () => {
    // Increment 1.60, and the reason the increment exists: a provider that was
    // busy for a second used to cost the practice the whole message.
    const before = (await rows()).length;
    const transport = flakyTransport(1, "The provider was busy.");
    const result = await tx(async (d) => sendNotices(d, await base(transport)));
    expect(result.outcome).toBe("sent");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.attempts).toBe(2);
    expect(transport.attempts).toBe(2);
    // Two attempts, two rows. The failure is not erased by the success that
    // followed it: a reader asking "did this practice have trouble reaching me"
    // gets an answer.
    const added = (await rows()).slice(before);
    expect(added.map((r) => r.outcome)).toEqual(["failed", "sent"]);
    expect(added.map((r) => r.failure_kind)).toEqual(["transient", null]);
    expect(added[0].detail).toBe("The provider was busy.");
  });

  it("stops at three attempts and says the last one failed", async () => {
    const before = (await rows()).length;
    const transport = flakyTransport(99, "The provider was busy.");
    const result = await tx(async (d) => sendNotices(d, await base(transport)));
    expect(result.outcome).toBe("failed");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    // Three, and three is the rule rather than the fixture: PAUSES_MS has two
    // entries, so a fourth attempt would mean the rule changed.
    expect(result.attempts).toBe(3);
    expect(transport.attempts).toBe(3);
    const added = (await rows()).slice(before);
    expect(added.map((r) => r.outcome)).toEqual(["failed", "failed", "failed"]);
    expect(added.map((r) => r.failure_kind)).toEqual(["transient", "transient", "transient"]);
  });

  it("tries a permanent refusal exactly once", async () => {
    // The other half of the rule. A second attempt at an address that does not
    // exist changes nothing and spends the waiting person's time.
    const before = (await rows()).length;
    const transport = refusingTransport("No such address.", "permanent");
    const result = await tx(async (d) => sendNotices(d, await base(transport)));
    expect(result.outcome).toBe("failed");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.attempts).toBe(1);
    expect(transport.attempts).toBe(1);
    const added = (await rows()).slice(before);
    expect(added.map((r) => r.outcome)).toEqual(["failed"]);
    expect(added[0].failure_kind).toBe("permanent");
  });

  it("sends, hands the transport exactly what it recorded, and keeps the body", async () => {
    const transport = memoryTransport();
    const result = await tx(async (d) => sendNotices(d, await base(transport)));
    expect(result.outcome).toBe("sent");
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0].to).toBe("riley@ridgeview.example");

    const all = await rows();
    const sent = all[all.length - 1];
    expect(sent.outcome).toBe("sent");
    expect(sent.detail).toBeNull();
    // What the transport carried is what the row keeps, because "what did they
    // actually receive" cannot be re-derived from rows that move.
    expect(sent.subject).toBe(transport.sent[0].message.subject);
    expect(sent.body).toBe(transport.sent[0].message.body);
  });

  it("keeps no patient and quotes nobody, at rest", async () => {
    // The guarantee Increment 1.58 made at the type level, asserted on the row
    // that outlives the request.
    const { rows: stored } = await db.admin.query("SELECT body FROM notice_sends WHERE tenant_id = $1", [tenantId]);
    for (const r of stored) {
      expect(r.body).toContain("This message names no patient and quotes nobody's words.");
    }
  });

  it("reports the latest attempt, and the earlier ones stay as they were", async () => {
    const before = (await rows()).length;
    const transport = memoryTransport();
    await tx(async (d) => sendNotices(d, await base(transport)));
    const held = await tx((d) => lastSend(d, tenantId, owner.id));
    expect(held?.outcome).toBe("sent");
    expect(held?.failureKind).toBeNull();
    // Every attempt this suite has made is still a row of its own: an attempt
    // is never rewritten, and a later one is another row.
    expect((await rows()).length).toBe(before + 1);
  });

  it("writes no row at all when nothing is owed", async () => {
    const before = (await rows()).length;
    const result = await tx(async (d) =>
      sendNotices(d, { ...(await base(memoryTransport())), notices: [] })
    );
    // Nothing owed is not an act, and a table of rows saying nothing happened
    // is a table nobody can read.
    expect(result.outcome).toBe("nothing_owed");
    expect((await rows()).length).toBe(before);
  });

  it("records the act on the chain without the address or the body", async () => {
    const { rows: events } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 AND kind = 'notice.sent' ORDER BY seq",
      [tenantId]
    );
    // One event per act, never one per attempt: a person asked to be sent their
    // notices once, and the attempts are in the table for whoever wants them.
    expect(events.map((e) => (e.payload as { outcome: string }).outcome)).toEqual([
      "unreachable",
      "failed",
      "sent",
      "failed",
      "failed",
      "sent",
      "sent",
    ]);
    // Nowhere to send asks no transport, so it counts no attempts; the two
    // retried acts are the only ones above one.
    expect(events.map((e) => (e.payload as { attempts: number }).attempts)).toEqual([0, 1, 2, 3, 1, 1, 1]);
    const text = JSON.stringify(events.map((e) => e.payload));
    expect(text).not.toContain("ridgeview.example");
    expect(text).not.toContain("quotes nobody");
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

    it("refuses a failure that does not say what failed", async () => {
      // The kind is supplied so that this row breaks one rule and no other:
      // Postgres names whichever constraint it checks first, and a case that
      // could be satisfied by either is a case that asserts neither.
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, failure_kind, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', 'a@b.example', 'failed', NULL, 'permanent', 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_failure_says_why/);
    });

    it("refuses a failure that does not say whether asking again could work", async () => {
      // Increment 1.60. A failure with no kind leaves its reader with nothing
      // to do, which is the silence this table was opened to prevent.
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, failure_kind, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', 'a@b.example', 'failed', 'It refused.', NULL, 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_failure_says_which_kind/);
    });

    it("refuses a third kind of refusal", async () => {
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, failure_kind, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', 'a@b.example', 'failed', 'It refused.', 'maybe', 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_failure_kind_is_one_of/);
    });

    it("refuses a kind of refusal on a send that worked", async () => {
      // Only a refusal has a kind of refusal to have.
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, failure_kind, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', 'a@b.example', 'sent', NULL, 'transient', 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_only_a_failure_has_a_kind/);
    });

    it("refuses a send that claims to have gone nowhere", async () => {
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', NULL, 'sent', NULL, 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_sent_is_complete/);
    });

    it("refuses a fourth outcome", async () => {
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_sends (id, tenant_id, seat, recipient_id, recipient_name, address, outcome, detail, subject, body, notice_count, attempted_at, kind)
           VALUES (gen_random_uuid(), $1, 'owner', $2, 'Riley Owner', 'a@b.example', 'maybe', NULL, 's', 'b', 1, now(), 'notices')`,
          [tenantId, owner.id]
        )
      );
      expect(why).toMatch(/notice_sends_outcome_check/);
    });

    it("refuses an edit and a delete", async () => {
      const { rows: one } = await db.admin.query("SELECT id FROM notice_sends WHERE tenant_id = $1 LIMIT 1", [tenantId]);
      const id = one[0].id as string;
      await expect(db.admin.query("UPDATE notice_sends SET outcome = 'sent' WHERE id = $1", [id])).rejects.toThrow(
        /notice_sends is append-only/
      );
      await expect(db.admin.query("DELETE FROM notice_sends WHERE id = $1", [id])).rejects.toThrow(/notice_sends is append-only/);
    });
  });
});
