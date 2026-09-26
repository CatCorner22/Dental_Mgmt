import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
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
 *
 * Each suite also audits the states it reaches with axe-core (the build the
 * prototype harness vendors), against WCAG 2.0, 2.1, and 2.2 A and AA plus
 * axe's best practices. A critical or serious violation fails the suite;
 * moderate and minor ones are printed. Automated rules cover a minority of
 * WCAG; the rest stays with the UX audit.
 */

export const adminUrl = liveAdminUrl();
export const e2eEnabled = process.env.PMS_E2E === "1" && Boolean(adminUrl);

const KEY = "b".repeat(64);
const appDir = fileURLToPath(new URL("../..", import.meta.url));
const AXE_PATH = fileURLToPath(new URL("../../../../scripts/vendor/axe-core/axe.min.js", import.meta.url));
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export type E2eApp = {
  base: string;
  db: LiveDatabase;
  serverLog(): string;
  stop(): Promise<void>;
};

function pickPort(): number {
  return 3100 + Math.floor(Math.random() * 800);
}

const TOTP_STEP_MS = 30_000;
const spentSteps = new Map<string, number>();

/**
 * A code the server has not seen for this account. Codes are single-use, so
 * each sign-in takes the next unspent step inside the server's ±1 window,
 * waiting for the clock when both the current and the next step are spent.
 */
export async function freshCodeForTest(username: string, secret: string = DEV_MFA_SECRET): Promise<string> {
  for (;;) {
    const now = Date.now();
    const current = Math.floor(now / TOTP_STEP_MS);
    const step = Math.max(current, (spentSteps.get(username) ?? -1) + 1);
    if (step <= current + 1) {
      spentSteps.set(username, step);
      return currentCodeForTest(username, secret, step * TOTP_STEP_MS);
    }
    await new Promise((r) => setTimeout(r, (current + 1) * TOTP_STEP_MS - now + 50));
  }
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
    // A transport that reaches no network (Increment 1.59), so the browser can
    // drive delivery end to end without a message escaping to a real person.
    // Unset, the product refuses to send and says so, which the unit and live
    // suites cover; here the working path is what needs proving.
    PMS_NOTICE_TRANSPORT: "memory",
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

export type AxeViolation = {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  helpUrl: string;
  tags: string[];
  /** The first offending nodes: selector, outer HTML head, and axe's summary of what to fix. */
  nodes: { target: string; html: string; summary: string }[];
  count: number;
  /** The suite states (page and moment) this violation was seen in. */
  states: string[];
};

export type E2eBrowser = {
  browser: Browser;
  page: Page;
  /** Console errors, page errors, and 5xx responses seen so far; expected refusals are filtered. */
  problems: string[];
  /** Distinct axe violations seen so far, one per rule and first target. */
  a11y: AxeViolation[];
  /**
   * One row per audited state: the document title the audit saw, and how many rules
   * passed, failed, or need review, so a silent no-op cannot pass. The title is
   * recorded because a document sampled mid-update reads differently from the same
   * screen at rest, and the next such failure should say so rather than be guessed at.
   */
  audits: { state: string; title: string; passes: number; violations: number; incomplete: number }[];
  signIn(username: string, callbackPath: string): Promise<void>;
  /**
   * Runs `fn` with a 401 on `/api/` tolerated, because the case is driving a
   * sign-in that has ended on purpose (Increment 1.81). It is scoped rather
   * than standing: outside this window a 401 still fails the suite, which is
   * the check that catches a session the product lost track of.
   */
  signedOut<T>(fn: () => Promise<T>): Promise<T>;
  /**
   * The document title once the head has settled, which is the only moment a
   * title assertion can be about the screen rather than about the frame. Reading
   * `page.title()` raw samples an instant that may fall inside a head swap; see
   * the comment on the implementation for what was measured there.
   */
  titleAtRest(): Promise<string>;
  /** Runs axe on the page as it stands and records the violations under `state`. Returns the serious and critical ones. */
  audit(state: string): Promise<AxeViolation[]>;
  close(): Promise<void>;
};

type RawAxeResult = {
  passes: number;
  incomplete: string[];
  violations: {
    id: string;
    impact: AxeViolation["impact"] | null;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: { target: string[]; html: string; failureSummary?: string }[];
  }[];
};

export async function openBrowser(app: E2eApp): Promise<E2eBrowser> {
  const browser = await chromium.launch(
    process.env.PMS_E2E_CHROMIUM ? { executablePath: process.env.PMS_E2E_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const problems: string[] = [];
  /** Open while a case is deliberately driving a sign-in that has ended. */
  let signedOutWindow = false;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location().url ?? "";
    // A refusal answers 403 or 409 and the browser logs it; that is the product working.
    if (/status of (403|409)/.test(m.text()) && url.includes("/api/")) return;
    // A sign-in that has ended answers 401, and a case may drive one on
    // purpose — finishing an enrolment revokes the session that reached the
    // screen (Increment 1.80), and a session can end under a person anywhere
    // in the product (Increment 1.81). The window is opened by the case, for
    // as long as it is driving that state, rather than standing open on a
    // route: a 401 outside it is a session the product lost track of, and that
    // must still fail a suite.
    if (/status of 401/.test(m.text()) && url.includes("/api/") && signedOutWindow) return;
    if (url.endsWith("/favicon.ico")) return;
    problems.push(`console: ${m.text()} @ ${url}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`http ${r.status()} ${r.url()}`);
  });

  const a11y: AxeViolation[] = [];
  const audits: E2eBrowser["audits"] = [];
  const axeSource = readFileSync(AXE_PATH, "utf8");

  /** See the E2eBrowser declaration. */
  const titleAtRest = async (): Promise<string> => {
    // Read the title at rest, never mid-update. Every route here declares
    // metadata, so an empty document.title is always a document caught between
    // renders -- the head swapped by a client navigation or a refresh -- and
    // never a screen a person can be on.
    //
    // The window is real and was measured, not assumed. Patching the four
    // mutators on document.head and recording document.title synchronously
    // after each call, a link navigation from /ledger to an account shows the
    // old <title> removed, two unrelated nodes inserted, and the new <title>
    // inserted about 0.1 ms later: for that span the head holds no title
    // element at all and document.title reads "". React reconciles the head
    // that way, so no route or layout here can close the window. It is also
    // narrower than a frame, which is why sampling every animation frame --
    // 25 frames at full speed and 58 under 20x CPU throttling -- never caught
    // it, while CI, which samples on its own clock, caught it twice.
    //
    // This settles the sample; it excuses nothing. A screen that genuinely
    // carries no title never settles, so this wait times out and the suite
    // fails, which is how the missing titles of Increment 1.49 were found.
    // The value comes back from the predicate that passed, so the title
    // asserted on is the title that was seen, not a second read of a document
    // that may have moved on.
    const settled = await page.waitForFunction(() => document.title || false, undefined, { timeout: 30_000 });
    return (await settled.jsonValue()) as string;
  };

  return {
    browser,
    page,
    problems,
    a11y,
    audits,
    titleAtRest,
    async audit(state) {
      const title = await titleAtRest();
      const loaded = await page.evaluate(() => typeof (window as unknown as { axe?: unknown }).axe !== "undefined");
      if (!loaded) await page.addScriptTag({ content: axeSource });
      const raw = (await page.evaluate(async (tags) => {
        type Run = { passes: unknown[]; incomplete: { id: string }[]; violations: RawAxeResult["violations"] };
        const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<Run> } }).axe;
        const res = await axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete", "passes"] });
        return {
          passes: res.passes.length,
          incomplete: res.incomplete.map((i) => i.id),
          violations: res.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            tags: v.tags,
            nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target, html: n.html.slice(0, 200), failureSummary: n.failureSummary?.slice(0, 300) })),
          })),
        };
      }, AXE_TAGS)) as RawAxeResult;
      audits.push({ state, title, passes: raw.passes, violations: raw.violations.length, incomplete: raw.incomplete.length });
      const found: AxeViolation[] = [];
      for (const v of raw.violations) {
        const first = v.nodes[0]?.target.join(" ") ?? "";
        let row = a11y.find((r) => r.id === v.id && r.nodes[0]?.target === first);
        if (!row) {
          row = {
            id: v.id,
            impact: v.impact ?? "minor",
            help: v.help,
            helpUrl: v.helpUrl,
            tags: v.tags.filter((t) => /^wcag|best-practice/.test(t)),
            nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html, summary: n.failureSummary ?? "" })),
            count: v.nodes.length,
            states: [],
          };
          a11y.push(row);
        }
        if (!row.states.includes(state)) row.states.push(state);
        found.push(row);
      }
      return found.filter((v) => v.impact === "critical" || v.impact === "serious");
    },
    async signedOut(fn) {
      signedOutWindow = true;
      try {
        return await fn();
      } finally {
        signedOutWindow = false;
      }
    },
    async signIn(username, callbackPath) {
      // End the previous case's document before its cookies go (Increment
      // 1.84). Clearing cookies under a live screen lets whatever it still has
      // in flight come back 401 — a console error belonging to no case, raised
      // at the end of the suite by `assertNoProblems`, naming a route the
      // failing case never touched. `about:blank` unloads that screen first, so
      // there is nothing left to answer.
      await page.goto("about:blank");
      await page.context().clearCookies();
      await page.goto(`${app.base}/signin?callbackUrl=${encodeURIComponent(callbackPath)}`, { waitUntil: "networkidle" });
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', DEV_PASSWORD);
      await page.fill('input[name="totp"]', await freshCodeForTest(username));
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => url.pathname === callbackPath, { timeout: 60_000 });
    },
    async close() {
      await browser.close().catch(() => undefined);
    },
  };
}

function describeViolation(v: AxeViolation): string {
  const node = v.nodes[0];
  return `[${v.impact}] ${v.id}: ${v.help} (${v.tags.join(", ")}) · ${v.count} node${v.count === 1 ? "" : "s"} · seen in ${v.states.join("; ")}\n    ${node?.target ?? ""}\n    ${node?.html ?? ""}\n    ${node?.summary.replace(/\n/g, " ") ?? ""}\n    ${v.helpUrl}`;
}

/**
 * Throws with the server log attached when the browser saw problems, and
 * when axe found a critical or serious violation in any audited state.
 * Moderate and minor violations are printed so the record stays visible.
 */
export function assertNoProblems(b: E2eBrowser, app: E2eApp): void {
  if (b.problems.length) {
    throw new Error(`Browser problems:\n${b.problems.join("\n")}\n\nServer log tail:\n${app.serverLog().slice(-4000)}`);
  }
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const sorted = [...b.a11y].sort((x, y) => order[x.impact] - order[y.impact]);
  const blocking = sorted.filter((v) => v.impact === "critical" || v.impact === "serious");
  const advisory = sorted.filter((v) => v.impact === "moderate" || v.impact === "minor");
  const passes = b.audits.reduce((n, a) => n + a.passes, 0);
  const incomplete = b.audits.reduce((n, a) => n + a.incomplete, 0);
  if (b.audits.length === 0 || passes === 0) {
    throw new Error(`axe audited ${b.audits.length} state(s) with ${passes} passing rules: the audit did not run.`);
  }
  console.log(
    `axe-core 4.13.0: ${b.audits.length} states audited, ${passes} rule passes, ${incomplete} needing review, ${b.a11y.length} distinct violation${b.a11y.length === 1 ? "" : "s"} (${blocking.length} critical or serious, ${advisory.length} moderate or minor)` +
      (advisory.length ? `:\n  ${advisory.map(describeViolation).join("\n  ")}` : "")
  );
  if (blocking.length) {
    throw new Error(`Accessibility violations (critical or serious):\n  ${blocking.map(describeViolation).join("\n  ")}`);
  }
}
