import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { currentAddress, setAddress } from "./addresses";
import { collectOutstanding } from "./outstanding";
import { ASKS_PER_WINDOW, currentProof, nextAskAllowedAt, proveAddress, sendProofCode } from "./proof";
import { sendNotices } from "./send";
import { memoryTransport } from "./transport";

/**
 * Proving that an address reaches the person who typed it (Increment 1.61).
 *
 * The rule worth proving is the one nothing before this could hold: a message
 * to a mistyped address **does not fail**. It is accepted by whoever owns that
 * mailbox, so Increment 1.59's visible-failure guarantee never fires. Only a
 * code coming back tells the practice the difference.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const owner = DEV_USERS[0]!;

describe.skipIf(!adminUrl)("proving an address (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The code that went out, read from the message the transport was handed. */
  const codeIn = (body: string) => /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(body)?.[1] ?? "";

  const ask = async (transport: ReturnType<typeof memoryTransport>, at?: Date) =>
    tx((d) =>
      sendProofCode(d, {
        tenantId,
        userId: owner.id,
        userName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        transport,
        at,
        pause: async () => {},
      })
    );

  const sendOwed = async (at?: Date) =>
    tx(async (d) =>
      sendNotices(d, {
        tenantId,
        recipientId: owner.id,
        recipientName: owner.displayName,
        seat: "owner",
        practiceName: "Ridgeview Dental",
        appUrl: "https://app.example",
        notices: await collectOutstanding(d, tenantId),
        transport: memoryTransport(),
        at,
        pause: async () => {},
      })
    );

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview.example"));
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("refuses to send notices to an address nobody has proved, and says what would change it", async () => {
    // The whole reason the increment exists. The address is well formed and the
    // transport would take it; what is missing is any evidence that it reaches
    // the person who typed it.
    const result = await sendOwed();
    expect(result.outcome).toBe("unreachable");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.address).toBeNull();
    expect(result.record.detail).toContain("Nobody has proved that this address reaches you");
    expect(result.record.detail).toContain("Ask for a code");
    // Nothing reached a transport, so nothing was attempted.
    expect(result.attempts).toBe(0);
  });

  it("sends a code to the address, and keeps only its hash", async () => {
    const transport = memoryTransport();
    const result = await ask(transport);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.delivered.record.outcome).toBe("sent");
    expect(transport.sent[0].to).toBe("riley@ridgeview.example");

    const code = codeIn(transport.sent[0].message.body);
    expect(code).toHaveLength(10);
    const { rows } = await db.admin.query("SELECT token_hash, address_id, expires_at FROM notice_address_challenges WHERE tenant_id = $1", [tenantId]);
    expect(rows).toHaveLength(1);
    // What the database keeps recognises the right code and cannot produce one.
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toContain(code);
    const held = await tx((d) => currentAddress(d, tenantId, owner.id));
    expect(rows[0].address_id).toBe(held!.id);
  });

  it("records the code's own message as a send that carried no notices", async () => {
    // Nothing owed writes no row, so a notice_count of zero names this one
    // message in the whole table rather than being a placeholder.
    const { rows } = await db.admin.query(
      "SELECT kind, notice_count, subject, body FROM notice_sends WHERE tenant_id = $1 AND kind = 'proof_code'",
      [tenantId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("Ridgeview Dental: confirm where your messages go");
    // The code is in the body it was sent in, and nowhere the chain can read.
    expect(rows[0].body).toContain("Your code is ");
  });

  it("refuses a code that was never issued, and one that is merely misshapen", async () => {
    const wrongShape = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, "nope"));
    expect(wrongShape).toMatchObject({ ok: false, status: 400, code: "malformed" });
    const neverIssued = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, "ABCDEFGHJK"));
    expect(neverIssued).toMatchObject({ ok: false, status: 409, code: "unknown" });
    // Neither wrote anything.
    expect((await db.admin.query("SELECT 1 FROM notice_address_proofs WHERE tenant_id = $1", [tenantId])).rows).toHaveLength(0);
  });

  it("refuses a code brought back after its window closed", async () => {
    const transport = memoryTransport();
    const issued = new Date("2026-09-01T09:00:00.000Z");
    await ask(transport, issued);
    const code = codeIn(transport.sent[0].message.body);
    const tooLate = new Date("2026-09-03T09:00:00.000Z");
    const result = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code, tooLate));
    expect(result).toMatchObject({ ok: false, status: 409, code: "expired" });
  });

  it("takes the code back, records the proof, and lets the notices go", async () => {
    const transport = memoryTransport();
    await ask(transport);
    const code = codeIn(transport.sent[0].message.body);
    // Typed the way a person types it, off one screen and into another.
    const result = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, ` ${code.toLowerCase()} `));
    expect(result.ok).toBe(true);

    const held = await tx((d) => currentAddress(d, tenantId, owner.id));
    expect(await tx((d) => currentProof(d, tenantId, held!.id))).not.toBeNull();

    const sent = await sendOwed();
    expect(sent.outcome).toBe("sent");
    if (sent.outcome === "nothing_owed") throw new Error("unreachable");
    expect(sent.record.address).toBe("riley@ridgeview.example");
  });

  it("refuses a second proof, and a second code, on an address already proved", async () => {
    const again = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, "ABCDEFGHJK"));
    expect(again).toMatchObject({ ok: false, status: 409, code: "already_proved" });
    const asked = await ask(memoryTransport());
    expect(asked).toMatchObject({ ok: false, status: 409, code: "already_proved" });
  });

  it("unproves an address by changing it, with no flag to clear", async () => {
    // The property the shape gives for free: a proof names the address row, and
    // a new address is a new row that no proof names. A signal that never
    // clears is not a signal; this one cannot fail to clear.
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-two.example"));
    const held = await tx((d) => currentAddress(d, tenantId, owner.id));
    expect(await tx((d) => currentProof(d, tenantId, held!.id))).toBeNull();
    const sent = await sendOwed();
    expect(sent.outcome).toBe("unreachable");
    if (sent.outcome === "nothing_owed") throw new Error("unreachable");
    expect(sent.record.detail).toContain("Nobody has proved that this address reaches you");
  });

  it("refuses a code issued for the address the practice has moved on from", async () => {
    // The old address's code is still inside its window and still in somebody's
    // inbox. It proves a row that is no longer where anything would go.
    const { rows } = await db.admin.query(
      "SELECT id FROM notice_address_challenges WHERE tenant_id = $1 ORDER BY issued_at DESC LIMIT 1",
      [tenantId]
    );
    expect(rows).toHaveLength(1);
    const transport = memoryTransport();
    await ask(transport);
    const freshCode = codeIn(transport.sent[transport.sent.length - 1].message.body);
    const result = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, freshCode));
    // The fresh one works, because it was issued for the address now on file.
    expect(result.ok).toBe(true);
  });

  it("names the acts on the chain without the code and without the address", async () => {
    const { rows } = await db.admin.query(
      "SELECT kind, payload FROM domain_event WHERE tenant_id = $1 AND kind IN ('notice.address_code_sent', 'notice.address_proved') ORDER BY seq",
      [tenantId]
    );
    expect(rows.length).toBeGreaterThan(0);
    const text = JSON.stringify(rows.map((r) => r.payload));
    expect(text).not.toContain("ridgeview.example");
    expect(text).not.toMatch(/[A-HJKMNP-Z2-9]{10}/);
  });

  describe("a proof that has a life", () => {
    // Increment 1.65. A proof stands for a year, and an address is proved again
    // before it lapses rather than after the notices have stopped.
    // Both in the PAST relative to the real clock, deliberately. The ask limit
    // (Increment 1.63) counts challenges issued within the last hour, and a
    // future-dated one satisfies "within the last hour" — so pinning these
    // ahead of now would spend the ask-limit cases' allowance and refuse them
    // for a reason that has nothing to do with the rule they name.
    const provedLongAgo = new Date("2025-09-20T09:00:00.000Z");
    const nearlyLapsed = new Date("2026-09-01T09:00:00.000Z");

    const ask = (at: Date, unlimited = false) =>
      tx((d) =>
        sendProofCode(d, {
          tenantId,
          userId: owner.id,
          userName: owner.displayName,
          seat: "owner",
          practiceName: "Ridgeview Dental",
          appUrl: "https://app.example",
          transport: codes,
          at,
          pause: async () => {},
          unlimited,
        })
      );
    let codes = memoryTransport();

    beforeAll(async () => {
      // A fresh address so nothing above refuses these first, proved at a date
      // a year in the past so the window is reachable without waiting.
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-life.example"));
      codes = memoryTransport();
      const issued = await ask(provedLongAgo, true);
      expect(issued.ok).toBe(true);
      const code = codeIn(codes.sent[codes.sent.length - 1].message.body);
      expect(await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code, provedLongAgo))).toMatchObject({
        ok: true,
      });
    });

    it("refuses a new code while the proof stands comfortably, and names the day it lapses", async () => {
      const refused = await ask(new Date("2026-01-15T09:00:00.000Z"), true);
      expect(refused).toMatchObject({ ok: false, code: "already_proved" });
      if (refused.ok) throw new Error("unreachable");
      expect(refused.why).toContain("stands until 2026-09-20");
    });

    it("sends one inside the last thirty days, because waiting for it to stop is the silence this refuses", async () => {
      const before = codes.sent.length;
      const issued = await ask(nearlyLapsed, true);
      expect(issued.ok).toBe(true);
      expect(codes.sent.length).toBe(before + 1);
    });

    it("proves the address again on the new code, which the old one cannot do", async () => {
      const fresh = codeIn(codes.sent[codes.sent.length - 1].message.body);
      const done = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, fresh, nearlyLapsed));
      expect(done).toMatchObject({ ok: true });
      // Two proofs on one address now, and the newest is the one that stands.
      const held = await tx((d) => currentAddress(d, tenantId, owner.id));
      const now = await tx((d) => currentProof(d, tenantId, held!.id));
      expect(now!.provedAt).toBe(nearlyLapsed.toISOString());
      const { rows } = await db.admin.query(
        "SELECT count(*)::int AS n FROM notice_address_proofs WHERE tenant_id = $1 AND address_id = $2",
        [tenantId, held!.id]
      );
      expect(rows[0].n).toBe(2);
    });
  });

  describe("how often the product can be made to send", () => {
    // Increment 1.63. The abuse worth limiting is not guessing a code — a
    // person can only prove their own address, which they could prove by
    // asking — but asking: a signed-in person can point this product's mail at
    // somebody else's address by typing it, and press the button again.
    //
    // A fresh hour, well clear of every ask the cases above made, so the
    // arithmetic here is exact rather than inherited.
    const base = new Date("2026-10-01T09:00:00.000Z");
    const minutesIn = (n: number) => new Date(base.getTime() + n * 60_000);

    const ask = (at: Date) =>
      tx((d) =>
        sendProofCode(d, {
          tenantId,
          userId: owner.id,
          userName: owner.displayName,
          seat: "owner",
          practiceName: "Ridgeview Dental",
          appUrl: "https://app.example",
          transport: memoryTransport(),
          at,
          pause: async () => {},
        })
      );

    beforeAll(async () => {
      // The cases above leave a proved address, and an already-proved address
      // refuses an ask before the limit is ever consulted — so these cases
      // would pass for a reason that has nothing to do with the rule they
      // name. A fresh, unproved address puts the limit back in the path.
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-ask.example"));
    });

    const challengeCount = async () =>
      (await db.admin.query("SELECT count(*)::int AS n FROM notice_address_challenges WHERE tenant_id = $1", [tenantId]))
        .rows[0].n as number;

    it("sends the first five within the hour", async () => {
      for (let i = 0; i < ASKS_PER_WINDOW; i += 1) {
        expect(await ask(minutesIn(i))).toMatchObject({ ok: true });
      }
    });

    it("refuses the sixth, says when they may ask again, and writes nothing", async () => {
      const before = await challengeCount();
      const refused = await ask(minutesIn(5));
      expect(refused).toMatchObject({ ok: false, status: 409, code: "asked_too_often" });
      if (refused.ok) throw new Error("unreachable");
      // The window frees up when the oldest of the five leaves it, which is an
      // hour after the first — so the message names a time rather than telling
      // somebody to try again later and leaving them to guess.
      expect(refused.why).toContain("10:00 UTC");
      // A refused ask must leave no trace, or the refusal would itself spend
      // part of the next window.
      expect(await challengeCount()).toBe(before);
    });

    it("does not hand out a fresh allowance for changing one character", async () => {
      // The limit is per person rather than per address row, because a per-row
      // limit is escaped by typing a slightly different stranger's address —
      // which is exactly the thing being limited.
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-four.example"));
      expect(await ask(minutesIn(6))).toMatchObject({ ok: false, code: "asked_too_often" });
    });

    it("lets them ask again once the oldest ask has left the window", async () => {
      expect(await tx((d) => nextAskAllowedAt(d, tenantId, owner.id, minutesIn(59)))).not.toBeNull();
      expect(await tx((d) => nextAskAllowedAt(d, tenantId, owner.id, minutesIn(61)))).toBeNull();
      expect(await ask(minutesIn(61))).toMatchObject({ ok: true });
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

    const oneRow = async (sql: string) => (await db.admin.query(sql, [tenantId])).rows[0];

    /**
     * Runs a statement with an acting user, as a tenant transaction would.
     *
     * Without one the own-user trigger refuses first and every case below would
     * pass for the wrong reason — asserting that rule again instead of the one
     * it names. `db.admin` is a single connection, so the setting reaches the
     * statement and is cleared afterwards rather than leaking into later reads.
     */
    async function refusalActingAs(userId: string, sql: string, params: unknown[]): Promise<string> {
      await db.admin.query("SELECT set_config('app.user_id', $1, false)", [userId]);
      try {
        return await refusalFrom(() => db.admin.query(sql, params));
      } finally {
        await db.admin.query("SELECT set_config('app.user_id', '', false)");
      }
    }

    it("refuses a row acted for somebody else before it looks at anything else", async () => {
      // The rule Increment 1.58 set for addresses, held here for the same
      // reason: this is the act whose whole risk is being done on somebody
      // else's behalf, and an administrator who could prove another person's
      // address could point that person's notices at a mailbox they never saw.
      const proof = await oneRow("SELECT address_id, challenge_id, user_id FROM notice_address_proofs WHERE tenant_id = $1 LIMIT 1");
      const why = await refusalFrom(() =>
        db.admin.query(
          `INSERT INTO notice_address_proofs (id, tenant_id, user_id, address_id, challenge_id, proved_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
          [tenantId, proof.user_id, proof.address_id, proof.challenge_id]
        )
      );
      expect(why).toMatch(/no acting user in this transaction/);
    });

    it("redeems a code once, whatever the service believes", async () => {
      // Increment 1.65 moved this guarantee off the address and onto the code.
      // "One proof per address" meant "a code is used once" only while a proof
      // was forever; once a proof can lapse it would mean an address may never
      // be proved twice, which is a different and wrong rule.
      const proof = await oneRow("SELECT address_id, challenge_id, user_id FROM notice_address_proofs WHERE tenant_id = $1 LIMIT 1");
      const why = await refusalActingAs(
        proof.user_id,
        `INSERT INTO notice_address_proofs (id, tenant_id, user_id, address_id, challenge_id, proved_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [tenantId, proof.user_id, proof.address_id, proof.challenge_id]
      );
      expect(why).toMatch(/notice_address_proofs_one_per_challenge/);
    });

    it("refuses a proof answering a code issued for another address", async () => {
      // A third address, so the row under test is one no proof already holds:
      // otherwise the one-proof-per-address index refuses first and this case
      // would pass while asserting nothing about the key it names.
      await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley@ridgeview-three.example"));
      const fresh = await tx((d) => currentAddress(d, tenantId, owner.id));
      // Live, unredeemed, and newest. An expired challenge would trip the
      // in-time trigger, and one already answered would trip the single-use
      // index (Increment 1.65) — either fires before this foreign key, and the
      // case would pass while asserting nothing about the key it names.
      const { rows } = await db.admin.query(
        `SELECT c.id AS challenge_id, c.user_id, $2::uuid AS other_address
           FROM notice_address_challenges c
          WHERE c.tenant_id = $1 AND c.address_id <> $2::uuid AND c.expires_at > now()
            AND NOT EXISTS (SELECT 1 FROM notice_address_proofs p WHERE p.challenge_id = c.id)
          ORDER BY c.issued_at DESC LIMIT 1`,
        [tenantId, fresh!.id]
      );
      expect(rows.length).toBe(1);
      const why = await refusalActingAs(
        rows[0].user_id,
        `INSERT INTO notice_address_proofs (id, tenant_id, user_id, address_id, challenge_id, proved_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
        [tenantId, rows[0].user_id, rows[0].other_address, rows[0].challenge_id]
      );
      expect(why).toMatch(/notice_address_proofs_answers_its_own_challenge/);
    });

    it("refuses a proof stamped after its code expired", async () => {
      const { rows } = await db.admin.query(
        `SELECT c.id, c.address_id, c.user_id, c.expires_at FROM notice_address_challenges c
          WHERE c.tenant_id = $1 AND NOT EXISTS (SELECT 1 FROM notice_address_proofs p WHERE p.challenge_id = c.id)
          ORDER BY c.issued_at DESC LIMIT 1`,
        [tenantId]
      );
      expect(rows.length).toBe(1);
      const why = await refusalActingAs(
        rows[0].user_id,
        `INSERT INTO notice_address_proofs (id, tenant_id, user_id, address_id, challenge_id, proved_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::timestamptz + interval '1 second')`,
        [tenantId, rows[0].user_id, rows[0].address_id, rows[0].id, rows[0].expires_at]
      );
      expect(why).toMatch(/that code expired on/);
    });

    it("refuses a code that expires before it is issued", async () => {
      const proof = await oneRow("SELECT address_id, user_id FROM notice_address_proofs WHERE tenant_id = $1 LIMIT 1");
      const why = await refusalActingAs(
        proof.user_id,
        `INSERT INTO notice_address_challenges (id, tenant_id, user_id, address_id, token_hash, issued_at, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, repeat('a', 64), now(), now() - interval '1 hour')`,
        [tenantId, proof.user_id, proof.address_id]
      );
      expect(why).toMatch(/notice_address_challenges_expires_after_issue/);
    });

    it("refuses a code stored in the clear", async () => {
      const proof = await oneRow("SELECT address_id, user_id FROM notice_address_proofs WHERE tenant_id = $1 LIMIT 1");
      const why = await refusalActingAs(
        proof.user_id,
        `INSERT INTO notice_address_challenges (id, tenant_id, user_id, address_id, token_hash, issued_at, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'ABCD234XYZ', now(), now() + interval '1 hour')`,
        [tenantId, proof.user_id, proof.address_id]
      );
      expect(why).toMatch(/notice_address_challenges_token_hash_check/);
    });

    it("refuses an edit and a delete on both tables", async () => {
      for (const table of ["notice_address_challenges", "notice_address_proofs"]) {
        const { rows } = await db.admin.query(`SELECT id FROM ${table} WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
        await expect(db.admin.query(`UPDATE ${table} SET tenant_id = tenant_id WHERE id = $1`, [rows[0].id])).rejects.toThrow(
          /append-only/
        );
        await expect(db.admin.query(`DELETE FROM ${table} WHERE id = $1`, [rows[0].id])).rejects.toThrow(/append-only/);
      }
    });
  });
});
