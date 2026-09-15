import type { NextAuthConfig } from "next-auth";

/**
 * NextAuth v5 beta is pinned (ADR Increment 0.1). Session authority lives in
 * the server `sessions` table and is re-checked inside withGuard / requireAccess.
 * The JWT is transport for the opaque session id only.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      const u = user as
        | { id?: string; sessionId?: string; pwAt?: string; needsMfaEnrollment?: boolean }
        | undefined;
      if (u?.sessionId) token.sessionId = u.sessionId;
      else if (u?.id) token.sessionId = u.id;
      if (u?.pwAt) token.pwAt = u.pwAt;
      if (u?.needsMfaEnrollment) token.needsMfaEnrollment = true;
      else if (u) token.needsMfaEnrollment = false;
      return token;
    },
    session({ session, token }) {
      const extra = session as typeof session & {
        sessionId?: string;
        needsMfaEnrollment?: boolean;
      };
      if (typeof token.sessionId === "string") extra.sessionId = token.sessionId;
      if (typeof token.sessionId === "string" && extra.user) extra.user.id = token.sessionId;
      extra.needsMfaEnrollment = token.needsMfaEnrollment === true;
      return extra;
    },
  },
};
