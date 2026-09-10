/* Hash router: #/signin | #/<persona>/<route>[/<id>][?k=v&...] */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  // Every persona the seed maps to a user (seed.personaUser) must be routable: the PIN pad switches the author
  // by setting `#/<persona>/...`, and a persona the router does not know falls through to sign-in after the
  // session row has already been written.
  const PERSONAS = ['frontdesk', 'biller', 'hygienist', 'assistant', 'dentist', 'surgeon', 'owner', 'compliance', 'temp'];
  const HOME = { frontdesk: 'board', biller: 'money', hygienist: 'chairs', assistant: 'board', dentist: 'exams', surgeon: 'exams', owner: 'close', compliance: 'risk', temp: 'board' };
  const LABEL = { frontdesk: 'Front-desk coordinator', biller: 'Office manager / biller', hygienist: 'Hygienist', assistant: 'Dental assistant', dentist: 'Dentist', surgeon: 'Oral surgeon', owner: 'Owner', compliance: 'Compliance lead', temp: 'Temp (day pass)' };

  function parse(hash) {
    const h = (hash || location.hash || '#/signin').replace(/^#/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    // A malformed escape in the address threw out of parse(), and every listener on the page went with it.
    const unescape = (s) => { try { return decodeURIComponent(s); } catch { return String(s); } };
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[unescape(k)] = unescape(v == null ? '1' : v); });
    if (parts[0] === 'phone') return { persona: (window.__proto && window.__proto.persona) || 'owner', route: 'phone', id: parts[1] || 'approvals', query, raw: h };
    // Case is not identity: #/FRONTDESK/board is the Board. A first segment that names no persona is not
    // sign-in either; it is nowhere, and says so instead of dropping the working screen for the picker.
    const head = String(parts[0] || '').toLowerCase();
    if (!parts.length || head === 'signin') return { persona: null, route: 'signin', id: null, query, raw: h };
    const persona = PERSONAS.includes(head) ? head : null;
    if (!persona) return { persona: null, route: 'notfound', id: null, query, raw: h };
    return { persona, route: parts[1] || HOME[persona], id: parts[2] || null, query, raw: h };
  }

  function go(persona, route, id, query) {
    let h = '#/' + persona + '/' + route + (id ? '/' + id : '');
    if (query && Object.keys(query).length) h += '?' + Object.entries(query).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    if (location.hash === h) { Proto.router.render(); } else { location.hash = h; }
  }

  const handlers = {};
  Proto.router = {
    PERSONAS, HOME, LABEL, parse, go,
    on(route, fn) { handlers[route] = fn; },
    render() {
      const r = parse();
      const fn = handlers[r.route] || handlers.notfound;
      if (fn) fn(r);
    },
    current() { return parse(); },
    announce(text) { const live = document.getElementById('live'); if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 10); } },
  };
})();
