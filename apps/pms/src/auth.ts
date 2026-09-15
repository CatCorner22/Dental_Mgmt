import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authorizeCredentials } from "./lib/auth/authorize";
import { getAuthStore } from "./lib/auth/resolveStore";

function ensureDevAuthSecret(): void {
  if (process.env.AUTH_SECRET) return;
  if (process.env.AUTH_DEV_MEMORY === "1" && process.env.NODE_ENV !== "production") {
    process.env.AUTH_SECRET = "dev-only-auth-secret-increment-0.2";
  }
}

ensureDevAuthSecret();

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
      async authorize(creds, request) {
        const store = await getAuthStore();
        if (!store) return null;
        const result = await authorizeCredentials(
          store,
          {
            username: creds?.username,
            password: creds?.password,
            totp: creds?.totp,
          },
          request as Request | undefined
        );
        if (!result.ok) return null;
        return {
          id: result.user.id,
          sessionId: result.user.sessionId,
          pwAt: result.user.pwAt,
        };
      },
    }),
  ],
});
