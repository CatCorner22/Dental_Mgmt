"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import {
  loginFailureMessage,
  sanitizeCallbackPath,
  type LoginState,
} from "./loginFormState";

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();
  const dest = sanitizeCallbackPath(String(formData.get("callbackUrl") ?? ""));
  const offered = prev.offerTotp || formData.get("mfaOffered") === "1" || totp !== "";
  const attempts = Math.max(prev.attempts, Number(formData.get("attempts")) || 0) + 1;

  try {
    await signIn("credentials", { username, password, totp, redirectTo: dest });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error: loginFailureMessage(true, offered, attempts),
        offerTotp: true,
        attempts,
        username,
      };
    }
    throw err;
  }
  return prev;
}
