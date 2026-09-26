"use server";

import { withTenantTransaction } from "../db/client";
import { refuseAddress } from "./stop";
import type { StopFormState } from "./stopFormState";
import { parseStopRef } from "./stopLink";

/**
 * The one act in this product that no session stands behind (Increment 1.67).
 *
 * A server action rather than a route under `/api`, so that "every route under
 * `/api` passes through `withGuard`" stays true of the whole surface rather
 * than true except here. What authorises this is the secret the message
 * carried, and the check for it is the lookup itself: a secret naming no row
 * refuses, and it refuses in the same words whichever practice was named.
 *
 * Nothing about the form is trusted. The reference is parsed to shape before
 * the practice id in it is set as the transaction's own, the secret is
 * rechecked against the rows rather than against what the page was rendered
 * with, and the mailbox is read from the challenge rather than from the
 * browser — so the only thing a caller can choose is which link they hold.
 *
 * There is no cross-site concern worth guarding here. A page that could forge
 * this request would need the secret, and anything holding the secret can make
 * the request directly.
 *
 * The state this form carries lives in `stopFormState.ts`, because a
 * `"use server"` file may export nothing but async functions.
 */

export async function stopAction(_prev: StopFormState, formData: FormData): Promise<StopFormState> {
  const ref = parseStopRef(String(formData.get("ref") ?? ""));
  if (ref === null) {
    return { settled: true, message: "This link is not one we recognise, so nothing was changed." };
  }

  const result = await withTenantTransaction(ref.tenantId, "", (db) => refuseAddress(db, ref.tenantId, ref.secret));
  if (!result.ok) return { settled: true, message: result.why };
  return {
    settled: true,
    message: `${result.practiceName} has been told. It will send nothing further to this mailbox, and cannot save this address again.`,
  };
}
