// Serves the static site, and stores campaign signups in KV.
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/signup') {
      if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
      let b;
      try { b = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400); }
      if (b.company) return json({ ok: true }); // honeypot: quietly drop bots
      const name = String(b.name || '').trim().slice(0, 120);
      const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Name and a valid email are required.' }, 400);
      const help = Array.isArray(b.help) ? b.help.filter((h) => ['volunteer', 'yard_sign', 'host'].includes(h)) : [];
      const record = {
        name, email, zip: String(b.zip || '').trim().slice(0, 10), help,
        at: new Date().toISOString(), country: request.cf?.country || null,
      };
      // one key per email so repeat signups update rather than duplicate
      await env.SIGNUPS.put(`signup:${email}`, JSON.stringify(record));
      return json({ ok: true });
    }
    return env.ASSETS.fetch(request);
  },
};
