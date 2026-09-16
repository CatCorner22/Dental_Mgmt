import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { createLiveDatabase, liveAdminUrl, type LiveDatabase } from "@pms/db/testing";
import { seedDatabase } from "@pms/db/seed";
import { DEV_MFA_SECRET, DEV_PASSWORD } from "@pms/db/seed-data";
import { currentCodeForTest } from "../lib/auth/totp";

/**
 * The Practice Risk page in a real browser against the real server.
 *
 * Builds a throwaway database with the live helper (roles, every migration
 * as app_migrate), seeds the two demo tenants, starts `next start` against
 * it with the production boot gates satisfied (an ordinary login role, an
 * encryption key, no development shortcuts), signs in with a time-based
 * code, and drives the page: a refused grant, the refusal of licensing
 * one's own conflict, a licensed grant for someone else, a standalone
 * decision, a frozen snapshot, revocation, and the read-only refusal for a
 * user-rank account.
 *
 * Needs a production build (`pnpm --filter @pms/app build`) and Chromium.
 * Runs only with PMS_E2E=1 and PMS_TEST_POSTGRES_URL; CI sets both after
 * building. PMS_E2E_CHROMIUM may name a Chromium executable.
 */

const adminUrl = liveAdminUrl();
const enabled = process.env.PMS_E2E === "1" && Boolean(adminUrl);
const KEY = "b".repeat(64);
const appDir = fileURLToPath(new URL("../..", import.meta.url));

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

describe.skipIf(!enabled)("Practice Risk page (browser, production server)", () => {
  let db: LiveDatabase;
  let server: ChildProcess | undefined;
  let serverLog = "";
  let browser: Browser;
  let page: Page;
  let base: string;
  const problems: string[] = [];

  async function signIn(username: string) {
    await page.context().clearCookies();
    await page.goto(`${base}/signin?callbackUrl=%2Frisk`, { waitUntil: "networkidle" });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', DEV_PASSWORD);
    await page.fill('input[name="totp"]', currentCodeForTest(username, DEV_MFA_SECRET, Date.now()));
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/risk/, { timeout: 60_000 });
  }

  const alert = () => page.locator("main [role=alert]");
  const grantSelects = () => page.locator("h3:has-text('Grant a duty') ~ div select");
  const flash = (re: RegExp) => page.getByText(re);
  const provenance = () => page.getByText(/^(Frozen |Computed from live rows)/);

  beforeAll(async () => {
    db = await createLiveDatabase(adminUrl!);
    await seedDatabase(db.admin, { env: { ENCRYPTION_KEY: KEY, BCRYPT_COST: "4" } });
    const rw = await db.loginAs("app_rw");
    const append = await db.loginAs("app_append");

    const port = pickPort();
    base = `http://127.0.0.1:${port}`;
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
    const child = spawn(`${appDir}node_modules/.bin/next`, ["start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: appDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => (serverLog += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (serverLog += d.toString()));
    server = child;
    await waitForHealth(base, 60_000);

    browser = await chromium.launch(
      process.env.PMS_E2E_CHROMIUM ? { executablePath: process.env.PMS_E2E_CHROMIUM } : {}
    );
    page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const url = m.location().url ?? "";
      if (/status of 403/.test(m.text()) && url.includes("/api/controls/")) return; // a refusal, expected
      if (url.endsWith("/favicon.ico")) return;
      problems.push(`console: ${m.text()} @ ${url}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("response", (r) => {
      if (r.status() >= 500) problems.push(`http ${r.status()} ${r.url()}`);
    });
  }, 180_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1_000));
    }
    await db?.destroy();
    if (problems.length) {
      // Surface the server log next to the browser problems for diagnosis.
      throw new Error(`Browser problems:\n${problems.join("\n")}\n\nServer log tail:\n${serverLog.slice(-4000)}`);
    }
  }, 60_000);

  it("boots the production server on an ordinary role and shows the page to the owner", async () => {
    await signIn("ridgeview-owner");
    await page.getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    expect(await provenance().innerText()).toMatch(/Directional until a CPA calibrates/);
    expect(await page.locator("section[aria-labelledby=coverage] tbody tr").count()).toBe(6);
    expect(await page.getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/stale import|not measured/);
    expect(await page.getByText(/outside the rulebook/).innerText()).toMatch(/2 grant row/);
    expect(serverLog).toMatch(/\[boot\] database role .*not superuser, not BYPASSRLS, owns no tables/);
  }, 90_000);

  it("refuses the owner cash custody, then refuses the owner licensing their own conflict", async () => {
    const owner = await grantSelects().nth(0).locator("option", { hasText: "Riley Owner" }).getAttribute("value");
    await grantSelects().nth(0).selectOption(owner!);
    await grantSelects().nth(1).selectOption("collect_cash");
    await page.getByRole("button", { name: "Grant", exact: true }).click();
    await alert().waitFor({ timeout: 30_000 });
    const text = await alert().innerText();
    expect(text).toMatch(/Needs a control decision before this grant/);
    expect(text).toMatch(/Cash custody \+ bank reconciliation · Riley Owner · Critical/);
    expect(text).toMatch(/Record a control decision/);

    await alert().locator("input[placeholder*='compensates']").fill("Owner counts the drawer with the front desk each close.");
    await alert().locator("input[type=date]").fill("2026-12-31");
    await alert().getByRole("button", { name: "Record decision and grant" }).click();
    await page.locator("main [role=alert]", { hasText: "Needs a different administrator" }).waitFor({ timeout: 30_000 });
    expect(await alert().getByRole("button", { name: "Record decision and grant" }).count()).toBe(0);
  }, 90_000);

  it("licenses a grant for someone else only with a decision, and shows the governing decision on the row", async () => {
    const finn = await grantSelects().nth(0).locator("option", { hasText: "Finn Front" }).getAttribute("value");
    await grantSelects().nth(0).selectOption(finn!);
    await grantSelects().nth(1).selectOption("collect_cash");
    await page.getByRole("button", { name: "Grant", exact: true }).click();
    await flash(/^Granted Collect patient payments/).waitFor({ timeout: 30_000 });

    await grantSelects().nth(0).selectOption(finn!);
    await grantSelects().nth(1).selectOption("bank_reconcile");
    await page.getByRole("button", { name: "Grant", exact: true }).click();
    await page.locator("main [role=alert]", { hasText: "Needs a control decision" }).waitFor({ timeout: 30_000 });
    await alert().locator("input[placeholder*='compensates']").fill("Owner reconciles independently on Fridays until the bookkeeper starts.");
    await alert().locator("input[type=date]").fill("2026-12-31");
    await alert().getByRole("button", { name: "Record decision and grant" }).click();
    await flash(/^Granted Reconcile bank to PMS/).waitFor({ timeout: 30_000 });

    const row = page.locator("section[aria-labelledby=conflicts] tbody tr", { hasText: "Cash custody + bank reconciliation" }).first();
    expect(await row.innerText()).toMatch(/Finn Front[\s\S]*Critical[\s\S]*Accept residual · review by 2026-12-31/);
    expect(await page.locator("section[aria-labelledby=register] tbody tr").count()).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("records a standalone decision, freezes a snapshot, and revokes with live recomputation", async () => {
    const open = page.locator("section[aria-labelledby=conflicts] tbody tr", { hasText: "No decision yet" }).first();
    await open.getByRole("button", { name: "Record decision" }).click();
    const form = page.locator("section[aria-labelledby=conflicts] form");
    await form.getByRole("combobox").selectOption("monitor");
    await form.locator("input[placeholder*='compensates']").fill("Daily drawer report goes to the owner; watching until the bookkeeper starts.");
    await form.locator("input[type=date]").fill("2026-11-30");
    await form.getByRole("button", { name: "Record decision" }).click();
    await flash(/^Monitor recorded for /).waitFor({ timeout: 30_000 });

    await page.getByRole("button", { name: "Freeze snapshot" }).click();
    await flash(/Snapshot frozen/).waitFor({ timeout: 30_000 });
    expect(await provenance().innerText()).toMatch(/^Frozen /);
    expect(await page.getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/stale import/);

    await page.getByRole("button", { name: "Revoke Reconcile bank to PMS from Finn Front" }).click();
    await flash(/^Revoked Reconcile bank to PMS/).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "Revoke Collect patient payments / cash drawer from Finn Front" }).click();
    await flash(/^Revoked Collect patient payments/).waitFor({ timeout: 30_000 });
    const tiles = await page.locator("section[aria-labelledby=headline] .grid > div").allInnerTexts();
    expect(tiles.map((t) => t.replace(/\s+/g, " "))).toEqual(
      expect.arrayContaining([expect.stringMatching(/OPEN CONFLICTS 0/), expect.stringMatching(/WITHOUT A DECISION 0/)])
    );
  }, 120_000);

  it("shows a user-rank account the Refusal, not the page", async () => {
    await signIn("ridgeview-front");
    await page.locator("main [role=alert]").waitFor({ timeout: 30_000 });
    expect(await page.locator("main [role=alert]").innerText()).toMatch(/Practice Risk did not load[\s\S]*manager rank or above/);
    expect(await page.getByRole("heading", { name: "Headline" }).count()).toBe(0);
  }, 90_000);
});
