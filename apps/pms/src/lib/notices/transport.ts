import type { Message } from "./message";
import type { FailureKind } from "./sendOutcome";

/**
 * The one thing that carries a message out of the product (Increments 1.59 and
 * 1.60).
 *
 * A port rather than a provider, and deliberately not a provider yet. Writing
 * an SMTP client against no server would be untested code that looks like
 * working code, and picking a vendor is the practice's decision rather than
 * this increment's. What the increment owes is the shape: one call, two
 * outcomes, and a refusal that says why in words a person can act on.
 *
 * **There is no default.** A practice that has configured nothing cannot send,
 * and the product says so the first time somebody asks rather than appearing to
 * work. That is the rule the whole increment turns on — a failure to deliver is
 * visible, never swallowed — and a silently discarded message is the worst
 * possible default because the reader would believe they had been told.
 *
 * **A refusal says whether it could pass** (Increment 1.60). Only the transport
 * can know that: the caller sees an error string and cannot tell a provider
 * that was busy for a second from an address that does not exist. Making the
 * port answer it is what lets the sender retry the first and refuse to waste
 * anybody's time on the second.
 */

export type Delivery = { ok: true } | { ok: false; why: string; kind: FailureKind };

export type Transport = {
  /** A name for the record, so a reader can tell which path a message took. */
  readonly name: string;
  send(to: string, message: Message): Promise<Delivery>;
};

/**
 * Holds what it was given and reports success, for development and for every
 * test that drives the send path. It never reaches the network, so a suite can
 * exercise delivery without a message escaping to a real person.
 */
export function memoryTransport(): Transport & { sent: { to: string; message: Message }[] } {
  const sent: { to: string; message: Message }[] = [];
  return {
    name: "memory",
    sent,
    async send(to, message) {
      sent.push({ to, message });
      return { ok: true };
    },
  };
}

/**
 * Refuses everything, with the reason as its own words and the kind it names.
 *
 * `attempts` counts the calls, so a suite can assert the thing that matters
 * about a permanent refusal: the sender does not try it again.
 */
export function refusingTransport(
  why: string,
  kind: FailureKind
): Transport & { readonly attempts: number } {
  // A closure rather than a field this method reads off `this`: a transport
  // handed around as a bare function would otherwise stop counting, silently,
  // and a count that can silently stop is worse than no count.
  let attempts = 0;
  return {
    name: kind === "permanent" ? "none" : "refusing",
    get attempts() {
      return attempts;
    },
    async send() {
      attempts += 1;
      return { ok: false, why, kind };
    },
  };
}

/**
 * What an unconfigured practice gets: a refusal, in words, that will not pass.
 *
 * This is not an error state in the code. It is the honest report that the
 * product has nowhere to hand a message to, recorded as a failed attempt like
 * any other so that somebody sees it. It is **permanent** by the plain meaning
 * of the word: no number of retries configures a transport, and pretending
 * otherwise would spend a person's wait on an outcome nobody could reach.
 */
export function unconfiguredTransport(why: string): Transport & { readonly attempts: number } {
  return refusingTransport(why, "permanent");
}

/**
 * Refuses transiently a fixed number of times and then succeeds.
 *
 * It exists for the same reason `memoryTransport` does: the retry rule is the
 * point of Increment 1.60, and a suite cannot prove a rule about a provider
 * that comes back without a provider that comes back. `transportFromEnv` never
 * returns it, so no deployment can reach it by configuration, and a test
 * asserts that.
 */
export function flakyTransport(
  refusals: number,
  why: string
): Transport & { readonly attempts: number; sent: { to: string; message: Message }[] } {
  const sent: { to: string; message: Message }[] = [];
  let attempts = 0;
  return {
    name: "flaky",
    get attempts() {
      return attempts;
    },
    sent,
    async send(to, message) {
      attempts += 1;
      if (attempts <= refusals) return { ok: false, why, kind: "transient" };
      sent.push({ to, message });
      return { ok: true };
    },
  };
}

/**
 * The transport this deployment has, read from the environment on every call
 * rather than captured once, so a test can set one without restarting a module.
 *
 * `PMS_NOTICE_TRANSPORT=memory` is the only value that sends anything today,
 * and it sends nowhere. Anything else, including nothing at all, refuses in
 * words naming the setting that would change it.
 */
export function transportFromEnv(env: NodeJS.ProcessEnv = process.env): Transport {
  if (env.PMS_NOTICE_TRANSPORT === "memory") return memoryTransport();
  return unconfiguredTransport(
    "This practice has no way to send messages yet. Nothing was delivered. Set PMS_NOTICE_TRANSPORT to configure one."
  );
}
