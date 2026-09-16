import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/** Edge-safe auth wrapper for middleware (no database providers). */
export const { auth } = NextAuth(authConfig);
