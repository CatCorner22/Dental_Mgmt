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
    for (const name of ["Open ledger", "Post payment", "Bank reconciliation", "Day close", "Statements", "Approvals inbox", "Practice Risk", "Weekly digest", "Locations", "Month-end package"]) {
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
  it("corrects a posted entry as a reversal-and-repost pair, or says why a second person must release it", async () => {
    await b.signIn("ridgeview-front", "/ledger");
    await page().getByRole("heading", { name: "Ledger" }).waitFor({ timeout: 60_000 });
    await page().getByRole("link", { name: "Jane Doe" }).click();
    await page().getByText("Explain this balance").waitFor({ timeout: 30_000 });

    const ledger = page().locator("section:has(h2:text('Running ledger'))");
    const before = await ledger.locator("tbody tr").count();
    const correct = ledger.getByRole("button", { name: "Correct" }).first();
    await correct.waitFor({ timeout: 30_000 });
    await correct.click();
    const amount = page().getByLabel("Corrected amount");
    await amount.waitFor({ timeout: 30_000 });
    // The form opens on the figure the entry carries, so the correction states the new one.
    expect(await amount.inputValue()).toMatch(/^-?\d+\.\d{2}$/);
    await amount.fill("-45.00");
    await page().getByLabel("Reason").fill("posted twice");
    await b.audit("account explanation (correcting)");
    await page().getByRole("button", { name: "Reverse and repost" }).click();

    // Which way this lands is the clock's to decide: the after-hours hold forces a second person on
    // this channel outside the location's business hours, and CI runs at every hour. Both outcomes
    // are the product working; each has to say plainly which one happened.
    const done = page().getByText(/the entry is reversed and reposted/);
    const refused = page().getByText(/needs a second person, and a pair has to land in one transaction/);
    await Promise.race([done.waitFor({ timeout: 30_000 }), refused.waitFor({ timeout: 30_000 })]);

    if (await refused.count()) {
      // Refused: the pair never half-lands, so the ledger is exactly as it was.
      expect(await ledger.locator("tbody tr").count()).toBe(before);
      await b.audit("account explanation (correction needs a second person)");
      return;
    }

    // Written: two rows appear, and each says what it is.
    await expect.poll(async () => ledger.locator("tbody tr").count(), { timeout: 30_000 }).toBe(before + 2);
    const text = await ledger.innerText();
    expect(text).toMatch(/Reverses the/);
    expect(text).toMatch(/Reposts the/);
    // Neither half offers a Correct control: a correction is corrected through its repost, never in place.
    expect(await ledger.locator("tr", { hasText: "Reverses the" }).getByRole("button", { name: "Correct" }).count()).toBe(0);
    expect(await ledger.locator("tr", { hasText: "Reposts the" }).getByRole("button", { name: "Correct" }).count()).toBe(0);
    await b.audit("account explanation (corrected)");
  }, 90_000);
});
