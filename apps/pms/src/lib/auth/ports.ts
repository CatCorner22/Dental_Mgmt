import type { FreshUser, SessionRow } from "./types";

export interface AuthPorts {
  getSessionId(req: Request): Promise<string | null>;
  getSession(id: string): Promise<SessionRow | null>;
  getUser(id: string): Promise<FreshUser | null>;
  touchSession(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  setTenantContext(tenantId: string, userId: string): Promise<void>;
  logPhiAccess(input: {
    tenantId: string;
    userId: string;
    purpose: string;
    recordKind: string;
    recordIds: string[];
    at: Date;
  }): Promise<void>;
}

export const IDLE_MS = {
  desk: 30 * 60 * 1000,
  operatory: 10 * 60 * 1000,
} as const;

export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

export function memoryPorts(seed?: {
  session?: SessionRow;
  user?: FreshUser;
  sessionId?: string;
}): AuthPorts & { phiLog: unknown[]; tenantSets: string[] } {
  const phiLog: unknown[] = [];
  const tenantSets: string[] = [];
  let session = seed?.session ?? null;
  const user = seed?.user ?? null;
  const sessionId = seed?.sessionId ?? session?.id ?? null;
  return {
    phiLog,
    tenantSets,
    async getSessionId() {
      return sessionId;
    },
    async getSession(id) {
      return session && session.id === id ? session : null;
    },
    async getUser(id) {
      return user && user.id === id ? user : null;
    },
    async touchSession(id, lastSeenAt, idleExpiresAt) {
      if (session && session.id === id) {
        session = { ...session, lastSeenAt, idleExpiresAt };
      }
    },
    async setTenantContext(tenantId, userId) {
      tenantSets.push(`${tenantId}:${userId}`);
    },
    async logPhiAccess(input) {
      phiLog.push(input);
    },
  };
}
