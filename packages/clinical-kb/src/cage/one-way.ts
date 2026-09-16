// ONE-WAY FEEDBACK — SuperByte → staff, never staff → SuperByte.
//
// SuperByte gives feedback through objective language (observations) and
// graphics. Staff cannot prompt it, rate it, copy from it, or send any signal
// back that could train or steer the model.

export const BYTESTAR_ONE_WAY_NOTICE =
  "SuperByte observes the draft — language and graphics only. You cannot prompt it, copy its text into the note, or send it feedback.";

/** Actions staff must never use to talk TO SuperByte. */
export const BYTESTAR_FORBIDDEN_USER_ACTIONS = [
  "feedback",
  "rate",
  "thumbs-up",
  "thumbs-down",
  "train",
  "opt-in",
  "opt-out",
  "chat",
  "prompt"
] as const;

export type ForbiddenUserAction = (typeof BYTESTAR_FORBIDDEN_USER_ACTIONS)[number];

export function isForbiddenUserAction(action: unknown): action is ForbiddenUserAction {
  return (
    typeof action === "string" &&
    (BYTESTAR_FORBIDDEN_USER_ACTIONS as readonly string[]).includes(action)
  );
}
