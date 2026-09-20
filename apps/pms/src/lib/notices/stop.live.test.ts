import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { noticeAddressChallenges, uuidv7 } from "@pms/db";
import { resetDbPoolForTests, withTenantTransaction } from "../db/client";
import { setAddress } from "./addresses";
import { collectOutstanding } from "./outstanding";
import { proveAddress, sendProofCode } from "./proof";
import { sendNotices } from "./send";
import { hashStop, lookUpStop, refuseAddress } from "./stop";
import { parseStopRef, STOP_LIFE_MS } from "./stopLink";
import { memoryTransport } from "./transport";

/**
 * A stranger stops a code they did not ask for (Increment 1.67).
 *
 * The rule worth proving is the one nothing before this could hold: the person
 * who receives an unwanted code has no account, will never have one, and is
 * not the person the practice typed the address for. Everything else in this
 * schema is authorised by a session. This is authorised by a secret the
 * message carried, and by nothing else.
 *
 * Skipped without PMS_TEST_POSTGRES_URL; mandatory under PMS_TEST_POSTGRES_REQUIRED=1.
 */

const adminUrl = liveAdminUrl();
const tenantId = DEV_TENANTS[0]!.id;
const otherTenantId = DEV_TENANTS[1]!.id;
const owner = DEV_USERS[0]!;
const mailbox = "riley@ridgeview.example";

describe.skipIf(!adminUrl)("stopping a code nobody asked for (live)", () => {
  let db: LiveDatabase;
  let env: Record<string, string | undefined>;
  /** What the stranger has in hand: the reference out of the message they received. */
  let reference = "";
  let code = "";

  function tx<T>(fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenantId, owner.id, fn, env);
  }

  /** The stranger's transaction: no acting user, because nobody signs in to refuse. */
  function strangerTx<T>(tenant: string, fn: Parameters<typeof withTenantTransaction<T>>[2]) {
    return withTenantTransaction(tenant, "", fn, env);
  }

  const codeIn = (body: string) => /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(body)?.[1] ?? "";
  const refIn = (body: string) => /\/notices\/stop\/([0-9a-f-]{36}\.[A-Za-z0-9_-]{43})/.exec(body)?.[1] ?? "";

  const sendOwed = async () =>
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
        pause: async () => {},
      })
    );

  /**
   * A raw statement run with an acting user, and the message it was refused with.
   *
   * `notice_addresses` refuses a transaction that names no acting user before
   * it looks at anything else, so a bare administrator insert is refused for
   * lacking a session rather than for the rule under test — a case passing for
   * a reason other than its own name. `db.admin` is one client, so setting the
   * session value and running the statement land on the same connection.
   */
  async function refusalActingAs(userId: string, statement: string, params: unknown[]): Promise<string> {
    await db.admin.query("SELECT set_config('app.user_id', $1, false)", [userId]);
    try {
      await db.admin.query(statement, params);
      throw new Error("that statement was expected to be refused, and was not");
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      await db.admin.query("SELECT set_config('app.user_id', '', false)");
    }
  }

  const refusalRows = async () =>
    (await db.admin.query("SELECT address, challenge_id, refused_at FROM notice_address_refusals WHERE tenant_id = $1", [tenantId]))
      .rows;

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await resetDbPoolForTests();
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: "b".repeat(64), BCRYPT_COST: "4" } });
    env = { POSTGRES_URL: await db.loginAs("app_rw"), APPEND_ROLE_DSN: await db.loginAs("app_append"), BCRYPT_COST: "4" };
    await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, mailbox));
  }, 90_000);

  afterAll(async () => {
    await resetDbPoolForTests();
    await db?.destroy();
  });

  it("carries a way to say no in the message, and keeps only its hash", async () => {
    const transport = memoryTransport();
    const result = await tx((d) =>
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
    expect(result.ok).toBe(true);

    const body = transport.sent[0]!.message.body;
    code = codeIn(body);
    reference = refIn(body);
    expect(code).toHaveLength(10);
    expect(parseStopRef(reference)).not.toBeNull();
    // The reference names the practice that wrote, because a database which
    // refuses cross-practice reads cannot be asked which one issued a secret.
    expect(parseStopRef(reference)!.tenantId).toBe(tenantId);

    const { rows } = await db.admin.query(
      "SELECT stop_hash FROM notice_address_challenges WHERE tenant_id = $1 ORDER BY issued_at DESC LIMIT 1",
      [tenantId]
    );
    // What the database keeps recognises the right secret and cannot produce one.
    expect(rows[0]!.stop_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.stop_hash).not.toContain(parseStopRef(reference)!.secret);
    expect(rows[0]!.stop_hash).toBe(hashStop(parseStopRef(reference)!.secret));
  });

  it("proves the address, so what stops later is a proof rather than an absence", async () => {
    // Deliberate: the interesting refusal is the one that overrides a proof
    // standing in good order, not the one that adds nothing to an address
    // already going nowhere.
    const proved = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code));
    expect(proved.ok).toBe(true);
    const sent = await sendOwed();
    expect(sent.outcome).toBe("sent");
  });

  it("answers an unknown secret and one aimed at another practice in the same words", async () => {
    // Telling them apart would turn this page into an oracle for which
    // practice a given secret belongs to.
    const stranger = parseStopRef(reference)!;
    const wrongSecret = await strangerTx(tenantId, (d) => lookUpStop(d, tenantId, "z".repeat(43)));
    const wrongPractice = await strangerTx(otherTenantId, (d) => lookUpStop(d, otherTenantId, stranger.secret));
    expect(wrongSecret.ok).toBe(false);
    expect(wrongPractice.ok).toBe(false);
    if (wrongSecret.ok || wrongPractice.ok) throw new Error("unreachable");
    expect(wrongSecret.code).toBe("unknown");
    expect(wrongPractice.code).toBe("unknown");
    expect(wrongPractice.why).toBe(wrongSecret.why);
  });

  it("refuses a link older than its life, and writes nothing when it does", async () => {
    // A link whose message is thirty days old has run out. The row is written
    // directly rather than by asking for another code, so the age under test is
    // the link's own and not an artefact of how it was obtained.
    const staleSecret = "s".repeat(43);
    const issuedAt = new Date(Date.now() - STOP_LIFE_MS - 60_000);
    const addressId = (
      await db.admin.query("SELECT id FROM notice_addresses WHERE tenant_id = $1 AND user_id = $2 ORDER BY set_at DESC LIMIT 1", [
        tenantId,
        owner.id,
      ])
    ).rows[0]!.id as string;
    await tx(async (d) => {
      await d.insert(noticeAddressChallenges).values({
        id: uuidv7(),
        tenantId,
        userId: owner.id,
        addressId,
        tokenHash: "a".repeat(64),
        stopHash: hashStop(staleSecret),
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 3_600_000),
      });
    });

    const before = (await refusalRows()).length;
    const stale = await strangerTx(tenantId, (d) => refuseAddress(d, tenantId, staleSecret));
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error("unreachable");
    expect(stale.code).toBe("expired");
    expect(stale.why).toContain("the newest one carries a link that works");
    expect((await refusalRows()).length).toBe(before);
  });

  it("records that the mailbox said no, naming the mailbox and nobody at all", async () => {
    const stranger = parseStopRef(reference)!;
    const result = await strangerTx(tenantId, (d) => refuseAddress(d, tenantId, stranger.secret));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.practiceName).toBe(DEV_TENANTS[0]!.name);

    const rows = await refusalRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.address).toBe(mailbox);

    // The chain names the act and never the mailbox, which is the rule every
    // address event has held since Increment 1.58 — and here there is also no
    // person to name, because nobody signed in to do this.
    const { rows: events } = await db.admin.query(
      "SELECT actor_user_id, payload FROM domain_event WHERE tenant_id = $1 AND kind = 'notice.address_refused'",
      [tenantId]
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.actor_user_id).toBeNull();
    expect(JSON.stringify(events[0]!.payload)).not.toContain(mailbox);
    expect(events[0]!.payload).toEqual({ challenge: rows[0]!.challenge_id });
  });

  it("outranks a proof that still stands, so the notices stop", async () => {
    // The proof from earlier in this suite has not lapsed and has not been
    // cleared. A mailbox can change hands, and the person reading it now is
    // the person entitled to say so.
    const result = await sendOwed();
    expect(result.outcome).toBe("unreachable");
    if (result.outcome === "nothing_owed") throw new Error("unreachable");
    expect(result.record.address).toBeNull();
    expect(result.record.detail).toContain("did not ask for this practice's messages");
    expect(result.record.detail).toContain("Save a different address");
    expect(result.attempts).toBe(0);
  });

  it("will not send another code there, and says the refusal rather than the proof", async () => {
    // The address is proved, so the ordering is the test: a refusal checked
    // after the proof would answer "already proved", which is true and useless.
    const transport = memoryTransport();
    const result = await tx((d) =>
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
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("refused");
    expect(transport.sent).toHaveLength(0);
  });

  it("will not accept a code minted before the refusal", async () => {
    const result = await tx((d) => proveAddress(d, tenantId, owner.id, owner.displayName, code));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("refused");
  });

  it("refuses the same mailbox typed again, in whatever case, and the database is the backstop", async () => {
    const worded = await tx((d) =>
      setAddress(d, tenantId, owner.id, owner.displayName, "  RILEY@Ridgeview.Example  ")
    );
    expect(worded.ok).toBe(false);
    if (worded.ok) throw new Error("unreachable");
    expect(worded.code).toBe("refused");
    expect(worded.status).toBe(409);

    // The application saying it is a courtesy; the rule lives in the database,
    // where a later caller cannot skip it.
    const why = await refusalActingAs(
      owner.id,
      "INSERT INTO notice_addresses (id, tenant_id, user_id, address, set_at) VALUES ($1,$2,$3,$4,now())",
      [uuidv7(), tenantId, owner.id, "RILEY@RIDGEVIEW.EXAMPLE"]
    );
    expect(why).toMatch(/did not ask for this practice/);
  });

  it("lets a different mailbox be saved, so the product loses a destination rather than a person", async () => {
    const result = await tx((d) => setAddress(d, tenantId, owner.id, owner.displayName, "riley.owner@ridgeview.example"));
    expect(result.ok).toBe(true);
  });

  it("treats a second press as settled rather than as a second statement", async () => {
    const stranger = parseStopRef(reference)!;
    const again = await strangerTx(tenantId, (d) => refuseAddress(d, tenantId, stranger.secret));
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error("unreachable");
    expect(again.code).toBe("already_stopped");
    expect(await refusalRows()).toHaveLength(1);
  });

  it("refuses a refusal that names a mailbox the message never reached", async () => {
    // Without this the row would rest on the application having looked up the
    // right address, and a refusal naming some other mailbox would be indexed,
    // unique, and wrong.
    const challengeId = (await refusalRows())[0]!.challenge_id;
    await expect(
      db.admin.query("INSERT INTO notice_address_refusals (id, tenant_id, challenge_id, address, refused_at) VALUES ($1,$2,$3,$4,now())", [
        uuidv7(),
        tenantId,
        challengeId,
        "somebody.else@elsewhere.example",
      ])
    ).rejects.toThrow(/went to a different address/);
  });

  it("is append-only, so a refusal is not quietly lifted", async () => {
    // The only evidence that could authorise lifting one is a code sent to that
    // mailbox, which is the one thing this practice may no longer send there.
    await expect(
      db.admin.query("UPDATE notice_address_refusals SET address = $1 WHERE tenant_id = $2", ["other@example.test", tenantId])
    ).rejects.toThrow(/append-only/);
    await expect(db.admin.query("DELETE FROM notice_address_refusals WHERE tenant_id = $1", [tenantId])).rejects.toThrow(
      /append-only/
    );
  });
});
