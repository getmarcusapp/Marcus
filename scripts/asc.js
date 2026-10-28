#!/usr/bin/env node
/**
 * Minimal App Store Connect API client (ES256 JWT), for one-off reads and the
 * release steps done from the terminal: metadata, in-app purchases, builds,
 * review submissions. Used by hand and by other scripts; prints nothing secret.
 *
 *   node scripts/asc.js /v1/apps/6789749038/appStoreVersions     GET and print
 *   ASC_KEY=sales node scripts/asc.js <path>                     use the Sales-role key
 *
 * Keys: the release key from eas.json (App Manager) by default; the Sales key
 * (analytics and sales reports) from ASC_SALES_KEY_ID / ASC_SALES_KEY_PATH in
 * .env.local. Two things the API cannot do, learned the hard way in Oct 2026:
 * read analytics with the App Manager key (403), and attach an app's FIRST
 * non-consumable in-app purchase to a version (STATE_ERROR.FIRST_NON_CONSUMABLE
 * _MUST_BE_SUBMITTED_ON_VERSION). That one is a checkbox in the web UI.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const ISSUER = 'c0a86229-2a0a-48ea-9626-35f9da6c083b';

function key() {
  if (process.env.ASC_KEY === 'sales') return { id: process.env.ASC_SALES_KEY_ID, file: process.env.ASC_SALES_KEY_PATH };
  const ios = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8')).submit.production.ios;
  return { id: ios.ascApiKeyId, file: ios.ascApiKeyPath };
}

function jwt() {
  const k = key();
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: k.id, typ: 'JWT' });
  const p = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: fs.readFileSync(k.file), dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return h + '.' + p + '.' + sig;
}

async function api(p, opts = {}) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + p, {
    ...opts, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
}

module.exports = { api };
if (require.main === module) {
  api(process.argv[2]).then(r => console.log(r.status, JSON.stringify(r.body, null, 1)));
}
