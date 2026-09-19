import { describe, expect, it } from "vitest";
import { renderMessage, type Deliverable } from "./message";
import { outstandingNotices } from "./outstanding";
import type { Thread } from "../cpa/questions";

/**
 * What a message may contain, and what it may not (Increment 1.58).
 *
 * The rule these cases hold is the one the increment exists for: a message
 * leaves the product, so it carries only sentences the product generated, and
 * never a person's typed words.
 */

const covered = { month: "2026-08", channels: [], attested: [], unattested: [], complete: true, sentence: "" };

function threadMessage(id: string, body: string, authorSeat: "accountant" | "practice", createdAt: string): Thread["messages"][number] {
  return {
    id,
    threadId: "t",
    month: "2026-08",
    subjectKey: "collections:patient_payments",
    body,
    authorSeat,
    authorName: authorSeat === "accountant" ? "Casey Prentice" : "Riley Owner",
    createdAt,
  };
}

function thread(over: Partial<Thread> & { id: string; month: string }): Thread {
  return {
    id: over.id,
    month: over.month,
    subjectKey: over.subjectKey ?? "collections:patient_payments",
    askedAt: over.askedAt ?? "2026-09-02T10:00:00.000Z",
    lastAt: over.lastAt ?? "2026-09-02T10:00:00.000Z",
    awaitingPractice: over.awaitingPractice ?? true,
    closedMonth: over.closedMonth ?? null,
    messages: over.messages ?? [],
  } as Thread;
}

describe("the message that would be sent", () => {
  it("says nothing at all when the seat owes nothing", () => {
    // Not a cheerful "all clear": a message that arrives whether or not
    // anything happened teaches its reader to ignore whatever arrives.
    expect(renderMessage({ practiceName: "Ridgeview Dental", seat: "owner", notices: [], appUrl: "https://app.example" })).toBeNull();
  });

  it("carries only this seat's debts, whatever it is handed", () => {
    const notices: Deliverable[] = [
      { key: "a", seat: "owner", subject: "One", outside: "The owner's.", href: "/home", since: "2026-09-01" },
      { key: "b", seat: "accountant", subject: "Two", outside: "The accountant's.", href: "/cpa", since: "2026-09-02" },
    ];
    const owner = renderMessage({ practiceName: "Ridgeview Dental", seat: "owner", notices, appUrl: "https://app.example" });
    expect(owner?.body).toContain("The owner's.");
    expect(owner?.body).not.toContain("The accountant's.");
    // A message addressed to two seats is a message nobody owns, so the count
    // in the subject is this seat's count and not the list's length.
    expect(owner?.subject).toBe("Ridgeview Dental: 1 thing is waiting");
  });

  it("counts in English at either end", () => {
    const one: Deliverable[] = [{ key: "a", seat: "owner", subject: "One", outside: ".", href: "/home", since: null }];
    const three: Deliverable[] = [0, 1, 2].map((i) => ({
      key: `k${i}`,
      seat: "owner" as const,
      subject: "S",
      outside: ".",
      href: "/home",
      since: null,
    }));
    expect(renderMessage({ practiceName: "P", seat: "owner", notices: one, appUrl: "https://a" })?.subject).toBe("P: 1 thing is waiting");
    expect(renderMessage({ practiceName: "P", seat: "owner", notices: three, appUrl: "https://a" })?.subject).toBe("P: 3 things are waiting");
  });

  it("names the practice and a count in the subject, and what is owed nowhere near it", () => {
    // The subject is what a lock screen shows to whoever is holding the phone.
    const notices: Deliverable[] = [
      { key: "a", seat: "owner", subject: "Channels nobody reviewed for 2026-08", outside: "payroll and refunds.", href: "/cpa", since: null },
    ];
    const msg = renderMessage({ practiceName: "Ridgeview Dental", seat: "owner", notices, appUrl: "https://app.example" })!;
    expect(msg.subject).toBe("Ridgeview Dental: 1 thing is waiting");
    expect(msg.subject).not.toContain("payroll");
    expect(msg.subject).not.toContain("Channels");
  });

  it("points at the screen, with one trailing slash or none", () => {
    const notices: Deliverable[] = [{ key: "a", seat: "owner", subject: "S", outside: ".", href: "/home", since: null }];
    for (const base of ["https://app.example", "https://app.example/", "https://app.example///"]) {
      const msg = renderMessage({ practiceName: "P", seat: "owner", notices, appUrl: base })!;
      expect(msg.body).toContain("https://app.example/home");
      expect(msg.body).not.toContain("example//home");
    }
  });

  it("dates what it can and stays quiet about what it cannot", () => {
    const dated: Deliverable[] = [{ key: "a", seat: "owner", subject: "S", outside: ".", href: "/home", since: "2026-09-01" }];
    const undated: Deliverable[] = [{ key: "a", seat: "owner", subject: "S", outside: ".", href: "/home", since: null }];
    expect(renderMessage({ practiceName: "P", seat: "owner", notices: dated, appUrl: "https://a" })?.body).toContain("Owed since 2026-09-01.");
    expect(renderMessage({ practiceName: "P", seat: "owner", notices: undated, appUrl: "https://a" })?.body).not.toContain("Owed since");
  });

  it("tells the reader why it is thin, so a thin message does not read as a broken one", () => {
    const notices: Deliverable[] = [{ key: "a", seat: "owner", subject: "S", outside: ".", href: "/home", since: null }];
    expect(renderMessage({ practiceName: "P", seat: "owner", notices, appUrl: "https://a" })?.body).toContain(
      "This message names no patient and quotes nobody's words. Sign in to read what was said."
    );
  });
});

describe("the words a message never carries", () => {
  // The whole point of the increment. A thread body is typed by a person and
  // nothing constrains it; the outside accountant's seat needs no BAA only
  // because what it reaches names no patient.
  const TYPED = "Ask Mrs Abigail Thorne why her balance moved";

  const asked = thread({
    id: "t1",
    month: "2026-08",
    askedAt: "2026-09-02T10:00:00.000Z",
    lastAt: "2026-09-02T10:00:00.000Z",
    awaitingPractice: true,
    messages: [threadMessage("m1", TYPED, "accountant", "2026-09-02T10:00:00.000Z")],
  });

  it("puts the typed words on the screen and the act in the message", () => {
    const [notice] = outstandingNotices({ attestations: covered, awaitingPractice: [asked], unreadByAccountant: [], decisionsDue: [] });
    // The screen still shows what Increment 1.50 chose to show.
    expect(notice.sentence).toBe(TYPED);
    // Outside, the act and the date, and nothing anybody typed.
    expect(notice.outside).toBe("The accountant asked about 2026-08 on 2026-09-02. The question itself is on the owner board.");

    const msg = renderMessage({ practiceName: "P", seat: "owner", notices: [notice], appUrl: "https://a" })!;
    expect(msg.body).not.toContain(TYPED);
    expect(msg.body).not.toContain("Abigail");
    expect(msg.subject).not.toContain("Abigail");
  });

  it("does the same for an answer the practice typed", () => {
    const answered = thread({
      id: "t2",
      month: "2026-08",
      askedAt: "2026-09-02T10:00:00.000Z",
      lastAt: "2026-09-05T09:00:00.000Z",
      awaitingPractice: false,
      messages: [
        threadMessage("m1", "Why did collections move?", "accountant", "2026-09-02T10:00:00.000Z"),
        threadMessage("m2", TYPED, "practice", "2026-09-05T09:00:00.000Z"),
      ],
    });
    const [notice] = outstandingNotices({ attestations: covered, awaitingPractice: [], unreadByAccountant: [answered], decisionsDue: [] });
    expect(notice.sentence).toBe(TYPED);
    expect(notice.outside).toBe("The practice answered about 2026-08 on 2026-09-05. The answer itself is on the month-end screen.");
    const msg = renderMessage({ practiceName: "P", seat: "accountant", notices: [notice], appUrl: "https://a" })!;
    expect(msg.body).not.toContain(TYPED);
  });

  it("carries the generated sentences unchanged, because those are already safe", () => {
    // Attestation coverage and an overdue decision are built from channels,
    // names, codes and dates. There is no second wording for them, and no
    // reason to invent one.
    const [notice] = outstandingNotices({
      attestations: { ...covered, complete: false, sentence: "Two channels for 2026-08 have nobody's word behind them: payroll and refunds." },
      awaitingPractice: [],
      unreadByAccountant: [],
      decisionsDue: [],
    });
    expect(notice.outside).toBe(notice.sentence);
    expect(renderMessage({ practiceName: "P", seat: "owner", notices: [notice], appUrl: "https://a" })?.body).toContain("payroll and refunds");
  });
});
