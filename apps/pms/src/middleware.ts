import { auth } from "@/auth-edge";
import { NextResponse } from "next/server";

/**
 * Unenrolled accounts may reach /enroll-mfa and its API only. Every other
 * signed-in route waits until MFA enrollment completes and the user signs in
 * again with an authenticator code.
 */
export default auth((req) => {
  const path = req.nextUrl.pathname;
  const session = req.auth as { needsMfaEnrollment?: boolean } | null;
  const needs = session?.needsMfaEnrollment === true;

  const enrollPath =
    path === "/enroll-mfa" ||
    path.startsWith("/api/enroll-mfa") ||
    path.startsWith("/api/auth");

  if (needs && !enrollPath) {
    return NextResponse.redirect(new URL("/enroll-mfa", req.url));
  }
  if (!needs && path === "/enroll-mfa" && session) {
    return NextResponse.redirect(new URL("/home", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
