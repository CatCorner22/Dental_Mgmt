"use client";

import { useEffect, useState } from "react";

interface MeResponse {
  ok: boolean;
  username?: string;
  displayName?: string;
  role?: string;
  error?: string;
}

export function SessionStatus() {
  const [state, setState] = useState<"loading" | MeResponse>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async (res) => {
        const body = (await res.json()) as MeResponse;
        if (!cancelled) setState({ ...body, ok: res.ok && body.ok });
      })
      .catch(() => {
        if (!cancelled) setState({ ok: false, error: "Could not read the session." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <p className="text-sm text-[var(--ink-2)]">Checking session…</p>;
  }
  if (!state.ok) {
    return (
      <p className="text-sm text-[var(--ink-2)]">
        Not signed in.{" "}
        <a className="font-semibold text-[var(--link)] underline" href="/signin">
          Sign in
        </a>
      </p>
    );
  }
  return (
    <p className="text-sm text-[var(--ink-2)]">
      Signed in as <strong className="text-[var(--ink)]">{state.displayName}</strong> (
      {state.username}, {state.role}).
    </p>
  );
}
