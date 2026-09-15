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
      const u = user as { sessionId?: string; pwAt?: string } | undefined;
      if (u?.sessionId) token.sessionId = u.sessionId;
      if (u?.pwAt) token.pwAt = u.pwAt;
      return token;
    },
    session({ session, token }) {
      const extra = session as typeof session & { sessionId?: string };
      if (typeof token.sessionId === "string") extra.sessionId = token.sessionId;
      return extra;
    },
  },
};
