import { refuseIfSignInEnded } from "@/lib/auth/guardedFetch";
import { sendSentence, type SendRecord } from "@/lib/notices/sendOutcome";
import type { AddressResponse } from "./delivery-panel";

/**
 * The four acts behind the delivery panel, and the reading it renders
 * (Increments 1.58 to 1.61; shared since 1.74).
 *
 * The panel is on two screens now — Practice Risk for the practice's own
 * seats, Month-end for the outside accountant, which cannot open the first —
 * and an act copied onto the second screen would be a second answer to one
 * question. So the route calls and the sentences they produce live here once,
 * and each screen keeps only what is its own: which control is busy, where the
 * message goes, and when to re-read.
 *
 * Every act returns the sentence to show and throws on a refusal, because the
 * screens differ in how they report and agree on what to say. Each answers in
 * the route's own words where it gives any: `why` is written for the person who
 * pressed the button, and a second wording here would say something the rule
 * does not.
 */

/** A route refusal, in whichever field the route puts it. */
async function refusal(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { why?: string; error?: string };
  return body.why ?? body.error ?? fallback;
}

/** Where this viewer's notices would go, and what would go there. Nothing is sent. */
export async function readDelivery(): Promise<AddressResponse> {
  const res = await fetch("/api/notices/address");
  const body = (await res.json().catch(() => ({}))) as AddressResponse & { error?: string };
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error(body.error ?? "Could not read where your messages would go.");
  return body;
}

/** What to call the act of saving; an empty address is the act of stopping. */
export function saveAddressLabel(address: string): string {
  return address === "" ? "Stop sending to me" : "Save address";
}

/**
 * Records where this person's notices would go, or that they would go nowhere
 * (Increment 1.58). It sends nothing and never names a user: the route takes
 * the caller's own id, and the database refuses a row naming anybody else.
 */
export async function saveAddress(address: string): Promise<string> {
  const res = await fetch("/api/notices/address", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error(await refusal(res, "Could not record that."));
  return address === "" ? "You will receive no messages." : `Messages would go to ${address}.`;
}

/**
 * Sends this person their own notices now (Increment 1.59). Every outcome is
 * reported in words, the failure loudest of all: a delivery that failed
 * silently would leave the reader believing they had been told.
 */
export async function sendNoticesNow(): Promise<string> {
  const res = await fetch("/api/notices/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = (await res.json().catch(() => ({}))) as
    | { outcome: "nothing_owed" }
    | { outcome: "sent" | "failed" | "unreachable"; record: SendRecord; attempts: number };
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error("Could not attempt a send.");
  if (body.outcome === "nothing_owed") return "Nothing is owed, so nothing was sent.";
  // The attempt count belongs to the act the person just asked for, and only to
  // it: the table keeps the attempts, and a reader looking later counts rows
  // rather than trusting a number stored beside them.
  const tries = body.attempts > 1 ? ` The practice tried ${body.attempts} times.` : "";
  return `${sendSentence(body.record)}${tries}`;
}

/**
 * Asks for a code to be sent to the address on file (Increment 1.61).
 *
 * The outcome of the send is reported in the same words a send of notices
 * gets, because it is the same act through the same transport: a person left
 * waiting for a code that never left would conclude the product is broken, or
 * worse, that their address works.
 */
export async function askForCode(): Promise<string> {
  const res = await fetch("/api/notices/prove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = (await res.json().catch(() => ({}))) as {
    why?: string;
    error?: string;
    delivered?: { record: SendRecord; attempts: number };
  };
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error(body.why ?? body.error ?? "Could not send a code.");
  const record = body.delivered?.record;
  return record ? sendSentence(record) : "A code was sent.";
}

/** Brings a code back, which is the proof (Increment 1.61). */
export async function proveAddress(code: string): Promise<string> {
  const res = await fetch("/api/notices/prove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  refuseIfSignInEnded(res);
  if (!res.ok) throw new Error(await refusal(res, "Could not check that code."));
  return "This address is proved. Your notices will go to it.";
}
