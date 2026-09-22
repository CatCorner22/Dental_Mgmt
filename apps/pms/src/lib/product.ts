/**
 * What this product says it is, and what it says it holds (Increment 1.105).
 *
 * Four places carried the increment number and every one of them said
 * `0.11` — the two API routes, the eyebrow on the sign-in screen, and the
 * page description a browser tab and a link preview show. The signed-in
 * footer said `1.104`, and only because somebody edits it by hand on every
 * increment. Five claims, four of them ninety-three increments stale, and no
 * check anywhere read one against another.
 *
 * `scripts/verify-docs.sh` now reads `APP_INCREMENT` against the last
 * increment recorded in `docs/17`, and fails on any other file under
 * `apps/pms/src` that writes an increment number as a literal. The hand-edit
 * remains, because somebody has to say which increment this is — but it is
 * one edit, in one place, that a check keeps honest.
 */
export const APP_INCREMENT = "1.105";

/**
 * Whether this product stores rows about patients.
 *
 * It does, and it has since migration 0009: `patients` carries a first name,
 * a last name, a date of birth and a record number, and the seed writes two
 * of them. `GET /api/health` — which is **unguarded**, and therefore the one
 * answer anybody can read without signing in — said `phiPatientRows: false`.
 * The sign-in screen said "This shell holds no patient records", and the page
 * description said "No patient records are stored".
 *
 * Three false statements about protected health information, on the surfaces
 * a reader meets before they have an account. They were true of Increment
 * 0.11's shell and stopped being true when the ledger arrived.
 *
 * `product.test.ts` reads the database schema and fails if this constant
 * disagrees with it, in either direction: a product that later holds no
 * patient rows must stop saying it does, exactly as this one had to stop
 * saying it did not.
 */
export const HOLDS_PATIENT_ROWS = true;

/**
 * What the product tells a reader about the records it keeps.
 *
 * Written for somebody who has not signed in, because that is where two of
 * the three false claims sat. It names what is stored rather than promising
 * what is not: a promise about the absence of data is the kind of claim that
 * goes stale the moment a table is added, which is what happened here.
 */
export function patientRecordsSentence(): string {
  return HOLDS_PATIENT_ROWS
    ? "This practice's records include patients — a name, a date of birth and a record number — behind row-level security and a hashed audit trail."
    : "This practice's records include no patients.";
}

/** The same fact in the half-line a page description has room for. */
export function productDescription(): string {
  return `Increment ${APP_INCREMENT}. ${patientRecordsSentence()}`;
}
