import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_BANK } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";
import { assertNoProblems, e2eEnabled, openBrowser, startProductionApp, type E2eApp, type E2eBrowser } from "./harness";

/**
 * The Money Desk in a real browser against the production server, on the
 * seeded Ridgeview tenant: the ledger and an account's explanation; a
 * payment posted by the front desk and a write-off held for a second
 * approver; the owner approving one request and declining another; a bank
 * statement imported, its credits matched to the deposits the front desk
 * prepared, and its run cleared; the day close frozen by a second counter;
 * the measured grade, lag, and match rate on the reconciliation screen and
 * on Practice Risk; a statement drafted and issued. See harness.ts for what
 * the run needs.
 */

/** YYYY-MM-DD, `days` days before today (UTC), which is the clock the server measures with. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * The bank's side of two days ago, when the front desk banked the drawer and
 * a check (the deposits the suite prepares below), plus a fee dated the
 * seeded business day so the run's period covers the owner's own postings.
 * Imported today, the two credits match within 48 hours; the fee stays open.
 */
const DEPOSIT_DAY = daysAgo(2);
const BANK_CSV = [
  "Date,Description,Amount,Reference",
  `${DEPOSIT_DAY},DEPOSIT CASH MAIN,250.00,`,
  `${DEPOSIT_DAY},DEPOSIT CHECK 1042,100.00,1042`,
  "2026-09-14,ACH MERCHANT FEE,-150.00,",
].join("\n");

/** The month that has ended, which is the month every attestation reader reports. */
function lastCompleteMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

describe.skipIf(!e2eEnabled)("Money Desk (browser, production server)", () => {
  let app: E2eApp;
  let b: E2eBrowser;
  const page = () => b.page;
  const flash = (re: RegExp) => page().getByText(re);

  beforeAll(async () => {
    app = await startProductionApp();
    // The front desk prepared two deposits two days ago; the statement below is the bank's record of them.
    const { rows } = await app.db.admin.query("SELECT id, display_name FROM users WHERE username = 'ridgeview-front'");
    for (const [method, amount, reference] of [
      ["cash", 25_000, null],
      ["check", 10_000, "1042"],
    ] as const) {
      await app.db.admin.query(
        `INSERT INTO deposits (id, tenant_id, location_id, bank_account_id, business_date, method, amount_cents,
                               reference, status, prepared_by_id, prepared_by_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, now())`,
        [uuidv7(), SEED_BANK.tenantId, SEED_BANK.locationId, SEED_BANK.accountId, DEPOSIT_DAY, method, amount, reference, rows[0].id, rows[0].display_name]
      );
    }
    b = await openBrowser(app);
  }, 180_000);

  afterAll(async () => {
    await b?.close();
    await app?.stop();
    if (b && app) assertNoProblems(b, app);
  }, 60_000);

  it("shows the owner the home links, the ledger, and an account's explanation", async () => {
    await page().goto(`${app.base}/signin`, { waitUntil: "networkidle" });
    await page().locator('input[name="username"]').waitFor({ timeout: 60_000 });
    await b.audit("sign-in");

    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    // Before any statement: no green state without a bank record; the seeded $75 write-off waits on the owner.
    await page().getByRole("heading", { name: "No bank record yet" }).waitFor({ timeout: 60_000 });
    expect(await page().getByText(/A day sheet on its own is a self-assertion/).count()).toBe(1);
    const approvals = page().locator("div", { has: page().getByText("Approvals only you can give") }).last();
    expect(await approvals.innerText()).toMatch(/1[\s\S]*\$75\.00 held until a second person decides/);
    expect(await page().getByText(/No control decision comes up for review/).count()).toBe(1);
    expect(await page().getByText(/Segregation health\. COSO overall \d+/).count()).toBe(1);
    for (const name of ["Open ledger", "Post payment", "Bank reconciliation", "Day close", "Statements", "Approvals inbox", "Practice Risk", "Weekly digest", "Locations", "Reason codes", "Month-end package"]) {
      expect(await page().locator("main").getByRole("link", { name, exact: true }).count()).toBe(1);
    }
    await b.audit("home (owner, no bank record)");

    await page().goto(`${app.base}/ledger`);
    await page().getByRole("heading", { name: "Ledger" }).waitFor();
    const rows = page().locator("tbody tr");
    await rows.first().waitFor({ timeout: 30_000 });
    const names = await rows.allInnerTexts();
    expect(names.join("\n")).toMatch(/Jane Doe/);
    expect(names.join("\n")).toMatch(/John Smith/);
    await b.audit("ledger");

    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });
    expect(await page().getByRole("heading", { name: "Jane Doe" }).count()).toBe(1);
    expect(await page().locator("section:has(h2:text('Running ledger')) tbody tr").count()).toBeGreaterThanOrEqual(2);
    expect(await page().getByText(/A posted entry is never edited/).count()).toBe(1);
    await b.audit("account explanation");
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
    await b.audit("post to ledger (posted)");

    await page().getByLabel("Kind").selectOption("write_off");
    await page().getByLabel("Amount (USD)").fill("200");
    await page().getByLabel("Reason code").selectOption("courtesy");
    await page().getByRole("button", { name: "Post", exact: true }).click();
    await flash(/^Needs second approver:/).waitFor({ timeout: 30_000 });
    expect(await flash(/^Needs second approver:/).innerText()).toMatch(/\(request [0-9a-f-]{36}\)/);
    await b.audit("post to ledger (held for a second approver)");
  }, 90_000);

  it("shows the owner both held requests, approves the new one, and declines the seeded one with a reason", async () => {
    await b.signIn("ridgeview-owner", "/approvals");
    await page().getByRole("heading", { name: "Approvals inbox" }).waitFor({ timeout: 60_000 });
    const items = page().locator("article");
    await items.first().waitFor({ timeout: 30_000 });
    expect(await items.count()).toBe(2);
    await b.audit("approvals inbox with two requests");

    const held = items.filter({ hasText: "$200.00" });
    // The card says why it was held: above the threshold in hours, or the after-hours hold when CI runs at night.
    expect(await held.innerText()).toMatch(/Why held: (Dual release required above \$150\.|Exception "After-hours hold" forces dual release\. Posted at \d{2}:\d{2} local time)/);
    await held.getByRole("button", { name: "Approve" }).click();
    await flash(/^Request approved\./).waitFor({ timeout: 30_000 });
    expect(await items.count()).toBe(1);

    const seeded = items.filter({ hasText: "$75.00" });
    await seeded.getByLabel("Decline reason").fill("Not a courtesy case; bill the patient.");
    await seeded.getByRole("button", { name: "Decline" }).click();
    await flash(/^Request declined\./).waitFor({ timeout: 30_000 });
    await page().getByText("No pending approvals.").waitFor({ timeout: 30_000 });
    await b.audit("approvals inbox empty");

    // The approved write-off is now on the account.
    await page().goto(`${app.base}/ledger`);
    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });
    expect(await page().locator("section:has(h2:text('Running ledger')) tbody").innerText()).toMatch(/\$200\.00|-\$200\.00/);
  }, 120_000);

  it("imports a bank statement, matches its credits to the front desk's deposits, and clears the fee as the owner", async () => {
    await page().goto(`${app.base}/reconciliation`);
    await page().getByRole("heading", { name: "Bank reconciliation" }).waitFor({ timeout: 60_000 });
    // Nothing measured yet: no run, no bank line.
    await page().getByText(/^Stale import$/).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/^No rate yet/).count()).toBe(1);
    await b.audit("reconciliation, no runs");

    await page().getByLabel("CSV content").fill(BANK_CSV);
    await page().getByRole("button", { name: "Import statement" }).click();
    await page().waitForURL(/\/reconciliation\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await page().getByText(/Independence source: statement import/).waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody tr").count()).toBe(3);
    expect(await page().locator("tbody tr", { hasText: "Matched deposit" }).count()).toBe(2);
    expect(await page().locator("tbody tr", { hasText: "Unmatched bank line" }).count()).toBe(1);
    expect(await page().locator("div", { has: page().getByText(/^Matched$/) }).getByText("$350.00").count()).toBe(1);

    // The fee line is dated the seeded business day, so it is already older than 48 hours: freezing a
    // snapshot runs the detectors, and the finding appears on Practice Risk, worded about the line.
    const runUrl = page().url();
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await page().getByRole("button", { name: "Freeze snapshot" }).click();
    await flash(/Snapshot frozen/).waitFor({ timeout: 30_000 });
    const detectors = page().locator("section[aria-labelledby=detectors]");
    const detectorRow = (label: string) => detectors.locator("tbody tr", { hasText: label });
    expect(await detectorRow("Unmatched bank line older than 48 hours").innerText()).toMatch(
      /A \$150\.00 bank debit posted 2026-09-14 \(ACH MERCHANT FEE\) has had no matching deposit and no clearance for \d+ days\.[\s\S]*Open/
    );
    // The seeded grants leave two highest-weight duties with one holder each; the rows name the duty, never the holder.
    expect(await detectorRow("Critical duty held by one person").count()).toBe(2);
    expect(await detectors.innerText()).not.toMatch(/Riley|Finn/);
    await b.audit("practice risk, detector finding open");

    // The owner posted the seeded payments, so only owner-only clearance is open to them; it is recorded, not hidden.
    await page().goto(runUrl);
    const clear = page().getByRole("button", { name: /^Clear/ });
    await clear.waitFor({ timeout: 30_000 });
    await b.audit("reconciliation run, open variance");
    await clear.click();
    await flash(/Cleared\.|Variances cleared\./).waitFor({ timeout: 30_000 });
    await page().getByText(/^Cleared$/).waitFor({ timeout: 30_000 });
    await b.audit("reconciliation run, cleared");
  }, 120_000);

  it("shows the measured grade, match rate, and detection lag over the runs", async () => {
    await page().goto(`${app.base}/reconciliation`);
    await page().getByRole("heading", { name: "Bank reconciliation" }).waitFor({ timeout: 60_000 });
    await page().getByText(/^Same hands$/).waitFor({ timeout: 30_000 });
    // Both credits matched on import, two days after the bank posted them; the fee cleared today. Median 2 whatever today is.
    expect(await page().getByText(/^100% within 48 hours/).innerText()).toMatch(/median lag 2 days/);
    expect(await page().getByText(/2 of 2 bank credits matched a practice deposit within 48 hours/).innerText()).toMatch(
      /Debits are not matched yet/
    );
    await b.audit("reconciliation with measurements");
  }, 90_000);

  it("freezes the day close as a second counter, since the front desk prepared the deposits", async () => {
    await page().goto(`${app.base}/day-close`);
    await page().getByRole("heading", { name: "Day close" }).waitFor({ timeout: 60_000 });
    await page().getByText(/Status:/).waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody tr").count()).toBe(2);
    await b.audit("day close open");
    await page().getByRole("button", { name: "Freeze day close" }).click();
    await flash(/Freeze day close succeeded\./).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/Status:/).innerText()).toMatch(/Frozen[\s\S]*frozen by Riley Owner[\s\S]*second count by a different person/);
    expect(await page().getByRole("button", { name: "Freeze day close" }).isDisabled()).toBe(true);
    await b.audit("day close frozen");
  }, 90_000);

  it("reflects the owner-only clearance on Practice Risk as measured, not assumed", async () => {
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await page().getByRole("button", { name: "Recompute from live rows" }).click();
    await flash(/Recomputed from live rows/).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/^Independent bank reconciliation:/).innerText()).toMatch(/same hands[\s\S]*owner-only clearance recorded as a finding/);
    expect(await page().getByText(/^Bank matching:/).innerText()).toMatch(/100% within 48 hours, median lag 2 days[\s\S]*recorded, not scored/);
    await b.audit("practice risk (owner, measured)");

    // Freezing again runs the detectors on the cleared run: the bank-line finding closes with its reason and
    // stays readable, and the owner-only clearance the owner just performed is recorded as its own finding.
    await page().getByRole("button", { name: "Freeze snapshot" }).click();
    await flash(/Snapshot frozen/).waitFor({ timeout: 30_000 });
    const detectors = page().locator("section[aria-labelledby=detectors]");
    const detectorRow = (label: string) => detectors.locator("tbody tr", { hasText: label });
    expect(await detectorRow("Owner-only clearance").innerText()).toMatch(
      /was cleared on \d{4}-\d{2}-\d{2} as owner-only clearance: no other eligible person existed[\s\S]*Open/
    );
    expect(await detectorRow("Unmatched bank line older than 48 hours").innerText()).toMatch(/Closed[\s\S]*matched or cleared/);
    expect(await detectors.innerText()).not.toMatch(/Riley|Finn/);
    await b.audit("practice risk, detector findings open and closed");
  }, 120_000);

  it("lets the front desk draft and issue a statement from the same balances", async () => {
    await b.signIn("ridgeview-front", "/statements");
    await page().getByRole("heading", { name: "Statements" }).waitFor({ timeout: 60_000 });
    await page().locator("tbody tr").first().waitFor({ timeout: 30_000 });
    expect(await page().locator("tbody").innerText()).toMatch(/Jane Doe[\s\S]*Issued/);
    await b.audit("statements");

    const account = page().getByLabel("Account");
    await account.selectOption({ label: "John Smith" });
    await page().getByRole("button", { name: "Create draft" }).click();
    await page().waitForURL(/\/statements\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await page().getByRole("heading", { name: "John Smith" }).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/As of .* · Draft/).count()).toBe(1);
    await b.audit("statement draft");
    await page().getByRole("button", { name: "Issue statement" }).click();
    await flash(/^Statement issued\./).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/As of .* · Issued/).count()).toBe(1);
    await b.audit("statement issued");
  }, 90_000);

  it("shows the front desk the links only, and the owner a board that reflects the day", async () => {
    await page().goto(`${app.base}/home`);
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    await page().getByText(/The board is for the manager and owner seats/).waitFor({ timeout: 30_000 });
    expect(await page().getByRole("heading", { name: "No bank record yet" }).count()).toBe(0);
    await b.audit("home (front desk)");

    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Tied · needs a second look" }).waitFor({ timeout: 60_000 });
    expect(await page().getByText(/^The same hands posted or prepared deposits and cleared the bank reconciliation\./).count()).toBe(1);
    expect(await page().getByText(/Bank matching: 100% within 48 hours · detection lag 2 days \(median\)/).count()).toBe(1);
    const approvals = page().locator("div", { has: page().getByText("Approvals only you can give") }).last();
    expect(await approvals.innerText()).toMatch(/0[\s\S]*Nothing is waiting on you/);
    expect(await page().getByRole("link", { name: "See who can clear independently" }).getAttribute("href")).toBe("/risk");

    // 2026-09-14 is sealed by now and nothing has posted behind it, which the board says
    // out loud rather than omitting (Increment 1.41).
    const sealed = page().locator("section[aria-labelledby=after-close]");
    await sealed.waitFor({ timeout: 30_000 });
    expect(await sealed.innerText()).toMatch(/Nothing posted into a sealed day/);
    expect(await sealed.getByRole("link").count()).toBe(0);

    // The hard events the day produced, for the owner only: the fee left the run $150 over the variance threshold,
    // and each holder of a critical duty signed in from a browser this database had never seen.
    const hard = page().locator("section[aria-labelledby=hard-events]");
    await hard.waitFor({ timeout: 30_000 });
    const hardText = await hard.innerText();
    expect(hardText).toMatch(/Deposit variance over threshold/);
    expect(hardText).toMatch(/carries a \$150\.00 variance against the practice's deposits, over the \$100\.00 threshold/);
    expect(hardText).toMatch(/New device on a financial role/);
    expect(hardText).not.toMatch(/After-hours refund|Retroactive-dated entry|Dual control waived|Audit-chain check failed/);
    expect(hardText).not.toMatch(/Riley|Finn/);
    expect(await hard.getByRole("link", { name: "Open" }).first().getAttribute("href")).toMatch(/^\/reconciliation\//);
    const waiting = Number(hardText.match(/(\d+) not yet acknowledged/)?.[1]);
    expect(waiting).toBeGreaterThanOrEqual(2);
    expect(await hard.getByRole("button", { name: /^Acknowledge / }).count()).toBe(waiting);
    await b.audit("home (owner, tied with a second look)");

    // The owner acknowledges the variance with what was done; the note is required, the card re-reads from rows,
    // and the other events still wait.
    const variance = hard.locator("li", { hasText: "Deposit variance over threshold" });
    await variance.getByRole("button", { name: "Acknowledge Deposit variance over threshold" }).click();
    const ackForm = hard.locator("form");
    await ackForm.waitFor({ timeout: 30_000 });
    expect(await ackForm.getByRole("button", { name: "Mark as seen" }).isDisabled()).toBe(true);
    await b.audit("home (owner, acknowledging a hard event)");
    await ackForm.locator("input").fill("Fee line; cleared in the variance queue with the bank's reason.");
    await ackForm.getByRole("button", { name: "Mark as seen" }).click();
    await flash(/^Acknowledged: Deposit variance over threshold\./).waitFor({ timeout: 30_000 });
    expect(await variance.innerText()).toMatch(/Seen by Riley Owner on \d{4}-\d{2}-\d{2}: Fee line; cleared in the variance queue with the bank's reason\./);
    expect(await hard.innerText()).toMatch(new RegExp(`${waiting - 1} not yet acknowledged`));
    expect(await hard.getByRole("button", { name: /^Acknowledge / }).count()).toBe(waiting - 1);
  }, 120_000);

  it("counts the week for the owner in the digest, stamps it once, and refuses the front desk", async () => {
    await page().goto(`${app.base}/digest`);
    await page().getByRole("heading", { name: "The week, counted" }).waitFor({ timeout: 60_000 });
    await page().locator("section[aria-labelledby=digest-chain]").waitFor({ timeout: 60_000 });
    const section = (id: string) => page().locator(`section[aria-labelledby=${id}]`);
    const row = (id: string, label: string) => section(id).locator("tr", { has: page().locator(`th:text-is("${label}")`) });

    // The week this suite just lived: one statement imported and cleared by the owner alone, a day close frozen,
    // the held write-off approved and the seeded one declined, a statement issued, the front desk's payment posted.
    expect(await row("digest-bank", "Statements imported").innerText()).toMatch(/\b1$/);
    expect(await row("digest-bank", "Bank runs cleared").innerText()).toMatch(/\b1$/);
    expect(await row("digest-bank", "Of those, owner-only clearance").innerText()).toMatch(/\b1$/);
    expect(await row("digest-bank", "Day closes frozen").innerText()).toMatch(/\b1$/);
    // Nothing has posted behind a seal yet; the row reads zero rather than being absent (Increment 1.43).
    expect(await row("digest-bank", "Postings into sealed days").innerText()).toMatch(/\b0$/);
    expect(await row("digest-bank", "\u2026of those, first postings").innerText()).toMatch(/\b0$/);
    expect(await row("digest-bank", "Patient statements issued").innerText()).toMatch(/\b1$/);
    expect(await row("digest-approvals", "Given by a second person").innerText()).toMatch(/\b1$/);
    expect(await row("digest-approvals", "Declined").innerText()).toMatch(/\b1$/);
    expect(await row("digest-money", "Patient payment").innerText()).toMatch(/\$/);
    expect(await section("digest-findings").innerText()).toMatch(/Opened · Unmatched bank line older than 48 hours\s+1/);
    expect(await section("digest-decisions").innerText()).toMatch(/Snapshots frozen\s+[1-9]/);
    expect(await section("digest-access").innerText()).toMatch(/Sign-ins\s+[1-9]/);
    // The variance acknowledged on the board above; the held write-off counts as an after-hours hold only when CI runs at night.
    expect(await row("digest-alerts", "Hard events acknowledged").innerText()).toMatch(/\b1$/);
    expect(await row("digest-alerts", "After-hours holds").innerText()).toMatch(/\b[01]$/);
    // Nobody has attested anything yet this week (Increment 1.53). The row reads
    // zero rather than being absent, and the standing debt sits in its own
    // section, marked as where the practice stands rather than as the week's.
    expect(await row("digest-alerts", "Channels attested").innerText()).toMatch(/\b0$/);
    const standing = section("digest-attested");
    await standing.waitFor({ timeout: 30_000 });
    expect(await standing.innerText()).toMatch(/Standing, not this week/i);
    expect(await standing.innerText()).toMatch(/outside the figures the acknowledgment stamps/);
    expect(await standing.innerText()).toMatch(/Nobody has reviewed new vendors and payroll for \d{4}-\d{2}/);
    const whole = await page().locator("main").innerText();
    expect(whole).toMatch(/Chain · \d+ events, sequence \d+ to \d+/);
    expect(whole).toMatch(/no row here names anyone/);
    expect(whole).not.toMatch(/Riley|Finn|John Smith/);
    await b.audit("digest (owner, unacknowledged)");

    // The owner stamps the week; the stamp shows who and when, and the button is gone for good.
    await page().getByRole("button", { name: "Acknowledge this week" }).click();
    await flash(/^Acknowledged\. The stamp binds the digest/).waitFor({ timeout: 30_000 });
    expect(await section("digest-ack").innerText()).toMatch(/Acknowledged by Riley Owner on .* when the chain held \d+ events for this week/);
    expect(await page().getByRole("button", { name: "Acknowledge this week" }).count()).toBe(0);
    await page().reload();
    await section("digest-ack").waitFor({ timeout: 60_000 });
    expect(await section("digest-ack").innerText()).toMatch(/Acknowledged by Riley Owner/);
    // The acknowledgment is itself a chain event inside the week, so the page says the rows moved after the stamp.
    expect(await section("digest-ack").innerText()).toMatch(/The rows have changed since/);
    expect(await row("digest-chain", "Digest acknowledgments").innerText()).toMatch(/\b1$/);
    await b.audit("digest (owner, acknowledged)");

    await b.signIn("ridgeview-front", "/digest");
    await page().getByText(/The digest is for the manager and owner seats/).waitFor({ timeout: 60_000 });
    expect(await page().getByRole("button", { name: "Acknowledge this week" }).count()).toBe(0);
    await b.audit("digest (front desk refusal)");
  }, 150_000);

  it("lets the owner set a location's hours, the week the after-hours hold reads, and gives the front desk nothing to edit", async () => {
    await b.signIn("ridgeview-owner", "/locations");
    const main = page().locator("section", { has: page().getByRole("heading", { name: "Main", exact: true }) });
    await main.waitFor({ timeout: 60_000 });
    expect(await main.innerText()).toMatch(/Timezone America\/Chicago/);
    expect(await main.getByLabel("Main Friday opens").inputValue()).toBe("07:00");
    expect(await main.getByLabel("Main Friday closes").inputValue()).toBe("17:00");
    expect(await main.getByLabel("Main Saturday closed").isChecked()).toBe(true);
    expect(await main.getByLabel("Main Saturday opens").isDisabled()).toBe(true);
    await b.audit("locations (owner)");

    // Friday evening clinic: the close moves to 18:00, and the page says what moved.
    await main.getByLabel("Main Friday closes").fill("18:00");
    await main.getByRole("button", { name: "Save Main" }).click();
    await flash(/^Saved Main: Friday 07:00 to 17:00 → 07:00 to 18:00\. The after-hours hold reads these hours from the next posting\./).waitFor({ timeout: 30_000 });
    await page().reload();
    await main.waitFor({ timeout: 60_000 });
    expect(await main.getByLabel("Main Friday closes").inputValue()).toBe("18:00");

    // Saving the same week writes nothing; a window that closes before it opens is refused with the day named.
    await main.getByRole("button", { name: "Save Main" }).click();
    await flash(/^No change to Main: the week is as it was\./).waitFor({ timeout: 30_000 });
    await main.getByLabel("Main Monday opens").fill("20:00");
    await main.getByRole("button", { name: "Save Main" }).click();
    await flash(/Monday must open before it closes \(20:00 to 19:00\)\./).waitFor({ timeout: 30_000 });
    await b.audit("locations (owner, refused window)");

    await b.signIn("ridgeview-front", "/locations");
    await page().getByText(/Location hours are for the manager and owner seats/).waitFor({ timeout: 60_000 });
    expect(await page().getByRole("button", { name: /^Save / }).count()).toBe(0);
    await b.audit("locations (front desk refusal)");
  }, 150_000);

  it("lets the owner adopt, relabel and retire a reason code, refuses the reserved one, and shows the front desk the list only", async () => {
    await b.signIn("ridgeview-owner", "/reason-codes");
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    await page().getByRole("heading", { name: "Write-off" }).waitFor({ timeout: 30_000 });
    // The seeded list, grouped by kind, with prior_period marked reserved.
    const codes = page().locator("main");
    expect(await codes.innerText()).toMatch(/courtesy[\s\S]*Courtesy adjustment/);
    expect(await codes.innerText()).toMatch(/prior_period[\s\S]*reserved/);
    await b.audit("reason codes (owner)");

    // Adopting one: the code is a key, so it is lowercased and kept.
    await page().getByLabel("Code").fill("Insurance_Adjustment");
    await page().getByLabel("Kind").selectOption("adjustment");
    await page().getByLabel("Reads as").fill("Insurance adjustment");
    await page().getByRole("button", { name: "Adopt", exact: true }).click();
    await page().getByText(/^Adopt succeeded\.$/).waitFor({ timeout: 30_000 });
    const adopted = page().locator("tr", { hasText: "insurance_adjustment" });
    await expect
      .poll(async () => adopted.innerText(), { timeout: 30_000 })
      .toMatch(/Insurance adjustment[\s\S]*Offered[\s\S]*0/);

    // Relabelling changes what the form reads, never the key underneath it.
    await adopted.getByRole("button", { name: "Relabel insurance_adjustment" }).click();
    await page().getByLabel("New wording for insurance_adjustment").fill("Insurance contractual adjustment");
    await adopted.getByRole("button", { name: "Save" }).click();
    await page().getByText(/^Relabel succeeded\.$/).waitFor({ timeout: 30_000 });
    // The notice lands before the list refetches, so poll the row rather than race it.
    await expect
      .poll(async () => page().locator("tr", { hasText: "insurance_adjustment" }).innerText(), { timeout: 30_000 })
      .toMatch(/Insurance contractual adjustment/);

    // Retiring takes it off the forms; the row stays.
    await page().locator("tr", { hasText: "insurance_adjustment" }).getByRole("button", { name: "Retire insurance_adjustment" }).click();
    await page().getByText(/^Retire succeeded\.$/).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => page().locator("tr", { hasText: "insurance_adjustment" }).innerText(), { timeout: 30_000 })
      .toMatch(/Retired/);

    // The reserved one cannot be retired at all: the closed-month refusal needs it.
    const reserved = page().locator("tr", { hasText: "prior_period" });
    expect(await reserved.getByRole("button", { name: "Retire prior_period" }).isDisabled()).toBe(true);
    await b.audit("reason codes (owner, after adopting and retiring)");

    // The posting form offers what the practice holds, and not what it retired.
    await page().goto(`${app.base}/ledger/post`);
    await page().getByRole("heading", { name: "Post to ledger" }).waitFor({ timeout: 60_000 });
    await page().getByLabel("Kind").selectOption("write_off");
    const reason = page().getByLabel("Reason code");
    await reason.locator("option", { hasText: "Courtesy adjustment" }).waitFor({ state: "attached", timeout: 30_000 });
    const offered = await reason.locator("option").allInnerTexts();
    expect(offered).toContain("Courtesy adjustment");
    expect(offered).toContain("Contractual PPO write-off");
    // A retired code and the reserved one are both absent.
    expect(offered.join("|")).not.toMatch(/Insurance contractual adjustment|Prior period/);

    // A reason may tighten the channel's threshold (Increment 1.46). The seeded
    // writeoff channel holds at $150; hold contractual_ppo to $50 and a $100
    // write-off must be HELD by the service rather than posting and then failing
    // at the trigger — the service and the database have to reach one figure.
    await page().goto(`${app.base}/reason-codes`);
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    const ppo = page().locator("tr", { hasText: "contractual_ppo" });
    await ppo.waitFor({ timeout: 30_000 });
    expect(await ppo.innerText()).toMatch(/the channel's figure/);
    await ppo.getByRole("button", { name: "Set threshold for contractual_ppo" }).click();
    await page().getByLabel("Second person over, in dollars, for contractual_ppo").fill("50");
    await ppo.getByRole("button", { name: "Save" }).click();
    await page().getByText(/^Set the threshold succeeded\.$/).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => page().locator("tr", { hasText: "contractual_ppo" }).innerText(), { timeout: 30_000 })
      .toMatch(/\$50\.00/);

    // The front desk initiates write-off releases; the owner may not (the SoD rule
    // from Increment 1.14), so the hold is driven from the seat that would meet it.
    await b.signIn("ridgeview-front", "/ledger/post");
    await page().getByRole("heading", { name: "Post to ledger" }).waitFor({ timeout: 60_000 });
    const ppoAccount = page().getByLabel("Guarantor account");
    await ppoAccount.locator("option", { hasText: "Jane Doe" }).waitFor({ state: "attached", timeout: 30_000 });
    await ppoAccount.selectOption((await ppoAccount.locator("option", { hasText: "Jane Doe" }).getAttribute("value"))!);
    await page().getByLabel("Kind").selectOption("write_off");
    await page().getByLabel("Amount (USD)").fill("100");
    await page().getByLabel("Reason code").selectOption("contractual_ppo");
    await page().getByRole("button", { name: "Post", exact: true }).click();
    // Held in words, not a 500: the reason's figure governed, and the service knew it.
    // $100 sits under the channel's own $150, so only the reason's $50 can hold it.
    await flash(/^Needs second approver:/).waitFor({ timeout: 30_000 });
    await b.audit("post to ledger (held by the reason's own threshold)");

    // The front desk reads the list and is offered nothing to change.
    await b.signIn("ridgeview-front", "/reason-codes");
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    await page().getByText(/Adopting, relabelling, and retiring a reason code is the administrator/).waitFor({ timeout: 30_000 });
    expect(await page().getByRole("button", { name: /^Retire / }).count()).toBe(0);
    expect(await page().getByRole("button", { name: "Adopt", exact: true }).count()).toBe(0);
    expect(await page().getByRole("button", { name: /^Set threshold for / }).count()).toBe(0);
    await b.audit("reason codes (front desk)");

    // Clearing the threshold hands those rows back to the channel's own figure,
    // which lets through what used to wait — a control decision, not a settings
    // change (Increment 1.47), exactly as switching the after-hours hold off is.
    await b.signIn("ridgeview-owner", "/reason-codes");
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    const ppoAgain = page().locator("tr", { hasText: "contractual_ppo" });
    await ppoAgain.waitFor({ timeout: 30_000 });
    await ppoAgain.getByRole("button", { name: "Set threshold for contractual_ppo" }).click();
    await page().getByLabel("Second person over, in dollars, for contractual_ppo").fill("");
    // The form says what the change does and asks for the decision before it will save.
    await page().getByText(/That lets through what used to wait for a second person/).waitFor({ timeout: 30_000 });
    await b.audit("reason codes (loosening asks for a decision)");

    // Save holds until the decision is complete: the form already knows it is
    // incomplete, so it says so rather than spending a round trip to be refused.
    expect(await ppoAgain.getByRole("button", { name: "Save" }).isDisabled()).toBe(true);
    await page().getByLabel("Why").fill("The channel's own $150 governs these again.");
    expect(await ppoAgain.getByRole("button", { name: "Save" }).isDisabled()).toBe(true);
    await page().getByLabel("Review by").fill("2026-12-01");
    expect(await ppoAgain.getByRole("button", { name: "Save" }).isDisabled()).toBe(false);
    await ppoAgain.getByRole("button", { name: "Save" }).click();
    await page().getByText(/^Set the threshold succeeded\.$/).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => page().locator("tr", { hasText: "contractual_ppo" }).innerText(), { timeout: 30_000 })
      .toMatch(/the channel's figure/);
    await b.audit("reason codes (loosened under a decision)");
  }, 150_000);

  it("renders the month-end package for the owner, exports it as CSV onto the chain, and shows the front desk the seat message", async () => {
    await b.signIn("ridgeview-owner", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    const section = (id: string) => page().locator(`section[aria-labelledby=${id}]`);
    await section("package-chain").waitFor({ timeout: 60_000 });
    const stamp = await section("package-stamp").innerText();
    expect(stamp).toMatch(/month in progress/);
    expect(stamp).toMatch(/Package hash [0-9a-f]{16}…\. Not exported yet\./);
    expect(await section("package-tieout").innerText()).toMatch(/Journal totals equal the month's ledger postings: yes\.[\s\S]*The deposit register equals the deposits prepared: yes\.[\s\S]*The audit chain verified at its last check: no\. No chain check recorded yet/);
    expect(await section("package-journal").innerText()).toMatch(/patient ar · Patient payment/);
    expect(await section("package-reasons").innerText()).toMatch(/Write-off · courtesy · 1 with approval/);
    expect(await section("package-deposits").innerText()).toMatch(/cash · /);
    expect(await section("package-controls").innerText()).toMatch(/Exception · After-hours hold · force dual[\s\S]*open/);
    // One day sealed so far this month, and nothing behind it yet (Increment 1.44).
    const sealedSection = await section("package-sealed-days").innerText();
    expect(sealedSection).toMatch(/Sealed days · 1 frozen · 0 posted behind them/);
    expect(sealedSection).toMatch(/1 day close frozen this month, and nothing posted against any of them afterward\./);
    expect(await section("package-tieout").innerText()).toMatch(
      /No row posted against a day this month after the practice sealed it: yes\. 1 day sealed this month, none disturbed afterward\./
    );
    const whole = await page().locator("main").innerText();
    expect(whole).not.toMatch(/Riley|Finn|Jane Doe|John Smith/);
    await b.audit("month-end package (owner)");

    const downloading = page().waitForEvent("download", { timeout: 30_000 });
    await page().getByRole("button", { name: "Download CSV" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^month-end-\d{4}-\d{2}\.csv$/);
    await flash(/^Exported as CSV: \d+ rows, package hash [0-9a-f]{12}…, recorded on the chain\./).waitFor({ timeout: 30_000 });
    expect(await section("package-stamp").innerText()).toMatch(/Exported 1 time; last on \d{4}-\d{2}-\d{2} as CSV with \d+ rows\. The rows have changed since that export\./);
    await b.audit("month-end package (owner, exported)");

    await b.signIn("ridgeview-front", "/cpa");
    await page().getByText(/The month-end package is for the manager and owner seats/).waitFor({ timeout: 60_000 });
    expect(await page().getByRole("button", { name: /^Download / }).count()).toBe(0);
    await b.audit("month-end package (front desk refusal)");
  }, 150_000);

  it("maps a journal line to an account under maker-checker: the owner proposes, cannot approve their own, and the approval reaches the journal", async () => {
    await b.signIn("ridgeview-owner", "/cpa");
    const section = (id: string) => page().locator(`section[aria-labelledby=${id}]`);
    await section("package-mappings").waitFor({ timeout: 60_000 });
    const mappings = section("package-mappings");
    expect(await mappings.innerText()).toMatch(/0 approved mappings; 0 waiting for a second person; \d+ journal lines? unmapped/);
    expect(await section("package-tieout").innerText()).toMatch(/Every journal line is mapped to an account: no\./);
    expect(await section("package-journal").innerText()).toMatch(/→ unmapped/);

    const form = mappings.locator("form");
    await form.getByLabel("Bucket").selectOption("patient_ar");
    await form.getByLabel("Kind").selectOption("patient_payment");
    await form.getByLabel("Account code").fill("1200");
    await form.getByLabel("Account name").fill("Patient receivables");
    await form.getByLabel("Side").selectOption("credit");
    await form.getByRole("button", { name: "Propose mapping" }).click();
    await flash(/^Proposed\. A different person approves it before the journal reads it\./).waitFor({ timeout: 30_000 });

    // The owner proposed it, so the owner cannot decide it: the row says so and offers no button.
    const row = mappings.locator("tbody tr", { hasText: "1200 Patient receivables" });
    expect(await row.innerText()).toMatch(/Proposed by Riley Owner[\s\S]*Yours; a different person decides it\./);
    expect(await mappings.getByRole("button", { name: /^Approve mapping/ }).count()).toBe(0);
    expect(await mappings.innerText()).toMatch(/0 approved mappings; 1 waiting for a second person/);
    await b.audit("month-end package, mapping proposed");

    // The current month cannot be closed: it is still taking rows, so no control appears for it.
    expect(await section("package-stamp").innerText()).toMatch(/month in progress/);
    expect(await page().getByRole("button", { name: "Close month" }).count()).toBe(0);

    // A month that has ended offers the close, behind one confirmation, and refuses while lines are unmapped.
    const lastMonth = new Date();
    lastMonth.setUTCDate(1);
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    await page().locator("input[type=month]").fill(lastMonth.toISOString().slice(0, 7));
    await page().getByRole("button", { name: "Close month" }).waitFor({ timeout: 30_000 });
    await page().getByRole("button", { name: "Close month" }).click();
    expect(await section("package-stamp").innerText()).toMatch(/cannot be undone\. A correction afterwards posts today with reason prior_period\./);
    await b.audit("month-end package, close confirmation");
    await page().getByRole("button", { name: "Cancel" }).click();
    expect(await page().getByRole("button", { name: "Close it for good" }).count()).toBe(0);
  }, 150_000);
  it("holds a large correction as one request, shows it to the owner as a correction, and writes both halves on approval", async () => {
    await b.signIn("ridgeview-front", "/ledger");
    await page().getByRole("heading", { name: "Ledger" }).waitFor({ timeout: 60_000 });
    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });

    const ledger = page().locator("section:has(h2:text('Running ledger'))");
    const before = await ledger.locator("tbody tr").count();
    // The $200 write-off an earlier case posted through the approvals path. Correcting it is above
    // the $150 write-off threshold whatever the hour, so this case never depends on the clock.
    const target = ledger.locator("tbody tr", { hasText: "$200.00" }).first();
    await target.waitFor({ timeout: 30_000 });
    await target.getByRole("button", { name: "Correct" }).click();
    const amount = page().getByLabel("Corrected amount");
    await amount.waitFor({ timeout: 30_000 });
    expect(await amount.inputValue()).toBe("-200.00");
    await amount.fill("-150.00");
    // The reason is chosen from the codes the practice has adopted, never typed: the column is a
    // foreign key, so free text used to reach the database and fail the insert (Increment 1.39).
    await page().getByLabel("Reason").selectOption("courtesy");
    await page().getByRole("button", { name: "Reverse and repost" }).click();

    // Held as one request, and nothing posts while it waits.
    const held = page().getByText(/approving it writes both the reversal and the repost/);
    await held.waitFor({ timeout: 30_000 });
    expect(await held.innerText()).toMatch(/\(request [0-9a-f-]{36}\)/);
    expect(await ledger.locator("tbody tr").count()).toBe(before);
    // Pinned at the state CI caught: this screen carries its own title, and the
    // violation reported against it was a document sampled between renders.
    expect(await page().title()).toBe("Account ledger");
    await b.audit("account explanation (correction held for a second person)");

    // The owner's inbox reads it as a correction, not a bare reversal, and names both figures.
    await b.signIn("ridgeview-owner", "/approvals");
    await page().getByRole("heading", { name: "Approvals inbox" }).waitFor({ timeout: 60_000 });
    const card = page().locator("article", { hasText: "What changes" }).first();
    await card.waitFor({ timeout: 30_000 });
    const cardText = await card.innerText();
    expect(cardText).toMatch(/^Correction/m);
    expect(cardText).toMatch(/the write-off carries -?\$200\.00 and would carry -?\$150\.00/);
    expect(cardText).toMatch(/Approving writes both rows/);
    await b.audit("approvals inbox with a held correction");

    // One decision, both halves: the pair appears on the account, each row saying what it is.
    await card.getByRole("button", { name: "Approve" }).click();
    await flash(/^Request approved\./).waitFor({ timeout: 30_000 });

    await page().goto(`${app.base}/ledger`);
    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });
    await expect.poll(async () => ledger.locator("tbody tr").count(), { timeout: 30_000 }).toBe(before + 2);
    const text = await ledger.innerText();
    expect(text).toMatch(/Reverses the write-off/);
    expect(text).toMatch(/Reposts the write-off/);
    // Neither half offers a Correct control: a correction is corrected through its repost, never in place.
    expect(await ledger.locator("tr", { hasText: "Reverses the" }).getByRole("button", { name: "Correct" }).count()).toBe(0);
    expect(await ledger.locator("tr", { hasText: "Reposts the" }).getByRole("button", { name: "Correct" }).count()).toBe(0);
    // The screen carries a title of its own. It had none until now and inherited
    // the root layout's "Practice home", which CI caught here as no title at all
    // while a client navigation swapped it — a WCAG 2.4.2 failure on a page
    // reached by a link rather than by a fresh load.
    expect(await page().title()).toBe("Account ledger");
    await b.audit("account explanation (corrected)");
  }, 120_000);

  // Last, because it posts against a day an earlier case sealed and so changes
  // what that day reads. Every case that counts rows has already run.
  it("names on the sealed day everything that posted against it afterward, and leaves the sealed figures alone", async () => {
    // The front desk records a payment that arrived for a day the practice already
    // froze. The database admits it — the money arrived — and stamps it.
    await b.signIn("ridgeview-front", "/ledger/post");
    await page().getByRole("heading", { name: "Post to ledger" }).waitFor({ timeout: 60_000 });
    const account = page().getByLabel("Guarantor account");
    await account.locator("option", { hasText: "Jane Doe" }).waitFor({ state: "attached", timeout: 30_000 });
    await account.selectOption((await account.locator("option", { hasText: "Jane Doe" }).getAttribute("value"))!);
    await page().getByLabel("Kind").selectOption("patient_payment");
    await page().getByLabel("Amount (USD)").fill("40");
    // The form already offers 2026-09-14, the day an earlier case sealed.
    expect(await page().getByLabel("Effective date").inputValue()).toBe("2026-09-14");
    await page().getByRole("button", { name: "Post", exact: true }).click();
    await flash(/^Posted successfully\./).waitFor({ timeout: 30_000 });

    await page().goto(`${app.base}/day-close`);
    await page().getByRole("heading", { name: "Day close" }).waitFor({ timeout: 60_000 });
    await page().getByRole("heading", { name: "Since the seal" }).waitFor({ timeout: 30_000 });

    // The seal still reads frozen, and the glyph accompanies the word rather than standing for it.
    expect(await page().getByText(/Status:/).innerText()).toMatch(/Frozen/);
    // And the figures the practice counted have not moved.
    expect(await page().getByText(/^\$350\.00$/).count()).toBeGreaterThan(0);

    const since = page().locator("section:has(h2:text('Since the seal'))");
    const sinceText = await since.innerText();
    // Three rows: the correction pair the previous case approved, both effective-dated
    // into this day, and the payment just posted.
    expect(await since.locator("tbody tr").count()).toBe(3);
    expect(sinceText).toMatch(/3 rows posted against this day after it was frozen/);
    // Each half of the correction says what it did, and the payment says it is a first posting.
    expect(sinceText).toMatch(/Correction: clears the earlier entry/);
    expect(sinceText).toMatch(/Correction: replaces it/);
    expect(sinceText).toMatch(/First posting: patient payment/);
    expect(sinceText).toMatch(/Finn Front/);
    // The three together net $10.00 against a day sealed at $350.00.
    expect(sinceText).toMatch(/together \$10\.00/);
    expect(sinceText).toMatch(/what the practice counted, and what the ledger holds/);
    await b.audit("day close with postings since the seal");

    // And the owner's board counts the same three rows, from the same stamps (Increment 1.41).
    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    const sealedDays = page().locator("section[aria-labelledby=after-close]");
    await sealedDays.waitFor({ timeout: 30_000 });
    const sealedText = await sealedDays.innerText();
    expect(sealedText).toMatch(/Postings into closed days: 3 rows/);
    expect(sealedText).toMatch(/Together they move the sealed days by \$10\.00/);
    expect(sealedText).toMatch(/one a first posting, the rest corrections/);
    // Nothing here names a person; the board reports the practice.
    expect(sealedText).not.toMatch(/Riley|Finn/);
    expect(await sealedDays.getByRole("link", { name: "Open the day close" }).getAttribute("href")).toBe("/day-close");

    // And exactly one of those three rows pages the owner (Increment 1.42): the payment.
    // Both halves of the correction landed against the same sealed day, and neither is a
    // hard event, because a correction names the entry it replaces.
    const hardCard = page().locator("section[aria-labelledby=hard-events]");
    await hardCard.waitFor({ timeout: 30_000 });
    const sealedAlerts = hardCard.locator("li", { hasText: "First posting into a day already sealed" });
    expect(await sealedAlerts.count()).toBe(1);
    expect(await sealedAlerts.first().innerText()).toMatch(/\$40\.00 patient payment[\s\S]*landed against 2026-09-14, a day the practice had already sealed/);
    expect(await sealedAlerts.first().innerText()).not.toMatch(/Riley|Finn/);
    await b.audit("home (owner, postings into closed days)");

    // The week counts the same three rows, and splits them the same way (Increment 1.43).
    await page().goto(`${app.base}/digest`);
    await page().getByRole("heading", { name: "The week, counted" }).waitFor({ timeout: 60_000 });
    const bank = page().locator("section[aria-labelledby=digest-bank]");
    await bank.waitFor({ timeout: 30_000 });
    const bankRow = (label: string) => bank.locator("tr", { has: page().locator(`th:text-is("${label}")`) });
    expect(await bankRow("Postings into sealed days").innerText()).toMatch(/\b3$/);
    expect(await bankRow("\u2026of those, first postings").innerText()).toMatch(/\b1$/);

    // And the month-end package names the day itself, so the accountant reconciling
    // daily slips against the journal is pointed straight at it (Increment 1.44).
    await page().goto(`${app.base}/cpa`);
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    const packageSealed = page().locator("section[aria-labelledby=package-sealed-days]");
    await packageSealed.waitFor({ timeout: 30_000 });
    const packageSealedText = await packageSealed.innerText();
    expect(packageSealedText).toMatch(/Sealed days · 1 frozen · 3 posted behind them/);
    expect(packageSealedText).toMatch(/2026-09-14 · 1 first posting/);
    expect(await page().locator("section[aria-labelledby=package-tieout]").innerText()).toMatch(
      /No row posted against a day this month after the practice sealed it: no\. 3 rows totalling \$10\.00 landed against 1 of 1 sealed day, 1 of them first postings\./
    );
    // The sealed-days section and the tie-out name days and figures, never a person.
    // (The chart-of-accounts table below them does name two people, and must: the
    // control is that the proposer and the approver are different ones.)
    expect(packageSealedText).not.toMatch(/Riley|Finn|Jane Doe/);
    expect(await page().locator("section[aria-labelledby=package-tieout]").innerText()).not.toMatch(/Riley|Finn|Jane Doe/);
    await b.audit("month-end package (sealed days disturbed)");
  }, 120_000);

  it("lets the outside accountant read and export the month, and gives that seat no other screen", async () => {
    // The seat is the reporting grant below every rank the practice's own
    // screens need (Increment 1.49). It reads the package, takes the month
    // away, and meets a refusal everywhere else.
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });

    // The header offers one screen rather than eleven that would refuse it.
    const nav = page().locator("header nav");
    expect(await nav.getByRole("link").allInnerTexts()).toEqual(["Month-end"]);
    await b.audit("month-end package (outside accountant)");

    // It reads the month, and the chart of accounts — the practice's own
    // maker-checker — is not the seat's to run, so it is not offered at all.
    expect(await page().locator("section[aria-labelledby=package-stamp]").innerText()).toMatch(/Package hash/);
    expect(await page().locator("section[aria-labelledby=package-mappings]").count()).toBe(0);
    expect(await page().getByRole("button", { name: "Close month" }).count()).toBe(0);
    expect(await page().getByRole("button", { name: "Propose mapping" }).count()).toBe(0);

    // It takes the month away, and the export is a chain event like any other.
    const downloading = page().waitForEvent("download", { timeout: 30_000 });
    await page().getByRole("button", { name: "Download CSV" }).click();
    expect((await downloading).suggestedFilename()).toMatch(/^month-end-\d{4}-\d{2}\.csv$/);
    await flash(/^Exported as CSV: \d+ rows, package hash [0-9a-f]{12}…, recorded on the chain\./).waitFor({ timeout: 30_000 });

    // Every other screen refuses it in words, which is the whole of the seat.
    await page().goto(`${app.base}/risk`);
    await page().locator("main [role=alert]").waitFor({ timeout: 60_000 });
    expect(await page().locator("main [role=alert]").innerText()).toMatch(/Practice Risk did not load/);
    await page().goto(`${app.base}/home`);
    await page().getByText(/The board is for the manager and owner seats/).waitFor({ timeout: 60_000 });
    await page().goto(`${app.base}/ledger`);
    await page().getByText(/You do not have access to this action\./).waitFor({ timeout: 60_000 });
    await b.audit("ledger (outside accountant refused)");
  }, 150_000);

  it("lets the accountant ask about a line of the month, and the practice answer it from the board", async () => {
    // The package was one-way until now: read it, export it, and ask about a
    // figure by email, where the question ends up somewhere other than the
    // month it is about (Increment 1.50).
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    const questions = page().locator("section[aria-labelledby=package-questions]");
    await questions.waitFor({ timeout: 30_000 });
    expect(await questions.innerText()).toMatch(/No one has asked about this month yet/);
    await b.audit("month-end package (questions, none yet)");

    // The line is chosen from the ones the package states, never typed.
    // By role: the section's own heading reads "Questions about this month", so
    // a label match on "About" reaches the region as well as the control.
    await questions.getByRole("combobox").selectOption("journal|total");
    await questions.getByLabel("Question", { exact: true }).fill("The journal total sits under the deposits for the month. What am I missing?");
    await questions.getByRole("button", { name: "Ask", exact: true }).click();
    await page().getByText(/^Asked\. The practice sees it on the home board\.$/).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => questions.innerText(), { timeout: 30_000 })
      .toMatch(/Journal total[\s\S]*Accountant · Casey Prentice[\s\S]*Waiting on the practice/);
    await b.audit("month-end package (a question waiting)");

    // The practice reads it on the board, where the work of the day is.
    await b.signIn("ridgeview-owner", "/home");
    const card = page().locator("section[aria-labelledby=accountant-asked]");
    await card.waitFor({ timeout: 60_000 });
    expect(await card.innerText()).toMatch(/1 question waiting on the practice[\s\S]*journal\|total[\s\S]*What am I missing\?/);
    await card.getByRole("button", { name: "Answer this" }).click();
    const answer = page().getByLabel("Your answer");
    await answer.waitFor({ timeout: 30_000 });
    // An answer says something: the button holds until it does.
    await answer.fill("too short");
    expect(await card.getByRole("button", { name: "Answer", exact: true }).isDisabled()).toBe(true);
    await answer.fill("Two deposits landed on the first of next month, so they are in that month's journal.");
    await b.audit("home board, the accountant's question");
    await card.getByRole("button", { name: "Answer", exact: true }).click();
    await page().getByText(/^Answered\. The accountant reads it on the month-end package\.$/).waitFor({ timeout: 30_000 });
    // Answered, so nobody is owed anything and the card leaves the board.
    await expect.poll(async () => page().locator("section[aria-labelledby=accountant-asked]").count(), { timeout: 30_000 }).toBe(0);

    // And the accountant reads the answer beside the figure it is about.
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    const answered = page().locator("section[aria-labelledby=package-questions]");
    await answered.waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => answered.innerText(), { timeout: 30_000 })
      .toMatch(/Practice · Riley Owner[\s\S]*Two deposits landed[\s\S]*Waiting on nobody/);

    // The answer landed on a screen nobody was watching, so the accountant is
    // told (Increment 1.55). It is a count rather than a badge that never
    // clears: marking it read is an act, and a later message re-opens it.
    expect(await answered.innerText()).toContain("1 thread the practice has spoken in since you last marked it read.");
    expect(await answered.innerText()).toContain("You have not marked this read.");
    await b.audit("month-end package (an answer the accountant has not read)");

    await answered.getByRole("button", { name: "Mark as read" }).click();
    await page().getByText(/^Marked as read\.$/).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => answered.innerText(), { timeout: 30_000 })
      .toMatch(/Marked read by Casey Prentice on \d{4}-\d{2}-\d{2}\./);
    // The count is gone, and so is the control: there is nothing left to mark.
    expect(await answered.innerText()).not.toContain("since you last marked");
    expect(await answered.getByRole("button", { name: "Mark as read" }).count()).toBe(0);
    await b.audit("month-end package (the question answered)");
  }, 150_000);

  it("lets the accountant attest a channel the product cannot hold, refuses one it can, and names it on the coverage table", async () => {
    // The coverage table has called vendor payments and payroll "attested,
    // never enforced" since Increment 1.12 with nothing behind the word. This
    // is what stands behind it (Increment 1.51).
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    const attest = page().locator("section[aria-labelledby=package-attest]");
    await attest.waitFor({ timeout: 30_000 });

    // Only the two channels this build cannot enforce are offered at all.
    const text = await attest.innerText();
    expect(text).toMatch(/New vendors[\s\S]*Payroll/);
    expect(text).not.toMatch(/Write-offs|Paper checks|Deposits/);
    expect(await attest.getByRole("button", { name: /^Attest / }).count()).toBe(2);
    await b.audit("month-end package (nothing attested yet)");

    await attest.getByRole("button", { name: "Attest Payroll" }).click();
    const note = attest.getByLabel("What you reviewed, and against what");
    await note.waitFor({ timeout: 30_000 });
    // It says what was reviewed, or it is not an attestation.
    await note.fill("too short");
    expect(await attest.getByRole("button", { name: "Reviewed this month" }).isDisabled()).toBe(true);
    await note.fill("Tied the payroll register to the provider's report and to the bank debits for the month.");
    await attest.getByRole("button", { name: "Reviewed this month" }).click();
    await page().getByText(/^Attested: Payroll for \d{4}-\d{2}\./).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => attest.innerText(), { timeout: 30_000 })
      .toMatch(/Reviewed for \d{4}-\d{2} by Casey Prentice \(the accountant\) on \d{4}-\d{2}-\d{2}/);
    // It is said once and never rewritten, so the control is gone from that row.
    expect(await attest.getByRole("button", { name: "Attest Payroll" }).count()).toBe(0);
    await b.audit("month-end package (payroll attested)");

    // The owner reads the same word on the coverage table, with who said it.
    // The table names the month that has ended, so this month's attestation is
    // not what it reports — which is the honest reading, and says so.
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    const payrollRow = page().locator("section[aria-labelledby=coverage] tbody tr", { hasText: "Payroll" });
    await payrollRow.waitFor({ timeout: 30_000 });
    expect(await payrollRow.innerText()).toMatch(/Attested \(external\)[\s\S]*(Nobody has reviewed|Reviewed for) \d{4}-\d{2}/);
    // An enforced channel carries no such line: there is nothing to attest
    // beside evidence the product already holds.
    const writeoffRow = page().locator("section[aria-labelledby=coverage] tbody tr", { hasText: "Write-offs / adjustments" });
    expect(await writeoffRow.innerText()).not.toMatch(/Nobody has reviewed|Reviewed for/);
    await b.audit("practice risk, what stands behind the word attested");
  }, 150_000);

  it("names on the owner board the channels nobody reviewed for the month that ended, and clears the card once somebody does", async () => {
    // Increment 1.51 gave the word "attested" something behind it. This is the
    // other half: the months nobody spoke for. Silence is the state that
    // matters, so the card is on the board in every state rather than only
    // when it is red — an owner who sees it only on a bad month cannot tell a
    // reviewed month from one nobody looked at.
    const ended = lastCompleteMonth();

    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    const card = page().locator("section[aria-labelledby=attested]");
    await card.waitFor({ timeout: 30_000 });
    // The eyebrow is set in uppercase by the stylesheet, so read it that way.
    expect(await card.innerText()).toContain(`CHANNELS THE PRODUCT CANNOT HOLD · ${ended}`);
    expect(await card.innerText()).toContain("2 of 2 reviewed by nobody");
    expect(await card.innerText()).toContain(
      `Nobody has reviewed new vendors and payroll for ${ended}, so those channels are a month the product cannot speak for and no person has.`
    );
    // The attestation the accountant made above was for the month still
    // running, and this card does not count it: a month nobody could have
    // finished reviewing is not a month anybody reviewed.
    await card.getByRole("link", { name: "Attest them on the month-end package" }).waitFor({ timeout: 30_000 });
    await b.audit("home board, an external channel nobody vouched for");

    // The accountant reads the ended month and vouches for both channels.
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    await page().getByLabel("Month", { exact: true }).fill(ended);
    const attest = page().locator("section[aria-labelledby=package-attest]");
    await expect.poll(async () => attest.getByRole("button", { name: /^Attest / }).count(), { timeout: 30_000 }).toBe(2);
    for (const [button, note] of [
      ["Attest Payroll", "Tied the payroll register for the ended month to the provider's report and to the bank debits."],
      ["Attest New vendors", "Checked every vendor opened in the ended month against the approval emails that opened it."],
    ] as const) {
      await attest.getByRole("button", { name: button }).click();
      await attest.getByLabel("What you reviewed, and against what").fill(note);
      await attest.getByRole("button", { name: "Reviewed this month" }).click();
      await page().getByText(new RegExp(`^Attested: .* for ${ended}\\.`)).waitFor({ timeout: 30_000 });
    }

    // And the board now reads the way the month-end package's tie-out does.
    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    await expect.poll(async () => card.innerText(), { timeout: 30_000 }).toContain("Reviewed by somebody: 2 of 2");
    expect(await card.innerText()).toContain(`carries an attestation for ${ended}`);
    expect(await card.innerText()).toContain("payroll by Casey Prentice");
    expect(await card.getByRole("link", { name: "Attest them on the month-end package" }).count()).toBe(0);
    await b.audit("home board, every external channel vouched for");
  }, 150_000);

  // Last of all, because it reads back what every case above did to the week.
  it("counts this week's attestations on the digest, and clears the standing line once the month is covered", async () => {
    // Increment 1.53. Three attestations happened above: payroll for the month
    // still running (1.51), then payroll and new vendors for the month that
    // ended (1.52). All three are acts of this week, so all three count here.
    await b.signIn("ridgeview-owner", "/digest");
    await page().getByRole("heading", { name: "The week, counted" }).waitFor({ timeout: 60_000 });
    const section = (id: string) => page().locator(`section[aria-labelledby=${id}]`);
    const row = (id: string, label: string) => section(id).locator("tr", { has: page().locator(`th:text-is("${label}")`) });
    await section("digest-chain").waitFor({ timeout: 60_000 });

    expect(await row("digest-alerts", "Channels attested").innerText()).toMatch(/\b3$/);
    // The standing line reads the month that has ended, which is now covered, and
    // names who said each -- the same sentence the owner board and the month-end
    // package carry, because all three read one function over the same rows.
    const standing = section("digest-attested");
    expect(await standing.innerText()).toMatch(/carries an attestation for \d{4}-\d{2}/);
    // The accountant made both of the ended month's attestations above, so
    // neither carries the practice's own word and the line marks neither.
    expect(await standing.innerText()).toContain("payroll by Casey Prentice");
    expect(await standing.innerText()).toContain("new vendors by Casey Prentice");
    expect(await standing.innerText()).not.toContain("(the practice itself)");
    // It is still marked as standing rather than as one of the week's counts.
    expect(await standing.innerText()).toMatch(/Standing, not this week/i);
    await b.audit("digest, the week's attestations and what still stands");
  }, 90_000);

  // Truly last: this one closes a month for good, which no earlier case may see.
  it("marks a question about a month the practice has since closed, on both screens", async () => {
    // Increment 1.54. A thread about a closed month read exactly like a thread
    // about an open one, and the two call for different answers: "I will fix
    // that figure" is true of an open month and false of a closed one, where
    // the fix posts today under prior_period and the accountant's copy still
    // reads what they received.
    const ended = lastCompleteMonth();

    // The owner closes the month that has ended, this time for good.
    await b.signIn("ridgeview-owner", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    await page().locator("input[type=month]").fill(ended);
    await page().getByRole("button", { name: "Close month" }).waitFor({ timeout: 30_000 });
    await page().getByRole("button", { name: "Close month" }).click();
    await page().getByRole("button", { name: "Close it for good" }).click();
    await page().getByText(new RegExp(`^Closed ${ended}\\.`)).waitFor({ timeout: 30_000 });

    // The accountant asks about a line of that now-frozen month.
    await b.signIn("ridgeview-cpa", "/cpa");
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
    await page().locator("input[type=month]").fill(ended);
    const questions = page().locator("section[aria-labelledby=package-questions]");
    await questions.waitFor({ timeout: 30_000 });
    await expect.poll(async () => questions.getByRole("combobox").count(), { timeout: 30_000 }).toBe(1);
    await questions.getByRole("combobox").selectOption("journal|total");
    await questions.getByLabel("Question", { exact: true }).fill("This total is lower than the one I had from your prior file. Which entries moved?");
    await questions.getByRole("button", { name: "Ask", exact: true }).click();
    await page().getByText(/^Asked\. The practice sees it on the home board\.$/).waitFor({ timeout: 30_000 });

    // The thread says the month is closed, and what a fix now actually does.
    const closedNote = new RegExp(
      `${ended} was closed by Riley Owner on \\d{4}-\\d{2}-\\d{2}, so its figures are frozen and the accountant already has them\\. ` +
        `A correction to this line now posts today with reason prior_period and is reported in the month it posts, not in this one\\.`
    );
    await expect.poll(async () => questions.innerText(), { timeout: 30_000 }).toMatch(closedNote);
    await b.audit("month-end package, a question about a closed month");

    // And the owner reads the same sentence on the board, before answering
    // rather than after: this is what decides whether the answer is true.
    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
    const asked = page().locator("section[aria-labelledby=accountant-asked]");
    await asked.waitFor({ timeout: 30_000 });
    expect(await asked.innerText()).toMatch(closedNote);
    await b.audit("home board, a question about a closed month");
  }, 150_000);
});
