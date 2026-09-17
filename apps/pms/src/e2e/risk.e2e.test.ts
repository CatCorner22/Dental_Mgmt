import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertNoProblems, e2eEnabled, openBrowser, startProductionApp, type E2eApp, type E2eBrowser } from "./harness";

/**
 * The Practice Risk page in a real browser against the production server:
 * a refused grant, the refusal of licensing one's own conflict, a licensed
 * grant for someone else, a standalone decision, a frozen snapshot,
 * revocation, and the read-only refusal for a user-rank account.
 * See harness.ts for what the run needs.
 */
describe.skipIf(!e2eEnabled)("Practice Risk page (browser, production server)", () => {
  let app: E2eApp;
  let b: E2eBrowser;

  const page = () => b.page;
  const alert = () => page().locator("main [role=alert]");
  const grantSelects = () => page().locator("h3:has-text('Grant a duty') ~ div select");
  const flash = (re: RegExp) => page().getByText(re);
  const provenance = () => page().getByText(/^(Frozen |Computed from live rows)/);

  beforeAll(async () => {
    app = await startProductionApp();
    b = await openBrowser(app);
  }, 180_000);

  afterAll(async () => {
    await b?.close();
    await app?.stop();
    if (b && app) assertNoProblems(b, app);
  }, 60_000);

  it("boots the production server on an ordinary role and shows the page to the owner", async () => {
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    expect(await provenance().innerText()).toMatch(/Directional until a CPA calibrates/);
    expect(await page().locator("section[aria-labelledby=coverage] tbody tr").count()).toBe(6);
    expect(await page().getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/stale import|not measured/);
    expect(await page().getByText(/^Bank matching:/).innerText()).toMatch(/no rate yet[\s\S]*nothing to measure/);
    expect(await page().getByText(/outside the rulebook/).innerText()).toMatch(/2 grant row/);
    expect(app.serverLog()).toMatch(/\[boot\] database role .*not superuser, not BYPASSRLS, owns no tables/);
    await b.audit("practice risk (owner)");
  }, 90_000);

  it("refuses the owner cash custody, then refuses the owner licensing their own conflict", async () => {
    const owner = await grantSelects().nth(0).locator("option", { hasText: "Riley Owner" }).getAttribute("value");
    await grantSelects().nth(0).selectOption(owner!);
    await grantSelects().nth(1).selectOption("collect_cash");
    await page().getByRole("button", { name: "Grant", exact: true }).click();
    await alert().waitFor({ timeout: 30_000 });
    const text = await alert().innerText();
    expect(text).toMatch(/Needs a control decision before this grant/);
    expect(text).toMatch(/Cash custody \+ bank reconciliation · Riley Owner · Critical/);
    expect(text).toMatch(/Record a control decision/);
    await b.audit("practice risk, refused grant with the decision form");

    await alert().locator("input[placeholder*='compensates']").fill("Owner counts the drawer with the front desk each close.");
    await alert().locator("input[type=date]").fill("2026-12-31");
    await alert().getByRole("button", { name: "Record decision and grant" }).click();
    await page().locator("main [role=alert]", { hasText: "Needs a different administrator" }).waitFor({ timeout: 30_000 });
    expect(await alert().getByRole("button", { name: "Record decision and grant" }).count()).toBe(0);
    await b.audit("practice risk, self-licence refusal");
  }, 90_000);

  it("licenses a grant for someone else only with a decision, and shows the governing decision on the row", async () => {
    const finn = await grantSelects().nth(0).locator("option", { hasText: "Finn Front" }).getAttribute("value");
    await grantSelects().nth(0).selectOption(finn!);
    await grantSelects().nth(1).selectOption("collect_cash");
    await page().getByRole("button", { name: "Grant", exact: true }).click();
    await flash(/^Granted Collect patient payments/).waitFor({ timeout: 30_000 });

    await grantSelects().nth(0).selectOption(finn!);
    await grantSelects().nth(1).selectOption("bank_reconcile");
    await page().getByRole("button", { name: "Grant", exact: true }).click();
    await page().locator("main [role=alert]", { hasText: "Needs a control decision" }).waitFor({ timeout: 30_000 });
    await alert().locator("input[placeholder*='compensates']").fill("Owner reconciles independently on Fridays until the bookkeeper starts.");
    await alert().locator("input[type=date]").fill("2026-12-31");
    await alert().getByRole("button", { name: "Record decision and grant" }).click();
    await flash(/^Granted Reconcile bank to PMS/).waitFor({ timeout: 30_000 });

    const row = page().locator("section[aria-labelledby=conflicts] tbody tr", { hasText: "Cash custody + bank reconciliation" }).first();
    expect(await row.innerText()).toMatch(/Finn Front[\s\S]*Critical[\s\S]*Accept residual · review by 2026-12-31/);
    expect(await page().locator("section[aria-labelledby=register] tbody tr").count()).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("records a standalone decision, freezes a snapshot, and revokes with live recomputation", async () => {
    const open = page().locator("section[aria-labelledby=conflicts] tbody tr", { hasText: "No decision yet" }).first();
    await open.getByRole("button", { name: "Record decision" }).click();
    const form = page().locator("section[aria-labelledby=conflicts] form");
    await form.waitFor({ timeout: 30_000 });
    await b.audit("practice risk, inline decision form");
    await form.getByRole("combobox").selectOption("monitor");
    await form.locator("input[placeholder*='compensates']").fill("Daily drawer report goes to the owner; watching until the bookkeeper starts.");
    await form.locator("input[type=date]").fill("2026-11-30");
    await form.getByRole("button", { name: "Record decision" }).click();
    await flash(/^Monitor recorded for /).waitFor({ timeout: 30_000 });

    await page().getByRole("button", { name: "Freeze snapshot" }).click();
    await flash(/Snapshot frozen/).waitFor({ timeout: 30_000 });
    expect(await provenance().innerText()).toMatch(/^Frozen /);
    expect(await page().getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/stale import/);
    await b.audit("practice risk, frozen snapshot with decisions");

    await page().getByRole("button", { name: "Revoke Reconcile bank to PMS from Finn Front" }).click();
    await flash(/^Revoked Reconcile bank to PMS/).waitFor({ timeout: 30_000 });
    await page().getByRole("button", { name: "Revoke Collect patient payments / cash drawer from Finn Front" }).click();
    await flash(/^Revoked Collect patient payments/).waitFor({ timeout: 30_000 });
    const tiles = await page().locator("section[aria-labelledby=headline] .grid > div").allInnerTexts();
    expect(tiles.map((t) => t.replace(/\s+/g, " "))).toEqual(
      expect.arrayContaining([expect.stringMatching(/OPEN CONFLICTS 0/), expect.stringMatching(/WITHOUT A DECISION 0/)])
    );
  }, 120_000);

  it("shows a user-rank account the Refusal, not the page", async () => {
    await b.signIn("ridgeview-front", "/risk");
    await page().locator("main [role=alert]").waitFor({ timeout: 30_000 });
    expect(await page().locator("main [role=alert]").innerText()).toMatch(/Practice Risk did not load[\s\S]*manager rank or above/);
    expect(await page().getByRole("heading", { name: "Headline" }).count()).toBe(0);
    await b.audit("practice risk, user-rank refusal");
  }, 90_000);
});
