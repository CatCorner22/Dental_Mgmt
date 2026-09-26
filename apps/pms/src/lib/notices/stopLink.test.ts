import { describe, expect, it } from "vitest";
import {
  STOP_LIFE_DAYS,
  packStopRef,
  parseStopRef,
  stopLinkWorksUntil,
  stopUrl,
} from "./stopLink";

/**
 * The shape of a stop link (Increment 1.67).
 *
 * Everything here is arithmetic and string handling, and it is tested apart
 * from the rows because the rule it holds is about what a stranger's browser
 * may hand this product: the reference is parsed to shape before the practice
 * id inside it is set as a transaction's own, so a value of the wrong shape
 * reaches the reader as a sentence rather than as a failed cast.
 */

const tenantId = "018f4c1a-0000-7000-8000-000000000001";
const secret = "A".repeat(43);

describe("a stop reference", () => {
  it("reads back exactly what it was packed from", () => {
    expect(parseStopRef(packStopRef({ tenantId, secret }))).toEqual({ tenantId, secret });
  });

  it("refuses anything that is not one this product could have issued", () => {
    // The practice id goes on to be set as the transaction's own. A value that
    // is not a uuid would fail as a cast — which reaches a stranger as a broken
    // page rather than as an answer.
    expect(parseStopRef("")).toBeNull();
    expect(parseStopRef(secret)).toBeNull();
    expect(parseStopRef(tenantId)).toBeNull();
    expect(parseStopRef(`not-a-uuid.${secret}`)).toBeNull();
    expect(parseStopRef(`${tenantId}.${"A".repeat(42)}`)).toBeNull();
    expect(parseStopRef(`${tenantId}.${"A".repeat(44)}`)).toBeNull();
    // Base64url, so neither padding nor the characters it replaces belong here.
    expect(parseStopRef(`${tenantId}.${"A".repeat(42)}=`)).toBeNull();
    expect(parseStopRef(`${tenantId}.${"A".repeat(42)}+`)).toBeNull();
    // Two separators is two references, and neither half is what it claims.
    expect(parseStopRef(`${tenantId}.${secret}.${secret}`)).toBeNull();
  });

  it("tolerates the whitespace a mail client wraps a URL in", () => {
    expect(parseStopRef(`  ${tenantId}.${secret}\n`)).toEqual({ tenantId, secret });
  });

  it("builds one path segment, however the origin was punctuated", () => {
    const ref = { tenantId, secret };
    expect(stopUrl("https://app.example", ref)).toBe(`https://app.example/notices/stop/${tenantId}.${secret}`);
    expect(stopUrl("https://app.example/", ref)).toBe(stopUrl("https://app.example", ref));
  });
});

describe("how long a stop link works", () => {
  it("counts from the message that carried it, and is derived rather than stored", () => {
    // The challenge already dates every ask and never changes one, so this is
    // arithmetic on a row that cannot drift: no expiry column, nothing to keep
    // in step, and no job that has to remember to run.
    const issued = new Date("2026-03-01T00:00:00.000Z");
    expect(stopLinkWorksUntil(issued).toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(stopLinkWorksUntil(issued.toISOString())).toEqual(stopLinkWorksUntil(issued));
  });

  it("outlives the code, because the two measure different things", async () => {
    // A code stops working after a day because a proof should rest on evidence
    // somebody acted on promptly. A refusal rests on the message having been
    // unwanted, which does not stop being true while the reader is away.
    const { CODE_WINDOW_HOURS } = await import("./proofMessage");
    expect(STOP_LIFE_DAYS * 24).toBeGreaterThan(CODE_WINDOW_HOURS);
  });
});
