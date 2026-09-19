import type { Message } from "./message";

/**
 * The one thing that carries a message out of the product (Increment 1.59).
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
 */

export type Delivery = { ok: true } | { ok: false; why: string };

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
 * A transport that refuses everything, with the reason as its own words.
 *
 * This is what an unconfigured practice gets. It is not an error state in the
 * code: it is the honest report that the product has nowhere to hand a message
 * to, recorded as a failed attempt like any other so that somebody sees it.
 */
export function unconfiguredTransport(why: string): Transport {
  return {
    name: "none",
    async send() {
      return { ok: false, why };
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
