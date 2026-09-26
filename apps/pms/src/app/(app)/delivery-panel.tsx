"use client";

import type { Message } from "@/lib/notices/message";
import type { NoticeSeat } from "@/lib/notices/outstanding";
import { sendSentence, type SendRecord } from "@/lib/notices/sendOutcome";

/**
 * Where a person says their notices go, and what would go there
 * (Increment 1.58; shared since 1.74).
 *
 * Lifted out of the Practice Risk screen, which had it to itself because that
 * screen was where every seat that could act on a notice went. The outside
 * accountant's seat cannot open it — `/risk` is manager rank and the seat is
 * `readonly` by construction (Increment 1.49) — and yet the three routes this
 * panel calls were deliberately widened to admit that seat:
 * `GET`/`POST /api/notices/address` and `POST /api/notices/prove` all carry
 * `orEntitlement: CPA_SEAT_ENTITLEMENT`.
 *
 * So the guards were opened for a seat and the surface was not, which is
 * exactly the shape Increment 1.72 found on the enrolment route. The seat
 * could be mailed a code and told to go somewhere it cannot go, while
 * Increment 1.70's card named it for never having said where.
 *
 * One component rather than one per screen, because a person setting an
 * address is one act and a second copy of it would be a second answer — the
 * thing this codebase refuses from the owner board's counts to the reading of
 * who cannot be reached.
 */

/** Where this viewer's notices would go, and what would go there. Nothing is sent (Increment 1.58). */
export type AddressResponse = {
  seat: NoticeSeat;
  address: { id: string; address: string | null; setAt: string } | null;
  /** Whether this exact address row was proved to reach this person (Increment 1.61); null where it was not. */
  proof: { addressId: string; provedAt: string } | null;
  /** Where that proof stands: a proof lasts a year (Increment 1.65). */
  standing: "none" | "good" | "expiring" | "lapsed";
  /** Set when somebody reading that mailbox said they did not ask for these (Increment 1.67). */
  refused: { refusedAt: string } | null;
  /** What became of a proof that lapsed (Increment 1.68); null unless one has. */
  lapse:
    | { retired: false; asked: number; askDue: string | null; retiresAt: string }
    | { retired: true; asked: number; retiredAt: string }
    | null;
  lapsesAt: string | null;
  /** The last attempt and how it went (Increment 1.59); null where nobody has tried. */
  lastSend: SendRecord | null;
  /** When the scheduled sender last ran, whatever it found (Increment 1.62); null where it never has. */
  lastRound: { ranAt: string; considered: number; sent: number; unchanged: number; unreachable: number; failed: number } | null;
  message: Message | null;
};

export type AddressFormState = {
  draft: string | null;
  setDraft: (v: string | null) => void;
  save: (address: string) => void;
  /** Sends this viewer their own notices now and records what happened (Increment 1.59). */
  sendNow: () => void;
  /** Asks for a code, and brings one back (Increment 1.61). */
  codeDraft: string;
  setCodeDraft: (v: string) => void;
  askForCode: () => void;
  prove: (code: string) => void;
};

export function DeliveryPanel({
  delivery,
  form,
  busy,
}: {
  delivery: AddressResponse;
  form: AddressFormState;
  busy: string | null;
}) {
  return (
    <section aria-labelledby="delivery" className="mb-10">
      <h2 id="delivery" className="mb-1 text-lg font-semibold">
        What would be sent to you
      </h2>
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        Nothing is sent yet. This is the message that would go to you, and the address it would go to. A message carries
        only sentences the product wrote: never a question or an answer somebody typed, because those leave the product
        and nothing constrains what they say.
      </p>

      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          form.save(form.draft ?? delivery.address?.address ?? "");
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium">Your address</span>
          <input
            type="email"
            className="w-72 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1"
            placeholder="name@example.com"
            value={form.draft ?? delivery.address?.address ?? ""}
            onChange={(e) => form.setDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded-md border border-[var(--line)] px-3 py-1 text-sm" disabled={busy !== null}>
          Save address
        </button>
        {/* Increment 1.59: the act, and its outcome in words. */}
        <button
          type="button"
          className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
          disabled={busy !== null}
          onClick={() => form.sendNow()}
        >
          Send this to me now
        </button>
        {delivery.address?.address ? (
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
            disabled={busy !== null}
            onClick={() => form.save("")}
          >
            Stop sending to me
          </button>
        ) : null}
      </form>

      <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
        {delivery.address === null
          ? "You have never said where to send these, so nothing would go anywhere."
          : delivery.address.address === null
            ? `You asked on ${delivery.address.setAt.slice(0, 10)} not to receive these, so nothing would go anywhere.`
            : `Recorded on ${delivery.address.setAt.slice(0, 10)}. Only you can change this: the database refuses an address set by anybody else.`}
      </p>

      {/* Whether anybody has proved this address reaches this person
          (Increment 1.61). A mistyped address does not fail: it is accepted
          by whoever does own that mailbox, so nothing but a code coming back
          tells the practice the difference. */}
      {delivery.address?.address ? (
        /* A mailbox whose reader said they did not ask for these is not a
           destination, proved or not (Increment 1.67). The screen says so
           here rather than leaving a person to wonder why an address that
           looks settled receives nothing. */
        delivery.refused ? (
          <p className="mb-3 max-w-prose rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--ink-2)]">
            <strong>Somebody reading this address said on {delivery.refused.refusedAt.slice(0, 10)} that they did not
            ask for this practice&apos;s messages.</strong>{" "}
            Nothing further goes there, and this practice cannot save that address again. Save a different one, prove
            it, and your notices resume. This is not undone from here: the only evidence that could lift it is a code
            sent to that mailbox, which is the one thing this practice may no longer send there.
          </p>
        ) : delivery.proof && delivery.standing !== "lapsed" ? (
          <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
            Proved on {delivery.proof.provedAt.slice(0, 10)}: somebody opened this address and brought back the code sent
            to it. Changing the address means proving the new one, because a proof names the address rather than you.{" "}
            {/* A proof stands for a year (Increment 1.65), and the screen says
                when rather than waiting for the day the notices stop. */}
            {delivery.standing === "expiring"
              ? `It needs proving again by ${delivery.lapsesAt?.slice(0, 10)}, and a code is on its way: bring it back and nothing stops.`
              : `It stands until ${delivery.lapsesAt?.slice(0, 10)}, when it needs proving again.`}
          </p>
        ) : (
          <form
            className="mb-3 max-w-prose rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              form.prove(form.codeDraft);
            }}
          >
            <p className="mb-2 text-sm">
              <strong>
                {delivery.lapse?.retired
                  ? `This address stopped being a destination on ${delivery.lapse.retiredAt.slice(0, 10)}`
                  : delivery.standing === "lapsed"
                    ? `The proof that this address reaches you lapsed on ${delivery.lapsesAt?.slice(0, 10)}`
                    : "Nobody has proved this address reaches you"}
              </strong>
              , so nothing is sent to it.{" "}
              {/* A lapse the product is still working on reads differently
                  from one it has given up on (Increment 1.68). */}
              {delivery.lapse
                ? delivery.lapse.retired
                  ? `${delivery.lapse.asked} codes went to it after the proof lapsed and none came back, so the practice stopped asking. Save an address again and prove it, and your notices resume.`
                  : `${delivery.lapse.asked === 0 ? "No code has" : `${delivery.lapse.asked} code${delivery.lapse.asked === 1 ? " has" : "s have"}`} gone out since the proof lapsed. The practice keeps asking once a month, and stops on ${delivery.lapse.retiresAt.slice(0, 10)} if none comes back.`
                : null}{" "}
              A mistyped address
              does not bounce — it is accepted by whoever does own that mailbox — so the practice asks you to fetch a
              code from it instead. This practice will send at most five codes an hour, because an address you type is
              somebody else&apos;s inbox until it is proved.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                disabled={busy !== null}
                onClick={() => form.askForCode()}
              >
                Send me a code
              </button>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium">Code from that message</span>
                <input
                  type="text"
                  className="w-48 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono uppercase"
                  placeholder="ABCD234XYZ"
                  value={form.codeDraft}
                  onChange={(e) => form.setCodeDraft(e.target.value)}
                />
              </label>
              <button type="submit" className="rounded-md border border-[var(--line)] px-3 py-1 text-sm" disabled={busy !== null}>
                Prove this address
              </button>
            </div>
          </form>
        )
      ) : null}

      {/* How the last attempt went, whatever way it went (Increment 1.59). A
          delivery that failed silently would leave its reader believing they
          had been told, which is worse than never having sent. */}
      <p className="mb-1 max-w-prose text-sm text-[var(--ink-2)]">
        {delivery.lastSend === null
          ? "Nothing has been sent to you yet."
          : sendSentence(delivery.lastSend)}
      </p>

      {/* When the sender itself last ran (Increment 1.62). Every round leaves
          a row, including the quiet ones, so a scheduler that stopped is
          visible here rather than looking like a practice that owes nothing
          — which is the difference this whole arc exists to keep. */}
      <p className="mb-1 max-w-prose text-sm text-[var(--ink-2)]">
        {delivery.lastRound === null
          ? "Nothing sends these on a schedule yet, so they go out only when somebody asks."
          : `The sender last ran on ${delivery.lastRound.ranAt.slice(0, 10)} and looked at ${delivery.lastRound.considered} ${delivery.lastRound.considered === 1 ? "person" : "people"}.`}
      </p>

      {/* The standing rule, beside the outcome it governs (Increment 1.60).
          It is on the screen because a reader deciding whether to press the
          button again deserves to know what pressing it already did. */}
      <p className="mb-3 max-w-prose text-sm text-[var(--ink-3)]">
        A refusal that can pass is tried up to three times in one send; a refusal that cannot is tried once. Every
        attempt is kept, so the count is the attempts themselves rather than a number beside them. A scheduled round
        sends only what would read differently from the last message that reached you, or the same message once a week
        if it still stands.
      </p>

      {delivery.message === null ? (
        <p className="max-w-prose text-[var(--ink-2)]">
          No message would go out, because {delivery.seat === "owner" ? "the practice" : "you"} owe nothing. A message that
          arrived whether or not anything happened would not be a signal.
        </p>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Subject</p>
          <p className="mt-1 text-sm font-semibold">{delivery.message.subject}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Body</p>
          <pre className="mt-1 max-w-prose overflow-x-auto whitespace-pre-wrap font-sans text-sm text-[var(--ink-2)]">
            {delivery.message.body}
          </pre>
        </div>
      )}
    </section>
  );
}
