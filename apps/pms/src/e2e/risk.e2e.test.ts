import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@pms/controls-engine";
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
    expect(tiles.map((t) => t.replace(/\s+/g, " "))).toEqual(
      expect.arrayContaining([expect.stringMatching(/OPEN CONFLICTS 0/), expect.stringMatching(/WITHOUT A DECISION 0/)])
    );
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

  it("sends, says where it went, and says plainly when there was nowhere to send", async () => {
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
    await b.audit("practice risk, nowhere to send it");

    // With an address, the same act delivers and says where.
    await delivery.getByLabel("Your address").fill("riley@ridgeview.example");
    await delivery.getByRole("button", { name: "Save address" }).click();
    await flash(/Messages would go to riley@ridgeview\.example\./).waitFor({ timeout: 30_000 });
    await delivery.getByRole("button", { name: "Send this to me now" }).click();
    await expect
      .poll(async () => await banner.innerText(), { timeout: 30_000 })
      .toMatch(/Sent to riley@ridgeview\.example on \d{4}-\d{2}-\d{2}\./);
    await expect
      .poll(async () => await delivery.innerText(), { timeout: 30_000 })
      .toMatch(/Sent to riley@ridgeview\.example on \d{4}-\d{2}-\d{2}\./);
    await b.audit("practice risk, sent");
  }, 120_000);

  it("shows a user-rank account the Refusal, not the page", async () => {
    await b.signIn("ridgeview-front", "/risk");
    await page().locator("main [role=alert]").waitFor({ timeout: 30_000 });
    expect(await page().locator("main [role=alert]").innerText()).toMatch(/Practice Risk did not load[\s\S]*manager rank or above/);
    expect(await page().getByRole("heading", { name: "Headline" }).count()).toBe(0);
    await b.audit("practice risk, user-rank refusal");
  }, 90_000);
});
