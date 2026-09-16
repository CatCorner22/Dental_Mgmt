export interface LoginState {
  error: string;
  offerTotp: boolean;
  attempts: number;
  username: string;
}

export const initialLoginState: LoginState = {
  error: "",
  offerTotp: false,
  attempts: 0,
  username: "",
};

export function sanitizeCallbackPath(raw: string | undefined | null): string {
  if (!raw) return "/home";
  const isPath = raw.startsWith("/") && !raw.startsWith("//");
  const isHttpAbsolute = /^https?:\/\//i.test(raw);
  if (!isPath && !isHttpAbsolute) return "/home";
  try {
    const u = new URL(raw, "http://internal");
    const path = u.pathname + u.search;
    if (!path.startsWith("/") || path.startsWith("//")) return "/home";
    return path === "/" ? "/home" : path;
  } catch {
    return "/home";
  }
}

export function loginFailureMessage(
  mfaAvailable: boolean,
  totpWasOffered: boolean,
  attempts: number
): string {
  const throttleHint =
    attempts >= 3
      ? " If you have tried several times, wait a few minutes — sign-in is briefly paused after repeated failures."
      : "";
  const base = !mfaAvailable
    ? "Sign-in failed. Check the username and password."
    : totpWasOffered
      ? "Sign-in failed. Check the username, password, and authenticator code."
      : "Sign-in failed. If this account uses an authenticator app, enter the current code below.";
  return base + throttleHint;
}
