import { describe, expect, it } from "vitest";
import type { Thread, ThreadMessage, ThreadSeat } from "./questions";
import { unreadFor, type ThreadRead } from "./threadReads";

function message(over: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    id: "m1",
    threadId: "t1",
    month: "2026-08",
    subjectKey: "journal|total",
    body: "The journal total is lower than I expected.",
    authorSeat: "accountant",
    authorName: "Casey Prentice",
    createdAt: "2026-09-05T10:00:00.000Z",
    ...over,
  };
}

function thread(messages: ThreadMessage[]): Thread {
  return {
    id: "t1",
    month: "2026-08",
    subjectKey: "journal|total",
    subjectLabel: "Journal total",
    messages,
    awaitingPractice: messages[messages.length - 1]?.authorSeat === "accountant",
    closedMonth: null,
    askedAt: messages[0]?.createdAt ?? "",
    lastAt: messages[messages.length - 1]?.createdAt ?? "",
  };
}

function read(upToMessageId: string, seat: ThreadSeat = "accountant"): ThreadRead {
  return { threadId: "t1", seat, upToMessageId, readerName: "Casey Prentice", readAt: "2026-09-06T09:00:00.000Z" };
}

describe("unreadFor", () => {
  it("counts the other side's last message as unread until a read names it", () => {
    const t = thread([message(), message({ id: "m2", authorSeat: "practice", authorName: "Riley Owner" })]);
    expect(unreadFor(t, "accountant", undefined)).toBe(true);
    expect(unreadFor(t, "accountant", read("m2"))).toBe(false);
  });

  it("never treats a seat's own last word as unread", () => {
    // A message you wrote is one you have seen, so the accountant's own
    // question is not something the accountant is owed a reading of.
    const t = thread([message()]);
    expect(unreadFor(t, "accountant", undefined)).toBe(false);
    // The practice, meanwhile, has not read it.
    expect(unreadFor(t, "practice", undefined)).toBe(true);
  });

  it("re-opens once a later message lands, without the earlier read being rewritten", () => {
    // This is why the table is append-only and deliberately not unique: the
    // read still says truly what it said, and it no longer covers the thread.
    const t = thread([
      message(),
      message({ id: "m2", authorSeat: "practice", authorName: "Riley Owner" }),
      message({ id: "m3", authorSeat: "practice", authorName: "Riley Owner", createdAt: "2026-09-07T10:00:00.000Z" }),
    ]);
    expect(unreadFor(t, "accountant", read("m2"))).toBe(true);
    expect(unreadFor(t, "accountant", read("m3"))).toBe(false);
  });

  it("reads each seat separately, so one side marking read never clears the other's", () => {
    const t = thread([message(), message({ id: "m2", authorSeat: "practice", authorName: "Riley Owner" })]);
    // The practice reading its own thread leaves the accountant still owed one.
    expect(unreadFor(t, "accountant", undefined)).toBe(true);
    expect(unreadFor(t, "practice", read("m2", "practice"))).toBe(false);
  });

  it("treats an empty thread as nothing to read rather than as unread", () => {
    expect(unreadFor(thread([]), "accountant", undefined)).toBe(false);
  });
});
