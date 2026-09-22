import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_INCREMENT, HOLDS_PATIENT_ROWS, patientRecordsSentence, productDescription } from "./product";

const schemaPath = fileURLToPath(new URL("../../../../packages/db/src/schema.ts", import.meta.url));

/**
 * What the product says it holds, read against what it holds (Increment 1.105).
 *
 * `GET /api/health` is unguarded, so `phiPatientRows` is a statement about
 * protected health information made to anybody who can reach the deployment.
 * It said `false` while `patients` carried a first name, a last name and a
 * date of birth, and the seed wrote two rows. A constant that states a fact
 * about the schema has to be read against the schema, or it is the same
 * hand-kept claim in a new place.
 */
describe("what the product says it holds", () => {
  const schema = readFileSync(schemaPath, "utf8");

  it("agrees with the database about patient rows", () => {
    const patients = schema.includes('"patients",');
    const identifiers =
      schema.includes('firstName: text("first_name")') &&
      schema.includes('lastName: text("last_name")') &&
      schema.includes('dateOfBirth: date("date_of_birth")');
    expect({ says: HOLDS_PATIENT_ROWS }).toEqual({ says: patients && identifiers });
  });

  /**
   * Both directions. A product that later holds no patient rows must stop
   * saying it does, exactly as this one had to stop saying it did not — so
   * the sentence is generated from the constant rather than written beside it.
   */
  it("says what it holds rather than promising what it does not", () => {
    expect(patientRecordsSentence()).toMatch(/include patients/);
    expect(patientRecordsSentence()).not.toMatch(/no patient/i);
  });

  it("puts the increment and the records in the page description", () => {
    expect(productDescription()).toContain(`Increment ${APP_INCREMENT}`);
    expect(productDescription()).toContain(patientRecordsSentence());
  });
});

/**
 * The increment number itself. `verify-docs.sh` reads it against the last
 * increment `docs/17` records and fails on any other file under
 * `apps/pms/src` that writes one as a literal; this is the shape check, so a
 * malformed constant fails where it is defined rather than in a shell script.
 */
describe("the increment this product says it is", () => {
  it("is a phase and a number, and nothing else", () => {
    expect(APP_INCREMENT).toMatch(/^\d+\.\d+$/);
  });
});
