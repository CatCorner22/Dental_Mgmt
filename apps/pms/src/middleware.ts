import { auth } from "@/auth-edge";
import { enrollmentGateAllows } from "@/lib/auth/enrollmentGate";
import { NextResponse } from "next/server";

/**
 * Unenrolled accounts may reach /enroll-mfa and its API only. Every other
 * signed-in route waits until MFA enrollment completes and the user signs in
 * again with an authenticator code.
 *
 * An enrolled account may reach it too (Increment 1.76). It used to be bounced
 * to /home, which was the last thing holding the second factor shut: recovery
 * codes only ever decrease, and the one screen that mints a new set was closed
 * to anybody who had already used it. A person on their last code and a new
 * phone had nowhere to go, so every account was counting down to a lockout
 * nothing could undo. The screen reads its visitor and says which act it is.
 *
 * Which paths the gate admits is `enrollmentGateAllows`, and it admits the
 * sign-in page since Increment 1.80: the claim this middleware reads is minted
 * at sign-in and never rewritten, so it outlives the enrolment that answered
 * it, and a gate that also held the door shut turned a stale claim into a
 * screen nobody could leave. That file carries the whole account.
 */
export default auth((req) => {
  const path = req.nextUrl.pathname;
  const session = req.auth as { needsMfaEnrollment?: boolean } | null;
  const needs = session?.needsMfaEnrollment === true;

  if (needs && !enrollmentGateAllows(path)) {
    return NextResponse.redirect(new URL("/enroll-mfa", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
