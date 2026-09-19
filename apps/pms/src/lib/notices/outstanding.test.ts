import { describe, expect, it } from "vitest";
import { attestationCoverage } from "../controls/attestationCoverage";
import type { Thread, ThreadMessage } from "../cpa/questions";
import type { DecisionDue } from "../home/board";
import { countBySeat, outstandingNotices, type OutstandingInput } from "./outstanding";

function message(over: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: "m1",
    threadId: "t1",
    month: "2026-08",
    subjectKey: "journal|total",
    body: "The journal total sits under the deposits. What am I missing?",
    authorSeat: "accountant",
    authorName: "Casey Prentice",
    createdAt: "2026-09-02T10:00:00.000Z",
    ...over,
  };
}

function thread(over: Partial<Thread> = {}, messages = [message()]): Thread {
  return {
    id: "t1",
    month: "2026-08",
    subjectKey: "journal|total",
    subjectLabel: "Journal total",
    messages,
    awaitingPractice: messages[messages.length - 1]?.authorSeat === "accountant",
    closedMonth: null,
    askedAt: messages[0]!.createdAt,
    lastAt: messages[messages.length - 1]!.createdAt,
    ...over,
  };
}

function decision(over: Partial<DecisionDue> = {}): DecisionDue {
  return {
    id: "d1",
    subjectKind: "reason_code",
    subjectId: "courtesy",
    kind: "accept_residual",
    kindLabel: "Accept the residual",
    reviewBy: "2026-08-15",
    overdue: true,
    note: "Reviewed with the accountant.",
    decidedByName: "Riley Owner",
    decidedAt: "2026-05-15T12:00:00.000Z",
    ...over,
  } as DecisionDue;
}

const covered = attestationCoverage({
  month: "2026-08",
  channels: ["vendor_new", "payroll"],
  attested: [
    { channel: "vendor_new", seat: "accountant", byName: "Casey Prentice" },
    { channel: "payroll", seat: "accountant", byName: "Casey Prentice" },
  ],
});
const uncovered = attestationCoverage({ month: "2026-08", channels: ["vendor_new", "payroll"], attested: [] });

function input(over: Partial<OutstandingInput> = {}): OutstandingInput {
  return { attestations: covered, awaitingPractice: [], unreadByAccountant: [], decisionsDue: [], ...over };
}

describe("outstandingNotices", () => {
  it("says nothing when nothing is owed, which is a real state rather than an unmeasured one", () => {
    expect(outstandingNotices(input())).toEqual([]);
    expect(countBySeat([])).toEqual({ owner: 0, accountant: 0 });
  });

  it("carries each surface's own sentence rather than writing a second one for the same fact", () => {
    const [notice] = outstandingNotices(input({ attestations: uncovered }));
    // Exactly the sentence the owner board and the month-end tie-out already use.
    expect(notice!.sentence).toBe(uncovered.sentence);
    expect(notice!.key).toBe("attestation:2026-08");
    expect(notice!.seat).toBe("owner");
  });

  it("adds nothing for a month that is covered, rather than a reassuring row", () => {
    expect(outstandingNotices(input({ attestations: covered }))).toEqual([]);
  });

  it("names who owes the doing, so one seat's debt is never the other's", () => {
    const answered = [message(), message({ id: "m2", authorSeat: "practice", authorName: "Riley Owner", createdAt: "2026-09-03T10:00:00.000Z" })];
    const notices = outstandingNotices(
      input({
        awaitingPractice: [thread()],
        unreadByAccountant: [thread({ id: "t2" }, answered)],
      })
    );
    expect(countBySeat(notices)).toEqual({ owner: 1, accountant: 1 });
    expect(notices.find((n) => n.key === "question:t1")!.seat).toBe("owner");
    expect(notices.find((n) => n.key === "unread:t2")!.seat).toBe("accountant");
    // The question's own words, which is what the board carries: resolving a
    // label would cost a whole month-end package (Increment 1.50).
    expect(notices.find((n) => n.key === "question:t1")!.sentence).toBe(message().body);
  });

  it("counts a decision only once it is actually overdue", () => {
    expect(outstandingNotices(input({ decisionsDue: [decision({ overdue: false })] }))).toEqual([]);
    const [only] = outstandingNotices(input({ decisionsDue: [decision()] }));
    expect(only!.key).toBe("decision:d1");
    expect(only!.sentence).toBe("Accept the residual, recorded by Riley Owner on 2026-05-15, was due for review on 2026-08-15.");
  });

  it("puts the owner's debts first and, within a seat, the oldest first", () => {
    const old = thread({ id: "t-old", askedAt: "2026-07-01T10:00:00.000Z" }, [message({ createdAt: "2026-07-01T10:00:00.000Z" })]);
    const recent = thread({ id: "t-new", askedAt: "2026-09-10T10:00:00.000Z" }, [message({ createdAt: "2026-09-10T10:00:00.000Z" })]);
    const answered = [message(), message({ id: "m2", authorSeat: "practice", authorName: "Riley Owner", createdAt: "2026-09-03T10:00:00.000Z" })];
    const notices = outstandingNotices(
      input({
        attestations: uncovered,
        awaitingPractice: [recent, old],
        unreadByAccountant: [thread({ id: "t2" }, answered)],
      })
    );
    expect(notices.map((n) => n.seat)).toEqual(["owner", "owner", "owner", "accountant"]);
    // Oldest owed first; the attestation, which the rows do not date, sorts last within its seat.
    expect(notices.map((n) => n.key)).toEqual(["question:t-old", "question:t-new", "attestation:2026-08", "unread:t2"]);
  });
});
