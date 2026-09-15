import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" },
      },
      async authorize() {
        // Wired to Postgres in a later increment. Increment 0.1 ships the
        // wrapper, MFA requirement, and sessions table; a live authorize
        // path needs POSTGRES_URL and enrolled users.
        return null;
      },
    }),
  ],
});
