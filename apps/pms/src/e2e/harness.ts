import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_MFA_SECRET, DEV_PASSWORD } from "@pms/db/seed-data";
import { currentCodeForTest } from "../lib/auth/totp";

/**
 * Shared harness for the browser suites.
 *
 * Builds a throwaway database with the live helper (roles, every migration
 * as app_migrate), seeds the two demo tenants, and starts `next start`
 * against it with the production boot gates satisfied: an ordinary login
 * role that inherits app_rw, an encryption key instead of the development
 * key, an append-role connection, backup and object-storage targets, and no
 * in-memory auth. Chromium then signs in with a time-based code.
 *
 * Needs a production build (`pnpm --filter @pms/app build`) and Chromium.
 * Suites run only with PMS_E2E=1 and PMS_TEST_POSTGRES_URL; CI sets both
 * after building. PMS_E2E_CHROMIUM may name a Chromium executable.
 */

export const adminUrl = liveAdminUrl();
export const e2eEnabled = process.env.PMS_E2E === "1" && Boolean(adminUrl);

const KEY = "b".repeat(64);
const appDir = fileURLToPath(new URL("../..", import.meta.url));

export type E2eApp = {
  base: string;
  db: LiveDatabase;
  serverLog(): string;
  stop(): Promise<void>;
};

function pickPort(): number {
  return 3100 + Math.floor(Math.random() * 800);
}

async function waitForHealth(base: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  let last = "";
  while (Date.now() < until) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.status === 200) return;
      last = `status ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become healthy at ${base}: ${last}`);
}

export async function startProductionApp(): Promise<E2eApp> {
  const db = await createLiveDatabase(adminUrl!);
  await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: KEY, BCRYPT_COST: "4" } });
  const rw = await db.loginAs("app_rw");
  const append = await db.loginAs("app_append");

  const port = pickPort();
  const base = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    POSTGRES_URL: rw,
    APPEND_ROLE_DSN: append,
    ALLOW_INSECURE_DB: "1",
    ENCRYPTION_KEY: KEY,
    AUTH_SECRET: "e2e-only-secret",
    BACKUP_TARGET: "file:///tmp/pms-e2e-backups",
    OBJECT_STORAGE_URL: "file:///tmp/pms-e2e-heads",
    BCRYPT_COST: "4",
  };
  // The test runner sets development shortcuts that production refuses.
  delete env.DEV_MFA_KEY;
  delete env.AUTH_DEV_MEMORY;

  let log = "";
  const server: ChildProcess = spawn(`${appDir}node_modules/.bin/next`, ["start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (d: Buffer) => (log += d.toString()));
  server.stderr?.on("data", (d: Buffer) => (log += d.toString()));
  try {
    await waitForHealth(base, 60_000);
  } catch (err) {
    server.kill("SIGTERM");
    await db.destroy();
    throw new Error(`${err instanceof Error ? err.message : String(err)}\n${log.slice(-4000)}`);
  }

  return {
    base,
    db,
    serverLog: () => log,
    async stop() {
      if (!server.killed) {
        server.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 1_000));
      }
      await db.destroy();
    },
  };
}

export type E2eBrowser = {
  browser: Browser;
  page: Page;
  /** Console errors, page errors, and 5xx responses seen so far; expected refusals are filtered. */
  problems: string[];
  signIn(username: string, callbackPath: string): Promise<void>;
  close(): Promise<void>;
};

export async function openBrowser(app: E2eApp): Promise<E2eBrowser> {
  const browser = await chromium.launch(
    process.env.PMS_E2E_CHROMIUM ? { executablePath: process.env.PMS_E2E_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url ?? "";
    // A refusal answers 403 or 409 and the browser logs it; that is the product working.
    if (/status of (403|409)/.test(m.text()) && url.includes("/api/")) return;
    if (url.endsWith("/favicon.ico")) return;
    problems.push(`console: ${m.text()} @ ${url}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`http ${r.status()} ${r.url()}`);
  });

  return {
    browser,
    page,
    problems,
    async signIn(username, callbackPath) {
      await page.context().clearCookies();
      await page.goto(`${app.base}/signin?callbackUrl=${encodeURIComponent(callbackPath)}`, { waitUntil: "networkidle" });
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', DEV_PASSWORD);
      await page.fill('input[name="totp"]', currentCodeForTest(username, DEV_MFA_SECRET, Date.now()));
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => url.pathname === callbackPath, { timeout: 60_000 });
    },
    async close() {
      await browser.close().catch(() => undefined);
    },
  };
}

/** Throws with the server log attached when the browser saw problems. */
export function assertNoProblems(b: E2eBrowser, app: E2eApp): void {
  if (b.problems.length) {
    throw new Error(`Browser problems:\n${b.problems.join("\n")}\n\nServer log tail:\n${app.serverLog().slice(-4000)}`);
  }
}
