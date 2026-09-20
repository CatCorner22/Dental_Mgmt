"use server";

import { withTenantTransaction } from "../db/client";
import { claimSeat } from "./invite";
import type { InviteFormState } from "./inviteFormState";
import { parseInviteRef } from "./inviteLink";

/**
 * The second act in this product that no session stands behind
 * (Increment 1.71).
 *
 * A server action rather than a route under `/api`, so that "every route under
 * `/api` passes through `withGuard`" stays true of the whole surface — the
 * same choice Increment 1.67 made for the stop form, and for the same reason.
 * What authorises this is the secret the practice handed over, and the check
 * for it is the lookup itself.
 *
 * Nothing about the form is trusted. The reference is parsed to shape before
 * the practice id in it is set as the transaction's own, the secret is
 * rechecked against the rows rather than against what the page was rendered
 * with, and the seat is read from the invitation rather than from the browser
 * — so the only thing a caller can choose is which link they hold and which
 * password they set.
 *
 * A mismatch between the two password fields is answered here rather than in
 * the browser, because a check that only the browser makes is a check a caller
 * may skip.
 */

export async function inviteAction(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const ref = parseInviteRef(String(formData.get("ref") ?? ""));
  if (ref === null) {
    return { settled: true, message: "This link is not one we recognise, so no account was opened." };
  }

  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) {
    return { settled: false, message: "The two passwords are not the same. Type the same one twice." };
  }

  const result = await withTenantTransaction(ref.tenantId, "", (db) =>
    claimSeat(db, ref.tenantId, ref.secret, password)
  );
  if (!result.ok) return { settled: result.code !== "weak", message: result.why };
  return {
    settled: true,
    message: `Your seat at ${result.practiceName} is ready. Sign in as ${result.username}; you will be asked to set up a second factor on the way.`,
  };
}
