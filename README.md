# jordanforfisd.com

Campaign site for Stephen Jordan, Frisco ISD Board of Trustees.

- `public/` static site. `index.html`, `app.js` (3D budget model, table, signup), `budget.json` (General Fund appropriations by function, 2022-23 to 2026-27, from the District's published budget workbooks).
- `src/worker.js` serves `public/` and handles `POST /api/signup`, storing one record per email in KV namespace `jordanforfisd-signups`.
- Pre-launch: `robots.txt` disallows all, every page has a noindex meta tag, and `_headers` sends `X-Robots-Tag: noindex`. Remove all three at launch.

Read signups: `npx wrangler kv key list --binding SIGNUPS --remote`
