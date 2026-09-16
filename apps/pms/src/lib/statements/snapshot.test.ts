import { describe, expect, it } from "vitest";
import type { LedgerAccountDetail } from "../ledger/types";
import {
  buildStatementSnapshot,
  issueRefusal,
  statementTotalsFromDetail,
} from "./snapshot";

const janeDetail: LedgerAccountDetail = {
  accountId: "acct-jane",
  displayName: "Jane Doe",
  patients: [
    {
      patientId: "pat-jane",
      mrn: "CH-10042",
      firstName: "Jane",
      lastName: "Doe",
      patientDueCents: 4500,
      insurancePendingCents: 10000,
      creditCents: 0,
    },
  ],
  entries: [
    {
      entryId: "charge-jane",
      patientId: "pat-jane",
      kind: "charge",
      amountCents: 24500,
      effectiveDate: "2026-09-14",
      postedAt: "2026-09-14T12:00:00.000Z",
      reasonCode: null,
      reasonLabel: null,
      posterName: "Finn Front",
      memo: null,
    },
    {
      entryId: "pay-jane",
      patientId: "pat-jane",
      kind: "patient_payment",
      amountCents: -10000,
      effectiveDate: "2026-09-14",
      postedAt: "2026-09-14T12:05:00.000Z",
      reasonCode: null,
      reasonLabel: null,
      posterName: "Finn Front",
      memo: null,
    },
  ],
};

describe("statement snapshot", () => {
  it("matches the three labeled totals from ledger query patients", () => {
    const snapshot = buildStatementSnapshot(janeDetail, "2026-09-16");
    const queryTotals = statementTotalsFromDetail(janeDetail);
    expect(snapshot.totals).toEqual(queryTotals);
    expect(snapshot.totals).toEqual({
      patientDueCents: 4500,
      insurancePendingCents: 10000,
      creditCents: 0,
    });
    expect(snapshot.lines).toEqual(janeDetail.entries);
    expect(snapshot.patients).toEqual(janeDetail.patients);
    expect(snapshot.displayName).toBe("Jane Doe");
    expect(snapshot.asOf).toBe("2026-09-16");
  });

  it("scopes household snapshots to one patient when requested", () => {
    const household: LedgerAccountDetail = {
      ...janeDetail,
      displayName: "Doe household",
      patients: [
        ...janeDetail.patients,
        {
          patientId: "pat-john",
          mrn: "CH-10088",
          firstName: "John",
          lastName: "Smith",
          patientDueCents: 8900,
          insurancePendingCents: 0,
          creditCents: 0,
        },
      ],
      entries: [
        ...janeDetail.entries,
        {
          entryId: "charge-john",
          patientId: "pat-john",
          kind: "charge",
          amountCents: 8900,
          effectiveDate: "2026-09-14",
          postedAt: "2026-09-14T12:00:00.000Z",
          reasonCode: null,
          reasonLabel: null,
          posterName: "Finn Front",
          memo: null,
        },
      ],
    };
    const snapshot = buildStatementSnapshot(household, "2026-09-16", "pat-jane");
    expect(snapshot.totals).toEqual(
      statementTotalsFromDetail({
        ...household,
        patients: janeDetail.patients,
        entries: janeDetail.entries,
      })
    );
    expect(snapshot.lines.every((line) => line.patientId === "pat-jane")).toBe(true);
    expect(snapshot.patients).toHaveLength(1);
  });
});

describe("issueRefusal", () => {
  it("refuses send when the statement or account is held", () => {
    expect(issueRefusal("held", "Delta claim pending", false)).toBe("held");
    expect(issueRefusal("draft", "Held: claim pending", false)).toBe("held");
    expect(issueRefusal("draft", null, true)).toBe("held");
    expect(issueRefusal("issued", null, false)).toBe("already_issued");
    expect(issueRefusal("void", null, false)).toBe("void");
    expect(issueRefusal("draft", null, false)).toBeNull();
  });
});
