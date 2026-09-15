import { auth } from "@/auth";

export async function getSessionIdFromAuth(_req: Request): Promise<string | null> {
  const session = await auth();
  const extra = session as typeof session & { sessionId?: string };
  return extra?.sessionId ?? null;
}
