// BYTESTAR DEPLOYMENT GATES — the silent cage around the pioneer.
//
// Increment 0.1 amendment (not a verbatim Smile Notes lift):
//   1. BYTESTAR_ENABLED defaults OFF. Unset is closed. Enabled only when
//      env.BYTESTAR_ENABLED === "1" AND a provider key is present AND
//      BYTESTAR_KILL is not "1".
//   2. AI_GATEWAY_API_KEY — the provider door. A key alone does not open
//      SuperByte. No provider key is required to boot this package or the app.
//   3. BYTESTAR_KILL — the SILENT killswitch. When set to "1", SuperByte is
//      unavailable. The model is never told that this variable exists.
//
// The "silent" part is load-bearing. A killswitch the model can reason about
// is a killswitch the model can try to talk its way around.
//
// This file is only the door. It does not import a provider service.

export interface ByteStarConfig {
  /** True only when every gate is open and the silent kill is not tripped. */
  enabled: boolean;
  /** Model id. Inline default — no assist service import. */
  model: string;
  /**
   * True when the silent killswitch is the reason the feature is dark.
   * Exposed ONLY to operator diagnostics — never to the model, never to
   * end-user chrome (which sees a bland "unavailable").
   */
  silentlyKilled: boolean;
  /** Diagnostics: is the separate AI-assist switch on? */
  assistOn: boolean;
  /** Diagnostics: is a gateway key present? */
  providerKeyPresent: boolean;
  /**
   * True when the pioneer is not explicitly enabled.
   * Increment 0.1: unset means opted out (default off), not open.
   */
  pioneerOptedOut: boolean;
}

export function getByteStarConfig(
  env: Record<string, string | undefined> = process.env
): ByteStarConfig {
  const providerKeyPresent = Boolean(env.AI_GATEWAY_API_KEY?.trim());
  const explicitlyEnabled = env.BYTESTAR_ENABLED === "1";
  const pioneerOptedOut = !explicitlyEnabled;
  const silentlyKilled = env.BYTESTAR_KILL === "1";
  return {
    enabled: explicitlyEnabled && providerKeyPresent && !silentlyKilled,
    model: env.BYTESTAR_MODEL || "unavailable",
    silentlyKilled,
    assistOn: env.ASSIST_ENABLED === "1",
    providerKeyPresent,
    pioneerOptedOut
  };
}

/** Bland copy for any caller that is not an operator monitor. */
export const BYTESTAR_UNAVAILABLE =
  "SuperByte is unavailable right now. Keep drafting with Byte; your note is unchanged.";
