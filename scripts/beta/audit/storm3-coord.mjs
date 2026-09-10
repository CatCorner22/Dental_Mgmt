// Round-3 coordinator checks: leftovers the fixers reported under "Needs elsewhere" after their own files were done.
// Default position is NOT reproduced; every check carries its precondition values and closes its context in `finally`.
export default ({ ctx, go, click, state, rec }) => {
  const tid = (t) => `[data-testid="${t}"]`;

  return {
    // postCheckout's held branch carried the whole Checkout form (PIN included) inside pendingRequest, and requestApproval
    // spread it into the approvals row, so a shared-desk PIN was written to a table. Negative control: the row that a
    // PIN-posted request writes carries neither `form` nor `pin`, while the request itself still lands.
    async 'A-storm3-coord-1'(b) {
      const { c, p } = await ctx(b);
      try {
        await go(p, '#/frontdesk/checkout/a-1047?device=shared');
        await click(p, 'checkout.tender.card'); await p.fill(tid('checkout.amount'), '100');
        await click(p, 'checkout.writeoff.add'); await p.fill(tid('checkout.writeoff.amount'), '300'); await click(p, 'checkout.writeoff.reason.courtesy');
        await p.fill(tid('checkout.pin'), '2468'); await click(p, 'checkout.post'); await p.waitForTimeout(150);
        if (await p.$(tid('refusal.control'))) { await click(p, 'refusal.control'); await p.waitForTimeout(150); }
        const S = await state(p);
        const req = S.approvals[0] || null;
        const leaked = req ? JSON.stringify(req).includes('"pin"') || Object.prototype.hasOwnProperty.call(req, 'form') : false;
        rec('A-storm3-coord-1', 'A write-off request posted with the shared-desk PIN writes an approvals row that carries the Checkout form and the PIN inside it', 'docs/13 feature 24 PHI and credentials (a PIN is verified, never stored); store.js requestApproval / postCheckout pendingRequest',
          !!req && leaked, { request: req && { id: req.id, requestedById: req.requestedById, keys: Object.keys(req) }, leaked });
      } finally { await c.close(); }
    },
  };
};
