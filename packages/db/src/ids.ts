/**
 * UUIDv7 — time-ordered identifiers for every primary key.
 * RFC 9562 layout, no extra dependency.
 *
 * **Ordered inside a millisecond, not only across them.** The timestamp is
 * 48 bits of milliseconds, so two ids minted in the same millisecond used to
 * differ only in random bits — which made `ORDER BY (stamped_at, id)` a coin
 * toss for exactly the rows that need ordering most: two attempts at one send,
 * two events in one transaction, two rows written back to back.
 *
 * This codebase already holds the rule that an unordered read is a coin toss
 * rather than an answer, and states it about queries. It is just as true of
 * the tiebreak those queries fall back on. `notice_sends` found it first: a
 * failed attempt and the success that followed it can land in one millisecond,
 * and "the last attempt" would then be whichever the planner handed back —
 * so a send that worked could read as a send that failed.
 *
 * So the twelve bits RFC 9562 calls `rand_a` carry a counter (the specification's
 * "monotonic random" method): seeded randomly when the millisecond changes,
 * incremented while it repeats. Consecutive calls sharing a millisecond are
 * therefore ordered by the id alone.
 *
 * Two limits, stated rather than papered over:
 *
 * - **One process.** The counter lives in this module, so ids from different
 *   processes in the same millisecond can still tie. Rows written in one
 *   transaction come from one process, which is the case the rule is about.
 * - **A caller may pass an explicit millisecond.** Where one does, the order
 *   guaranteed is between consecutive calls carrying the same value; a call
 *   that steps back to an earlier millisecond reseeds, exactly as intended,
 *   because its id belongs in that earlier range.
 */
import { randomBytes, randomInt } from "node:crypto";

/** `rand_a`: twelve bits, which is where RFC 9562 puts a monotonic counter. */
const COUNTER_MAX = 0xfff;
/**
 * A fresh millisecond starts the counter in the lower half, so the upper half
 * is headroom. Seeding randomly rather than at zero keeps an id from
 * announcing how many were minted before it.
 */
const COUNTER_SEED_MAX = COUNTER_MAX >> 1;

let lastMs = -1;
let counter = 0;

export function uuidv7(nowMs: number = Date.now()): string {
  if (nowMs === lastMs) {
    // Capped rather than borrowing the next millisecond: borrowing would put
    // an id outside the millisecond it names, and 4,096 ids inside one
    // millisecond from one process is past anything this product does, since
    // every one of them accompanies a row. Past the cap the ordering degrades
    // to what it was before rather than to something worse.
    counter = Math.min(counter + 1, COUNTER_MAX);
  } else {
    counter = randomInt(COUNTER_SEED_MAX + 1);
    lastMs = nowMs;
  }

  const ms = BigInt(nowMs);
  const bytes = randomBytes(16);
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f);
  bytes[7] = counter & 0xff;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
