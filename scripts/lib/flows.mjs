/* The five daily flows as keyboard-only sequences over data-testids (CONTRACTS.md §7).
   Shared by scripts/proto-check.mjs and offered to the panel as the reference path.
   Step kinds: {press: testid} focuses the element by testid and presses Enter (counts as a tap);
   {keys: 'string'} types raw keys (each a keystroke, not a tap); {key: 'ArrowRight'} one named key;
   {route: '#/...'} navigates; {fill: [testid, text]} focuses and types into a field (keystrokes);
   {expect: (state, events) => boolean|string} asserts on the store snapshot (string = failure reason). */
export const FLOWS = [
  {
    id: 'checkin', name: 'Check-in', budgetTaps: 1, persona: 'frontdesk', start: '#/frontdesk/board',
    steps: [
      { press: 'board.card.a-1042.arrive' },
      { expect: (s) => s.appointments.find((a) => a.id === 'a-1042').status === 'arrived' || 'a-1042 not arrived' },
    ],
  },
  {
    id: 'perio', name: 'Perio, full mouth, one operator', budgetTaps: 2, budgetKeystrokes: 200, persona: 'hygienist', start: '#/hygienist/chairs',
    steps: [
      { press: 'chairs.card.a-1042.perio' },
      { keys: '323'.repeat(56) }, // 168 digits over 28 present teeth × 6 sites
      { press: 'perio.save' },
      { expect: (s) => (s.perioExams.some((e) => e.encounterId === 'enc-9001' && e.probed >= 160) || 'perio exam not saved with ≥160 sites') },
    ],
  },
  {
    id: 'chart', name: 'Chart + plan + note + File', budgetTaps: 10, persona: 'dentist', start: '#/dentist/exams',
    steps: [
      { press: 'exams.row.enc-9002.open' },
      { press: 'enc.tag.tag-1.chart' },
      { press: 'enc.surface.30.d' },
      { press: 'enc.surface.30.o' },
      { press: 'enc.proc.d2392' },
      { press: 'enc.note.starter.0' },
      { press: 'enc.file' },
      { press: 'refusal.control', optional: true }, // read-back confirm
      { expect: (s) => (s.filedNotes.some((n) => n.encounterId === 'enc-9002') || 'note not filed') },
      { expect: (s) => (s.ledger.some((e) => e.kind === 'charge' && e.patientId === 'p-302' && e.amountCents === 26000) || 'charge not released') },
    ],
  },
  {
    id: 'checkout', name: 'Checkout + payment', budgetTaps: 4, persona: 'frontdesk', start: '#/frontdesk/board',
    steps: [
      { press: 'board.card.a-1044.checkout' },
      { press: 'checkout.tender.card' },
      { fill: ['checkout.card.number', '4242424242424242'] },
      { press: 'checkout.post' },
      { expect: (s) => (s.collectionDecisions.some((d) => d.encounterId === 'enc-9003' && d.decision === 'collect') || 'no collect decision') },
      { expect: (s) => (s.ledger.some((e) => e.kind === 'patient_payment' && e.patientId === 'p-303' && e.amountCents === -4400) || 'payment not posted') },
    ],
  },
  {
    id: 'eraClose', name: 'Post ERAs + close the day', budgetTaps: 6, persona: 'biller', start: '#/biller/money',
    steps: [
      { press: 'money.era.era-1.postmatched' },
      { press: 'money.era.line.el-14.confirm' },
      { press: 'money.era.line.el-22.confirm' },
      { press: 'money.era.line.el-31.hold' },
      { route: '#/owner/close' },
      { press: 'close.closeday' },
      { press: 'close.closeday.confirm' },
      { expect: (s) => (s.dayCloses.some((d) => d.date === '2026-09-03' && d.locationId === 'loc-1') || 'day not closed') },
      { expect: (s) => (s.eraLines.find((l) => l.id === 'el-14').status === 'posted' || 'el-14 not posted') },
    ],
  },
];
