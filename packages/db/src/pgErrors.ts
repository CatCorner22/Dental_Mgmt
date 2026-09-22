/**
 * Reading a Postgres error well enough to refuse on it (Increment 1.87).
 *
 * Some questions only the database can answer. A unique index spanning every
 * tenant is one: row-level security hides other tenants' rows from the
 * application, on purpose, so a query issued inside a tenant transaction
 * cannot see the row it would collide with. The insert is therefore the check,
 * and the error it raises is the answer — which makes turning that error into
 * a refusal a first-class step rather than a fallback.
 */

/** Postgres SQLSTATE 23505: a unique constraint or index was violated. */
export const UNIQUE_VIOLATION = "23505";

type PgErrorish = { code?: unknown; constraint?: unknown; cause?: unknown };

/**
 * The SQLSTATE is not always on the error a caller catches. Drizzle wraps a
 * failed statement in its own error — "Failed query: insert into ..." — and
 * hangs the driver's error off `cause`, so a reader that looks only at the top
 * of the chain sees no `code` and concludes the collision was something else.
 *
 * Found by the live case rather than by reading: the first version of this
 * function checked the outer error, the refusal never fired, and the unique
 * violation travelled on exactly as it had before the fix. The chain is walked
 * to a fixed depth, which is enough for any wrapping this product does and
 * ends rather than trusting a `cause` graph not to loop.
 */
function pgErrorsIn(err: unknown, depth = 4): PgErrorish[] {
  const out: PgErrorish[] = [];
  let here: unknown = err;
  for (let i = 0; i <= depth; i += 1) {
    if (typeof here !== "object" || here === null) break;
    const node = here as PgErrorish;
    out.push(node);
    here = node.cause;
  }
  return out;
}

/**
 * True when `err`, or anything it wraps, is a unique violation — optionally on
 * one named index.
 *
 * Naming the index matters: a caller that refuses on any `23505` would also
 * swallow a collision it did not anticipate and report it as the one it did,
 * which is how a second defect hides behind the first one's refusal.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  return pgErrorsIn(err).some(
    (pg) =>
      pg.code === UNIQUE_VIOLATION && (constraint === undefined || pg.constraint === constraint)
  );
}

/** The index that makes a sign-in name unique across every practice (migration 0002). */
export const USERNAME_GLOBAL_UIDX = "users_username_lower_uidx";

/** The index that keeps one live grant per person and duty (migration 0013). */
export const LIVE_GRANT_UIDX = "user_entitlements_live_uidx";
