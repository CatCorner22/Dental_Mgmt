# Feature ideation 1: Front-desk coordinator and the Board: scheduling, check-in, eligibility, checkout, same-day emergencies, multi-location days, outages, and a temp's first shift

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, front-desk-coordinator-and-the-board-scheduling-ch

## Summary

12 candidate features from the Front-desk coordinator and the Board: scheduling, check-in, eligibility, checkout, same-day emergencies, multi-location days, outages, and a temp's first shift lens, 6 marked non-obvious.

## Lens

Front-desk coordinator and the Board: scheduling, check-in, eligibility, checkout, same-day emergencies, multi-location days, outages, and a temp's first shift

## Features


### Item 1
- **name**: Checkout queue with structural chips and a Filed-later lane

#### personas
- front-desk coordinator
- dentist
- biller
- **problem**: The coordinator is made the 'note cop': the patient reaches the window, the note is not filed, and she absorbs the yell and chases assistants by text. Today she has no signal she trusts and no way to check the patient out without either waiting for the doctor or laundering an unfinished chart.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-front-desk.md: 'I cannot see "note in Curve" from the board. No status I trust. I chase assistants by text.' and 'You made me the note cop.' Trap row: '"Mark complete" button I can hit from front desk — Launders incomplete clinical into green.' Fix #1 (25–40 min saved per half-day): 'Board-visible "Copied → in Curve" signal'.
- **interaction**: Board: the right-hand Checkout queue lists patients in chair-out order. Each row carries two chips derived from rows, not buttons: Note (Filed / Open · initials of the owner) and Claim (Ready / Needs: attachment). Coordinator taps the row (1) → Checkout screen opens with completed procedures from the procedure log. If Note is Open, one line at the top: 'Note not filed — Dr. K' with one control 'Ping chair' (1 tap, in-app ping to that chair's device only). Take payment → Post (2 more clicks): charges, payment, allocations post atomically; the claim is created in state held_note_unfiled and appears on Money Desk. The Board card moves to a bottom 'Filed later' lane where it stays until the encounter reaches note_filed, at which point the claim releases to the scrubber automatically. No front-desk control can flip Note to Filed.
- **why intuitive**: Home is the work: the queue is the coordinator's live worklist, each row has one primary action (Checkout). Structural correctness over vigilance: the chip is a projection of clinical_notes_filed existence on the encounter FK, so nobody has to trust a verbal green light. Recognition over recall: she sees whose note is open without asking. One verb line + one control at the gate ('Note not filed — Dr. K' → 'Ping chair'). Two identities: Post (irreversible) vs Ping (reversible).
- **why innovative**: The corpus records Curve Hero as a paste-handoff target with no board-level documentation status, which is why the pilot's coordinator resorted to group texts. No incumbent (Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack) in the report is described as gating claim release on a filed encounter note; the plan's own encounter FK makes the chip a database fact rather than a status someone marks. Decoupling checkout from filing while holding the claim moves the yell to the dentist's Exams-to-sign queue instead of the window.
- **phi and controls**: Board chips show initials and chair only (per-chair strip rule); the patient name is on the card, hidden in privacy mode. The ping is an in-app domain_event, not SMS, so no disclosure row. Checkout posting runs through postGuarded inside the ledger transaction; held claims are a claim-state, not a ledger entry, so no estimate touches balance. No per-person counts of open notes are aggregated or shown; 'Ping chair' is one-to-one and unbroadcast. The dentist's unfiled queue is theirs, never a coordinator-visible ranking.
- **phase**: Phase 3
- **effort**: M
- **risks**: Filed-later lane could normalise late filing; mitigate by keeping the claim genuinely held (revenue pressure lands on the practice, not the coordinator) and reporting median ready→filed practice-level only. Ping could be abused as nagging; cap one ping per encounter per 15 minutes.
- **surprise**: True

### Item 2
- **name**: Open-the-day readiness strip

#### personas
- front-desk coordinator
- office manager
- **problem**: Dead chairs at 8:00 come from things nobody checked at 7:45: a temp whose role is unset, a shared tablet still holding yesterday's author, a lab case not back for a 9:00 seat, insured patients whose 6 am eligibility failed, a provider template with no operatory. Each is discovered only when the patient is in the lobby.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md fix #1: 'Coordinator Monday readiness strip: unset writers visible before open. Unset must not be the first viewport beat.' /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-front-desk.md hate 6: 'Shared iPad / wrong author / Lead away = dead chairs.' /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md lab-case row: 'a Board warning when a seat appointment precedes the due date'.
- **interaction**: Board, before the first appointment of the day: a single strip above the operatory columns, one row per unresolved item, each one verb line + one control, e.g. 'Lab case for 9:00 Op 3 not received' → 'Call lab' (opens vendor phone/fax record); '3 eligibility checks failed overnight' → 'Re-run' (fires 270s, 1 tap); 'Tablet Op 2 still signed in as J.M.' → 'Sign out' ; 'Temp account for today has no location' → 'Assign here' (office manager only). Rows disappear as rows are resolved; the strip collapses to one word 'Ready' when empty. Zero rows means zero taps.
- **why intuitive**: Recognition over recall: the coordinator does not carry a mental checklist. Home is the work: the strip is on the Board, not a settings page. One verb line + one control per row; severity by shape + word + luminance (a lab case for a 9:00 seat outranks one for 3:00). Structural: every row is computed from tables (lab_cases.due vs appointments.start, eligibility_snapshots status, sessions on shared devices, user_entitlements without location).
- **why innovative**: The report's complaint themes (A.6.1 #3 'Support during a patient-in-chair failure', #11 'Staff familiarity as switching friction') show incumbents surface problems at chair time. No PMS in the corpus is described as presenting a pre-open checklist computed from lab, eligibility, device-session and provisioning state; Dentrix and Curve rely on the coordinator's memory and morning huddle. The temp recruiter's kill #1 is the unset-role greeting, which this strip makes impossible to encounter at 8:00.
- **phi and controls**: Strip rows carry time, operatory and item type; the patient name appears only on tap into the card. Re-run eligibility is a 270 through the BAA-gated clearinghouse adapter and writes an eligibility_snapshot plus a disclosure row per query. Sign-out of a stale device session is an enforced control (server session revocation), not a note. 'Assign here' is a role event that runs detectSodConflicts synchronously. No row names a person as a problem; the device row names the device.
- **phase**: Phase 2
- **effort**: S
- **risks**: Strip could grow into a dashboard; cap it to items that block a chair today and make everything else a Money Desk or Practice worklist row.
- **surprise**: False

### Item 3
- **name**: Eligibility at booking that shapes the reminder

#### personas
- front-desk coordinator
- biller
- **problem**: Eligibility is checked at check-in, so a terminated or changed plan is discovered with the patient standing at the desk, producing a surprise balance or a cancelled hygiene visit. The reminder text that went out two days earlier said nothing because nothing was known.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 #1: '71% of respondents call real-time eligibility verification their primary daily challenge'. /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md D.4 #1: 'real-time eligibility at booking and check-in'. /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 2: 'First-party appointment confirmations and reminders, moved up from Phase 4 through a BAA-covered messaging vendor'.
- **interaction**: Board: coordinator books in the standard 3 interactions (click slot → 3-letter search → type → save). Nothing extra to do: on save, a 270 runs asynchronously and the card gets its badge within seconds (green Verified / amber Unverified / red Inactive). The 6 am sweep re-runs it the day before. When the reminder job assembles the confirmation text, it reads the latest snapshot: an Inactive or Unverified snapshot adds one sentence to the reminder ('Please bring your current insurance card') and puts the card in the coordinator's Board filter 'Coverage to confirm' (a count chip; 1 tap to list). At check-in the badge re-runs on Arrive as planned; amber shows inline 'Re-verify'.
- **why intuitive**: Zero added clicks at booking; the work happens where the information becomes available. Recognition over recall: the coordinator sees a filter count rather than remembering to call. Validation is silent until it matters (the reminder). Severity by shape + word + luminance on the badge, so a color-blind coordinator can rank the day in grayscale.
- **why innovative**: The report notes Dentrix Ascend is complained about for 'fee-schedule workarounds' and Zentist's 71% figure shows eligibility is still a manual daily fight; no PMS in the corpus is described as running eligibility at the moment of booking or as feeding the eligibility result into the reminder content. Incumbents treat reminders (Weave, RevenueWell, NexHealth in the roadmap) and eligibility (clearinghouse) as separate vendors that never meet.
- **phi and controls**: Each 270 is a disclosure row (purpose payment) to the BAA-gated clearinghouse; the reminder is a disclosure row (purpose sms/email) to the BAA-gated messaging vendor, with the patient's SMS consent checked before send. The reminder never states the plan name or status, only 'bring your current card'. Eligibility snapshots are estimates and never enter the ledger. Connector stays disabled at the registry until a countersigned BAA row exists.
- **phase**: Phase 2
- **effort**: M
- **risks**: Payer 271 responses are inconsistent; a false Inactive would add the sentence unnecessarily, which is low-harm. Clearinghouse per-query fees could rise with booking-time checks; meter with throttle namespaces and skip re-runs when the snapshot is under 72 hours old.
- **surprise**: True

### Item 4
- **name**: Emergency booking contract with a provisional patient

#### personas
- front-desk coordinator
- dentist
- **problem**: A swollen-face walk-in or phone call forces a full new-patient registration before anything can be booked, and after hours the covering dentist has no coordinator at all; the fast path today is to write it down on paper and re-key it later, or chart in the incumbent and lose the visit.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-emergency-dentist.md: 'I am writing a legal note while a face is swollen, often alone after hours, with Curve still empty.' and fix #4 'After-hours solo preset'. /home/user/catcorner22/dental/knowledge/sources/cornerstone-dental-arts-practice-profile.md: 'Executive Park leans cosmetic, facial aesthetics and emergency'.
- **interaction**: Board: coordinator taps the 'Emergency' type from the type list after clicking a slot (or the reserved emergency block the type contract auto-holds each day). The form asks exactly three fields: name, phone, chief complaint (free text, 80 chars). Save (1 click) creates a provisional patient (flag provisional=true, no DOB) and the appointment. The Board card shows a distinct emergency shape and the chief complaint in the expander. On Arrive, the card demands the second identifier: 'Confirm date of birth' with one field; chart open is refused server-side until the provisional flag clears or the coordinator merges into an existing patient (merge-as-event, 1 tap on the suggested match). After hours, when a dentist creates the same type from the Cmd-K palette, the encounter opens directly (Board skipped) in the solo preset defined by the emergency panel.
- **why intuitive**: Fewer words at the gate: three fields, one save. Structural correctness: the two-identifier rule is enforced at chart open, so speed at booking never weakens identity. Recognition over recall: the suggested existing-patient match appears at Arrive. Severity by shape: the emergency card is visibly different on the Board so the whole team sees the swollen clock.
- **why innovative**: The report's specialty and click complaints (A.6.1 #6 'too many clicks' across Dentrix, Ascend, Denticon) and the emergency panel's account of Curve QuickText as the fallback show incumbents have one registration path regardless of urgency. No PMS in the corpus is described as a provisional-patient record whose completion is enforced at chart open rather than at booking, nor as a booking contract that reserves and releases daily emergency capacity.
- **phi and controls**: Provisional record holds name, phone, complaint: minimum necessary for triage. Merge is an append-only event with frozen names; the discarded provisional row is retained under the same retention clock. Two-identifier confirmation is a real enforced control because the PMS owns the chart. After-hours postings flow to the recorded detector 'postings outside location business hours'; an after-hours refund remains one of the six hard events. No AI in the path; chief complaint is human text.
- **phase**: Phase 2
- **effort**: M
- **risks**: Provisional records left uncompleted become duplicates; enforce with a Money Desk row 'Provisional patients over 24 h' and refuse claim assembly on a provisional patient. The daily emergency hold reduces bookable capacity; make the hold size a per-location setting released at a configurable hour.
- **surprise**: True

### Item 5
- **name**: Location- and licence-aware slot validator

#### personas
- front-desk coordinator
- office manager
- hygienist
- **problem**: In a three-office practice the coordinator at one site books a provider who is at another site that day, or books a new patient into hygiene before any dentist exam, and the error surfaces as a wasted chair or a Tennessee supervision problem on the day of the visit.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/cornerstone-dental-arts-practice-profile.md: 'Three offices, one practice... Fort Sanders West does advanced restorative and surgical with early-morning hours.' /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md kill 5: 'Lead is at another Knoxville office'. /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md Board row: 'supervision refusal is one line + one control ("New patient: needs a dentist exam before hygiene" → "Add exam")'.
- **interaction**: Board: click slot → 3-letter search → type → save. Validation is silent until save. On save the server checks provider_schedule for that location/day and the effective-dated supervision rule. Failure returns one line + one control: 'Dr. Kim is at Fort Sanders West on Tuesdays' → 'Show her days here' (opens the Board on the next date she is at this location, slot pre-highlighted, 1 tap) or 'New patient: needs a dentist exam before hygiene' → 'Add exam' (adds the exam procedure and, if needed, extends the slot, 1 tap). Provider columns on the Board only render providers scheduled at this location that day, so the common case never reaches the error.
- **why intuitive**: Structural correctness over vigilance: the rule is validated at booking, not remembered by the coordinator. Validation silent until blur/save. One verb line + one control, never a dead end. Recognition: only the providers who are actually here appear.
- **why innovative**: The Cornerstone profile records that Smile Notes had no location concept and that Curve Hero's multi-location support is 'centralized template management and role-based access', not schedule validation. No PMS in the corpus is described as refusing a booking on a provider's other-location day or on a state supervision rule; the report's multi-location job (D.3) lists 'one patient record and schedule across sites' as the hire criterion, with 'sync failures' as the fire trigger, not rule-aware booking.
- **phi and controls**: No PHI in the refusal line; it names provider and location. The supervision rule is effective-dated and versioned (jurisdiction parameter TN), stamped on the appointment event. Provider schedules are location-scoped rows; the coordinator's Board reads only her granted locations. No override path that silently books; a deliberate override requires the office manager and writes a reason-coded appointment event.
- **phase**: Phase 2
- **effort**: S
- **risks**: Providers who float mid-day need split schedules; support half-day location blocks in provider templates or the validator will refuse legitimate bookings.
- **surprise**: False

### Item 6
- **name**: Degraded-mode paper day and reconnect catch-up worklist

#### personas
- front-desk coordinator
- office manager
- owner
- **problem**: When the cloud is down for hours, the front desk does not know who is due, what they owe, or what to collect; afterward, arrivals and payments are re-keyed from memory and sticky notes, and the day sheet never quite ties.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.6: r/Dentistry owner on Curve, 2025: 'completely inaccessible for hours, sometimes six plus hours.' /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md D.5: 'cloud reliability treated as a utility with a documented degraded mode (no cloud PMS documents one)' and principle 20 'Honest, bounded offline'.
- **interaction**: Board (degraded): the banner reads 'Offline since 9:12 — you can view today's schedule, alerts and estimates; you cannot post, approve or send claims.' The cached read-only Board shows each card with the 6 am patient-portion estimate and the printable 'paper day' sheet (one tap 'Print day sheet') listing time, patient, provider, estimate, and a blank Collected column. On reconnect, a Catch-up worklist replaces the banner: one row per appointment inside the outage window, each with exactly three controls: Arrived, No-show, Collected $__ (amount + tender). Tapping Collected opens the normal Checkout with the amount pre-filled; Post runs through postGuarded online as usual. Rows clear as they are handled; the worklist closes when empty and the day sheet can then close.
- **why intuitive**: Honesty: the banner says what still works. Recognition over recall: the printed sheet mirrors the Board she already knows. One primary action per row on catch-up. Structural: nothing financial is ever written offline, so there is no reconciliation of two ledgers, only a worklist of things to post.
- **why innovative**: The report's D.5 states no cloud PMS documents a degraded mode and D.7 lists 'No public uptime history for any cloud PMS'; Curve's six-plus-hour outages and Denticon downtime are top complaints with no product answer. Incumbents leave the practice to improvise on paper; this makes the paper improvisation a designed, printable artefact and makes the aftermath a bounded worklist that the day sheet cannot close around.
- **phi and controls**: The cached Board is encrypted with a session-derived key and disabled on shared devices (plan rule); the printed day sheet is a disclosure row (purpose print, row count rendered) created on reconnect from the cache's print event. Catch-up postings are online postings carrying reason code posted_after_outage with the outage id and same-day effective date, so the retroactive-dated-entry hard event does not fire and the digest groups them practice-wide. Day close refuses while catch-up rows remain. Financial postings, approvals, and claims are never offline.
- **phase**: Phase 4
- **effort**: M
- **risks**: A printed sheet with estimates on a front desk is a PHI surface; default to initials-only print with a coordinator toggle for full names. Cache staleness if the outage starts before 6 am; the banner must show the cache time.
- **surprise**: True

### Item 7
- **name**: Temp first shift: named identity with an end date and an in-surface fast path

#### personas
- front-desk coordinator
- office manager
- **problem**: A day-rate front-desk temp arrives before the manager, meets an 'unset role' warning or a shared generic login, and is unproductive until someone with admin rights is free; training lives in a separate module she is not paid to complete.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md kill 1: 'First emotional beat is "you are not allowed to be useful yet."'; kill 2: 'Temps are paid for chairs, not homework.'; trap: 'Do not ship a shared "temp" login'. /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 22: 'Learnable by a temp in one shift.'
- **interaction**: Practice → Roles (office manager, the day before): 'Add temp' → name, phone, role (Front desk), location, start and end date (5 fields, 1 save). The invite is a magic link plus TOTP enrolment on the temp's own phone. Temp signs in at 7:50 and lands on the Board for that location with a one-shift card docked at the bottom, three rows: 'Arrive a patient', 'Take a payment', 'Book a slot'. Each row is the real action on a real card with a two-sentence coach overlay on first use; the row ticks off after the first successful real action. At the end date the grants expire automatically and the session is revoked; the account remains as a frozen name on everything it posted. No drill or arena stands between login and work; the public quick-start and certification drills exist for the agency to send in advance and are never a gate.
- **why intuitive**: Role set at provisioning, so the first beat is never a refusal. Recognition over recall: the three most common verbs are visible on the surface, not in a manual. Home is the work: the coach overlay sits inside the Board. Learnable in one shift by design, and measured (time to first real Arrive, Post, Book).
- **why innovative**: The report's must-have #5 says hiring-pool familiarity 'a new entrant cannot meet and must neutralize with one-shift learnability, role-based first run, free certification', and A.6.1 #11 records Dentrix and Eaglesoft winning hiring on familiarity while 'Open Dental, DentiMax, and cloud products need onboarding'. No incumbent in the corpus offers a time-boxed named temp identity or a role-scoped fast path inside the work surface; the recruiter panel's account of the shipped Training Arena shows the failure mode of training as homework.
- **phi and controls**: The temp is a unique identity (no shared login), so every posting carries a frozen poster name; grants are append-only user_entitlements rows with an expiry and run detectSodConflicts like any grant. Least privilege: the front-desk temp role has no refund, write-off, or reconciliation entitlement, so dual release never involves them as approver. Expired grants are enforced at withGuard per request. The coach overlay reads no PHI beyond the card already on screen. No completion score is stored per person; the card's tick state is a per-viewer convenience.
- **phase**: Phase 2
- **effort**: S
- **risks**: Agencies may resist per-temp TOTP; offer SMS-free TOTP enrolment in under a minute and document it in the public quick-start. End-date defaults must be short (one day) so forgotten temps do not linger as a finding.
- **surprise**: False

### Item 8
- **name**: Shared-desk author PIN on Post

#### personas
- front-desk coordinator
- office manager
- owner
- **problem**: Two coordinators share one front-desk workstation; whoever logged in first is the frozen poster on every payment for the day, so attribution is wrong and any later question about a payment lands on the wrong person.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md kill 3: 'Wrong-author on a shared device is an immediate pilot kill for any OM who has lived a Board complaint.' /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-front-desk.md hate 6: 'Shared iPad / wrong author / Lead away = dead chairs.' /home/user/Dental_Mgmt/docs/04-ux-blueprint.md: 'zero wrong-author events on shared devices'.
- **interaction**: Practice → Devices: the office manager marks a workstation 'Shared' (1 toggle). On a shared device the top bar shows the active author's initials as a 44 px chip. Any irreversible action (Post at Checkout, Close day) shows a 4-digit PIN field on the confirm control itself; the coordinator types her PIN (1 field, no extra dialog) and Post executes as her. Switching author is 1 tap on the initials chip + PIN. Reversible actions (view, print estimate, book) need no PIN. On an unshared device nothing changes.
- **why intuitive**: Two visual identities for irreversible and reversible actions become literal: irreversible actions ask who you are. One control at the gate (the PIN lives on the Post button). No login churn between patients. Glove-floor targets on the chip and keypad.
- **why innovative**: The report notes Curve is praised for 'ease of use' and the design partner's front desk runs on shared Curve workstations; no PMS in the corpus is described as binding poster identity per posting on a shared device, and the plan's own frozen-attribution rule is only as good as the identity behind it. Incumbents solve this with per-user Windows sessions that staff bypass; this puts the control in the transaction path.
- **phi and controls**: PIN is a second factor bound to an already-authenticated tenant session, verified server-side inside postGuarded; the poster name frozen on the ledger entry is the PIN holder, and the domain_event records device id and author switch. Failed PINs are rate-limited and produce a recorded finding on the device, never a person. Shared-device posture is an observed input to COSO Principle 11 monitoring. MFA step-up above the high-value band remains separate.
- **phase**: Phase 2
- **effort**: S
- **risks**: PIN sharing between coordinators defeats it; pair with the office manager's device policy and a digest note (practice-scoped) when author switches cluster at one second before Post. Adds one field to checkout on shared devices; must stay inside the 4-click budget by placing the PIN on the Post control, not a modal.
- **surprise**: True

### Item 9
- **name**: Checkout closes with a typed collection decision

#### personas
- front-desk coordinator
- biller
- owner
- **problem**: The patient portion that is not collected at the window disappears: the coordinator clicks past payment, nothing is written, and the balance is discovered weeks later on an aging report nobody trusts.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 #5: 'No harvested review praises any product for AR clarity after dual coverage and partial payments.' /home/user/Dental_Mgmt/docs/04-ux-blueprint.md flow 4: 'Take payment (hosted card field or cash/check; allocation defaults oldest-open and is shown) → Post writes charges, payment, and allocations atomically'.
- **interaction**: Checkout screen (from the Board card, 1 tap): completed procedures, patient portion, estimate column separate. The payment block has three 44 px choices as a segmented control: 'Collect' (default; card field or cash/check), 'Send statement', 'Set up payment plan'. Post is disabled until one is chosen; choosing Collect with $0 is not allowed, the coordinator must pick one of the other two. 'Send statement' writes no ledger entry but writes a statement_due row that appears on Money Desk 'Statements due' the same day. 'Payment plan' opens the plan schedule inline (amount, cadence, card token), 2 more clicks. Post remains within 4 clicks on the Collect path.
- **why intuitive**: One canonical fact per decision: the uncollected portion is a typed row, not an absence. Recognition over recall: three named options instead of remembering to note 'will bill'. Money never in note text: the reason is a typed choice. Two identities: Post is irreversible; Send statement is reversible until the statement job runs.
- **why innovative**: The report's per-platform summary praises Dentrix only for a 'ledger tied to checkout' and complains of Curve 'partial-payment posting' and Oryx 'AR/write-off presentation'; none is described as refusing a silent $0 checkout. Incumbents let the window skip payment with no record, which is exactly the leak the owner later cannot audit. This makes the skip a fact the Money Desk sees today.
- **phi and controls**: statement_due and payment_plans rows carry patient, amount, and frozen creator; neither enters the ledger until money moves. Daily Close shows 'Not collected at window: $X across N visits' at practice level only; there is never a per-coordinator figure. Payment plan auto-charges through the processor token (hosted vault, BAA per vendor table) and misses become events, not notes. Any write-off or discount here still routes through postGuarded and dual release.
- **phase**: Phase 2
- **effort**: S
- **risks**: Coordinators may default everything to 'Send statement' under lobby pressure; the practice-level Daily Close line makes the pattern visible to the owner without naming anyone. Payment-plan setup must not break the 4-click budget on the common Collect path.
- **surprise**: True

### Item 10
- **name**: Waitlist fill from a cancellation, ranked deterministically

#### personas
- front-desk coordinator
- **problem**: A cancellation leaves a hole the coordinator fills by scrolling a paper or spreadsheet waitlist, calling patients whose plan is inactive or whose appointment type does not fit the slot or provider, and losing the hour.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md Board home: 'waitlist fill; checkout queue'. /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 2: 'a practice that converts in this phase does not lose confirmations (a must-have regression and a no-show cost) when it leaves Weave, RevenueWell, or NexHealth'. /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md Board row: 'recall, waitlist, 6 am eligibility sweep'.
- **interaction**: Board: coordinator marks a card Cancelled (1 tap + reason). The empty slot shows one control 'Fill'. Tap (1) → a drawer lists up to five waitlist patients ranked by a fixed, visible rule: type matches slot and provider, duration fits, supervision rule passes, eligibility snapshot green, then longest on waitlist. Each row: name, phone, why they fit in four words, one control 'Book' (1 tap, appointment saved into the slot) and a secondary 'Called, no answer' which timestamps and moves to the next. In Phase 5, a 'Text top 3' control sends a claim-by link through the two-way texting channel; first reply books, others get 'slot taken'.
- **why intuitive**: Recognition over recall: candidates are surfaced with the reason they fit. Structural correctness: a fill can never create a supervision or eligibility problem because the same validator that gates booking gates the ranking. One primary action per row. Deterministic first: the ranking rule is printed in the drawer, no model.
- **why innovative**: The corpus records Weave, RevenueWell, and NexHealth only as the confirmation vendors a converting practice leaves; no PMS in the report is praised for waitlist fill, and none is described as ranking candidates by supervision and eligibility state rather than by list order. Incumbents' fill is a text blast that can book the wrong patient into the wrong chair.
- **phi and controls**: The drawer shows names on the coordinator's screen only (privacy mode applies). No PHI leaves the tenant on the Phase 2 call path; the Phase 5 text is a disclosure row per recipient through the BAA-gated messaging vendor, with content limited to date, time, location, and a link. Ranking constants are versioned and stamped on the appointment event. Waitlist position is a fact about the patient's request date, not a score of anyone.
- **phase**: Phase 2
- **effort**: M
- **risks**: Waitlist data quality (stale phone numbers) weakens the value; 'Called, no answer' timestamps age entries out after a configurable count. Claim-by-link race conditions in Phase 5 need first-write-wins on the slot with a compare-and-set.
- **surprise**: False

### Item 11
- **name**: Book from the plan card

#### personas
- front-desk coordinator
- dentist
- **problem**: When a patient calls to schedule accepted treatment, the coordinator re-derives what was planned, how long it takes, and which provider, then hunts the schedule; the resulting appointment carries no link to the planned procedure, so checkout and claims start from scratch.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md odontogram row: 'One painting gesture writes chart, plan, note scaffold, and pending charge' and 'planned → completed gated on encounter completion'. /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.4 #1: 'checkout in a handful of clicks'.
- **interaction**: Cmd-K → patient (2-identifier confirm) → Patient Rail → Plan (1 tap): unscheduled plan items appear as rows with procedure, tooth, provider, and duration from the appointment-type contract. Tap an item (1) → the Board opens filtered to slots that fit that duration for that provider at the coordinator's location, fitting slots highlighted. Tap a slot (1) → save. The appointment carries the plan_item FK; the Board card expander shows the planned procedure; at checkout the completed procedure is pre-selected and the estimate column reads from the plan's estimate. Total: 4 interactions from Cmd-K to saved appointment.
- **why intuitive**: Recognition over recall: the plan tells the coordinator what to book and for how long. Structural correctness: the appointment is attached to the plan item by FK, so checkout, claim scrubber, and 'Explain this balance' all share one fact. Fewer clicks at checkout because the procedure is already known.
- **why innovative**: The report's complaint themes call incumbents 'click-heavy' (A.6.1 #6) and record Curve's invoice-based ledger and Open Dental's allocation confusion; none is described as scheduling directly from an accepted plan item with duration derived from the type contract and the FK carried through to checkout. Dentrix's praised 'ledger tied to checkout' still requires re-selecting procedures at the window.
- **phi and controls**: Plan items are estimates and never in the ledger; the FK carries identity, not money. Chart open requires two-identifier confirmation (enforced). The Rail respects privacy mode. Plan-item selection writes an appointment_event with frozen actor. No AI.
- **phase**: Phase 3
- **effort**: M
- **risks**: Plans change between booking and visit; the checkout must show the planned item as a suggestion the clinician's procedure log overrides, never as a completed charge on its own.
- **surprise**: False

### Item 12
- **name**: Explain this balance at the window

#### personas
- front-desk coordinator
- biller
- **problem**: The patient asks why they owe $212 and the coordinator cannot answer from the ledger, so she guesses, promises a callback, or waives it; billers describe incumbents' ledgers as unreadable after dual coverage and partial payments.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.6: r/Dentistry on Open Dental's ledger: 'the allocated/unallocated/hidden payments in the ledger.' and 'My accounting team HATES it with the passion of 1,000 suns.' /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md vision bet 1: '"Explain this balance" renders one plain sentence per open procedure.'
- **interaction**: Checkout screen or Patient Rail → Ledger: the balance shows as three labeled numbers (Patient / Insurance / Unapplied) with one control 'Explain' (1 tap). A drawer renders one sentence per open procedure, e.g. 'Crown #30 on Jun 12: fee $1,180; Delta paid $590 on Jul 2; you paid $200 on Jun 12; $390 remains.' A second control 'Show patient' (1 tap) flips the drawer to a patient-facing view with the estimate lines visually separated and labelled 'estimate', suitable for turning the screen or printing. Nothing here is editable; disputes route to Money Desk via 'Send to biller' (1 tap) which creates a row with the patient and the sentence attached.
- **why intuitive**: One canonical view per fact: the same sentences the biller and CPA read. Recognition over recall: the coordinator reads, she does not compute. Money never in note text: the explanation is generated from allocation rows, not typed. Two visual identities: estimate lines are visibly not balance lines.
- **why innovative**: The report's D.5 names 'a ledger both clinicians and accountants can read' as the clearest whitespace, with 'nobody universally' close, and A.6.1 #5 says no harvested review praises any product for AR clarity after dual coverage and partial payments. Incumbents expose allocation internals (Open Dental) or transfer adjustments (CareStack); none renders the balance as sentences a coordinator can read aloud at the window.
- **phi and controls**: Read-only projection of ledger_entries and payment_allocations; the print is a disclosure row (purpose print, row count) and the patient-facing view hides internal reason codes and poster names. 'Send to biller' is a domain_event, not a message outside the tenant. Estimates never enter balance, so the sentences cannot contradict the ledger.
- **phase**: Phase 2
- **effort**: S
- **risks**: Sentence templates for unusual allocation shapes (secondary posted before primary, refunds) must be property-tested alongside the ledger suite or the drawer will produce a confusing sentence at the worst moment.
- **surprise**: False
