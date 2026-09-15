import { auth } from "@/auth";

export async function getSessionIdFromAuth(_req: Request): Promise<string | null> {
  const session = await auth();
  const extra = session as typeof session & { sessionId?: string };
  if (typeof extra?.sessionId === "string" && extra.sessionId) return extra.sessionId;
  const fromUser = extra?.user?.id;
  return typeof fromUser === "string" && fromUser ? fromUser : null;
}
