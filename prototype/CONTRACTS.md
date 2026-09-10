# Prototype contracts

These contracts bind the prototype, the stability checks (`scripts/proto-check.mjs`), and the beta panel's session scripts. A change here is a breaking change for all three.

## 1. Loading

- Open `prototype/index.html` directly (`file://`) or serve the folder (`npx serve prototype -l 4173`). No build step, no network, no dependencies.
- Scripts are classic `<script defer>` tags in dependency order. Everything lives under `window.Proto`.
- `window.__proto.ready` becomes `true` after the first render. Wait on it; never on a timeout.

## 2. Routes

`#/signin` and `#/<persona>/<route>[/<id>]`. Personas: `frontdesk`, `biller`, `hygienist`, `assistant`, `dentist`, `surgeon`, `owner`, `compliance`, `temp`. Persona homes (where sign-in lands):

| Persona | Home route | Screen |
|---|---|---|
| frontdesk | `board` | Board |
| biller | `money` | Money Desk |
| hygienist | `chairs` | Chairs (mine) |
| assistant | `board` | Board (charts as an assistant; the dentist files) |
| dentist, surgeon | `exams` | Exams to sign |
| owner | `close` | Daily Close and Controls |
| compliance | `risk` | Practice risk |
| temp | `board` | Board with the first-shift rail |

Other routes: `checkout/<apptId>`, `perio/<encId>`, `encounter/<encId>`, `ledger/<patientId>`, `roles`, `phone/approvals` (the second approver's phone card, any persona). Every persona may open every route; the prototype simulates entitlement refusals where the specs say so. The persona segment is case-insensitive; a hash whose first segment is not a persona (and not `#canvas`, the skip-link target) renders the Nothing-here state with `notfound.home`, which returns to the signed-in persona's home or to sign-in.

## 3. Global state (`window.__proto`)

```
window.__proto = {
  ready: boolean,
  persona: string,           // current persona id
  theme: 'light'|'dark',
  device: 'desk'|'operatory'|'shared'|'phone',
  outage: boolean,           // Andon outage state (read-only Board)
  privacy: boolean,          // privacy mode (initials only)
  reset(seed?: number),      // rebuild the store from the seed, clear events
  state(),                   // snapshot of every table (deep copy)
  events(),                  // copy of window.__events
  set({theme, device, outage, privacy, motion, grayscale, persona, afterHours})
}
```

`set` accepts only the values listed here for `theme`, `device`, `motion` and `persona`; anything else is ignored. `reset()` restores `afterHours` and re-renders the shell.

Query parameters on the hash set the same options for scripts: `#/frontdesk/board?theme=dark&device=shared&privacy=1&outage=1&grayscale=1&afterHours=1`.

## 4. `data-testid` convention

Every element with a click or key handler carries `data-testid`, lowercase, dot-separated: `screen.object[.id].control`. Ids come from the seed and are stable across reloads.

| Screen | Test ids |
|---|---|
| Top bar | `topbar.location`, `topbar.search`, `topbar.theme`, `topbar.privacy`, `topbar.author`, `topbar.signout`, `andon.control` |
| Author PIN pad | `pin.display` (the digit display; focus lands here on open and Enter here is Go), `pin.key.<0-9>`, `pin.backspace`, `pin.submit`, `pin.cancel`, `pin.why` |
| Palette | `palette.input`, `palette.row.<n>`, `palette.confirm.dob` |
| Patient Rail | `rail.tab.<chart|notes|perio|imaging|plan|ledger|claims|docs|profile>`, `rail.alert`, `rail.close` |
| Sign-in | `signin.persona.<persona>`, `signin.theme.<light|dark>`, `signin.device.<desk|operatory|shared|phone>`, `signin.motion`, `signin.grayscale`, `signin.privacy`, `signin.outage`, `signin.go` |
| Board | `board.readiness.row.<id>.<control>`, `board.readiness.toggle`, `board.readiness.handled`, `board.card.<apptId>`, `board.card.<apptId>.arrive`, `board.card.<apptId>.seat`, `board.card.<apptId>.reverify`, `board.card.<apptId>.checkout`, `board.card.<apptId>.expand`, `board.queue.row.<apptId>`, `board.queue.row.<apptId>.ping`, `board.queue.row.<apptId>.checkout`, `board.chair.<n>` |
| Checkout | `checkout.line.<procId>`, `checkout.line.<procId>.selfpay`, `checkout.collect.seg.<collect|send-statement|payment-plan|zero-due>`, `checkout.tender.<card|cash|check>`, `checkout.card.number`, `checkout.amount`, `checkout.writeoff.add`, `checkout.writeoff.remove`, `checkout.writeoff.amount`, `checkout.writeoff.reason.<code>`, `checkout.plan.cadence.<weekly|biweekly|monthly>`, `checkout.receipt`, `checkout.payment.why`, `checkout.pin`, `checkout.post`, `checkout.explain`, `checkout.showpatient`, `checkout.back` |
| Refusal (shared) | `refusal.verb`, `refusal.control`, `refusal.why`; while a dialog is open the gates beneath it read `refusal.prior.verb`, `refusal.prior.control`, `refusal.prior.why` and are restored when the last dialog closes |
| Phone | `phone.request.<reqId>.approve`, `phone.request.<reqId>.decline`, `phone.request.<reqId>.reason`, `phone.stepup.<0-9>`, `phone.stepup.submit`, `phone.stepup.backspace`, `phone.stepup.cancel` |
| Chairs | `chairs.card.<apptId>`, `chairs.card.<apptId>.perio`, `chairs.card.<apptId>.note`, `chairs.card.<apptId>.ready`, `chairs.card.<apptId>.expand` |
| Perio | `perio.grid.cell.t<tooth>-s<1-6>`, `perio.pad.toggle`, `perio.pad.key.<0-9>`, `perio.pad.bleed`, `perio.pad.skip`, `perio.pad.undo`, `perio.pad.next`, `perio.screening`, `perio.save`, `perio.licence.<code>`, `perio.licence.cancel`, `perio.tag.add`, `perio.tag.tooth`, `perio.tag.text`, `perio.tag.save`, `perio.settings` |
| Encounter | `exams.row.<encId>`, `exams.row.<encId>.open`, `enc.tag.<tagId>.chart`, `enc.tag.<tagId>.dismiss`, `enc.tooth.<1-32>`, `enc.surface.<tooth>.<m|o|d|b|l>`, `enc.proc.<cdt>`, `enc.temporality.<today|planned|existing>`, `enc.note.field.<id>`, `enc.note.starter.<n>`, `enc.killer.<n>.fix`, `enc.readback.switch`, `enc.file`, `enc.undo` |
| Money Desk | `money.tab.<era|aging|denials|statements|credits|variances|approvals>`, `money.era.<batchId>.postmatched`, `money.era.line.<lineId>.confirm`, `money.era.line.<lineId>.hold`, `money.era.line.<lineId>.dispute`, `money.aging.row.<claimId>.<action>`, `money.denial.<claimId>.appeal`, `money.denial.<claimId>.fix`, `money.denial.<claimId>.bill`, `money.appeal.send`, `money.statement.<id>.send`, `money.statement.<id>.preview`, `money.statement.<id>.chart` (a statement waiting for the note), `money.credit.<id>.apply`, `money.writeoff.<accountId>`, `money.writeoff.amount`, `money.writeoff.reason.<code>`, `money.writeoff.post`, `money.pin` (shared device only), `money.statement.<patientId>.raise` |
| Daily Close | `close.tied.tile`, `close.location.<locId>`, `close.tender.<cash|check|card>`, `close.variance.<id>.match`, `close.variance.<id>.investigate`, `close.variance.<id>.clear`, `close.changed`, `close.late`, `close.decision.<id>.<keep|tighten|retire>`, `close.closeday`, `close.closeday.confirm`, `close.closeday.cancel`, `close.approval.<reqId>.open`, `close.pin` (shared device only), `risk.row.<id>.<action>` |
| Roles | `roles.daypass.add`, `roles.daypass.name`, `roles.daypass.role.<code>`, `roles.daypass.location.<locId>`, `roles.daypass.end`, `roles.daypass.entitlement.<code>`, `roles.daypass.save`, `roles.daypass.credential.add`, `roles.sod.<remediate|compensate|accept>`, `roles.row.<userId>`, `roles.row.<dayPassId>` (an issued pass, same row shape) |
| Temp rail | `rail1.chip.<n>`, `rail1.toggle` |
| Patient Rail openers (every card and row that opens the rail) | `board.card.<apptId>.rail`, `chairs.card.<apptId>.rail`, `checkout.rail`, `enc.rail`, `rail.open.<patientId>` (the default opener id) |
| Why disclosures (every progressive-disclosure summary) | `board.queue.why`, `chairs.card.<apptId>.why`, `checkout.estimate.why`, `close.approvals.why`, `close.closeday.why`, `close.counts.why`, `close.decision.<id>.why`, `enc.plan.<planId>.why`, `ledger.statement.why`, `money.era.<batchId>.why`, `money.denial.<claimId>.why`, `perio.saved.why`, `phone.request.<reqId>.why`, `roles.row.<userId>.why`, `roles.daypass.extra.why`, `roles.daypass.expiry.why`, `risk.row.<id>.why` |
| Ledger | `ledger.explain`, `ledger.asof`, `ledger.showpatient`, `ledger.sendbiller`, `ledger.statement.send`, `ledger.statement.preview`, `ledger.statement.preview.close`, `ledger.row.<entryId>`, `ledger.asof.date`, `ledger.asof.back`, `ledger.asof.statement.<sdId>`, `ledger.explain.rows.<chargeId>`, `ledger.pin` (shared device only) |
| Shell and navigation | `nav.<route>`, `notfound.home`, `skip.canvas`, `dialog.backdrop`, `signin.afterhours` |
| Screen-local returns and closers | `enc.back` (live encounter only; a bad id renders `notfound.home` in place), `enc.tag.<tagId>.reason`, `money.appeal.close`, `palette.close`, `palette.how`, `palette.confirm.go`, `palette.confirm.back`, `close.sod.roles`, `perio.back`, `perio.tag.cancel`, `roles.daypass.signin` |
| Perio, beyond the grid | `perio.full`, `perio.amend`, `perio.pad.supp`, `perio.settings.grammar`, `perio.path.<arch|facial_lingual|quadrant>`, `perio.sextant.<n>`, `perio.tag.obs.<caries|fracture|lesion|mobility|recession|other>` |
| Money Desk and phone, beyond the worklists | `money.era.line.<lineId>.why`, `money.variance.<id>.open`, `phone.request.<reqId>.name`, `phone.simulate` |
| Patient Rail summaries | `rail.explain`, `rail.sum.<appts|balance|coverage|note|plans|recall>` |

Every id above is rendered by the product; §4 is the contract in both directions, so a handler with no id and an id with no §4 entry are each a defect. The audit measured 147 rendered ids with no entry (a lower bound: its crawl was narrower than the claim's) and four §4 entries its crawl never produced, all four reachable only through a gate it did not open (`perio.licence.<code>`, `perio.licence.confirm`, `enc.killer.<n>.fix`, `roles.sod.<remediate|compensate|accept>`). The pad key ids name the keystroke, not the depth: `perio.pad.key.0` is the key labelled `10+` (10 mm or deeper), which is why the range reads 0-9. The fix round collapsed the licence step: choosing the reason now saves, so `perio.licence.confirm` is gone and `perio.licence.cancel` stands in its place above.

## 5. Event log (`window.__events`)

Every entry:

```
{ seq: number,            // 1-based, monotonic
  t: number,              // ms since load
  kind: 'click'|'key'|'route'|'refusal'|'write'|'focus'|'error',
  route: string,          // current hash without '#'
  persona: string, theme: 'light'|'dark', device: string,
  testid?: string,        // click, key, focus: closest [data-testid]
  key?: string,           // key: KeyboardEvent.key
  code?: string, verb?: string, control?: string,   // refusal
  table?: string, id?: string,                      // write
  message?: string }      // error
```

Tap accounting used by every check and every persona report:

- `taps` = count of `click` events **without** `synthetic: true` + count of `key` events whose key is `Enter` or ` ` (space) on an element with a `data-testid` **that is not a text field** (`field: true` marks a key pressed inside an input or textarea). A click the browser synthesises from a keyboard activation carries `synthetic: true` and `detail: 0`, so one activation counts once whether it came from a mouse or from a key; and a space typed into a sentence is a keystroke, not a tap, so writing prose can never exhaust a click budget. Both corrections came from the beta panel: the first from every persona who worked by keyboard, the second from bp-15 and bp-29 independently.
- `keystrokes` = count of all `key` events.
- Perio keystrokes are counted separately from taps because the grammar is keyboard-first by design.

A finding without a `seq` range is not a finding.

## 6. Refusals

One shared component renders every gate: a verb line (`refusal.verb`, **verb first**, at most eight words, no terminal period, no interpolated name or list that can push it past eight), one 44 px control (`refusal.control`), a `Why` disclosure (`refusal.why`), an `aria-live="polite"` announcement of the verb line alone. The primary button never dims; it switches to the Held identity, and a held primary reads exactly `Held`. Every gate carries a control: a refusal with nowhere to go is a dead end.

Codes: `needs_second`, `after_hours`, `zero_collect_refused`, `sod_conflict`, `licence_not_on_file`, `depth_gt_15`, `tag_undispositioned`, `money_in_note`, `contradiction`, `readback`, `outage`, `clear_not_independent`, `pin_required`, `second_identifier`, `tender_required`, `already_decided`, `duplicate_paint`, `exam_sealed`, `omission_licence`, `no_chart_session`, `pin_no_match`, `ping_rate`, `denial_suppression`, `assessment_required`, `tooth_required`, `licence_scope`, `entitlement`, `already_closed`, `amount_required`, `reason_required`, `name_required`, `shift_end_required`, `screening_incomplete`, `statement_held`, `blocked_same_person`, `packet_incomplete`, `pin_locked`, `notfound`.

The list is the contract in both directions, and the function audit found it wrong both ways. Added because the product raises them: `amount_required`, `reason_required`, `name_required`, `shift_end_required`, `screening_incomplete`, `statement_held`, `blocked_same_person`, `packet_incomplete`; and, from the beta storm, `pin_locked` (three PIN misses lock the device's pad for five minutes; verb `Wait five minutes — device locked`, control `Close`). Removed because nothing raises them: `note_unfiled` (the Filed-later lane replaced it) and `consent_scope` (the send path is out of the prototype's scope). `stepup` was never a gate: a step-up is a challenge that carries no verb, control, or severity, so it is no longer returned as a refusal — `decideApproval` returns `{needsStepup: true}` and the phone card renders its own pad. `notfound` stays listed but is annotated: it renders as the screen's own Nothing-here state, never through the Refusal component, so it logs no refusal event.

## 7. The five flows as key sequences (see `scripts/lib/flows.mjs`)

1. Check-in: `board.card.a-1042.arrive` (1 tap).
2. Perio: `chairs.card.a-1042.perio` (1), 168 digits, `perio.save` (1), licence tap only if anything skipped.
3. Chart + plan + note: `exams.row.enc-9002.open` (1), `enc.tag.tag-1.chart` (2), `enc.tooth.30` (3), `enc.surface.30.d` (4), `enc.surface.30.o` (5), `enc.proc.d2392` (6), `enc.note.starter.0` (7), `enc.file` (8). Budget 10.
4. Checkout: `board.card.a-1044.checkout` (1), Collect pre-selected, `checkout.tender.card` (2), card field, `checkout.post` (3). Budget 4.
5. ERA and close: `money.tab.era` (0 if landing), `money.era.era-1.postmatched` (1), confirm deltas, then owner `close.closeday` (1), `close.closeday.confirm` (2).

## 8. Seed ids the scripts rely on

Tenant Riverbend Dental; locations `loc-1` Main Street, `loc-2` Riverbend East, `loc-3` Hillsboro. Today is 2026-09-03 (Thursday); yesterday 2026-09-02 is the reconciled day; 2026-09-01 is the sealed closed day with one reversal-and-repost pair and one late first posting.

| Id | Meaning |
|---|---|
| `a-1042` / `enc-9001` / `p-301` | Marisol Vega, 9:00 hygiene with Bree L. (RDH), chair 1, eligibility amber, perio 14 months ago, new anticoagulant |
| `a-1043` / `enc-9002` / `p-302` | Theo Brandt, 9:00 restorative with Dr. Kim, chair 2, hygienist tag `tag-1` "Suspected caries #30 DO" |
| `a-1044` / `p-303` | Ines Okoro, checkout with a $44 patient portion (dual coverage) |
| `a-1045` / `p-304` | Ruth Adler, checkout with a $0 patient portion (fully covered prophy) |
| `a-1046` / `p-305` | Samir Haddad, pays a $168 visit in full and asks that it stay off insurance (limited exam $90 plus four bitewings $78, from the fee schedule; this line said $180 and the fee schedule is what the screen adds up) |
| `a-1047` / `p-306` | Lena Fischer, $410 balance, courtesy write-off (needs a second approver: Dana or Dr. Reagan) |
| `a-1050` / `enc-9010` | Checked out with the note unfiled (Filed-later lane) |
| `a-1073` / `enc-9033` | Bree's 11:00 hygiene visit with no exam yet (task hy-6 charts its screening) |
| `a-1060` / `enc-9020` / `p-320` | Referred-in oral surgery consult for Dr. Okafor (sedation note) |
| `era-1` | Delta Dental 835, 41 lines, 37 matched, 3 deltas (`el-14`, `el-22`, `el-31`), 1 denial (`el-40` → claim `c-88`, CARC 16) |
| `c-88` | Denied claim, appeal built from the record |
| `v-1` | Hillsboro card-settlement timing variance $312.40 with a proposed match |
| `d-1` | Threshold raise for vacation cover, review due |
| `dp-alex` | Verified RDH credential on file for "Alex Rivera" (day pass succeeds); any other clinical name has no credential |
| `u-om-1` Dana | office manager, eligible second approver; `u-dr-1` Dr. Reagan, owner |
