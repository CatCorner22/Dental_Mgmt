import { authStoreKind } from "@/lib/auth/resolveStore";
import { APP_INCREMENT, HOLDS_PATIENT_ROWS } from "@/lib/product";

/**
 * The unguarded answer (Increment 1.105 rewrote what it says).
 *
 * This route has no `withGuard`, so it is the one thing this product tells
 * somebody who has not signed in. It said `increment: "0.11"` and
 * `phiPatientRows: false`; the first had been wrong for ninety-three
 * increments, and the second was a false statement about protected health
 * information — `patients` has carried a name and a date of birth since
 * migration 0009. Both figures come from `lib/product` now, where a check
 * reads each against the thing that makes it true.
 */
export async function GET() {
  return Response.json({
    ok: true,
    increment: APP_INCREMENT,
    bytestarDefault: "off",
    phiPatientRows: HOLDS_PATIENT_ROWS,
    authStore: authStoreKind(),
  });
}
