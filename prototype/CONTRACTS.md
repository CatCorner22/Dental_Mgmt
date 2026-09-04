# Prototype contracts

These contracts bind the prototype, the stability checks (`scripts/proto-check.mjs`), and the beta panel's session scripts. A change here is a breaking change for all three.

## 1. Loading

- Open `prototype/index.html` directly (`file://`) or serve the folder (`npx serve prototype -l 4173`). No build step, no network, no dependencies.
- Scripts are classic `<script defer>` tags in dependency order. Everything lives under `window.Proto`.
- `window.__proto.ready` becomes `true` after the first render. Wait on it; never on a timeout.

## 2. Routes

`#/signin` and `#/<persona>/<route>[/<id>]`. Personas: `frontdesk`, `biller`, `hygienist`, `dentist`, `surgeon`, `owner`, `compliance`, `temp`. Persona homes (where sign-in lands):

| Persona | Home route | Screen |
|---|---|---|
| frontdesk | `board` | Board |
| biller | `money` | Money Desk |
| hygienist | `chairs` | Chairs (mine) |
| dentist, surgeon | `exams` | Exams to sign |
| owner | `close` | Daily Close and Controls |
| compliance | `risk` | Practice risk |
| temp | `board` | Board with the first-shift rail |

Other routes: `checkout/<apptId>`, `perio/<encId>`, `encounter/<encId>`, `ledger/<patientId>`, `roles`, `phone/approvals` (the second approver's phone card, any persona). Every persona may open every route; the prototype simulates entitlement refusals where the specs say so.

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
  set({theme, device, outage, privacy, motion, grayscale, persona})
}
```

Query parameters on the hash set the same options for scripts: `#/frontdesk/board?theme=dark&device=shared&privacy=1&outage=1&grayscale=1`.

## 4. `data-testid` convention

Every element with a click or key handler carries `data-testid`, lowercase, dot-separated: `screen.object[.id].control`. Ids come from the seed and are stable across reloads.

| Screen | Test ids |
|---|---|
| Top bar | `topbar.location`, `topbar.search`, `topbar.theme`, `topbar.privacy`, `topbar.author`, `topbar.signout`, `andon.control` |
| Author PIN pad | `pin.key.<0-9>`, `pin.backspace`, `pin.submit`, `pin.cancel` |
| Palette | `palette.input`, `palette.row.<n>`, `palette.confirm.dob` |
| Patient Rail | `rail.tab.<chart|notes|perio|imaging|plan|ledger|claims|docs|profile>`, `rail.alert`, `rail.close` |
| Sign-in | `signin.persona.<persona>`, `signin.theme.<light|dark>`, `signin.device.<desk|operatory|shared|phone>`, `signin.motion`, `signin.grayscale`, `signin.privacy`, `signin.outage`, `signin.go` |
| Board | `board.readiness.row.<id>.<control>`, `board.readiness.toggle`, `board.card.<apptId>`, `board.card.<apptId>.arrive`, `board.card.<apptId>.seat`, `board.card.<apptId>.reverify`, `board.card.<apptId>.checkout`, `board.card.<apptId>.expand`, `board.queue.row.<apptId>`, `board.queue.row.<apptId>.ping`, `board.queue.row.<apptId>.checkout`, `board.chair.<n>` |
| Checkout | `checkout.line.<procId>`, `checkout.line.<procId>.selfpay`, `checkout.collect.seg.<collect|send-statement|payment-plan|zero-due>`, `checkout.tender.<card|cash|check>`, `checkout.card.number`, `checkout.amount`, `checkout.writeoff.add`, `checkout.writeoff.amount`, `checkout.writeoff.reason.<code>`, `checkout.pin`, `checkout.post`, `checkout.explain`, `checkout.showpatient`, `checkout.back` |
| Refusal (shared) | `refusal.verb`, `refusal.control`, `refusal.why` |
| Phone | `phone.request.<reqId>.approve`, `phone.request.<reqId>.decline`, `phone.stepup.<0-9>`, `phone.stepup.submit` |
| Chairs | `chairs.card.<apptId>`, `chairs.card.<apptId>.perio`, `chairs.card.<apptId>.note`, `chairs.card.<apptId>.ready`, `chairs.card.<apptId>.expand` |
| Perio | `perio.grid.cell.t<tooth>-s<1-6>`, `perio.pad.toggle`, `perio.pad.key.<1-9>`, `perio.pad.bleed`, `perio.pad.skip`, `perio.pad.undo`, `perio.pad.next`, `perio.screening`, `perio.save`, `perio.licence.<code>`, `perio.licence.confirm`, `perio.tag.add`, `perio.tag.tooth`, `perio.tag.text`, `perio.tag.save`, `perio.settings` |
| Encounter | `exams.row.<encId>`, `exams.row.<encId>.open`, `enc.tag.<tagId>.chart`, `enc.tag.<tagId>.dismiss`, `enc.tooth.<1-32>`, `enc.surface.<tooth>.<m|o|d|b|l>`, `enc.proc.<cdt>`, `enc.temporality.<today|planned|existing>`, `enc.note.field.<id>`, `enc.note.starter.<n>`, `enc.killer.<n>.fix`, `enc.readback.switch`, `enc.file`, `enc.undo` |
| Money Desk | `money.tab.<era|aging|denials|statements|credits|variances|approvals>`, `money.era.<batchId>.postmatched`, `money.era.line.<lineId>.confirm`, `money.era.line.<lineId>.hold`, `money.era.line.<lineId>.dispute`, `money.aging.row.<claimId>.<action>`, `money.denial.<claimId>.appeal`, `money.denial.<claimId>.fix`, `money.denial.<claimId>.bill`, `money.appeal.send`, `money.statement.<id>.send`, `money.statement.<id>.preview`, `money.credit.<id>.apply`, `money.writeoff.<accountId>`, `money.writeoff.amount`, `money.writeoff.reason.<code>`, `money.writeoff.post` |
| Daily Close | `close.tied.tile`, `close.location.<locId>`, `close.tender.<cash|check|card>`, `close.variance.<id>.match`, `close.variance.<id>.investigate`, `close.variance.<id>.clear`, `close.changed`, `close.late`, `close.decision.<id>.<keep|tighten|retire>`, `close.closeday`, `close.closeday.confirm`, `close.closeday.cancel`, `risk.row.<id>.<action>` |
| Roles | `roles.daypass.add`, `roles.daypass.name`, `roles.daypass.role.<code>`, `roles.daypass.location.<locId>`, `roles.daypass.end`, `roles.daypass.entitlement.<code>`, `roles.daypass.save`, `roles.daypass.credential.add`, `roles.sod.<remediate|compensate|accept>`, `roles.row.<userId>` |
| Temp rail | `rail1.chip.<n>`, `rail1.toggle` |

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

One shared component renders every gate: a verb line (`refusal.verb`, verb first, at most eight words), one 44 px control (`refusal.control`), a `Why` disclosure (`refusal.why`), an `aria-live="polite"` announcement. The primary button never dims; it switches to the Held identity (outlined, lock glyph, the word Held). Codes: `needs_second`, `after_hours`, `zero_collect_refused`, `note_unfiled`, `sod_conflict`, `licence_not_on_file`, `depth_gt_15`, `tag_undispositioned`, `money_in_note`, `contradiction`, `readback`, `consent_scope`, `outage`, `clear_not_independent`, `pin_required`, `second_identifier`, `tender_required`, `already_decided`, `duplicate_paint`, `exam_sealed`, `omission_licence`, `no_chart_session`, `pin_no_match`, `ping_rate`, `denial_suppression`, `assessment_required`, `tooth_required`, `licence_scope`, `entitlement`, `already_closed`, `notfound`. The list is the contract: a code the product raises and this list omits is a defect in one of the two (bp-05 and bp-20, round 2).

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
| `a-1046` / `p-305` | Samir Haddad, pays a $180 exam in full and asks that it stay off insurance |
| `a-1047` / `p-306` | Lena Fischer, $410 balance, courtesy write-off (needs a second approver: Dana or Dr. Reagan) |
| `a-1050` / `enc-9010` | Checked out with the note unfiled (Filed-later lane) |
| `a-1060` / `enc-9020` / `p-320` | Referred-in oral surgery consult for Dr. Okafor (sedation note) |
| `era-1` | Delta Dental 835, 41 lines, 37 matched, 3 deltas (`el-14`, `el-22`, `el-31`), 1 denial (`el-40` → claim `c-88`, CARC 16) |
| `c-88` | Denied claim, appeal built from the record |
| `v-1` | Hillsboro card-settlement timing variance $312.40 with a proposed match |
| `d-1` | Threshold raise for vacation cover, review due |
| `dp-alex` | Verified RDH credential on file for "Alex Rivera" (day pass succeeds); any other clinical name has no credential |
| `u-om-1` Dana | office manager, eligible second approver; `u-dr-1` Dr. Reagan, owner |
