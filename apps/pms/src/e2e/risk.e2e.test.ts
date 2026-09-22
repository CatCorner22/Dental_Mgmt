import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@pms/controls-engine";
import { assertNoProblems, e2eEnabled, openBrowser, startProductionApp, type E2eApp, type E2eBrowser } from "./harness";
import { currentCodeForTest } from "../lib/auth/totp";
import { DEV_MFA_SECRET, DEV_PASSWORD, DEV_TENANTS, DEV_USERS } from "@pms/db/seed-data";
import { uuidv7 } from "@pms/db";

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
    /**
     * This line used to read "2 grant row(s) name a duty outside the rulebook
     * and are listed, not scored", and the two rows were the owner's and the
     * front desk's `run_import` (Increment 1.91). The screen was telling its
     * reader that the product enforced a duty it could not score, and that
     * nothing here could grant or revoke. There is no such row now, so the
     * notice does not render.
     */
    expect(await page().getByText(/outside the rulebook/).count()).toBe(0);
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
    // The detectors ran on the freeze. No bank line exists, so no bank-line finding; the seeded grants leave two
    // highest-weight duties with one holder each (approve_writeoffs with the owner, collect_cash with Finn), recorded
    // without naming either. Totals are not asserted: the seeded deposits age past the banking lag on the calendar.
    const detectors = await page().locator("section[aria-labelledby=detectors]").innerText();
    expect(detectors).not.toMatch(/Unmatched bank line|Owner-only clearance|No detector findings yet/);
    expect(detectors.match(/Critical duty held by one person/g)?.length).toBe(2);
    expect(detectors).toMatch(/"Approve write-offs \/ adjustments" is held by one active person only/);
    expect(detectors).toMatch(/"Collect patient payments \/ cash drawer" is held by one active person only/);
    expect(detectors).not.toMatch(/Riley|Finn/);
    await b.audit("practice risk, frozen snapshot with decisions");

    // A decision on a finding. The owner is the one holder of approve_writeoffs, so accepting that residual is
    // refused as self-licensing; watching it is allowed. Finn's collect_cash row is someone else's work.
    const section = page().locator("section[aria-labelledby=detectors]");
    const ownRow = section.locator("tbody tr", { hasText: "Approve write-offs / adjustments" });
    await ownRow.getByRole("button", { name: /^Decide on Critical duty/ }).click();
    const findingForm = section.locator("form");
    await findingForm.waitFor({ timeout: 30_000 });
    await b.audit("practice risk, decision form on a finding");
    await findingForm.getByRole("combobox").selectOption("accept_residual");
    await findingForm.locator("input[placeholder*='compensates']").fill("Only the owner approves write-offs; the practice accepts this.");
    await findingForm.locator("input[type=date]").fill("2026-12-31");
    await findingForm.getByRole("button", { name: "Record decision" }).click();
    await flash(/cannot accept or compensate a finding about your own work/).waitFor({ timeout: 30_000 });
    await findingForm.getByRole("combobox").selectOption("monitor");
    await findingForm.getByRole("button", { name: "Record decision" }).click();
    await flash(/^Monitor recorded for the finding "Critical duty held by one person"/).waitFor({ timeout: 30_000 });
    expect(await ownRow.innerText()).toMatch(/Open[\s\S]*Monitor · review 2026-12-31/);

    const finnRow = section.locator("tbody tr", { hasText: "Collect patient payments / cash drawer" });
    await finnRow.getByRole("button", { name: /^Decide on Critical duty/ }).click();
    await findingForm.waitFor({ timeout: 30_000 });
    await findingForm.getByRole("combobox").selectOption("accept_residual");
    await findingForm.locator("input[placeholder*='compensates']").fill("The front desk alone collects while the second hire is onboarded.");
    await findingForm.locator("input[type=date]").fill("2026-11-30");
    await findingForm.getByRole("button", { name: "Record decision" }).click();
    await flash(/^Accept residual recorded for the finding/).waitFor({ timeout: 30_000 });
    expect(await finnRow.innerText()).toMatch(/Accept residual · review 2026-11-30/);
    expect(await section.innerText()).toMatch(/2 carry a decision and \d+ wait/);
    expect(await page().locator("section[aria-labelledby=register] tbody tr", { hasText: "detector finding" }).count()).toBe(2);
    await b.audit("practice risk, findings with decisions");

    await page().getByRole("button", { name: "Revoke Reconcile bank to PMS from Finn Front" }).click();
    await flash(/^Revoked Reconcile bank to PMS/).waitFor({ timeout: 30_000 });
    await page().getByRole("button", { name: "Revoke Collect patient payments / cash drawer from Finn Front" }).click();
    await flash(/^Revoked Collect patient payments/).waitFor({ timeout: 30_000 });
    const tiles = await page().locator("section[aria-labelledby=headline] .grid > div").allInnerTexts();
    /**
     * Two, not none (Increment 1.91). Finn Front's duties are back, and what
     * is left is the owner's own: the import duty entered the rulebook, and
     * the owner holds it alongside reconciliation and write-off approval.
     * Both combinations were true of the seeded practice from the first day
     * and neither was scored, because the duty belonged to no catalog and the
     * duty-family matrix had no row for it.
     */
    expect(tiles.map((t) => t.replace(/\s+/g, " "))).toEqual(
      expect.arrayContaining([expect.stringMatching(/OPEN CONFLICTS 2/), expect.stringMatching(/WITHOUT A DECISION 2/)])
    );
    // Same-family rows are folded away by default, so the two are named on the
    // checkbox before they are read in the table.
    const conflicts = page().locator("section[aria-labelledby=conflicts]");
    expect(await conflicts.getByText(/^Show same-family combinations/).innerText()).toMatch(/\(2\)/);
    await conflicts.locator("input[type=checkbox]").check();
    // A family row is titled by the two duty families rather than the two
    // duties, so the pairs are read that way: the owner's import duty records,
    // and it sits beside their reconciliation and their write-off approval.
    const familyRows = conflicts.locator("tbody tr").filter({ hasText: "combination" });
    await familyRows.first().waitFor({ timeout: 30_000 });
    const familyTexts = await familyRows.allInnerTexts();
    expect(familyTexts.length).toBe(2);
    for (const text of familyTexts) {
      expect(text).toMatch(/Riley Owner/);
      expect(text).toMatch(/recording/);
    }
    expect(familyTexts.some((t) => /reconciliation/.test(t))).toBe(true);
    expect(familyTexts.some((t) => /authorization/.test(t))).toBe(true);
  }, 120_000);

  it("brings decisions due to the home board with what happened since, and lets the owner keep one and retire one", async () => {
    // Bring the two finding decisions inside the 30-day horizon by superseding them on Practice Risk.
    const detectors = page().locator("section[aria-labelledby=detectors]");
    const form = detectors.locator("form");
    for (const [label, date] of [
      ["Approve write-offs / adjustments", "2026-10-01"],
      ["Collect patient payments / cash drawer", "2026-10-02"],
    ] as const) {
      const row = detectors.locator("tbody tr", { hasText: label });
      await row.getByRole("button", { name: /^Supersede the decision on/ }).click();
      await form.waitFor({ timeout: 30_000 });
      await form.getByRole("combobox").selectOption("monitor");
      await form.locator("input[placeholder*='compensates']").fill("Watching this duty until the second hire is live.");
      await form.locator("input[type=date]").fill(date);
      await form.getByRole("button", { name: "Record decision" }).click();
      await detectors.locator("tbody tr", { hasText: `Monitor · review ${date}` }).first().waitFor({ timeout: 30_000 });
    }

    await page().goto(`${app.base}/home`);
    const card = page().locator("section[aria-labelledby=decisions-due]");
    await card.getByRole("button", { name: "Keep Monitor 90 more days" }).first().waitFor({ timeout: 60_000 });
    const text = await card.innerText();
    expect(text).toMatch(/Monitor on detector finding · review by 2026-10-01/);
    expect(text).toMatch(/Monitor on detector finding · review by 2026-10-02/);
    expect(text).toMatch(/Since this decision on \d{4}-\d{2}-\d{2}: \d+ postings?; \d+ guarded releases? with a second approver and \d+ without; \d+ bank runs? cleared, \d+ owner-only; \d+ detector findings? opened, \d+ closed\. Directional and practice-wide; no one is named\./);
    expect(text).not.toMatch(/Riley|Finn/);
    await b.audit("home board, decisions due with keep, tighten, and retire");

    // Keep the first (due 10-01): the same decision, 90 days out, and it leaves the 30-day card.
    await card.getByRole("button", { name: "Keep Monitor 90 more days" }).first().click();
    await flash(/^Kept: Monitor stands and comes up for review again on /).waitFor({ timeout: 30_000 });
    expect(await card.innerText()).not.toMatch(/review by 2026-10-01/);

    // Retire the other: a note is required, and the second press is the irreversible one.
    await card.getByRole("button", { name: "Retire Monitor" }).click();
    const retireForm = card.locator("form");
    await retireForm.waitFor({ timeout: 30_000 });
    expect(await retireForm.getByRole("button", { name: "Retire for good" }).isDisabled()).toBe(true);
    await b.audit("home board, retire form");
    await retireForm.locator("input").fill("A second person now collects; nothing is left to watch.");
    await retireForm.getByRole("button", { name: "Retire for good" }).click();
    await flash(/^Retired: the decision no longer stands/).waitFor({ timeout: 30_000 });
    expect(await page().getByText(/No control decision comes up for review/).count()).toBe(1);

    // Practice Risk reads the outcome: the kept row reviewed 90 days out, the retired row undecided, the register carrying the retirement.
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    const keepDate = addDays(new Date().toISOString().slice(0, 10), 90);
    expect(await detectors.locator("tbody tr", { hasText: "Approve write-offs / adjustments" }).innerText()).toMatch(new RegExp(`Monitor · review ${keepDate}`));
    expect(await detectors.locator("tbody tr", { hasText: "Collect patient payments / cash drawer" }).innerText()).toMatch(/No decision yet/);
    expect(await page().locator("section[aria-labelledby=register] tbody tr", { hasText: "Retired" }).count()).toBe(1);
    await b.audit("practice risk, after the board review");
  }, 150_000);

  it("switches the after-hours hold off only with a decision and a review date, says so on the home board, and switches it back on", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const reviewDue = addDays(today, 90);
    const exceptions = page().locator("section[aria-labelledby=exceptions]");
    const holdRow = exceptions.locator("tbody tr", { hasText: "After-hours hold" });
    expect(await holdRow.innerText()).toMatch(/force dual[\s\S]*writeoff, check[\s\S]*Yes/);

    await holdRow.getByRole("button", { name: "Switch off After-hours hold" }).click();
    const form = exceptions.locator("form");
    await form.waitFor({ timeout: 30_000 });
    const submit = form.getByRole("button", { name: "Switch off with this decision" });
    expect(await submit.isDisabled()).toBe(true);
    expect(await form.getByRole("combobox").locator("option").allInnerTexts()).toEqual(["Accept residual", "Compensate"]);
    await b.audit("practice risk, switching the after-hours hold off");
    await form.locator("input[placeholder*='compensates']").fill("Two people staff the evening clinic through the year end.");
    // A note alone is not enough: the review date is required before the button lives.
    expect(await submit.isDisabled()).toBe(true);
    await form.locator("input[type=date]").fill(reviewDue);
    await submit.click();
    await flash(new RegExp(`^Switched off: After-hours hold\\. Review due ${reviewDue}`)).waitFor({ timeout: 30_000 });
    expect(await holdRow.innerText()).toMatch(/No[\s\S]*Switch on/);
    expect(await page().locator("section[aria-labelledby=register] tbody tr", { hasText: "exception" }).innerText()).toMatch(
      new RegExp(`Accept residual[\\s\\S]*${reviewDue}`)
    );

    await page().goto(`${app.base}/home`);
    const line = page().locator("section[aria-labelledby=after-hours-hold]");
    await line.waitFor({ timeout: 60_000 });
    expect(await line.innerText()).toMatch(new RegExp(`After-hours hold: off since ${today}, review due ${reviewDue}[\\s\\S]*Decided by Riley Owner: Two people staff`));
    await b.audit("home board, after-hours hold off");

    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await holdRow.getByRole("button", { name: "Switch on After-hours hold" }).click();
    await flash(/^Switched on: After-hours hold\. The decision that switched it off is retired\./).waitFor({ timeout: 30_000 });
    expect(await holdRow.innerText()).toMatch(/Yes[\s\S]*Switch off/);
    expect(await page().locator("section[aria-labelledby=register] tbody tr", { hasText: "Retired" }).count()).toBe(2);

    await page().goto(`${app.base}/home`);
    await page().locator("section[aria-labelledby=decisions-due]").waitFor({ timeout: 60_000 });
    expect(await page().locator("section[aria-labelledby=after-hours-hold]").count()).toBe(0);
  }, 150_000);

  it("names on the coverage table the reason codes holding a channel to less, and the decision behind a loosening", async () => {
    // The coverage table says what a channel holds. A reason code may hold that
    // channel to less (Increment 1.46), and the practice may loosen what a
    // reason holds only under a decision (Increment 1.47) — so a reader of the
    // table who cannot see the reasons is reading a figure that no longer
    // governs every posting on the channel (Increment 1.48).
    const coverage = () => page().locator("section[aria-labelledby=coverage] tbody tr", { hasText: "Write-offs / adjustments" });
    const reviewDue = addDays(new Date().toISOString().slice(0, 10), 120);

    // Nothing to say yet: no seeded reason carries a figure of its own.
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    expect(await coverage().innerText()).toMatch(/\$150/);
    expect(await coverage().innerText()).not.toMatch(/Courtesy adjustment/);

    // Hold courtesy write-offs to $50. That tightens, so it is a settings change.
    await b.signIn("ridgeview-owner", "/reason-codes");
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    const courtesy = page().locator("tr", { hasText: "courtesy" });
    await courtesy.waitFor({ timeout: 30_000 });
    await courtesy.getByRole("button", { name: "Set threshold for courtesy" }).click();
    await page().getByLabel("Second person over, in dollars, for courtesy").fill("50");
    await courtesy.getByRole("button", { name: "Save" }).click();
    await page().getByText(/^Set the threshold succeeded\.$/).waitFor({ timeout: 30_000 });

    // Practice Risk names it under the channel figure it tightens.
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await expect.poll(async () => coverage().innerText(), { timeout: 30_000 }).toMatch(/\$150[\s\S]*Courtesy adjustment: \$50/);
    // A reason reaches one channel, so the figure sits on that row and no other.
    const checkRow = page().locator("section[aria-labelledby=coverage] tbody tr", { hasText: "Paper checks" });
    expect(await checkRow.innerText()).not.toMatch(/Courtesy adjustment/);
    await b.audit("practice risk, a reason holding a channel to less");

    // Moving it to $100 lets through what used to wait, so it takes a decision.
    await page().goto(`${app.base}/reason-codes`);
    await page().getByRole("heading", { name: "Why money moved" }).waitFor({ timeout: 60_000 });
    const again = page().locator("tr", { hasText: "courtesy" });
    await again.waitFor({ timeout: 30_000 });
    await again.getByRole("button", { name: "Set threshold for courtesy" }).click();
    await page().getByLabel("Second person over, in dollars, for courtesy").fill("100");
    await page().getByText(/That lets through what used to wait for a second person/).waitFor({ timeout: 30_000 });
    await page().getByLabel("Why").fill("One biller writes off the small courtesy balances; the owner reads the weekly digest.");
    await page().getByLabel("Review by").fill(reviewDue);
    await again.getByRole("button", { name: "Save" }).click();
    await page().getByText(/^Set the threshold succeeded\.$/).waitFor({ timeout: 30_000 });

    // The coverage row now carries the figure and the decision that licensed it.
    await page().goto(`${app.base}/risk`);
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    await expect
      .poll(async () => coverage().innerText(), { timeout: 30_000 })
      .toMatch(new RegExp(`Courtesy adjustment: \\$100 · loosened under Accept residual by Riley Owner, review by ${reviewDue}`));
    await b.audit("practice risk, a loosened reason naming its decision");
  }, 150_000);

  it("folds what each seat owes into one list, derived from rows rather than stored", async () => {
    // Increment 1.57. Everything this arc built is read on its own screen; this
    // is the one place that answers "what does the practice owe, and who owes
    // it" without visiting all of them.
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    const owed = page().locator("section[aria-labelledby=outstanding]");
    await owed.waitFor({ timeout: 30_000 });

    // The seeded practice has never attested the month that ended, so the
    // practice owes that, in the same sentence the owner board carries.
    const text = await owed.innerText();
    expect(text).toContain("What people owe");
    expect(text).toMatch(/Channels nobody reviewed for \d{4}-\d{2}/);
    expect(text).toMatch(/Nobody has reviewed new vendors and payroll for \d{4}-\d{2}/);
    expect(text).toContain("recorded nowhere, so nothing here can outlive the thing it reports");
    // Addressed to a seat, never merely to a reader.
    expect(text).toContain("THE PRACTICE");
    await b.audit("practice risk, what people owe");
  });

  it("shows the message that would be sent and where, sends nothing, and quotes nobody", async () => {
    // Increment 1.58. The screen and the message are not the same surface: the
    // screen sits behind a guard, the message does not.
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    const delivery = page().locator("section[aria-labelledby=delivery]");
    await delivery.waitFor({ timeout: 30_000 });

    // Nobody has said where to send anything, so nothing would go anywhere.
    expect(await delivery.innerText()).toContain("You have never said where to send these");
    await b.audit("practice risk, nowhere to send yet");

    await delivery.getByLabel("Your address").fill("riley@ridgeview.example");
    await delivery.getByRole("button", { name: "Save address" }).click();
    await flash(/Messages would go to riley@ridgeview\.example\./).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toContain("Only you can change this");

    // The message itself: the subject names the practice and a count, the body
    // names what is owed in the product's own words, and neither carries a
    // sentence anybody typed.
    const body = await delivery.innerText();
    expect(body).toMatch(/Ridgeview [A-Za-z ]*: \d+ things? (is|are) waiting/);
    expect(body).toMatch(/Channels nobody reviewed for \d{4}-\d{2}/);
    expect(body).toContain("This message names no patient and quotes nobody's words.");
    // The subject line carries no content: it is what a lock screen shows.
    const subject = await delivery.locator("p", { hasText: /: \d+ things? (is|are) waiting/ }).first().innerText();
    expect(subject).not.toContain("Channels");
    await b.audit("practice risk, the message that would be sent");

    // Withdrawing is an act, and reads as one rather than as never having said.
    await delivery.getByRole("button", { name: "Stop sending to me" }).click();
    await flash(/You will receive no messages\./).waitFor({ timeout: 30_000 });
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toMatch(/You asked on \d{4}-\d{2}-\d{2} not to receive these/);
    await b.audit("practice risk, asked not to receive");
  }, 120_000);

  it("sends only to an address somebody proved, and says plainly when there was nowhere to send", async () => {
    // Increment 1.59. The half that matters is the failure: a delivery that
    // went nowhere and said nothing would leave its reader believing they had
    // been told.
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Headline" }).waitFor({ timeout: 60_000 });
    const delivery = page().locator("section[aria-labelledby=delivery]");
    await delivery.waitFor({ timeout: 30_000 });

    // The previous case withdrew, so this practice owes something and has
    // nowhere to send it — which is a state, not an error.
    // The banner, read on its own element: the outcome sentence deliberately
    // reads the same in the banner and in the section, so a locator by text
    // would match both and Playwright would refuse the ambiguity.
    const banner = page().locator("p[aria-live=polite]");
    await delivery.getByRole("button", { name: "Send this to me now" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/Nothing was sent on \d{4}-\d{2}-\d{2}: You asked on \d{4}-\d{2}-\d{2} not to receive these/);
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toMatch(/Nothing was sent on \d{4}-\d{2}-\d{2}/);
    // Increment 1.60. A reader deciding whether to press the button again is
    // told what pressing it already did, on the screen rather than in a doc.
    expect(await delivery.innerText()).toContain(
      "A refusal that can pass is tried up to three times in one send; a refusal that cannot is tried once."
    );
    // Increment 1.62: whether anything sends these without being asked, said
    // plainly. A scheduler that stopped must not read as a quiet practice.
    expect(await delivery.innerText()).toContain(
      "Nothing sends these on a schedule yet, so they go out only when somebody asks."
    );
    await b.audit("practice risk, nowhere to send it");

    // An address on its own is still nowhere to send (Increment 1.61): a
    // mistyped one does not bounce, it is accepted by whoever owns that
    // mailbox, so nothing but a code coming back tells the practice apart from
    // a stranger.
    await delivery.getByLabel("Your address").fill("riley@ridgeview.example");
    await delivery.getByRole("button", { name: "Save address" }).click();
    await flash(/Messages would go to riley@ridgeview\.example\./).waitFor({ timeout: 30_000 });
    await delivery.getByRole("button", { name: "Send this to me now" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/Nobody has proved that this address reaches you/);
    // Increment 1.63: how often the product can be made to send, said where a
    // person about to press the button will read it.
    expect(await delivery.innerText()).toContain("This practice will send at most five codes an hour");
    await b.audit("practice risk, an address nobody has proved");

    // The code goes to the address, through the same transport and the same
    // retry rule as anything else, so a code that could not be delivered would
    // read exactly as a failed send.
    await delivery.getByRole("button", { name: "Send me a code" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/Sent to riley@ridgeview\.example on \d{4}-\d{2}-\d{2}\./);

    // A code nobody sent proves nothing, and says so rather than failing quietly.
    await delivery.getByLabel("Code from that message").fill("ABCDEFGHJK");
    await delivery.getByRole("button", { name: "Prove this address" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/That code does not match one sent to this address/);

    // The real code, read out of the row the product wrote when it sent the
    // message — which is the only place it exists, since the code is stored as
    // a hash and never appears on the chain.
    const { rows } = await app.db.admin.query(
      "SELECT body FROM notice_sends WHERE notice_count = 0 ORDER BY attempted_at DESC, id DESC LIMIT 1"
    );
    const code = /Your code is ([A-HJKMNP-Z2-9]{10})/.exec(rows[0].body as string)?.[1] ?? "";
    expect(code).toHaveLength(10);
    await delivery.getByLabel("Code from that message").fill(code);
    await delivery.getByRole("button", { name: "Prove this address" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/This address is proved\./);
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toMatch(/Proved on \d{4}-\d{2}-\d{2}: somebody opened this address/);
    // Increment 1.65: a proof stands for a year, and the screen says when
    // rather than waiting for the day the notices stop.
    expect(await delivery.innerText()).toMatch(/It stands until \d{4}-\d{2}-\d{2}, when it needs proving again\./);
    await b.audit("practice risk, a proved address");

    // And now the notices go.
    await delivery.getByRole("button", { name: "Send this to me now" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/Sent to riley@ridgeview\.example on \d{4}-\d{2}-\d{2}\./);
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toMatch(/Sent to riley@ridgeview\.example on \d{4}-\d{2}-\d{2}\./);
    await b.audit("practice risk, sent");
  }, 180_000);

  it("lets the person who reads that mailbox stop it, with no account and no session", async () => {
    // Increment 1.67. The address this suite just proved is about to be
    // refused by the one party who had never been given a say: whoever opens
    // the mailbox. They have no account, will never have one, and are not the
    // person the practice typed the address for.
    const { rows } = await app.db.admin.query(
      "SELECT body FROM notice_sends WHERE kind = 'proof_code' ORDER BY attempted_at DESC, id DESC LIMIT 1"
    );
    const link = /(https?:\/\/\S+\/notices\/stop\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43})/.exec(rows[0].body as string)?.[1] ?? "";
    expect(link).toContain("/notices/stop/");

    // No session at all, which is the point: the secret in the link is the
    // whole of what authorises this.
    await page().context().clearCookies();
    await page().goto(link, { waitUntil: "networkidle" });
    await page().getByRole("heading", { name: "Stop these messages" }).waitFor({ timeout: 30_000 });
    const stopPage = page().locator("main");
    expect(await stopPage.innerText()).toContain("Ridgeview Family Dental");
    // The page names the practice and never the mailbox: a reader holding the
    // message already knows which mailbox, and a reader holding only a leaked
    // URL should not learn one.
    expect(await stopPage.innerText()).not.toContain("riley@ridgeview.example");
    await b.audit("stop page, offered to a stranger");

    await page().getByRole("button", { name: "I did not ask for this" }).click();
    await expect
      .poll(async () => await stopPage.innerText(), { timeout: 30_000 })
      .toMatch(/Ridgeview Family Dental has been told/);
    await b.audit("stop page, settled");

    // Opening the same link again says it is settled rather than offering the
    // button a second time.
    await page().goto(link, { waitUntil: "networkidle" });
    await expect
      .poll(async () => await stopPage.innerText(), { timeout: 30_000 })
      .toMatch(/was already told on \d{4}-\d{2}-\d{2} that this mailbox did not ask/);
    expect(await page().getByRole("button", { name: "I did not ask for this" }).count()).toBe(0);

    // And the practice reads it on the screen where it typed the address,
    // rather than discovering it as a silence.
    await b.signIn("ridgeview-owner", "/risk");
    const delivery = page().locator("section[aria-labelledby=delivery]");
    await delivery.waitFor({ timeout: 60_000 });
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 60_000 })
      .toMatch(/Somebody reading this address said on \d{4}-\d{2}-\d{2} that they did not ask/);
    expect(await delivery.innerText()).toContain("cannot save that address again");
    await b.audit("practice risk, a mailbox that said no");

    // Typing it again is refused in words, by the database's rule rather than
    // by this screen's opinion of it.
    await delivery.getByLabel("Your address").fill("RILEY@Ridgeview.Example");
    await delivery.getByRole("button", { name: "Save address" }).click();
    await expect
      .poll(async () => await page().locator("p[aria-live=polite]").innerText(), { timeout: 30_000 })
      .toMatch(/did not ask for this practice's messages[\s\S]*Use a different address/);
    await b.audit("practice risk, refusing a mailbox that said no");
  }, 180_000);

  it("says a lapsed proof is still being chased, and when it stops chasing", async () => {
    // Increment 1.68. Reaching this state honestly needs a proof older than a
    // year, so one is written directly — a real proof with a real date, rather
    // than a shortened life, which would drive a constant instead of the rule.
    // A different mailbox first. The one the previous case left on file was
    // refused by the stranger reading it, and a refusal outranks a lapse — so
    // planting a lapsed proof on that row would drive the refusal branch and
    // prove nothing about this one.
    await b.signIn("ridgeview-owner", "/risk");
    const panel = page().locator("section[aria-labelledby=delivery]");
    await panel.waitFor({ timeout: 60_000 });
    await panel.getByLabel("Your address").fill("riley.owner@ridgeview.example");
    await panel.getByRole("button", { name: "Save address" }).click();
    await expect
      .poll(async () => await page().locator("p[aria-live=polite]").innerText(), { timeout: 30_000 })
      .toMatch(/Messages would go to riley\.owner@ridgeview\.example\./);

    const address = (
      await app.db.admin.query(
        "SELECT id, user_id FROM notice_addresses WHERE address = $1 ORDER BY set_at DESC LIMIT 1",
        ["riley.owner@ridgeview.example"]
      )
    ).rows[0];
    const provedAt = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000);
    // `notice_addresses` and its proofs refuse a transaction with no acting
    // user, so the session value is set first; `db.admin` is one client, so
    // this and the inserts land on the same connection.
    await app.db.admin.query("SELECT set_config('app.user_id', $1, false)", [address.user_id]);
    await app.db.admin.query(
      `INSERT INTO notice_address_challenges (id, tenant_id, user_id, address_id, token_hash, issued_at, expires_at)
         SELECT gen_random_uuid(), tenant_id, user_id, id, repeat('a', 64), $2::timestamptz - interval '1 minute', $2::timestamptz + interval '1 minute'
           FROM notice_addresses WHERE id = $1`,
      [address.id, provedAt.toISOString()]
    );
    await app.db.admin.query(
      `INSERT INTO notice_address_proofs (id, tenant_id, user_id, address_id, challenge_id, proved_at)
         SELECT gen_random_uuid(), c.tenant_id, c.user_id, c.address_id, c.id, $2::timestamptz
           FROM notice_address_challenges c
          WHERE c.address_id = $1 AND c.token_hash = repeat('a', 64) LIMIT 1`,
      [address.id, provedAt.toISOString()]
    );
    await app.db.admin.query("SELECT set_config('app.user_id', '', false)");

    await b.signIn("ridgeview-owner", "/risk");
    const delivery = page().locator("section[aria-labelledby=delivery]");
    await delivery.waitFor({ timeout: 60_000 });
    // The count is not pinned: earlier cases in this suite send codes of their
    // own, so what is asserted is that the branch renders and says what it
    // means, not how many times this suite happened to ask.
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 60_000 })
      .toMatch(/gone out since the proof lapsed\. The practice keeps asking once a month, and stops on \d{4}-\d{2}-\d{2}/);
    expect(await delivery.innerText()).not.toContain("stopped being a destination");
    await b.audit("practice risk, a lapse still being chased");
  }, 120_000);

  it("tells the practice, on the owner's board, who it cannot reach", async () => {
    // Increment 1.69. The previous case left this owner with a lapsed proof the
    // practice is still chasing — which until now only they could see, on a
    // screen they had no reason to open, because the notices that would have
    // sent them there are the notices being withheld.
    await b.signIn("ridgeview-owner", "/home");
    const card = page().locator("section[aria-labelledby=reach]");
    await card.waitFor({ timeout: 60_000 });
    await expect
      .poll(async () => await card.innerText(), { timeout: 60_000 })
      .toMatch(/cannot be reached/);
    const said = await card.innerText();
    // The person, and the reason, in the same words the digest would use.
    expect(said).toContain("Riley Owner");
    expect(said).toMatch(/lapsed on \d{4}-\d{2}-\d{2}/);
    expect(said).toContain("still asking");
    // Never the address: where somebody is reachable is theirs (Increment 1.58).
    expect(said).not.toContain("@");
    await b.audit("owner board, who the practice cannot reach");
  }, 120_000);

  it("tells the practice who it was never set up to reach, and leaves the rest of the roster out", async () => {
    // Increment 1.70. The card above reports an address that does not work;
    // this one reports a person who never gave one. The outside accountant has
    // said nothing in this whole suite, so the month-end package — the one
    // thing this product sends outside itself — reaches nobody.
    await b.signIn("ridgeview-owner", "/home");
    const card = page().locator("section[aria-labelledby=setup]");
    await card.waitFor({ timeout: 60_000 });
    await expect
      .poll(async () => await card.innerText(), { timeout: 60_000 })
      .toMatch(/cannot be told/);
    const said = await card.innerText();
    expect(said).toContain("Casey Prentice");
    expect(said).toContain("outside accountant's seat");
    expect(said).toContain("never said where");
    // The scope, which is the whole argument: the front desk and the new hire
    // have no address either and can act on nothing a notice says, so naming
    // them would make this the roster rather than a card.
    expect(said).not.toContain("Finn Front");
    expect(said).not.toContain("Nora Newhire");
    // Never the address, on this card as on the one above.
    expect(said).not.toContain("@");
    await b.audit("owner board, who the practice was never set up to reach");
  }, 120_000);

  it("invites the outside accountant's seat, and the invited person opens it with a password the practice never sees", async () => {
    // Increment 1.71. `users` was written by the seed and by nothing else, so a
    // practice that wanted an accountant could not have one — and the card
    // above would report a seat that never said where to send its messages
    // while offering no way to add it.
    await b.signIn("ridgeview-owner", "/risk");
    const panel = page().locator("section[aria-labelledby=invite-seat]");
    await panel.waitFor({ timeout: 60_000 });
    await panel.locator("#seat-username").fill("firm-accounting");
    await panel.locator("#seat-name").fill("Prentice and Co");
    await panel.locator("#invite-seat-submit").click();
    await expect.poll(async () => await panel.innerText(), { timeout: 60_000 }).toMatch(/Send this link to firm-accounting/);
    const link = (await panel.locator("code").innerText()).trim();
    expect(link).toMatch(/\/invite\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);

    // The seat appears on the board's "never set up" card straight away, which
    // is the reading Increment 1.70 built and the reason this act exists.
    await page().goto(`${app.base}/home`);
    const setup = page().locator("section[aria-labelledby=setup]");
    await setup.waitFor({ timeout: 60_000 });
    await expect.poll(async () => await setup.innerText(), { timeout: 60_000 }).toMatch(/Prentice and Co/);

    // The invited person opens the link with no session at all.
    await page().context().clearCookies();
    await page().goto(link, { waitUntil: "networkidle" });
    expect(await page().locator("main").innerText()).toContain("outside accountant");
    // It names the practice and the username, and never an address: this seat
    // has none yet, and saying where to send its messages is its own act.
    expect(await page().locator("main").innerText()).toContain("firm-accounting");
    expect(await page().locator("main").innerText()).not.toContain("@");
    await b.audit("invitation, before the password is set");

    await page().locator("#invite-password").fill("a-long-enough-password");
    await page().locator("#invite-confirm").fill("a-long-enough-password");
    await page().locator("#invite-submit").click();
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .toMatch(/Sign in as firm-accounting/);
    await b.audit("invitation, claimed");

    // Once only: the same link now says so rather than opening a second time.
    await page().goto(link, { waitUntil: "networkidle" });
    expect(await page().locator("main").innerText()).toContain("already been used");
  }, 180_000);

  it("sends another link to a seat whose first one went astray, and the old link then opens nothing", async () => {
    // Increment 1.73. Until now a lost link stranded the account: `inviteAccountant`
    // only ever created a NEW user, so the practice's only recourse was a second
    // seat, leaving the first active, openable by nobody, and named on the board's
    // "never set up" card forever.
    await b.signIn("ridgeview-owner", "/risk");
    const panel = page().locator("section[aria-labelledby=invite-seat]");
    await panel.waitFor({ timeout: 60_000 });
    await panel.locator("#seat-username").fill("firm-mislaid");
    await panel.locator("#seat-name").fill("Mislaid and Co");
    await panel.locator("#invite-seat-submit").click();
    await expect.poll(async () => await panel.innerText(), { timeout: 60_000 }).toMatch(/Send this link to firm-mislaid/);
    const stale = (await panel.locator("code").innerText()).trim();

    // The practice mislays it. The seat is waiting, and the panel offers another.
    await expect.poll(async () => await panel.innerText(), { timeout: 60_000 }).toMatch(/Invited, not yet opened/);
    const waiting = panel.getByRole("listitem").filter({ hasText: "firm-mislaid" });
    await waiting.getByRole("button", { name: "Send a new link" }).click();
    // Waited on the link CHANGING rather than on the panel saying "Send this
    // link", which was already true from the first invitation and would have
    // matched the stale one instantly.
    await expect
      .poll(async () => (await panel.locator("code").innerText()).trim() !== stale, { timeout: 60_000 })
      .toBe(true);
    const fresh = (await panel.locator("code").innerText()).trim();
    await b.audit("practice risk, a seat reissued");

    // The old link opens nothing, and says why rather than failing blankly.
    await page().context().clearCookies();
    await page().goto(stale, { waitUntil: "networkidle" });
    expect(await page().locator("main").innerText()).toMatch(/replaced by a newer one/);
    expect(await page().locator("#invite-password").count()).toBe(0);
    await b.audit("invitation, superseded");

    // The new one opens the seat, which is the whole point of sending it.
    await page().goto(fresh, { waitUntil: "networkidle" });
    await page().locator("#invite-password").fill("another-long-password");
    await page().locator("#invite-confirm").fill("another-long-password");
    await page().locator("#invite-submit").click();
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .toMatch(/Sign in as firm-mislaid/);

    /**
     * And the panel stops saying the seat is waiting (Increment 1.92). This
     * case built the exact state that was broken — invited, reissued, then
     * opened on the link in force — and stopped at the claim, so the defect
     * sat under a passing test: the superseded invitation row is unclaimed
     * and always will be, and the list read that row rather than the seat.
     * The practice was told for good that somebody who had set a password had
     * not opened their seat, and the one act offered on the row refused every
     * time it was pressed.
     */
    await b.signIn("ridgeview-owner", "/risk");
    const seatPanel = page().locator("section[aria-labelledby=invite-seat]");
    await seatPanel.waitFor({ timeout: 60_000 });
    await expect
      .poll(async () => await seatPanel.getByRole("listitem").filter({ hasText: "firm-mislaid" }).count(), {
        timeout: 60_000,
      })
      .toBe(0);
    await b.audit("practice risk, a reissued seat gone from the unopened list");
  }, 180_000);

  it("takes the invited seat through its first sign-in with no authenticator, and into the month-end screen", async () => {
    // Increment 1.72. The case above left `firm-accounting` with a password its
    // holder set and no second factor at all, which is the state every invited
    // seat starts in: `mfa_enrolled_at` is null. A seat that cannot finish
    // signing in is a seat the practice only believes it has.
    await page().context().clearCookies();
    await page().goto(`${app.base}/signin?callbackUrl=${encodeURIComponent("/cpa")}`, { waitUntil: "networkidle" });
    await page().fill('input[name="username"]', "firm-accounting");
    await page().fill('input[name="password"]', "a-long-enough-password");
    // Deliberately blank: they have no authenticator yet, and the field must
    // not stand between them and the enrolment that gives them one.
    await page().click('button[type="submit"]');
    // Waited for by what the person sees rather than by the path: a server
    // action redirects to the callback, the middleware then sends an
    // unenrolled session to the enrolment screen, and the address bar keeps
    // the action's target while the enrolment page renders. Asserting on the
    // path would test that quirk rather than this increment's rule.
    // Increment 1.76 renamed this screen: it now serves a first pairing and a
    // re-pairing alike, so it is named for the thing rather than for one act.
    const enrolment = page().getByRole("heading", { name: "Your authenticator" });
    await enrolment.waitFor({ timeout: 60_000 });
    // The defect this case found: the route opened at `user` rank, so the one
    // seat below it was told "You do not have access to this action" with no
    // way forward and nothing naming what was wrong.
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .not.toMatch(/do not have access/);
    await b.audit("first sign-in, enrolment");

    // Increment 1.80. The gate holds this account out of the application, and
    // it must not also hold the door. Driven here because this is the only
    // moment in the suite where a session genuinely carries the claim — minted
    // at sign-in, and, until this increment, never rewritten — and a person who
    // wants to abandon a half-finished sign-in has to be able to.
    await page().goto(`${app.base}/signin`, { waitUntil: "networkidle" });
    await page().getByRole("heading", { name: "Sign in" }).waitFor({ timeout: 60_000 });
    await page().goto(`${app.base}/enroll-mfa`, { waitUntil: "networkidle" });
    await enrolment.waitFor({ timeout: 60_000 });

    // The setup URI the form shows is the only place this secret exists, so the
    // case reads it the way the person's authenticator would. Read after the
    // detour above, because each visit starts a fresh pairing.
    const uri = (await page().locator("main code").innerText()).trim();
    const secret = new URL(uri.replace("otpauth://", "https://")).searchParams.get("secret");
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    await page().fill('input[name="totp"]', currentCodeForTest("firm-accounting", secret!, Date.now()));
    await page().click('button[type="submit"]');
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .toMatch(/recovery codes/i);
    await b.audit("first sign-in, recovery codes");

    // Increment 1.80, and the defect this case walks straight into: a reload.
    //
    // Finishing an enrolment revokes every session for the account, because not
    // one of them passed the factor the account now has. The cookie used to
    // survive that, still claiming the account owed a second factor, so the
    // middleware sent every address back to this screen — whose own route then
    // answered 401, because the session was gone. What was left was one error
    // line, a button that could not be pressed, and no way anywhere. The only
    // exit was the button below, which lives in React state a reload discards.
    //
    // So the session now ends in both halves at once, and the screen reads a
    // 401 as the state it is rather than as an error beside the field. Both
    // controls here share one handler, so driving this one drives the exit.
    await b.signedOut(async () => {
      await page().reload({ waitUntil: "networkidle" });
      await expect
        .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
        .toMatch(/This sign-in has ended/);
      expect(await page().locator("main").innerText()).toMatch(/that pairing is what ended it/);
      await b.audit("first sign-in, session ended after enrolment");
    });

    await page().getByRole("button", { name: "Go to sign in" }).click();
    await page().waitForURL((url) => url.pathname === "/signin", { timeout: 60_000 });

    await page().fill('input[name="username"]', "firm-accounting");
    await page().fill('input[name="password"]', "a-long-enough-password");
    await page().fill('input[name="totp"]', currentCodeForTest("firm-accounting", secret!, Date.now()));
    await page().click('button[type="submit"]');
    // Sign-in lands everybody on the practice home, and this seat is told in
    // words that the board is not theirs rather than being moved without
    // explanation — the refusal this product gives everywhere else. The header
    // offers the one screen that is theirs.
    await page().getByText(/The board is for the manager and owner seats/).waitFor({ timeout: 60_000 });
    expect(await page().locator("header nav").getByRole("link").allInnerTexts()).toEqual(["Month-end"]);

    await page().locator("header nav").getByRole("link", { name: "Month-end" }).click();
    await page().waitForURL((url) => url.pathname === "/cpa", { timeout: 60_000 });
    // The one screen this seat reaches (Increment 1.49), now reached by a seat
    // the practice created for itself rather than one the seed provided.
    await page().getByRole("heading", { name: "The month, for the accountant" }).waitFor({ timeout: 60_000 });
  }, 180_000);

  it("tells a practice with one administrator why nobody can bring a locked-out person back", async () => {
    /**
     * Increment 1.77. Ridgeview seeds one administrator, which is what every
     * practice this product can currently produce: no route writes
     * `users.role`. So this is the state a real practice meets, and the
     * assertion is that it meets a refusal that says the rule, the practice's
     * own number, and the one thing that would change it — rather than a form
     * whose only outcome is a dead end.
     */
    await b.signIn("ridgeview-owner", "/risk");
    const section = page().locator("section[aria-labelledby=regain]");
    await section.waitFor({ timeout: 60_000 });
    const said = await section.innerText();
    expect(said).toMatch(/takes two administrators/);
    expect(said).toMatch(/one administrator who could take a part/);
    expect(said).toMatch(/Appoint a second administrator/);
    // A practice that has met the GL mapping exception (Increment 1.75) must
    // not be left expecting one here.
    expect(said).toMatch(/no recorded exception/);
    // And nothing is offered that cannot be finished.
    expect(await page().locator("#regain-start").count()).toBe(0);
    expect(await page().locator("#regain-target").count()).toBe(0);
    await b.audit("practice risk, getting somebody back in");
  }, 120_000);

  it("appoints a second administrator, which is what makes the recovery panel above usable", async () => {
    /**
     * Increment 1.78, and the one case that ties two increments together.
     *
     * The case above reads the refusal a one-administrator practice meets.
     * Nothing in this product wrote `users.role` before this increment, so
     * that refusal named a remedy — "appoint a second administrator" — the
     * practice could not take. This drives the remedy and then watches the
     * refusal turn into a form.
     *
     * It puts the rank back afterwards, because a later case in this suite
     * signs in as `ridgeview-front` and expects the user-rank Refusal. That
     * restoration is worth asserting in its own right: a practice that
     * promotes somebody should be able to undo it.
     */
    await b.signIn("ridgeview-owner", "/risk");
    const ranks = page().locator("section[aria-labelledby=ranks]");
    await ranks.waitFor({ timeout: 60_000 });
    expect(await ranks.innerText()).toMatch(/1 administrator\b/);

    // The recovery panel offers nothing yet, which is the state this case
    // exists to change.
    expect(await page().locator("#regain-start").count()).toBe(0);

    // The viewer's own row offers no control at all, for the reason a grant
    // may not license its own conflict — it says so instead.
    expect(await ranks.innerText()).toMatch(/Your own rank/);

    /**
     * Matched on the person's name, never on the control role beside it:
     * `precogRole` falls through to "Front Desk Lead" for everybody without a
     * grant, so a matcher reading that label picks whichever ungranted person
     * happens to sort first — which here promoted the one account with no
     * second factor, left the eligible count at one, and made this case fail
     * for a reason that had nothing to do with what it asserts.
     *
     * Finn Front carries a second factor in the seed. Nora Newhire does not,
     * and `isEligibleAdmin` refuses an administrator who cannot prove one, so
     * promoting her would not open the panel below.
     */
    const setRank = async (displayName: string, rank: string, expected: RegExp) => {
      const row = page().locator("section[aria-labelledby=ranks] li").filter({ hasText: displayName });
      await row.waitFor({ timeout: 60_000 });
      await row.locator("[id^='rank-open-']").click();
      const select = row.locator("select");
      await select.waitFor({ timeout: 30_000 });
      await select.selectOption(rank);
      await row.locator("[id^='rank-submit-']").click();
      await expect.poll(async () => await ranks.innerText(), { timeout: 60_000 }).toMatch(expected);
    };

    await setRank("Finn Front", "admin", /2 administrators/);
    await b.audit("practice risk, a second administrator appointed");

    // And the refusal above is now a form: the remedy Increment 1.77 named is
    // one this product can obey.
    await page().reload({ waitUntil: "networkidle" });
    await page().locator("#regain-start").waitFor({ timeout: 60_000 });
    expect(await page().locator("#regain-target").count()).toBe(1);
    expect(await page().locator("section[aria-labelledby=regain]").innerText()).not.toMatch(
      /Appoint a second administrator/
    );

    // Put it back, so the later user-rank case reads what it was written for.
    // Undoing an appointment is worth driving in its own right.
    await setRank("Finn Front", "user", /1 administrator\b/);
    await page().reload({ waitUntil: "networkidle" });
    expect(await page().locator("section[aria-labelledby=regain]").innerText()).toMatch(
      /Appoint a second administrator/
    );
  }, 180_000);

  it("stands somebody down, ends their grants with them, and brings the account back without the powers", async () => {
    /**
     * Increment 1.79. `users.active` has been in the schema since Increment
     * 0.2 and never reachable: `deactivateUser` had two callers, both tests,
     * and nothing anywhere set the column back. So a practice could not
     * remove access for somebody who left.
     *
     * The case drives Nora Newhire, who holds no grants and no second factor,
     * so nothing else in this suite depends on her standing.
     */
    await b.signIn("ridgeview-owner", "/risk");
    const roster = page().locator("section[aria-labelledby=ranks]");
    await roster.waitFor({ timeout: 60_000 });

    const row = (name: string) =>
      page().locator("section[aria-labelledby=ranks] li").filter({ hasText: name });

    await row("Nora Newhire").locator("[id^='standing-']").click();
    await expect
      .poll(async () => await row("Nora Newhire").innerText(), { timeout: 60_000 })
      .toMatch(/stood down/);
    // A person stood down is offered no rank change: the act would refuse a
    // deactivated account, and a button whose only outcome is a refusal is
    // the shape Increments 1.72 and 1.74 were both about.
    expect(await row("Nora Newhire").locator("[id^='rank-open-']").count()).toBe(0);
    expect(await roster.innerText()).toMatch(/Stood down\./);
    await b.audit("practice risk, somebody stood down");

    // The owner's own row offers no standing control at all.
    expect(await row("Riley Owner").locator("[id^='standing-']").count()).toBe(0);

    // Back on, and the sentence says the powers did not come back with them.
    await row("Nora Newhire").locator("[id^='standing-']").click();
    await expect
      .poll(async () => await roster.innerText(), { timeout: 60_000 })
      .toMatch(/their grants were not restored/i);
    /**
     * Polled, not read once. The sentence above is the flash, which the act
     * sets as soon as the route answers; the row is redrawn from the refetch
     * that follows it. Reading the row the moment the flash lands assumes
     * those two happen together, and on a slower machine they do not — this
     * assertion passed here and failed in CI, which is the shape of a race
     * rather than of a defect. The assertion itself is unchanged.
     */
    await expect
      .poll(async () => await row("Nora Newhire").innerText(), { timeout: 60_000 })
      .not.toMatch(/stood down/);
  }, 180_000);

  it("answers a recovery link that opens nothing in one sentence, and offers no way around it", async () => {
    // Increment 1.77, and the shape Increments 1.67 and 1.71 settled for every
    // page outside a session: a link that ran out, a link nobody approved and
    // a link that was never ours are told apart by anybody holding a real one
    // and by nobody else.
    await page().context().clearCookies();
    const shaped = `018f2a10-4c3b-7d21-9e44-5f6a7b8c9d0e.${"A".repeat(43)}`;
    await page().goto(`${app.base}/regain/${shaped}`, { waitUntil: "networkidle" });
    expect(await page().locator("main").innerText()).toMatch(/This link no longer works/);
    // No form, and no sign-in offered as a consolation.
    expect(await page().locator("#regain-password").count()).toBe(0);
    expect(await page().locator('input[name="username"]').count()).toBe(0);
    await b.audit("recovery link, opens nothing");

    // A reference of another shape entirely reads the same, and is refused
    // before any row is looked up.
    await page().goto(`${app.base}/regain/not-a-token`, { waitUntil: "networkidle" });
    expect(await page().locator("main").innerText()).toMatch(/This link no longer works/);
  }, 120_000);

  /**
   * The browser case Increment 1.88 left undone, and said so in its own record
   * (Increment 1.89).
   *
   * Raising `new_device_financial_role` needs a holder of a critical duty with
   * a sign-in from a browser nobody has seen on that account. The seeded
   * practice has exactly one such holder — the owner — which is why this case
   * grants one to the front desk first: pressing the button on the owner's own
   * alarm is the case below, and it refuses by design.
   */
  it("ends the sign-ins a new-device alarm names, and offers nothing on the reader's own", async () => {
    const tenantId = DEV_TENANTS[0]!.id;
    const front = DEV_USERS.find((u) => u.username === "ridgeview-front")!;

    await app.db.admin.query(
      `INSERT INTO user_entitlements (id, tenant_id, user_id, entitlement, effective_from)
       VALUES ($1, $2, $3, 'bank_reconcile', now())
       ON CONFLICT DO NOTHING`,
      [uuidv7(), tenantId, front.id]
    );
    // Two sign-ins from one browser nobody has seen on that account. Both end;
    // the sentence counts them, which is what tells the owner the act reached
    // more than the one row the alarm named.
    for (const _ of [0, 1]) {
      await app.db.admin.query(
        `INSERT INTO sessions (id, tenant_id, user_id, created_at, last_seen_at, absolute_expires_at, idle_expires_at, device_profile, user_agent)
         VALUES ($1, $2, $3, now(), now(), now() + interval '12 hours', now() + interval '30 minutes', 'desk', 'Unseen-Browser/1.0')`,
        [uuidv7(), tenantId, front.id]
      );
    }

    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });

    // The owner's own sign-ins raise the same alarm, and carry no button.
    await page().getByText(/This names your own sign-in/).first().waitFor({ timeout: 30_000 });

    const end = page().getByRole("button", { name: "End their sign-ins" });
    expect(await end.count()).toBe(1);
    await end.first().click();

    await page().getByText(/Ended 2 sign-ins for Finn Front/).waitFor({ timeout: 30_000 });

    const { rows } = await app.db.admin.query(
      "SELECT count(*)::int AS live FROM sessions WHERE user_id = $1 AND revoked_at IS NULL",
      [front.id]
    );
    expect(rows[0].live).toBe(0);

    // And the chain records who did it to whom.
    const { rows: events } = await app.db.admin.query(
      "SELECT payload->>'targetUsername' AS who, payload->>'revoked' AS n FROM domain_event WHERE tenant_id = $1 AND kind = 'auth.sessions_ended'",
      [tenantId]
    );
    expect(events).toEqual([{ who: "ridgeview-front", n: "2" }]);

    await b.audit("owner board, new-device alarm acted on");

    await app.db.admin.query(
      "DELETE FROM user_entitlements WHERE user_id = $1 AND entitlement = 'bank_reconcile'",
      [front.id]
    );
  }, 120_000);

  /**
   * Increment 1.91. The duty that guarded three import routes and belonged to
   * no catalog. Before this increment the dropdown did not offer it, because
   * the dropdown is the catalog, and the route behind it refused it as
   * unknown — so the only holders were the two the seed wrote rows for, and
   * the screen said as much in the line this suite's first case now asserts
   * the absence of.
   *
   * It sits before the case that ends every sign-in and the one that re-pairs
   * the owner's authenticator, both of which leave the session or the secret
   * somewhere a later sign-in cannot follow.
   */
  it("shows the import duty on the person who holds it, revokes it, and grants it back", async () => {
    // The case before this one reads the owner board, so this comes back to
    // Practice Risk rather than assuming where the suite left the browser.
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "Who holds which duties" }).waitFor({ timeout: 60_000 });

    /**
     * Finn Front has held `run_import` since the seed wrote the row, and until
     * this increment the screen did not show it: `assignmentsFromGrants` put
     * the row in `unknownEntitlements`, which the duties section never reads.
     * So the practice could not see the duty, and had no button to take it
     * back.
     */
    const revoke = page().getByRole("button", {
      name: "Revoke Import bank and practice-management files from Finn Front",
    });
    await revoke.waitFor({ timeout: 30_000 });
    await revoke.click();
    await flash(/^Revoked Import bank and practice-management files/).waitFor({ timeout: 30_000 });

    /**
     * And back again, which is the half that was impossible: `revokeEntitlement`
     * took any string it was handed while `grantEntitlement` refused anything
     * outside the catalog, so ending an import grant ended it for good.
     */
    const finn = await grantSelects().nth(0).locator("option", { hasText: "Finn Front" }).getAttribute("value");
    await grantSelects().nth(0).selectOption(finn!);
    await grantSelects().nth(1).selectOption("run_import");
    await page().getByRole("button", { name: "Grant", exact: true }).click();
    await flash(/^Granted Import bank and practice-management files/).waitFor({ timeout: 30_000 });
    await revoke.waitFor({ timeout: 30_000 });
    await b.audit("practice risk, the import duty revoked and granted back");
  }, 120_000);

  /**
   * Increment 1.90. The route has existed since Increment 0.8 and no screen
   * ever called it. This drives the whole act, including the half that makes
   * it different from Increment 1.88's: the administrator pressing it signs
   * themselves out, and the panel says so rather than leaving it to be met.
   *
   * Placement: before the case that pairs a new authenticator for the owner,
   * which leaves `DEV_MFA_SECRET` no longer that account's secret — the trap
   * Increment 1.89 recorded, and walked into again while writing this. Ending
   * every session is safe for the cases that follow, because each signs in for
   * itself.
   */
  it("ends every sign-in in the practice, including the administrator's own", async () => {
    await b.signIn("ridgeview-owner", "/risk");
    await page().getByRole("heading", { name: "End every sign-in in the practice" }).waitFor({ timeout: 60_000 });

    const press = page().getByRole("button", { name: "End every sign-in" });
    // A reason is the guard: the act cannot be pressed without one.
    expect(await press.isDisabled()).toBe(true);

    await page().fill('input[name="revoke-reason"]', "Lost phone reported by the front desk");
    expect(await press.isDisabled()).toBe(false);
    await press.click();

    await page().getByText(/including your own/).waitFor({ timeout: 30_000 });
    await page().getByRole("link", { name: "Sign in again" }).waitFor({ timeout: 10_000 });

    const { rows } = await app.db.admin.query(
      "SELECT count(*)::int AS live FROM sessions WHERE tenant_id = $1 AND revoked_at IS NULL",
      [DEV_TENANTS[0]!.id]
    );
    expect(rows[0].live).toBe(0);

    // The reason is on the chain, not a constant.
    const { rows: events } = await app.db.admin.query(
      "SELECT payload->>'reason' AS why FROM domain_event WHERE tenant_id = $1 AND kind = 'auth.sessions_revoked_all'",
      [DEV_TENANTS[0]!.id]
    );
    expect(events).toEqual([{ why: "Lost phone reported by the front desk" }]);

    await b.audit("practice risk, every sign-in ended");
  }, 120_000);

  it("lets an enrolled person pair a new authenticator, and signs them in on it", async () => {
    // Increment 1.76. A second factor was a one-way door: `mfa_enrolled_at` is
    // written once and cleared nowhere, both enrolment functions refused an
    // account that carried it, recovery codes only ever decrease, and this
    // screen bounced anybody already enrolled straight to /home. Ten sign-ins
    // on codes and a lost phone left an account nobody could reach again — the
    // owner's included. This case walks the way out.
    await b.signIn("ridgeview-owner", "/home");
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });

    // The act is reachable, which is the half that Increments 1.72 and 1.74
    // were both about: a mechanism nobody can find is not a mechanism.
    const link = page().locator("header").getByRole("link", { name: "Your authenticator" });
    await link.waitFor({ timeout: 60_000 });
    await link.click();
    await page().getByRole("heading", { name: "Your authenticator" }).waitFor({ timeout: 60_000 });
    // The screen reads its visitor: this one already has a factor, and is told
    // that it keeps working until a code from the new one comes back.
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .toMatch(/The one on your old phone keeps working/);
    expect(await page().getByRole("link", { name: "Leave this as it is" }).count()).toBe(1);
    await b.audit("re-pairing an authenticator");

    const uri = (await page().locator("main code").innerText()).trim();
    const secret = new URL(uri.replace("otpauth://", "https://")).searchParams.get("secret");
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    // A new authenticator, not the one the seed gave this account.
    expect(secret).not.toBe(DEV_MFA_SECRET);

    await page().fill('input[name="totp"]', currentCodeForTest("ridgeview-owner", secret!, Date.now()));
    await page().getByRole("button", { name: "Replace my authenticator" }).click();
    await expect
      .poll(async () => await page().locator("main").innerText(), { timeout: 60_000 })
      .toMatch(/This is a new set/);
    // The codes are reissued rather than merely stopped from falling, which is
    // what ends the countdown.
    expect(await page().locator("main li").count()).toBe(10);
    await b.audit("re-paired, with a fresh set of recovery codes");

    // And the new phone signs in while the old one no longer does.
    await page().getByRole("button", { name: "Continue to sign in" }).click();
    await page().waitForURL((url) => url.pathname === "/signin", { timeout: 60_000 });
    await page().fill('input[name="username"]', "ridgeview-owner");
    await page().fill('input[name="password"]', DEV_PASSWORD);
    await page().fill('input[name="totp"]', currentCodeForTest("ridgeview-owner", DEV_MFA_SECRET, Date.now()));
    await page().click('button[type="submit"]');
    // Still on the sign-in screen, because the factor it names is gone. A
    // regex that the sign-in page satisfies merely by existing would pass here
    // whether or not the old authenticator still worked, so the check is that
    // the board never arrives.
    await expect
      .poll(async () => await page().getByRole("heading", { name: "Today's board" }).count(), { timeout: 15_000 })
      .toBe(0);

    await page().fill('input[name="username"]', "ridgeview-owner");
    await page().fill('input[name="password"]', DEV_PASSWORD);
    await page().fill('input[name="totp"]', currentCodeForTest("ridgeview-owner", secret!, Date.now()));
    await page().click('button[type="submit"]');
    await page().getByRole("heading", { name: "Today's board" }).waitFor({ timeout: 60_000 });
  }, 180_000);

  it("shows a user-rank account the Refusal, not the page", async () => {
    await b.signIn("ridgeview-front", "/risk");
    await page().locator("main [role=alert]").waitFor({ timeout: 30_000 });
    expect(await page().locator("main [role=alert]").innerText()).toMatch(/Practice Risk did not load[\s\S]*manager rank or above/);
    expect(await page().getByRole("heading", { name: "Headline" }).count()).toBe(0);
    await b.audit("practice risk, user-rank refusal");
  }, 90_000);
});
