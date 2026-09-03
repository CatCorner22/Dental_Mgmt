# Feature ideation 6: Learnability, accessibility, and shared devices (one-shift learnability, command palette, keyboard-only operation, color-vision safety, glove mode, PIN author switch, in-surface first run, free certification drills)

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, learnability-accessibility-and-shared-devices-one-

## Summary

12 candidate features from the Learnability, accessibility, and shared devices (one-shift learnability, command palette, keyboard-only operation, color-vision safety, glove mode, PIN author switch, in-surface first run, free certification drills) lens, 8 marked non-obvious.

## Lens

Learnability, accessibility, and shared devices (one-shift learnability, command palette, keyboard-only operation, color-vision safety, glove mode, PIN author switch, in-surface first run, free certification drills)

## Features


### Item 1
- **name**: Event-verified first-shift rail

#### personas
- temp
- new hire
- front-desk coordinator
- hygienist
- biller
- **problem**: A temp or new hire arrives to a home screen they have never seen and either burns the morning on a tour modal or on training homework; the first hour of a paid shift is lost and the office manager calls the agency.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md, temp row: "Plus a one-shift fast path rendered inside the work surface; role was set at provisioning so the first beat is never 'you are not allowed yet'". /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md, kill 2: "Temps are paid for chairs, not homework. 'Complete the arena first' steals productive minutes."
- **interaction**: First login lands on the persona home (Board, Chairs, or Money Desk), not a welcome page. A 56 px collapsible rail sits under the top bar with the role's five daily steps as five chips (front desk: Arrive · Seat · Checkout · Take payment · Find a patient). Each chip is a 44 px target that, on tap (1), pulses the outline of the real control on the live surface (the first card's Arrive button) and shows one verb line beneath it ("Tap Arrive on the first card"). No demo data, no modal. A chip retires itself the first time the server sees that user's real domain event (`appointment.arrived` by this actor), so the rail shrinks as the shift proceeds; a step can be collapsed with one tap and reopened from the palette ("first shift"). When all five have fired the rail folds into a single "Keys" toggle. Progress is stored server-side per user, so it follows the temp to the next location and never depends on the shared device.
- **why intuitive**: Exercises Home is the work (no dashboard card grid or tour), recognition over recall (the real control is highlighted where it lives), one verb line + one control, and Learnable by a temp in one shift. It removes recall entirely: the rail points at the live object instead of describing it, and removes vigilance because completion is derived from the event stream, not from the user ticking a checklist.
- **why innovative**: The corpus records incumbents selling training as a paid service outside the product: Open Dental "on-site training $3,650 first day / $1,200 additional" (semantic-memory.md), Dentrix complained about for "training at scale", Oryx for "paid training and conversion", CareStack for "heavy owner setup" (report A.6.2). Dentrix Ascend is praised for "intuitive onboarding" but nothing in the corpus describes any PMS rendering first-run inside the live worklist and retiring steps from real transactions.
- **phi and controls**: No PHI in the rail copy; it references controls, not patients. Completion is read from `domain_event` rows the actor already produced (no new access). Rail state is a per-user server row, not localStorage, so nothing persists on a shared device. It cannot bypass any gate: the highlighted control is the production control with `withGuard` and `postGuarded` intact; role is already set at provisioning so the rail never offers an action the role lacks.
- **phase**: Phase 2
- **effort**: M
- **risks**: Highlighting a live control on a busy Board could pulse the wrong card if the schedule reflows; mitigate by anchoring to the first card in DOM order and honoring prefers-reduced-motion (outline, no transform). Some steps (Checkout) have no eligible object in the first hour; the chip must say "Nothing to check out yet" rather than pointing at nothing.
- **surprise**: True

### Item 2
- **name**: Command palette with incumbent-vocabulary translation

#### personas
- temp
- front-desk coordinator
- biller
- office manager
- hygienist
- **problem**: Staff hired from Dentrix or Eaglesoft offices know the job but not the words; they search for "walkout statement", "Office Journal", or "Ledger adjustment" and find nothing, then ask a colleague or call support.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md, Risks: "Hiring-pool familiarity with Dentrix and Eaglesoft cannot be met by a new entrant | Command palette, role-before-work, temp quick-start, free certification; measured in pilot, not asserted". /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md, A.6.1 #11: "Staff familiarity as switching friction. Dentrix and Eaglesoft win hiring; Open Dental, DentiMax, and cloud products need onboarding."
- **interaction**: Cmd/Ctrl-K (or the 44 px search button in the top bar) opens one input. Typing three letters (1 interaction) lists patients (name · DOB · last-4 phone as two identifiers), appointments, claims, reports, and actions, role-filtered. Actions are verbs in the PMS's own words ("Arrive", "Request approval", "Close day"). A synonym table maps incumbent vocabulary to the same actions: typing "walkout" shows "Statement — called walkout statement in Dentrix" as the same row; "day sheet" and "deposit slip" resolve to Daily Close; "adjustment" resolves to "Write-off or adjustment (needs a reason code)". Enter (1) runs a reversible action or opens the screen; an irreversible action opens its in-place confirm instead of executing. Selecting a patient asks for the second identifier before the chart opens. Recent items are kept per user server-side and are never shown on an operatory device profile. Total: 3 keystrokes + Enter to any object.
- **why intuitive**: Exercises Home is the work (principle 10: "finds any patient, claim, appointment, or action by its plain name"), recognition over recall (the user types the word they know and sees the word the PMS uses beside it), and Learnable by a temp in one shift. It removes recall of menu paths and removes the need to learn a new vocabulary before being productive; the translation teaches the canonical term at the moment of use.
- **why innovative**: The corpus says the hiring pool is Dentrix and Eaglesoft's moat (report D.4 #5, A.6.1 #11) and describes Curve's Sidekick as the persistent-context pattern to borrow, but no incumbent in the corpus offers a global command surface, and none translates a competitor's vocabulary; incumbents are instead criticized for "too many clicks" (Dentrix, Ascend, Denticon, A.6.1 #6). Open Dental's answer to unfamiliarity is paid training and SQL.
- **phi and controls**: Palette results are authorization-filtered per request through `withGuard` (a biller does not see clinical actions; a hygienist does not see refunds). Patient rows expose two identifiers only until the two-identifier confirmation passes, which writes the `phi_access_log` row on chart open. No recents are cached on operatory-profile devices (local state wiped on author switch). Actions never execute money or filing without the same `postGuarded`/`signNoteAtomic` path as the buttons.
- **phase**: Phase 2
- **effort**: M
- **risks**: Synonym tables can be wrong or stale across Dentrix versions; ship them as a versioned, tenant-editable catalog labelled by source system and let the office manager add the practice's own slang. Fuzzy patient search must not widen to phonetic matches that surface the wrong patient; keep two-identifier confirmation mandatory.
- **surprise**: True

### Item 3
- **name**: Keys layer: inline single-key accelerators with a keyboard-only gate in CI

#### personas
- hygienist
- biller
- dentist
- front-desk coordinator
- screen-reader or keyboard-only staff
- **problem**: Gates and worklists are operable only by mouse, so a keyboard or screen-reader user cannot reach the field that blocks filing, and a biller posting 200 ERA lines reaches for the mouse on every row.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-a11y-advocate-hate.md, kill 4: "`AuditPanel` `<li onClick={jump}>` — no `role="button"`, no key handler ... Screen reader and keyboard writers cannot reliably jump to the S0/S1 field." /home/user/Dental_Mgmt/docs/11-open-questions-and-unverified.md: "No accessibility testing beyond contrast | axe-core in blocking CI (Phase 0), keyboard-only end-to-end tests for the five flows (Phase 3 exit), VPAT at GA"
- **interaction**: Every worklist row and every gate control carries one single-key accelerator rendered as a small 14 px key cap on the control itself when the Keys layer is on (toggle: the top-bar "Keys" switch or the ? key; state per user, not per device). Money Desk: arrow keys move between rows, P posts the matched line, W opens write-off with reason, A opens appeal; Enter runs the row's one primary action. Encounter: F files, each finding in the killer strip is a real button (Enter jumps to the field). Board: arrow keys move between cards, A arrives, S seats, C opens checkout. Perio keeps its grammar (1–9 depth, space bleeding, arrows skip, Backspace undo) and shows the legend in the grid margin by default; it collapses with one tap and is remembered per user. Tab order equals reading order on every screen. In CI a Playwright job runs each of the five daily flows with the mouse disabled and fails the build if any flow needs a pointer; the same job runs axe-core.
- **why intuitive**: Exercises recognition over recall (the key is printed on the control, so nobody memorizes a shortcut sheet), one verb line + one control (the accelerator is the control), 44 px targets (the key cap is additive, never a substitute), and Learnable by a temp in one shift. It removes clicks on the three high-volume queues and removes vigilance about tab order because CI enforces it structurally.
- **why innovative**: The corpus's recurring complaint about Dentrix, Ascend, and Denticon is "too many clicks" (A.6.1 #6), and Eaglesoft's UI is described as "unchanged since 2015"; the only keyboard praise is hygienists on Open Dental perio speed. No incumbent in the corpus is described as keyboard-complete on its worklists, none publishes accessibility conformance, and the report's D.7 notes nothing on a VPAT for any vendor.
- **phi and controls**: No new PHI exposure; accelerators invoke the same server actions with `withGuard`. Irreversible keys (F file, Post, Close day) open the in-place confirm rather than executing on a single keystroke, so a gloved bump on F cannot file. Key-layer preference is a per-user server setting, so it cannot leak between authors on a shared tablet. The CI job is a build-time control that refuses to ship a pointer-only flow.
- **phase**: Phase 3
- **effort**: M
- **risks**: Single-key accelerators inside text inputs must be suppressed or they will type letters; scope them to worklist and gate focus contexts. Screen-reader announcements for held/blocked states need the refusal-contract feature to be meaningful. The keyboard e2e suite is expensive to keep green; make it blocking only for the five flows.
- **surprise**: False

### Item 4
- **name**: Shape pack with a top-bar grayscale glance and a luminance test in CI

#### personas
- biller
- front-desk coordinator
- hygienist
- owner
- color-blind staff
- **problem**: About 8% of male staff cannot rank a red/orange/amber queue; a color-blind biller mis-ranks a Stop against a Review, and a coordinator misreads Board card colors under operatory LEDs, so the wrong item gets worked first.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-cvd-dyslexia-hate.md, hate 1: "Under red–green CVD, Stop / Required / Review collapse into one muddy brick. The 'distinct appearance' test passes while the human cannot rank the gate." and "`severity-style.test.ts` only asserts **CSS string** uniqueness, not perceptual uniqueness under deuteranopia." /home/user/catcorner22/dental/knowledge/sources/color-theory-uiux.md, falsifier: "Chip-fill relative luminance strictly increases S0 < S1 < S2."
- **interaction**: Every severity, claim state, eligibility badge, and appointment type is drawn three ways at once: a distinct mark (filled square Stop, triangle Required, diamond Review, circle Style, bar Info; appointment types get their own glyph set), the short word, and a fill whose luminance rises monotonically with urgency. The top bar carries a 44 px "Grayscale" switch (not buried on an account page); one tap (1) desaturates the whole shell so anyone can check that Money Desk, the Board, and the killer strip still rank. The same switch is what the CI screenshot test flips: it renders each queue in grayscale and fails the build if two states share a shape token or if the luminance ladder is not strictly ordered. Default muted text is at least 6:1 on the cooler paper; no gate text below 14 px.
- **why intuitive**: Exercises severity by shape + word + luminance (principle 11 and the blueprint's "a color-blind biller ranks a queue in grayscale"), fewer words bigger targets, and structural correctness over vigilance because the ladder is asserted in CI, not reviewed by eye. It removes vigilance for the CVD user and removes the recall of "which color means what" for everyone.
- **why innovative**: No product in the corpus is credited with color-vision-safe encoding; incumbents are criticized for dated or cluttered interfaces (Eaglesoft "unchanged since 2015", DentiMax "format looks out of date", CareStack "overwhelming reports" per A.6.2) and the Curve Forms pattern the corpus documents uses colors that "often match appointment tags" (builder-text-blocks-predictive-ux.md) as the primary cue. A glance toggle that doubles as the CI oracle appears nowhere in the corpus.
- **phi and controls**: Purely presentational; no PHI or disclosure rows. Tokens live in `palette.ts`/`design-tokens.json` and components consume semantics only ("Feature code should not invent hex", design-tokens.md), so a rogue screen cannot introduce a hue-only state. The grayscale switch is a per-user preference stored server-side, never a device default that a shared tablet inherits. The Board's per-chair strip stays PHI-free (initials and chair only).
- **phase**: Phase 1
- **effort**: S
- **risks**: Adding a glyph to every chip makes rows taller; the CVD panel already asked the owner to accept that. Appointment-type glyph sets must stay small (eight or fewer) or they become a second vocabulary to learn. Grayscale screenshots in CI are brittle across font rendering; compare token metadata, not pixels, for the ordering assertion and use screenshots only as artifacts. Tokens and the CI test land in Phase 0 repo surgery; the first user-facing surfaces are the Phase 1 approvals inbox and ledger.
- **surprise**: True

### Item 5
- **name**: Device-profile glove floor with miss-recovery

#### personas
- hygienist
- dental assistant
- dentist
- staff with tremor or low vision
- **problem**: A gloved hand on a fine-pointer iPad or stylus gets desktop-density chips and 32 px tooth cells; an adjacent mistap writes the wrong tooth or the wrong phrase into a legal record, and motion still fires under the finger even with reduced motion on.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-a11y-advocate-hate.md, kill 2: "`.chip` = `px-2 py-0.5 text-xs` until `@media (pointer: coarse)` bumps to 44px ... Fine-pointer tablet, stylus, or desktop = **crumbs**." and kill 6: "Global rule sets `animation-duration` / `transition-duration` to `0.01ms` — **does not** disable `transform` / `scale` / `translate`." /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-chairside-da.md: "If your UI needs a clean mouse, a quiet room, both hands, or a trip to Account to set up a mic, you designed for the break room."
- **interaction**: Density is set by the server-side `sessions.device_profile`, not by the pointer media query: any device enrolled as an operatory device renders every control at 44 px minimum with 8 px gaps regardless of pointer type, and desks default to the same floor with a per-user "compact" opt-out that is never offered on operatory devices. On the odontogram and ToothPicker, each cell is 44 px; a selection shows a live "Selected: 14" line plus an adjacent 44 px Undo, so an off-by-one tap is corrected with one tap (1) instead of a dialog. Impossible surfaces are disabled at the control. Under prefers-reduced-motion (and always on operatory profiles) the clinical path sets animation, transition, and transform to none; there is no celebratory motion on filing. A Playwright check measures every interactive element's bounding box on each of the five flows and fails the build under 44×44 or with gaps under 8 px.
- **why intuitive**: Exercises 44 px targets with 8 px gaps on all pointer types ("glove mode is the default" in the blueprint), structural correctness over vigilance (the floor is a build-time assertion and a server-set profile, not a designer's promise), and two visual identities. It removes the vigilance of aiming with a glove and the recall of "where is the high-contrast setting".
- **why innovative**: The corpus attributes incumbents' chairside failure to reliability and clicks, not to target design, and records no PMS with a glove-specific density policy; the Smile Notes red-team files show even a modern design shipped 44 px only behind `pointer: coarse`. Deriving density from a server-known device profile rather than the browser's pointer heuristic appears in no incumbent account.
- **phi and controls**: No PHI change. Operatory device profile is already a HIPAA §164.310 control (docs/06 row 11) with idle lock and wiped local caches; the glove floor rides the same profile. Wrong-site prevention stays structural (impossible surfaces disabled; chart/note/claim contradiction is a blocking S0). The 44 px CI check is a build-time control, refuse-to-ship, not a recorded finding.
- **phase**: Phase 3
- **effort**: M
- **risks**: A 44 px odontogram with 32 teeth and five surfaces needs a wider canvas on a 10-inch tablet; expect a two-arch scroll or a zoomed quadrant view for surface painting. Desk staff may resist the floor on dense Money Desk tables; keep the desk opt-out but make it per user, so a temp never inherits it.
- **surprise**: True

### Item 6
- **name**: Who's-charting PIN author bar with chair-strip initials

#### personas
- hygienist
- dental assistant
- dentist
- front-desk coordinator
- temp
- **problem**: One operatory tablet passes between a hygienist, an assistant, and a temp in a morning; the next author inherits the previous session, drafts, and chrome and files under the wrong name, which is a Board complaint and an ALCOA+ failure.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md, row 12: "per-user PIN (argon2id-hashed, ≥6 digits, throttled) that can only resume that user's own session on a device bound to the tenant; 'zero wrong-author events on shared tablets' is a Phase 3 exit criterion". /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md, kill 3: "Temp B inherits Temp A's chrome or drafts under the wrong name. Wrong-author on a shared device is an **immediate pilot kill**."
- **interaction**: On any operatory-profile device the top bar's left slot is a persistent 44 px author chip showing the current author's initials and licence glyph ("BL · RDH"). Tap it (1) and a full-height numeric pad with 56 px keys appears; entering a different user's PIN (6 taps) revokes the prior session server-side, discards the client key, wipes drafts and preferences from the device, and opens the new author's session on the same encounter page. Entering your own PIN after the 10-minute idle lock restores the exact caret position. Before File, the killer strip's read-back line repeats author and patient ("Filing as BL · RDH for J.D., DOB 03/1978") so a stale author is caught at the last gate with one tap to switch. The Board's per-chair readiness strip shows each chair's current author initials with no patient data, so the coordinator sees "Chair 3 · BL" and can catch a tablet still signed in as the morning temp before the next patient is seated.
- **why intuitive**: Exercises one verb line + one control (the chip is the control), structural correctness over vigilance (the author is a server session, not a name the user remembers to change), recognition over recall (initials always visible), and 44 px targets with a glove-sized keypad. It removes vigilance about who is logged in and removes the recall of "did I log out".
- **why innovative**: The corpus shows the opposite pattern across categories: QuickBooks' "audit trail that cannot be turned off" is "defeated by shared 'Administrator' logins" (report B.6), Curve's shared-iPad reality has no hard author switch in the red-team files, and no dental PMS in the corpus documents a per-user PIN handoff, an author read-back at filing, or a Board strip that shows device authorship. Incumbents treat the workstation, not the person, as the session.
- **phi and controls**: The author switch is a server-enforced session control (revoke + new session, docs/06 line 98), not a client overlay; the PIN can only resume its owner's session on a tenant-bound device. Wiping local state closes the shared-device PHI residue path (drafts, palette recents, preferences). The chair strip exposes initials and chair only, no PHI. Every filed note's frozen entry-author identity comes from the session, so "zero wrong-author events" is measurable from `domain_event` rows. No per-person scoring: the strip shows who holds a device, never how well they work.
- **phase**: Phase 3
- **effort**: M
- **risks**: PIN entry with wet gloves six times per switch is friction; passkeys on tablets are an open decision (docs/07 item 17) and the keypad should be designed so a badge tap can replace it later. Wiping a colleague's unsaved draft on switch must be preceded by autosave to the server; the durable autosave machine must land first. Initials on the chair strip must never be extended into productivity data.
- **surprise**: True

### Item 7
- **name**: Temp day pass from the Board readiness strip

#### personas
- office manager
- temp
- front-desk coordinator
- owner
- **problem**: A temp arrives before the office manager, has no account or an account with role unset, and the first screen says they are not allowed yet; the alternative offices reach for is a shared "temp" login, which destroys attribution.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-temp-agency-recruiter.md, kill 1: "Temp arrives before Lead. Scope locks stay open or confusing. First emotional beat is 'you are not allowed to be useful yet.'" and Trap: "Do not ship a shared 'temp' login". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md, module map: "Role is set at provisioning, never day-of; setup wizard shows the SoD conflicts each default role creates before the first login is issued".
- **interaction**: The evening before, the Board's readiness strip shows an amber "Tomorrow: 1 chair with no writer" line with one control, "Add day pass" (1 tap). The office manager enters name, licence type (RDH, RDA, DA), and the shift end time (3 fields); the clinical role and the default clinical entitlements are set from the licence template, no financial entitlements are included, and the grant carries an expiry equal to shift end plus a grace period. The wizard shows any SoD conflict before save (a temp given payment posting would be shown the fraud path in one sentence). On arrival the temp taps their name on the tablet's author bar and sets a PIN (6 taps) after presenting the two-identifier check the office manager confirmed; their first screen is Chairs with the first-shift rail. The pass revokes itself at expiry and appears in the weekly digest as a practice-level count of day passes issued, never as a per-person line.
- **why intuitive**: Exercises Learnable by a temp in one shift ("role set at provisioning"), the compliant path is the fastest path (a real named account is faster than finding a shared login), one verb line + one control, and Home is the work (the readiness strip is where the gap is seen). It removes the day-of vigilance of "did anyone set up the temp" and removes the temptation to share credentials.
- **why innovative**: The corpus's staffing theme (report D.2 "Staffing reality — Hiring pool knows the software; temp coverage; onboarding time") is answered by incumbents with familiarity, not with a provisioning flow; Dentrix's own complaint list includes "training at scale". Time-boxed, licence-templated accounts created from the schedule's readiness view, with SoD preview and auto-revocation, appear in no incumbent account in the corpus.
- **phi and controls**: Creates an append-only `user_entitlements` grant with expiry; `detectSodConflicts` runs synchronously on the grant event and refuses a critical conflict without a recorded decision (docs/05). Unique user identification (docs/06 row 12) is preserved: one person, one account, argon2id PIN. Expiry is server-enforced through the sessions table. The temp's clinical writes carry frozen author identity; the digest reports counts at practice scope under the no-scoreboard doctrine.
- **phase**: Phase 2
- **effort**: S
- **risks**: A licence entered wrong (RDA vs RDH) grants the wrong scope; keep the licence-scope validator at the API so a hygiene note by an RDA is refused at filing regardless. Shift-end expiry that fires mid-note is a session-loss complaint; expire at end of shift plus a grace window and warn at the author bar 15 minutes before.
- **surprise**: True

### Item 8
- **name**: Free public certification drills verified by the production engines

#### personas
- temp
- new hire
- hygienist
- biller
- office manager
- recruiter
- **problem**: Hiring pools know Dentrix and Eaglesoft; nobody can arrive already competent in the PMS, and existing training products are paid, per-user, and disconnected from the rules that actually gate real work.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md, principle 22: "a public temp quick-start; free self-serve certification drills verified by the real engine. This is the only available answer to hiring-pool familiarity with Dentrix and Eaglesoft." /home/user/catcorner22/dental/src/app/api/training/complete/route.ts: "Completing a practice case. VERIFIED SERVER-SIDE with the same audit that" (gates real notes); scenarios.ts: "practicing here and charting for real are the same skill".
- **interaction**: A public page (no practice account needed) offers role drills on a sandbox tenant seeded with synthetic patients: front desk (arrive, seat, checkout in 4 clicks), biller (post an ERA batch with two exceptions; request approval on an over-threshold write-off), hygienist (full-mouth perio by keyboard grammar; file a hygiene note past the killer strip), dentist (sign an exam with a plan). Each drill runs in the real UI against the real `evaluateRelease`, `runTextAudit`, and perio engines; the pass condition is that the engine accepted the work with no open S0/S1 and every planted defect repaired. Result is pass or not yet, with the same one-line reasons the product shows; no score, points, timer leaderboard, or bounty. On pass the person receives a signed, dated certificate stamped with `RULESET_VERSION` and `CONTROL_RULEBOOK_VERSION` that they own and can present to an office; the office manager's provisioning screen accepts the certificate to pre-fill licence type (role is still set by the admin). Practices see a per-role "certified: yes/no, date" flag on the staff list, never a ranking. Drills re-open automatically when a ruleset version bumps.
- **why intuitive**: Exercises Learnable by a temp in one shift, deterministic first / human always (the engine that gates production judges the drill, so there is no second truth), recognition over recall (the drill is the real screen), and never score people (pass/not-yet only, owned by the person). It removes the recall gap between training material and the product, and removes vigilance for the office manager because the certificate names the exact rule version.
- **why innovative**: The corpus shows training sold as a cost line: Open Dental "on-site training $3,650 first day", Smart Training "Basic $79/user/yr" (report B.4), Eaglesoft support at "$45 per 15-minute support increment" (semantic-memory.md); Abyde and peers track staff training as an LMS separate from the operational system. No dental PMS in the corpus offers free, account-free, engine-verified drills in the production UI whose certificate is portable to the next employer.
- **phi and controls**: Drills run on a dedicated sandbox tenant with synthetic data only; no PHI exists there and the sandbox is excluded from the PHI access log and disclosure rows. The certificate contains name, role drill, date, and versions, no practice data. Nothing from the source repo's points economy or GPA axis survives (those are on the drop list). The verifying engines are the shipped `controls-engine` and `clinical-core` packages with zero app imports, so the drill cannot be softer than production.
- **phase**: Phase 4
- **effort**: L
- **risks**: Public drills expose the exact gates to anyone, including people who want to learn how to phrase a thin note that clears them; the audit engine's evidence-pinning and readback requirements make that hard, and the risk is accepted because the same rules are visible in the product. A certificate can be mistaken by an owner for competence or a credential; label it "completed drill, rules vX" and never call it a licence. Sandbox capacity is a real cost against a free offering; rate-limit per person.
- **surprise**: False

### Item 9
- **name**: Accessible refusal contract: reasons and next steps as one spoken line

#### personas
- biller
- office manager
- hygienist
- dentist
- screen-reader or low-vision staff
- **problem**: When a posting or filing is refused, the button goes to 40% opacity and the reason is hidden in a description nobody hears; low-vision users see a ghost button and screen-reader users land on a control that never says why it is dead or what to do.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-a11y-advocate-hate.md, kill 5: "Submit / Copy use `aria-disabled` (good: stays focusable) but CSS forces `opacity-40` — washed label fails readable contrast while still in tab order ... SR may land on it and still not get a durable 'what blocks me'". /home/user/Dental_Mgmt/docs/05-internal-controls-module.md, dual release table: "`blocked_same_person`, `blocked_role`, `blocked_missing_second`, `blocked_policy_off` | roll back, return 403 with `reasons[]` and `nextSteps[]`" and "`needs_second` | ... return 202 with one line + one control".
- **interaction**: Every refusal or hold the server returns (`reasons[]`, `nextSteps[]`) is rendered by one shared component: the first reason becomes the verb line (eight words or fewer, verb first: "Needs a second approver — Dana or Dr. Reagan"), the first next step becomes the one control ("Request approval", 44 px, focusable, full contrast). The primary button is never dimmed; it changes to the "Held" identity (outlined, lock glyph, word "Held") which is legible in grayscale. The verb line is an `aria-live="assertive"` region announced once when the state flips and is linked by `aria-describedby` to the Held control, so a screen-reader user hears the reason and can press Enter on the next step without hunting. Further reasons sit behind one "Why" disclosure. The same component is used on the refund form, ERA exception rows, File, Close day, and role grants, so a person learns the refusal shape once. The Money Desk row for a held item reads the same line the poster saw.
- **why intuitive**: Exercises one verb line plus one control at every gate, controls enforced in the transaction path (the copy is generated from the server verdict, never from a client guess), severity by shape + word (Held is a shape and a word, not a fade), and two visual identities. It removes the vigilance of decoding a greyed button and the recall of "what do I do when this is blocked" because the next step is always the control.
- **why innovative**: The corpus describes incumbents' controls as absent or advisory ("controls inside accounting systems ... exception reports", report B.6) and gives no account of any PMS whose refusals name the eligible approver and offer the remedy inline; the plan's own comparison is Curve's orphaned-note failure class and Open Dental's hidden-payment class, both silent failures. An accessibility-first refusal contract shared between money, filing, and grants appears nowhere in the corpus.
- **phi and controls**: The verdict is computed server-side inside the posting transaction by `postGuarded`/`evaluateRelease`; the UI only renders `reasons[]`/`nextSteps[]`. Approver names shown are staff names, not PHI. Requesting approval writes an `approval_requests` row and a domain event; nothing is posted. The component never invents a path around the gate because it only offers next steps the server returned.
- **phase**: Phase 1
- **effort**: S
- **risks**: Assertive live regions interrupt screen-reader users if fired on every keystroke; announce only on verdict change and debounce. Over-long approver lists must truncate to two names with a "more" disclosure. Copy in `reasons[]` is server-authored, so the eight-word rule needs the copy lint (next feature) to hold.
- **surprise**: False

### Item 10
- **name**: Gate-copy, type-floor, and terminology lint in CI

#### personas
- hygienist
- biller
- temp
- dyslexic staff
- product team
- **problem**: Gate messages grow into policy paragraphs, chips shrink to 0.65rem, and the same fact gets three names across screens; under time pressure staff skim color instead of reading and a dyslexic writer cannot parse the block.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-cvd-dyslexia-hate.md, fix 4: "Rewrite role/transfer Andon to Smart Brevity: **what blocks** (≤8 words) + **one button**" and fix 3: "Clinical type floor: ≥14px body, ≥1.5 line-height, no `0.65rem` on gates". /home/user/catcorner22/dental/knowledge/sources/eye-tracking-uiux-research.md: "The most damaging app defects are goal mismatches, not aesthetics: weak signifiers, premature data requests, late validation, hidden status, inconsistent terminology, unrecoverable errors."
- **interaction**: All user-facing gate strings (refusal reasons, next steps, Andon lines, killer-strip messages, Board and Money Desk primary actions) live in one versioned copy catalog keyed by id. A CI lint fails the build when a gate string exceeds eight words, does not begin with a verb or the blocked object, contains a dollar amount inside note-scoped copy, or uses a term outside the terminology registry (the registry pins one canonical word per fact: "write-off" not "adjustment" when the kind is write-off; "Arrive" everywhere, never "check in" on one screen and "arrive" on another). A second rule scans component styles for gate controls under 14 px, line-height under 1.5, or vertical padding under 8 px and fails. The office manager sees none of this; they see the same word in the palette, the Board, the Money Desk row, the digest, and the certification drill.
- **why intuitive**: Exercises fewer words bigger targets, one canonical view per fact ("the same metric shows the same value on every screen" extended to the same word), recognition over recall (one vocabulary to learn), money never inside note text (a lint rule, not a review item), and structural correctness over vigilance. It removes reading load at the gate and removes the recall of synonyms across screens.
- **why innovative**: The corpus faults incumbents for interfaces with inconsistent, confusing surfaces (Ascend reporting "confusing or inconsistent" 77% of mentions; CareStack "overwhelming") and the red-team files show that even a design-conscious product drifted to 0.65rem chips and Andon essays. A build-time lint over copy length, verb position, terminology, and gate typography is a discipline no PMS in the corpus is described as having.
- **phi and controls**: No PHI; the catalog contains UI strings only. The money-in-note rule is a structural enforcement of principle 11's "money lives on the plan card and ledger, never in note text" at build time, complementing the runtime audit rule. Catalog versions are stamped like other rule constants so a copy change is a reviewable diff.
- **phase**: Phase 1
- **effort**: S
- **risks**: Eight words is a blunt limit; legal copy counsel requires on some gates must move behind the "Why" disclosure rather than into the verb line, and counsel may object. The terminology registry needs an owner or it becomes a bottleneck; allow tenant-visible synonyms only in the palette translation table, never in gate copy. The lint itself belongs in the Phase 0 CI set-up; its first enforced strings are the Phase 1 refusal and approvals copy.
- **surprise**: True

### Item 11
- **name**: Practice-scoped first-run friction card

#### personas
- office manager
- owner
- product team
- **problem**: The pilot must prove ≤90 minutes of paid training per writer, but the only way offices learn where new staff get stuck is a callback to the agency or a support ticket; the vendor has no signal at all without a third-party analytics tool that would see PHI.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md, Measured, not asserted: "≤90 minutes paid training per writer; zero wrong-author events on shared devices." /home/user/Dental_Mgmt/docs/08-roadmap.md, Phase 0 non-code deliverables: "a first-party, PHI-free usage-metrics pipeline derived from `domain_event` and passed through the redactor, so the pilot buy gates are measurable without a third-party analytics vendor".
- **interaction**: The first-shift rail and the refusal component emit PHI-free domain events (step shown, step retired, refusal rendered, palette query with no match, Keys toggled) with actor id only. Weekly, the digest computes them per practice with the existing minimum-sample and `SYSTEMIC_SHARE` rules and, when at least three first-run users hit the same step, renders one card on the office manager's Money Desk digest tab: "3 of 4 new writers needed the rail for Checkout this month" with one control, "Show the Checkout rail" (opens the rail for anyone on request). No name appears; a step that only one person struggled with is never shown. The same aggregates, with actor ids dropped by the redactor and tenant id hashed, feed the vendor's usage pipeline so the product team sees which step is hard across practices and which palette queries return nothing (candidates for the vocabulary table).
- **why intuitive**: Exercises never score people (practice-scoped, minimum sample, systemic re-scoping), signals are batched and practice-scoped, and Home is the work (the card lives in the digest, not a dashboard). It removes the office manager's vigilance of watching new staff and gives the product a learnability metric without surveillance.
- **why innovative**: The corpus records no PMS measuring its own learnability; incumbents answer onboarding with paid training and the burned-RDH red-team file warns that any named signal becomes "a performance file with better fonts". Practice-scoped friction telemetry with minimum-sample gating, re-used from the digest rules, appears in no incumbent account.
- **phi and controls**: Events contain step ids, screen ids, and actor id only; palette queries are hashed or dropped if they matched a patient (only no-match queries are kept, and those are truncated to three characters). The redactor strips actor ids before anything leaves the tenant, and the vendor pipeline is first-party (no analytics vendor, no BAA needed for the aggregate). Per-actor detail is never rendered to anyone, including the owner, under the no-scoreboard doctrine.
- **phase**: Phase 2
- **effort**: S
- **risks**: In a four-person office a "3 of 4" card can still identify a person by elimination; keep the minimum sample and suppress the card when the practice has fewer than five first-run users in the window. Palette no-match queries can contain a patient name typed wrongly; truncate and never store beyond three characters.
- **surprise**: True

### Item 12
- **name**: In-place confirm for irreversible actions with object read-back

#### personas
- hygienist
- dentist
- biller
- dental assistant
- staff with tremor
- **problem**: On a gloved tablet, File, Post, Close day, and Extract are one tap from a mis-hit; a modal confirm steals focus mid-procedure and gets dismissed by reflex, so the irreversible action still happens on the wrong object.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-a11y-advocate-hate.md, fix 3: "Fat cells; selected state that survives glare; undo / clear adjacent; keep (strengthen) live 'Selected:' announcement; optional confirm step for single-tooth irreversible procedures." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md, principle 11: "two visual identities for irreversible (file, post, close day) and reversible (print, preview) actions".
- **interaction**: Irreversible controls carry the commit identity (filled navy, square corners, lock glyph, verb word) and reversible ones the plain identity (outlined, rounded, no glyph). Tapping a commit control (1) does not execute; the control widens in place into a 44 px two-part strip: a read-back line that names the object in the terms that matter for that action (File: "BL · RDH for J.D., DOB 03/1978, tooth 14 MO"; Post: "$142.00 cash to J.D., allocated to D2392"; Close day: "Tue 3 Sep, 3 tenders, $4,812.00") and one Confirm target (1) beside a Cancel. Enter confirms from the keyboard; Escape cancels. No modal, no focus trap, no motion. The read-back tokens are the same high-stakes tokens the plan already reads back on bulk and AI transformations (tooth, surface, dose, amount, payer). If the read-back cannot be fully populated (missing author, missing encounter) the strip renders the refusal contract instead of Confirm.
- **why intuitive**: Exercises two visual identities, 44 px targets with 8 px gaps, read-back for high-stakes tokens, one verb line + one control, and structural correctness over vigilance (the second tap cannot be given to the wrong object because the object is written on it). It removes mis-tap consequences without a modal and removes the vigilance of "did I have the right patient" at the moment it matters.
- **why innovative**: Curve's Forms pattern in the corpus uses required fields that "block save" but confirms nothing about the object; incumbents' wrong-object failures surface as "disappearing notes" (Sensei via DSN, report A.6.1 #13) and Curve's orphaned-note class. No PMS in the corpus is described as distinguishing irreversible from reversible controls visually or reading back the object on commit.
- **phi and controls**: The read-back shows PHI already on screen for the current patient to the current authenticated author; it adds no disclosure. Money tokens appear only on Post and Close day read-backs, never on File (note text stays money-free; the copy lint enforces it). Confirm invokes the same `signNoteAtomic`/`postGuarded`/`closeDayAtomic` paths; a refused verdict from the server replaces Confirm with the refusal contract, so the strip can never approve past a control.
- **phase**: Phase 3
- **effort**: S
- **risks**: A second tap on every commit adds one interaction to the ≤10-tap restorative flow and ≤4-click checkout budgets; count it in the exit criteria and offer no way to disable it. Users may learn to double-tap by reflex; the widening strip should require a spatially distinct Confirm target, not a second tap on the same spot.
- **surprise**: False
