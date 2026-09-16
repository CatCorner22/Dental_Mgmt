import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertNoProblems, e2eEnabled, openBrowser, startProductionApp, type E2eApp, type E2eBrowser } from "./harness";

/**
 * The Money Desk in a real browser against the production server, on the
 * seeded Ridgeview tenant: the ledger and an account's explanation; a
 * payment posted by the front desk and a write-off held for a second
 * approver; the owner approving one request and declining another; a bank
 * statement imported and its run cleared; the day close frozen by a second
 * counter; a statement drafted and issued. See harness.ts for what the run
 * needs.
 */

const BANK_CSV = [
  "Date,Description,Amount,Reference",
  "09/14/2026,DEPOSIT CASH MAIN,250.00,",
  "09/14/2026,DEPOSIT CHECK 1042,100.00,1042",
  "09/15/2026,ACH INSURANCE EFT,-150.00,",
].join("\n");

describe.skipIf(!e2eEnabled)("Money Desk (browser, production server)", () => {
  let app: E2eApp;
  let b: E2eBrowser;
  const page = () => b.page;
  const flash = (re: RegExp) => page().getByText(re);

  beforeAll(async () => {
    app = await startProductionApp();
    b = await openBrowser(app);
  }, 180_000);

  afterAll(async () => {
    await b?.close();
    await app?.stop();
    if (b && app) assertNoProblems(b, app);
  }, 60_000);

  it("shows the owner the home links, the ledger, and an account's explanation", async () => {
    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Nothing on the Board yet" }).waitFor({ timeout: 60_000 });
    for (const name of ["Open ledger", "Post payment", "Bank reconciliation", "Day close", "Statements", "Approvals inbox", "Practice Risk"]) {
      expect(await page().locator("main").getByRole("link", { name }).count()).toBe(1);
    }

    await page().goto(`${app.base}/ledger`);
    await page().getByRole("heading", { name: "Ledger" }).waitFor();
    const rows = page().locator("tbody tr");
    await rows.first().waitFor({ timeout: 30_000 });
    const names = await rows.allInnerTexts();
    expect(names.join("\n")).toMatch(/Jane Doe/);
    expect(names.join("\n")).toMatch(/John Smith/);

    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });
    expect(await page().getByRole("heading", { name: "Jane Doe" }).count()).toBe(1);
    expect(await page().locator("section:has(h2:text('Running ledger')) tbody tr").count()).toBeGreaterThanOrEqual(2);
  }, 90_000);

  it("lets the front desk post a payment, and holds a write-off above the threshold for a second approver", async () => {
    await b.signIn("ridgeview-front", "/ledger/post");
    await page().getByRole("heading", { name: "Post to ledger" }).waitFor({ timeout: 60_000 });
    const account = page().getByLabel("Guarantor account");
    await account.locator("option", { hasText: "Jane Doe" }).waitFor({ state: "attached", timeout: 30_000 });
    await account.selectOption((await account.locator("option", { hasText: "Jane Doe" }).getAttribute("value"))!);
    await page().getByLabel("Kind").selectOption("patient_payment");
    await page().getByLabel("Amount (USD)").fill("20");
    await page().getByRole("button", { name: "Post", exact: true }).click();
    await flash(/^Posted successfully\./).waitFor({ timeout: 30_000 });

    await page().getByLabel("Kind").selectOption("write_off");
    await page().getByLabel("Amount (USD)").fill("200");
    await page().getByLabel("Reason code").selectOption("courtesy");
    await page().getByRole("button", { name: "Post", exact: true }).click();
    await flash(/^Needs second approver:/).waitFor({ timeout: 30_000 });
    expect(await flash(/^Needs second approver:/).innerText()).toMatch(/\(request [0-9a-f-]{36}\)/);
  }, 90_000);

  it("shows the owner both held requests, approves the new one, and declines the seeded one with a reason", async () => {
    await b.signIn("ridgeview-owner", "/approvals");
    await page().getByRole("heading", { name: "Approvals inbox" }).waitFor({ timeout: 60_000 });
    const items = page().locator("article");
    await items.first().waitFor({ timeout: 30_000 });
    expect(await items.count()).toBe(2);

    const held = items.filter({ hasText: "$200.00" });
    await held.getByRole("button", { name: "Approve" }).click();
    await flash(/^Request approved\./).waitFor({ timeout: 30_000 });
    expect(await items.count()).toBe(1);

    const seeded = items.filter({ hasText: "$75.00" });
    await seeded.getByLabel("Decline reason").fill("Not a courtesy case; bill the patient.");
    await seeded.getByRole("button", { name: "Decline" }).click();
    await flash(/^Request declined\./).waitFor({ timeout: 30_000 });
    await page().getByText("No pending approvals.").waitFor({ timeout: 30_000 });

    // The approved write-off is now on the account.
    await page().goto(`${app.base}/ledger`);
    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });
    expect(await page().locator("section:has(h2:text('Running ledger')) tbody").innerText()).toMatch(/\$200\.00|-\$200\.00/);
  }, 120_000);

  it("imports a bank statement, opens its run, and clears it as the owner", async () => {
    await page().goto(`${app.base}/reconciliation`);
    await page().getByRole("heading", { name: "Bank reconciliation" }).waitFor({ timeout: 60_000 });
    await page().getByLabel("CSV content").fill(BANK_CSV);
    await page().getByRole("button", { name: "Import statement" }).click();
    await page().waitForURL(/\/reconciliation\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await page().getByText(/Independence source: statement import/).waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody tr").count()).toBe(3);

    // The owner posted the seeded payments, so only owner-only clearance is open to them; it is recorded, not hidden.
    const clear = page().getByRole("button", { name: /^Clear/ });
    await clear.waitFor({ timeout: 30_000 });
    await clear.click();
    await flash(/Cleared\.|Variances cleared\./).waitFor({ timeout: 30_000 });
    await page().getByText(/^Cleared$/).waitFor({ timeout: 30_000 });
  }, 120_000);

  it("freezes the day close as a second counter, since the front desk prepared the deposits", async () => {
    await page().goto(`${app.base}/day-close`);
    await page().getByRole("heading", { name: "Day close" }).waitFor({ timeout: 60_000 });
    await page().getByText(/Status:/).waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody tr").count()).toBe(2);
    await page().getByRole("button", { name: "Freeze day close" }).click();
    await flash(/Freeze day close succeeded\./).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/Status:/).innerText()).toMatch(/Frozen[\s\S]*frozen by Riley Owner[\s\S]*second count by a different person/);
    expect(await page().getByRole("button", { name: "Freeze day close" }).isDisabled()).toBe(true);
  }, 90_000);

  it("reflects the owner-only clearance on Practice Risk as measured, not assumed", async () => {
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await page().getByRole("button", { name: "Recompute from live rows" }).click();
    await flash(/Recomputed from live rows/).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/same hands[\s\S]*owner-only clearance recorded as a finding/);
  }, 90_000);

  it("lets the front desk draft and issue a statement from the same balances", async () => {
    await b.signIn("ridgeview-front", "/statements");
    await page().getByRole("heading", { name: "Statements" }).waitFor({ timeout: 60_000 });
    await page().locator("tbody tr").first().waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody").innerText()).toMatch(/Jane Doe[\s\S]*Issued/);

    const account = page().getByLabel("Account");
    await account.selectOption({ label: "John Smith" });
    await page().getByRole("button", { name: "Create draft" }).click();
    await page().waitForURL(/\/statements\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await page().getByRole("heading", { name: "John Smith" }).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/As of .* · Draft/).count()).toBe(1);
    await page().getByRole("button", { name: "Issue statement" }).click();
    await flash(/^Statement issued\./).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/As of .* · Issued/).count()).toBe(1);
  }, 90_000);
});
