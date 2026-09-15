import { createMemoryStore, getMemoryStoreSingleton, type MemoryStore } from "./memoryStore";
import { createPostgresStore } from "./postgresStore";
import { storePorts } from "./storePorts";
import type { AuthPorts } from "./ports";
import type { AuthStore } from "./store";

export type AuthStoreKind = "memory" | "postgres" | "none";

export function authStoreKind(
  env: Record<string, string | undefined> = process.env
): AuthStoreKind {
  if (env.AUTH_DEV_MEMORY === "1") return "memory";
  if (env.POSTGRES_URL) return "postgres";
  return "none";
}

export function assertAuthStoreAllowed(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.NODE_ENV === "production" && env.AUTH_DEV_MEMORY === "1") {
    throw new Error("AUTH_DEV_MEMORY is forbidden in production.");
  }
}

export async function getAuthStore(
  env: Record<string, string | undefined> = process.env
): Promise<AuthStore | null> {
  assertAuthStoreAllowed(env);
  const kind = authStoreKind(env);
  if (kind === "memory") return getMemoryStoreSingleton(env);
  if (kind === "postgres") return createPostgresStore(env);
  return null;
}

export async function getAuthPorts(
  getSessionId: (req: Request) => Promise<string | null>,
  env: Record<string, string | undefined> = process.env
): Promise<AuthPorts | undefined> {
  const store = await getAuthStore(env);
  if (!store) return undefined;
  return storePorts(store, getSessionId);
}

export async function createTestMemoryStore(): Promise<MemoryStore> {
  return createMemoryStore();
}
