/* Hash router: #/signin | #/<persona>/<route>[/<id>][?k=v&...] */
(function () {
  const Proto = (window.Proto = window.Proto || {});
  const PERSONAS = ['frontdesk', 'biller', 'hygienist', 'dentist', 'surgeon', 'owner', 'compliance', 'temp'];
  const HOME = { frontdesk: 'board', biller: 'money', hygienist: 'chairs', dentist: 'exams', surgeon: 'exams', owner: 'close', compliance: 'risk', temp: 'board' };
  const LABEL = { frontdesk: 'Front-desk coordinator', biller: 'Office manager / biller', hygienist: 'Hygienist', dentist: 'Dentist', surgeon: 'Oral surgeon', owner: 'Owner', compliance: 'Compliance lead', temp: 'Temp (day pass)' };

  function parse(hash) {
    const h = (hash || location.hash || '#/signin').replace(/^#/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v == null ? '1' : v); });
    if (parts[0] === 'phone') return { persona: (window.__proto && window.__proto.persona) || 'owner', route: 'phone', id: parts[1] || 'approvals', query, raw: h };
    if (!parts.length || parts[0] === 'signin') return { persona: null, route: 'signin', id: null, query, raw: h };
    const persona = PERSONAS.includes(parts[0]) ? parts[0] : null;
    if (!persona) return { persona: null, route: 'signin', id: null, query, raw: h };
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
