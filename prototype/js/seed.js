/* Deterministic seed: mulberry32(20260903). Every id below is a contract (see CONTRACTS.md §8). */
(function () {
  const Proto = (window.Proto = window.Proto || {});

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TODAY = '2026-09-03', YESTERDAY = '2026-09-02', CLOSED_DAY = '2026-09-01';

  const FIRST = ['Marisol', 'Theo', 'Ines', 'Ruth', 'Samir', 'Lena', 'Devon', 'Aiko', 'Grace', 'Omar', 'Priya', 'Hank', 'Noor', 'Jules', 'Rosa', 'Kwame', 'Elena', 'Tariq', 'Beth', 'Yusuf', 'Carmen', 'Felix', 'Hana', 'Ivan', 'Maya', 'Leo', 'Sofia', 'Dmitri', 'Amara', 'Wes', 'Nadia', 'Cole', 'Farah', 'Gus', 'Imani', 'Jonah', 'Kira', 'Luis', 'Mira', 'Nico'];
  const LAST = ['Vega', 'Brandt', 'Okoro', 'Adler', 'Haddad', 'Fischer', 'Price', 'Tanaka', 'Whitfield', 'Nasser', 'Raman', 'Dawson', 'Ali', 'Marchetti', 'Delgado', 'Mensah', 'Petrova', 'Aziz', 'Calloway', 'Demir', 'Ortiz', 'Hoffman', 'Sato', 'Volkov', 'Iyer', 'Brennan', 'Costa', 'Sokolov', 'Nwosu', 'Kirby', 'Rahimi', 'Bennett', 'Karim', 'Lindqvist', 'Okafor', 'Reyes', 'Novak', 'Serrano', 'Patel', 'Rossi'];

  function build(seedNum) {
    const rnd = mulberry32(seedNum || 20260903);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

    const tenant = { id: 'ten-1', name: 'Riverbend Dental', today: TODAY, yesterday: YESTERDAY, closedDay: CLOSED_DAY, timezone: 'America/Chicago', businessHours: { open: '07:30', close: '17:30' }, dualReleaseThresholdCents: 15000 };
    const locations = [
      { id: 'loc-1', name: 'Main Street', short: 'Main St', operatories: 3 },
      { id: 'loc-2', name: 'Riverbend East', short: 'East', operatories: 3 },
      { id: 'loc-3', name: 'Hillsboro', short: 'Hillsboro', operatories: 2 },
    ];
    const users = [
      { id: 'u-dr-1', name: 'Dr. Blake Reagan', short: 'Dr. Reagan', role: 'owner', licence: 'DDS', entitlements: ['approve_second', 'post_payment', 'refund', 'write_off', 'bank_reconcile', 'grant_roles', 'close_day'], pin: '2468' },
      { id: 'u-dr-2', name: 'Dr. Hana Kim', short: 'Dr. Kim', role: 'dentist', licence: 'DDS', entitlements: ['approve_second'], pin: '1357' },
      { id: 'u-dr-3', name: 'Dr. Chidi Okafor', short: 'Dr. Okafor', role: 'surgeon', licence: 'DDS, OMS', entitlements: [], pin: '9753' },
      { id: 'u-hy-1', name: 'Bree Lawson', short: 'Bree L.', role: 'hygienist', licence: 'RDH', entitlements: [], pin: '1111' },
      { id: 'u-hy-2', name: 'Marcus Tran', short: 'Marcus T.', role: 'hygienist', licence: 'RDH', entitlements: [], pin: '2222' },
      { id: 'u-da-1', name: 'Jo Ramirez', short: 'Jo R.', role: 'assistant', licence: 'RDA', entitlements: [], pin: '3333' },
      { id: 'u-om-1', name: 'Dana Whitfield', short: 'Dana', role: 'office_manager', licence: null, entitlements: ['approve_second', 'post_payment', 'refund', 'write_off', 'prepare_deposit', 'grant_roles', 'close_day'], pin: '4444' },
      { id: 'u-fd-1', name: 'Priya Raman', short: 'Priya', role: 'frontdesk', licence: null, entitlements: ['post_payment', 'schedule'], pin: '5555' },
      { id: 'u-bl-1', name: 'Sam Dawson', short: 'Sam', role: 'biller', licence: null, entitlements: ['post_payment', 'write_off', 'submit_claims', 'post_era'], pin: '6666' },
      { id: 'u-cl-1', name: 'Noor Ali', short: 'Noor', role: 'compliance', licence: null, entitlements: ['review_logs'], pin: '7777' },
      { id: 'u-cpa', name: 'Reyes & Co. CPA', short: 'CPA seat', role: 'cpa', licence: null, entitlements: ['view_reports', 'bank_reconcile'], pin: null },
    ];
    const personaUser = { frontdesk: 'u-fd-1', biller: 'u-bl-1', hygienist: 'u-hy-1', dentist: 'u-dr-2', surgeon: 'u-dr-3', owner: 'u-dr-1', compliance: 'u-cl-1', temp: 'u-temp' };

    const carriers = [{ id: 'car-delta', name: 'Delta Dental' }, { id: 'car-cigna', name: 'Cigna' }, { id: 'car-metlife', name: 'MetLife' }, { id: 'car-tenncare', name: 'TennCare (excluded at launch)' }];

    // Patients: the first eight are contract patients with fixed names and scenarios.
    const fixed = [
      ['p-301', 'Marisol Vega', '1978-04-12', '615-555-0141', 'car-delta', null, ['New anticoagulant (apixaban), intake 2 days ago']],
      ['p-302', 'Theo Brandt', '1990-11-02', '615-555-0172', 'car-cigna', null, []],
      ['p-303', 'Ines Okoro', '1985-06-21', '615-555-0118', 'car-delta', 'car-metlife', []],
      ['p-304', 'Ruth Adler', '1954-01-30', '615-555-0199', 'car-delta', null, ['Latex allergy']],
      ['p-305', 'Samir Haddad', '1996-09-15', '615-555-0133', 'car-cigna', null, []],
      ['p-306', 'Lena Fischer', '1969-07-08', '615-555-0126', 'car-metlife', null, []],
      ['p-307', 'Devon Price', '2014-03-19', '615-555-0160', 'car-delta', null, ['Minor: guardian Alicia Price']],
      ['p-320', 'Aiko Tanaka', '1982-12-05', '615-555-0187', 'car-cigna', null, ['Referred in: Dr. Serrano (GP) for #17 extraction; ASA II']],
    ];
    const patients = fixed.map(([id, name, dob, phone, primary, secondary, alerts]) => ({ id, name, dob, phone, mrn: 'MRN-' + id.slice(2), primary, secondary, alerts, selfPay: false }));
    let n = 308;
    while (patients.length < 40) {
      const id = 'p-' + n++;
      const name = pick(FIRST) + ' ' + pick(LAST);
      const dob = between(1948, 2016) + '-' + String(between(1, 12)).padStart(2, '0') + '-' + String(between(1, 28)).padStart(2, '0');
      const selfPay = rnd() < 0.06;
      const primary = selfPay ? null : pick(['car-delta', 'car-delta', 'car-cigna', 'car-metlife']);
      const secondary = !selfPay && rnd() < 0.2 ? pick(['car-metlife', 'car-cigna']) : null;
      patients.push({ id, name, dob, phone: '615-555-0' + between(200, 299), mrn: 'MRN-' + id.slice(2), primary, secondary, alerts: rnd() < 0.15 ? [pick(['Premed required', 'Anxious: stop signal agreed', 'Hard of hearing: face the patient'])] : [], selfPay });
    }

    // Credentials on file (for the day-pass gate)
    const credentials = [
      { id: 'cred-1', userId: 'u-hy-1', name: 'Bree Lawson', licenceType: 'RDH', state: 'TN', expiresAt: '2027-06-30', verifiedAt: '2026-01-14', verifiedBy: 'Dana Whitfield' },
      { id: 'cred-2', userId: 'u-hy-2', name: 'Marcus Tran', licenceType: 'RDH', state: 'TN', expiresAt: '2027-02-28', verifiedAt: '2026-01-14', verifiedBy: 'Dana Whitfield' },
      { id: 'dp-alex', userId: null, name: 'Alex Rivera', licenceType: 'RDH', state: 'TN', expiresAt: '2027-09-30', verifiedAt: '2026-08-29', verifiedBy: 'Dana Whitfield' },
    ];

    // Today's schedule at loc-1: three operatories. Contract appointments first.
    const appointments = [
      { id: 'a-1042', patientId: 'p-301', locationId: 'loc-1', op: 1, time: '09:00', type: 'hygiene', providerId: 'u-hy-1', status: 'confirmed', eligibility: 'amber', encounterId: 'enc-9001', formsDone: true, balanceCents: 0, perioLast: '2025-07-01', bwxDue: true, helpedLastTime: 'stop signal, sunglasses' },
      { id: 'a-1043', patientId: 'p-302', locationId: 'loc-1', op: 2, time: '09:00', type: 'restorative', providerId: 'u-dr-2', status: 'seated', eligibility: 'green', encounterId: 'enc-9002', formsDone: true, balanceCents: 0 },
      { id: 'a-1044', patientId: 'p-303', locationId: 'loc-1', op: 3, time: '08:00', type: 'exam', providerId: 'u-dr-2', status: 'in_chart', eligibility: 'green', encounterId: 'enc-9003', formsDone: true, balanceCents: 4400 },
      { id: 'a-1045', patientId: 'p-304', locationId: 'loc-1', op: 1, time: '08:00', type: 'hygiene', providerId: 'u-hy-2', status: 'note_filed', eligibility: 'green', encounterId: 'enc-9004', formsDone: true, balanceCents: 0 },
      { id: 'a-1046', patientId: 'p-305', locationId: 'loc-1', op: 2, time: '08:00', type: 'exam', providerId: 'u-dr-1', status: 'note_filed', eligibility: 'green', encounterId: 'enc-9005', formsDone: true, balanceCents: 16800 },
      { id: 'a-1047', patientId: 'p-306', locationId: 'loc-1', op: 3, time: '09:00', type: 'restorative', providerId: 'u-dr-1', status: 'note_filed', eligibility: 'green', encounterId: 'enc-9006', formsDone: true, balanceCents: 41000 },
      { id: 'a-1050', patientId: 'p-307', locationId: 'loc-1', op: 1, time: '07:30', type: 'hygiene', providerId: 'u-hy-1', status: 'checked_out_unfiled', eligibility: 'green', encounterId: 'enc-9010', formsDone: true, balanceCents: 0 },
      { id: 'a-1060', patientId: 'p-320', locationId: 'loc-1', op: 3, time: '10:00', type: 'surgery', providerId: 'u-dr-3', status: 'confirmed', eligibility: 'green', encounterId: 'enc-9020', formsDone: false, balanceCents: 0, referral: { from: 'Dr. Serrano', reason: '#17 extraction, sedation requested', recordsForwarded: true } },
    ];
    const types = ['hygiene', 'hygiene', 'hygiene', 'restorative', 'exam', 'restorative'];
    const times = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    let aid = 1061; let eid = 9021;
    for (const loc of locations) {
      const ops = loc.operatories;
      for (let op = 1; op <= ops; op++) {
        for (const time of times) {
          if (loc.id === 'loc-1' && op === 3 && time === '10:00') continue;
          const type = pick(types);
          const providerId = type === 'hygiene' ? pick(['u-hy-1', 'u-hy-2']) : pick(['u-dr-1', 'u-dr-2']);
          const patient = patients[between(8, 39)];
          appointments.push({ id: 'a-' + aid++, patientId: patient.id, locationId: loc.id, op, time, type, providerId, status: 'scheduled', eligibility: patient.selfPay ? 'none' : (rnd() < 0.12 ? 'amber' : 'green'), encounterId: 'enc-' + eid++, formsDone: rnd() < 0.8, balanceCents: rnd() < 0.3 ? between(20, 400) * 100 : 0, labCase: (loc.id === 'loc-1' && op === 3 && time === '11:00') ? { id: 'lab-op3', due: '2026-09-04', status: 'not_back', vendor: 'Ridge Dental Lab' } : null });
        }
      }
    }

    const encounters = appointments.map((a) => ({ id: a.encounterId, appointmentId: a.id, patientId: a.patientId, providerId: a.providerId, locationId: a.locationId, dos: TODAY, status: ['note_filed', 'checked_out_unfiled'].includes(a.status) ? (a.status === 'note_filed' ? 'signed' : 'open') : 'open', noteFiled: a.status === 'note_filed' }));

    // Hygienist tag on Theo Brandt's encounter (for-dentist handoff object)
    const tags = [{ id: 'tag-1', encounterId: 'enc-9002', tooth: 30, surfaces: ['D', 'O'], text: 'Suspected caries #30 DO', author: 'Bree Lawson', disposition: null }];

    // Prior perio exam for Marisol Vega (14 months ago), ghosted in the grid
    const priorPerio = {}; // key t<tooth>-s<site> -> depth
    for (let t = 1; t <= 32; t++) { if ([1, 16, 17, 32].includes(t)) continue; for (let s = 1; s <= 6; s++) priorPerio['t' + t + '-s' + s] = rnd() < 0.15 ? between(4, 5) : between(2, 3); }
    const perioExams = [{ id: 'pe-1', patientId: 'p-301', encounterId: 'enc-old-1', date: '2025-07-01', sites: priorPerio, missing: [1, 16, 17, 32] }];

    // Procedures and fee schedule
    const cdt = { d0120: ['Periodic exam', 6500], d0140: ['Limited exam', 9000], d0274: ['Bitewings, four', 7800], d1110: ['Prophylaxis, adult', 11800], d2392: ['Composite, 2 surf posterior', 26000], d2740: ['Crown, porcelain/ceramic', 118000], d4341: ['SRP, 4+ teeth per quadrant', 28500], d7210: ['Extraction, surgical', 36000], d9230: ['Nitrous oxide', 7500], d9243: ['IV sedation, each 15 min', 32000] };

    const procedures = [
      { id: 'pr-401', encounterId: 'enc-9003', patientId: 'p-303', cdt: 'd0120', tooth: null, feeCents: 6500, status: 'completed', selfPayRestricted: false },
      { id: 'pr-402', encounterId: 'enc-9003', patientId: 'p-303', cdt: 'd0274', tooth: null, feeCents: 7800, status: 'completed', selfPayRestricted: false },
      { id: 'pr-403', encounterId: 'enc-9003', patientId: 'p-303', cdt: 'd1110', tooth: null, feeCents: 11800, status: 'completed', selfPayRestricted: false },
      { id: 'pr-411', encounterId: 'enc-9004', patientId: 'p-304', cdt: 'd1110', tooth: null, feeCents: 11800, status: 'completed', selfPayRestricted: false },
      { id: 'pr-412', encounterId: 'enc-9004', patientId: 'p-304', cdt: 'd0120', tooth: null, feeCents: 6500, status: 'completed', selfPayRestricted: false },
      { id: 'pr-421', encounterId: 'enc-9005', patientId: 'p-305', cdt: 'd0140', tooth: null, feeCents: 9000, status: 'completed', selfPayRestricted: false },
      { id: 'pr-422', encounterId: 'enc-9005', patientId: 'p-305', cdt: 'd0274', tooth: null, feeCents: 7800, status: 'completed', selfPayRestricted: false },
      { id: 'pr-431', encounterId: 'enc-9006', patientId: 'p-306', cdt: 'd2740', tooth: 19, feeCents: 118000, status: 'completed', selfPayRestricted: false },
    ];
    // Patient portion estimates per checkout appointment (estimate column, never in the ledger)
    const estimates = {
      'a-1044': { patientCents: 4400, insuranceCents: 21700, writeoffCents: 0, note: 'Delta primary paid est. $156; MetLife secondary est. $61' },
      'a-1045': { patientCents: 0, insuranceCents: 18300, writeoffCents: 0, note: 'Delta covers prophy and exam at 100%' },
      'a-1046': { patientCents: 16800, insuranceCents: 0, writeoffCents: 0, note: 'Patient asked to pay in full; no claim' },
      'a-1047': { patientCents: 41000, insuranceCents: 59000, writeoffCents: 18000, note: 'Crown #19: MetLife est. $590; PPO write-off est. $180' },
    };

    // Ledger entries (append-only). Kinds: charge, patient_payment, insurance_payment, adjustment, write_off, refund, reversal.
    const ledger = [];
    let lid = 4400;
    function L(row) { row.id = 'le-' + lid++; ledger.push(row); return row; }
    // Closed day 9/1: a normal day plus a correction pair posted 9/3 and a late first posting
    for (let i = 0; i < 18; i++) {
      const p = patients[between(8, 39)];
      const charge = L({ kind: 'charge', patientId: p.id, amountCents: between(60, 1200) * 100, effective: CLOSED_DAY, posted: CLOSED_DAY, actor: 'Sam Dawson', actorKind: 'user', locationId: 'loc-1', reason: null });
      if (rnd() < 0.7) L({ kind: 'patient_payment', patientId: p.id, amountCents: -Math.round(charge.amountCents * (rnd() < 0.5 ? 1 : 0.4)), effective: CLOSED_DAY, posted: CLOSED_DAY, actor: 'Priya Raman', actorKind: 'user', locationId: 'loc-1', tender: pick(['card', 'cash', 'check']) });
    }
    const orig = L({ kind: 'patient_payment', patientId: 'p-311', amountCents: -12000, effective: CLOSED_DAY, posted: CLOSED_DAY, actor: 'Priya Raman', actorKind: 'user', locationId: 'loc-1', tender: 'check' });
    L({ kind: 'reversal', patientId: 'p-311', amountCents: 12000, effective: CLOSED_DAY, posted: TODAY, actor: 'Sam Dawson', actorKind: 'user', locationId: 'loc-1', reversesEntryId: orig.id, correctsEntryId: orig.id, reason: 'posted_to_wrong_account', postedAfterClose: false });
    L({ kind: 'patient_payment', patientId: 'p-312', amountCents: -12000, effective: CLOSED_DAY, posted: TODAY, actor: 'Sam Dawson', actorKind: 'user', locationId: 'loc-1', correctsEntryId: orig.id, reason: 'posted_to_wrong_account', tender: 'check', postedAfterClose: false });
    L({ kind: 'charge', patientId: 'p-313', amountCents: 26000, effective: CLOSED_DAY, posted: YESTERDAY, actor: 'Dr. Hana Kim', actorKind: 'file_event', locationId: 'loc-1', postedAfterClose: true, closedDayId: 'dc-loc-1-0901', reason: null });
    // Yesterday 9/2 per location
    const yesterdayTotals = {};
    for (const loc of locations) {
      const tot = { cash: 0, check: 0, card: 0 };
      for (let i = 0; i < (loc.id === 'loc-3' ? 9 : 16); i++) {
        const p = patients[between(8, 39)];
        const charge = L({ kind: 'charge', patientId: p.id, amountCents: between(60, 1200) * 100, effective: YESTERDAY, posted: YESTERDAY, actor: loc.id === 'loc-2' ? 'Dana Whitfield' : 'Sam Dawson', actorKind: 'user', locationId: loc.id });
        if (rnd() < 0.75) { const tender = pick(['card', 'card', 'cash', 'check']); const amt = Math.round(charge.amountCents * (rnd() < 0.5 ? 1 : 0.35)); tot[tender] += amt; L({ kind: 'patient_payment', patientId: p.id, amountCents: -amt, effective: YESTERDAY, posted: YESTERDAY, actor: loc.id === 'loc-2' ? 'Dana Whitfield' : 'Priya Raman', actorKind: 'user', locationId: loc.id, tender }); }
      }
      yesterdayTotals[loc.id] = tot;
    }
    // Open balances for contract patients
    L({ kind: 'charge', patientId: 'p-306', amountCents: 118000, effective: '2026-08-12', posted: '2026-08-12', actor: 'Sam Dawson', actorKind: 'user', locationId: 'loc-1', procedureId: 'pr-431', cdt: 'd2740', tooth: 19 });
    L({ kind: 'insurance_payment', patientId: 'p-306', amountCents: -59000, effective: '2026-09-01', posted: '2026-09-01', actor: 'pg-boss worker', actorKind: 'worker', locationId: 'loc-1', eraLineId: 'el-prev-1', payer: 'MetLife', gl: 'ins_ar_primary' });
    L({ kind: 'write_off', patientId: 'p-306', amountCents: -18000, effective: '2026-09-01', posted: '2026-09-01', actor: 'pg-boss worker', actorKind: 'worker', locationId: 'loc-1', eraLineId: 'el-prev-1', reason: 'contractual_ppo' });
    L({ kind: 'charge', patientId: 'p-303', amountCents: 21700, effective: '2026-07-14', posted: '2026-07-14', actor: 'Sam Dawson', actorKind: 'user', locationId: 'loc-1', cdt: 'd4341', tooth: null });
    L({ kind: 'insurance_payment', patientId: 'p-303', amountCents: -15600, effective: '2026-08-02', posted: '2026-08-02', actor: 'pg-boss worker', actorKind: 'worker', locationId: 'loc-1', payer: 'Delta Dental', gl: 'ins_ar_primary' });
    L({ kind: 'insurance_payment', patientId: 'p-303', amountCents: -6100, effective: '2026-08-20', posted: '2026-08-20', actor: 'pg-boss worker', actorKind: 'worker', locationId: 'loc-1', payer: 'MetLife', gl: 'ins_ar_secondary' });

    // Day closes, deposits, bank, reconciliation for yesterday
    const dayCloses = [
      { id: 'dc-loc-1-0901', locationId: 'loc-1', date: CLOSED_DAY, closedBy: 'Dana Whitfield', closedAt: '18:14', chainHeadHash: '9f3a…e21c' },
      { id: 'dc-loc-2-0901', locationId: 'loc-2', date: CLOSED_DAY, closedBy: 'Dana Whitfield', closedAt: '18:20', chainHeadHash: '4b77…08aa' },
      { id: 'dc-loc-3-0901', locationId: 'loc-3', date: CLOSED_DAY, closedBy: 'Sam Dawson', closedAt: '17:58', chainHeadHash: 'c0d1…5f19' },
      { id: 'dc-loc-1-0902', locationId: 'loc-1', date: YESTERDAY, closedBy: 'Dana Whitfield', closedAt: '18:02', chainHeadHash: '71ee…b3d0' },
      { id: 'dc-loc-2-0902', locationId: 'loc-2', date: YESTERDAY, closedBy: 'Dana Whitfield', closedAt: '18:09', chainHeadHash: '2a4c…97e4' },
      { id: 'dc-loc-3-0902', locationId: 'loc-3', date: YESTERDAY, closedBy: 'Sam Dawson', closedAt: '17:51', chainHeadHash: 'e8f2…1c07' },
    ];
    const reconciliation = [
      { id: 'rr-loc-1', locationId: 'loc-1', date: YESTERDAY, state: 'tied', independent: true, closer: 'Dana Whitfield', closerPosted: false, source: 'feed', lagDays: 1, expected: yesterdayTotals['loc-1'], bank: Object.assign({}, yesterdayTotals['loc-1']), eft: { payer: 'Delta Dental', amountCents: 481233, trn: 'TRN 20260902-88213', matched: true } },
      { id: 'rr-loc-2', locationId: 'loc-2', date: YESTERDAY, state: 'second_look', independent: false, closer: 'Dana Whitfield', closerPosted: true, source: 'feed', lagDays: 1, expected: yesterdayTotals['loc-2'], bank: Object.assign({}, yesterdayTotals['loc-2']) },
      { id: 'rr-loc-3', locationId: 'loc-3', date: YESTERDAY, state: 'variance', independent: true, closer: 'Sam Dawson', closerPosted: false, source: 'statement', lagDays: 1, expected: yesterdayTotals['loc-3'], bank: Object.assign({}, yesterdayTotals['loc-3'], { card: yesterdayTotals['loc-3'].card - 31240 }) },
    ];
    const variances = [{ id: 'v-1', reconciliationId: 'rr-loc-3', locationId: 'loc-3', tender: 'card', amountCents: 31240, sentence: 'Card settlements batch after 6 pm: yesterday\'s two late card payments ($312.40) appear in today\'s bank line.', proposedMatch: { bankLine: 'Sept 3 · CARD SETTLEMENT · $312.40', ledgerEntries: 2 }, status: 'open' }];

    // Approvals, exceptions, decisions
    const approvals = []; // filled at runtime
    const decisions = [{ id: 'd-1', kind: 'raise_threshold', text: 'Write-off threshold raised from $150 to $300 for vacation cover', decidedBy: 'Dr. Blake Reagan', decidedAt: '2026-08-04', reviewBy: '2026-09-01', measuredEffect: 'Held write-offs fell from 6/week to 1/week; approvals median 4 min', status: 'review_due' }];

    // ERA batch era-1: Delta Dental 835, 41 lines
    const eraLines = [];
    for (let i = 1; i <= 41; i++) {
      const p = patients[between(8, 39)];
      const expected = between(60, 900) * 100;
      const row = { id: 'el-' + i, batchId: 'era-1', patientId: p.id, claimId: 'c-' + (40 + i), cdt: pick(['d1110', 'd0120', 'd2392', 'd2740', 'd4341', 'd0274']), tooth: null, expectedCents: expected, paidCents: expected, carc: null, status: 'posted' };
      eraLines.push(row);
    }
    Object.assign(eraLines[13], { patientId: 'p-330', cdt: 'd2740', tooth: 19, expectedCents: 59000, paidCents: 54000, carc: '45', status: 'delta', note: 'Paid below contract: expected $590, ERA says $540' });
    Object.assign(eraLines[21], { cdt: 'd4341', expectedCents: 28500, paidCents: 21400, carc: '45', status: 'delta', note: 'Paid below contract: expected $285, ERA says $214' });
    Object.assign(eraLines[30], { cdt: 'd2392', tooth: 14, expectedCents: 26000, paidCents: 20800, carc: '131', status: 'delta', note: 'Downcoded to D2391: expected $260, ERA says $208' });
    Object.assign(eraLines[39], { id: 'el-40', patientId: 'p-321', claimId: 'c-88', cdt: 'd4341', expectedCents: 28500, paidCents: 0, carc: '16', rarc: 'N4', status: 'denied', note: 'Claim lacks information: missing perio chart' });
    const eraBatches = [{ id: 'era-1', payer: 'Delta Dental', received: TODAY + 'T06:10', lines: 41, postedLines: 37, eftCents: 481233, trn: 'TRN 20260903-90112', status: 'review' }];

    const claims = [
      { id: 'c-88', patientId: 'p-321', status: 'denied', cdt: 'd4341', tooth: null, amountCents: 28500, payer: 'Delta Dental', carc: '16', rarc: 'N4', plain: 'Delta says the claim is missing information: the perio chart was not attached.', nextAction: 'Appeal with the perio chart and the SRP narrative from the note', appealBy: '2026-11-02', submitted: '2026-08-20', hasPerioChart: true, hasNarrative: true },
      { id: 'c-72', patientId: 'p-315', status: 'pended', cdt: 'd2740', tooth: 3, amountCents: 118000, payer: 'Cigna', submitted: '2026-08-14', age: 20, nextAction: 'Payer requested pre-op radiograph; attach and resubmit' },
      { id: 'c-65', patientId: 'p-318', status: 'submitted', cdt: 'd2392', tooth: 30, amountCents: 26000, payer: 'MetLife', submitted: '2026-08-01', age: 33, nextAction: 'Call payer: no 277 status in 33 days' },
      { id: 'c-51', patientId: 'p-322', status: 'submitted', cdt: 'd4341', tooth: null, amountCents: 28500, payer: 'Delta Dental', submitted: '2026-07-02', age: 63, nextAction: 'Timely filing at 90 days: escalate' },
    ];

    const statementsDue = [{ id: 'sd-1', patientId: 'p-316', amountCents: 8400, reason: 'window_deferred', createdBy: 'Priya Raman', created: YESTERDAY }, { id: 'sd-2', patientId: 'p-319', amountCents: 21200, reason: 'window_deferred', createdBy: 'Priya Raman', created: YESTERDAY }];
    const credits = [{ id: 'cr-1', patientId: 'p-307', amountCents: -9500, reason: 'Checked out unfiled: payment waiting for charges (a-1050)', intents: 'pending charges on enc-9010' }];

    // Roles and SoD rules
    const roleTemplates = [
      { code: 'frontdesk', label: 'Front desk', entitlements: ['schedule', 'post_payment'], clinical: false },
      { code: 'rdh', label: 'RDH (hygienist)', entitlements: ['chart', 'perio', 'note_draft'], clinical: true, licence: 'RDH' },
      { code: 'rda', label: 'RDA (assistant)', entitlements: ['chart_assist', 'note_draft'], clinical: true, licence: 'RDA' },
      { code: 'da', label: 'DA (assistant)', entitlements: ['chart_assist'], clinical: true, licence: 'DA' },
    ];
    const sodRules = [
      { id: 'rule-post-refund', pair: ['post_payment', 'refund'], severity: 'critical', fraudPath: 'Post a fake payment, refund it to your own card.', compensating: 'Dual release on every refund; owner reviews refunds weekly.' },
      { id: 'rule-post-writeoff', pair: ['post_payment', 'write_off'], severity: 'high', fraudPath: 'Pocket cash, write off the balance so the patient never gets a statement.', compensating: 'Write-offs above threshold need a second approver; reason-code digest.' },
      { id: 'rule-deposit-post', pair: ['post_payment', 'prepare_deposit'], severity: 'critical', fraudPath: 'Deposit short; books adjusted to match.', compensating: 'Someone else clears the daily variance; bank feed.' },
      { id: 'rule-reconcile-post', pair: ['post_payment', 'bank_reconcile'], severity: 'critical', fraudPath: 'Reconcile your own postings and hide the gap.', compensating: 'Poster cannot clear the same day; CPA seat.' },
    ];
    const currentGrants = [
      { userId: 'u-om-1', entitlements: ['post_payment', 'refund', 'write_off', 'prepare_deposit', 'approve_second', 'grant_roles', 'close_day'], accepted: { ruleId: 'rule-post-refund', decisionId: 'd-0', reviewBy: '2026-10-01', by: 'Dr. Blake Reagan' } },
    ];

    // Palette synonym catalog (incumbent vocabulary → PMS words)
    const synonyms = [
      { term: 'walkout statement', source: 'Dentrix', target: 'Statement', route: 'money', hint: 'Money Desk → Statements due' },
      { term: 'office journal', source: 'Dentrix', target: 'Audit log (sentences)', route: 'risk', hint: 'Practice → Audit log' },
      { term: 'day sheet', source: 'Eaglesoft', target: 'Daily Close', route: 'close' },
      { term: 'deposit slip', source: 'Eaglesoft', target: 'Daily Close', route: 'close' },
      { term: 'adjustment', source: 'Open Dental', target: 'Write-off or adjustment (needs a reason code)', route: 'money', hint: 'Money Desk → Write-off' },
      { term: 'sidekick', source: 'Curve', target: 'Patient Rail', route: null },
      { term: 'ledger', source: 'all', target: 'Ledger (three numbers and Explain)', route: 'ledger' },
      { term: 'eob', source: 'all', target: 'ERA batch', route: 'money' },
    ];
    const actions = [
      { label: 'Board', route: 'board' }, { label: 'Chairs', route: 'chairs' }, { label: 'Exams to sign', route: 'exams' }, { label: 'Money Desk', route: 'money' }, { label: 'Daily Close', route: 'close' }, { label: 'Roles', route: 'roles' }, { label: 'Practice risk', route: 'risk' }, { label: 'Approvals (phone card)', route: 'phone' },
      { label: 'Close day', route: 'close', irreversible: true }, { label: 'Post matched ERA lines', route: 'money', irreversible: true }, { label: 'Add day pass', route: 'roles' },
    ];

    return { seed: seedNum || 20260903, tenant, locations, users, personaUser, carriers, patients, credentials, appointments, encounters, tags, perioExams, cdt, procedures, estimates, ledger, dayCloses, reconciliation, variances, approvals, decisions, eraBatches, eraLines, claims, statementsDue, credits, roleTemplates, sodRules, currentGrants, synonyms, actions, yesterdayTotals };
  }

  Proto.seed = { build, TODAY, YESTERDAY, CLOSED_DAY };
})();
