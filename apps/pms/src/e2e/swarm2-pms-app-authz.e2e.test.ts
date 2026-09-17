import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_TENANTS, SEED_BANK } from "@pms/db/seed-data";
import { currentCodeForTest } from "../lib/auth/totp";
import { e2eEnabled, startProductionApp, type E2eApp } from "./harness";

/**
 * Swarm 2, lens pms-app-authz: direct HTTP calls against the production
 * server (no browser). Each test asserts the correct behaviour and fails on
 * the reference commit; the failure output is the measured breach.
 * Runs with the same switches as the other suites (PMS_E2E=1 plus the live
 * PostgreSQL URL); see harness.ts.
 */

type Jar = Record<string, string>;

function absorbCookies(res: Response, jar: Jar): void {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1);
    if (v === "") delete jar[k];
    else jar[k] = v;
  }
}

async function call(app: E2eApp, jar: Jar, pathname: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (Object.keys(jar).length) {
    headers.set(
      "cookie",
      Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    );
  }
  const res = await fetch(`${app.base}${pathname}`, { ...init, headers, redirect: "manual" });
  absorbCookies(res, jar);
  return res;
}

async function signIn(app: E2eApp, username: string): Promise<Jar> {
  const jar: Jar = {};
  const { csrfToken } = (await (await call(app, jar, "/api/auth/csrf")).json()) as { csrfToken: string };
  const body = new URLSearchParams({
    csrfToken,
    username,
    password: DEV_PASSWORD,
    totp: currentCodeForTest(username, DEV_MFA_SECRET, Date.now()),
    callbackUrl: `${app.base}/home`,
  });
  const res = await call(app, jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  expect(res.status).toBe(302);
  expect(res.headers.get("location") ?? "").not.toMatch(/error=/);
  return jar;
}

function postJson(app: E2eApp, jar: Jar, pathname: string, payload: unknown): Promise<Response> {
  return call(app, jar, pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const OAKRIDGE = DEV_TENANTS[1];
const OAKRIDGE_LOCATION = "0196b0a0-0000-7000-8000-000000000201";
const OAKRIDGE_BANK = "0196b0a0-0000-7000-8000-00000000f401";
const DEPOSIT_SLIP =
  "Deposit Date,Location,Method,Amount,Reference\n" +
  "09/17/2026,MAIN,Cash,250.00,\n" +
  "09/17/2026,MAIN,Check,100.00,1042\n";

describe.skipIf(!e2eEnabled)("S2 pms-app-authz (production server, direct HTTP)", () => {
  let app: E2eApp;

  beforeAll(async () => {
    app = await startProductionApp();
    await app.db.admin.query(
      `INSERT INTO bank_accounts (id, tenant_id, location_id, display_name, institution_name, account_number_last4, currency, active)
       VALUES ($1, $2, $3, 'Oak Operating', 'Oak Bank', '9999', 'USD', true)`,
      [OAKRIDGE_BANK, OAKRIDGE.id, OAKRIDGE_LOCATION]
    );
  }, 180_000);

  afterAll(async () => {
    await app?.stop();
  }, 60_000);

  // Negative control: the same GET by the unenrolled ridgeview-newhire returns 200 with an otpauth URI.
  it("S2-pms-app-authz-4: GET /api/enroll-mfa for an already-enrolled account is a refusal, not a 500", async () => {
    const owner = await signIn(app, "ridgeview-owner");
    const res = await call(app, owner, "/api/enroll-mfa");
    const text = await res.text();
    expect(res.status, `status ${res.status} body ${JSON.stringify(text)}`).toBeLessThan(500);
    expect(text).toMatch(/already/i);
    expect(app.serverLog()).not.toMatch(/Error: MFA is already enrolled\./);
  }, 60_000);

  // Negative control: the same request with SEED_BANK.accountId (Ridgeview's own account) returns 201.
  it("S2-pms-app-authz-5: POST /api/deposits/apply-staged refuses a bankAccountId that is not this tenant's", async () => {
    const front = await signIn(app, "ridgeview-front");

    const staged = await postJson(app, front, "/api/import/curve", {
      reportKind: "deposit_slip",
      content: DEPOSIT_SLIP,
      fileName: "deposit-slip.csv",
    });
    expect(staged.status).toBe(201);

    const foreign = await postJson(app, front, "/api/deposits/apply-staged", { bankAccountId: OAKRIDGE_BANK });
    const foreignBody = await foreign.text();
    expect(foreign.status, `foreign bank account: status ${foreign.status} body ${foreignBody}`).toBeGreaterThanOrEqual(400);
    expect(foreign.status).toBeLessThan(500);

    const rows = await app.db.admin.query<{ tenant_id: string; bank_account_id: string; amount_cents: string }>(
      `SELECT tenant_id, bank_account_id, amount_cents::text FROM deposits WHERE bank_account_id = $1`,
      [OAKRIDGE_BANK]
    );
    expect(rows.rows, `Ridgeview deposits now attached to Oakridge's bank account: ${JSON.stringify(rows.rows)}`).toEqual([]);

    const bogus = await postJson(app, front, "/api/deposits/apply-staged", {
      bankAccountId: "0196b0a0-dead-7000-8000-000000000000",
    });
    expect(bogus.status, `unknown bank account: status ${bogus.status}`).toBeGreaterThanOrEqual(400);
    expect(bogus.status).toBeLessThan(500);

    // Ridgeview's own account is fine.
    const own = await postJson(app, front, "/api/deposits/apply-staged", { bankAccountId: SEED_BANK.accountId });
    expect(own.status).toBe(201);
  }, 90_000);
});
