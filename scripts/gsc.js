#!/usr/bin/env node
/**
 * Read Google Search Console for getmarcus.app.
 *
 * WHY THIS EXISTS. The site has 52 indexable pages and, until now, no way to
 * tell which of them earn anything. GA4 is installed but consent-gated, so its
 * numbers are a subset of real traffic, and it does not report search queries
 * or positions at all. Writing more pages without this is writing blind.
 *
 * WHAT IT IS FOR, specifically: the `striking` report. Queries where the site
 * already ranks 11-20 are positions it has earned on merit and is one edit away
 * from converting, because almost nobody clicks page two. That list is the
 * cheapest traffic available on any site, and it cannot be guessed at.
 *
 * READ-ONLY, BY CONSTRUCTION. The scope requested is webmasters.readonly. This
 * cannot submit a sitemap, request indexing, or remove a URL, and it should not
 * be given a scope that can.
 *
 * SETUP. Needs a Google service account with the Search Console API enabled,
 * added as a Restricted user on the property. Then in .env.local:
 *
 *   GSC_KEY_PATH=/Users/you/.gsc/marcus-service-account.json
 *   GSC_PROPERTY=sc-domain:getmarcus.app
 *
 * The key file lives OUTSIDE the repo. It is a private key: it does not go in
 * the project directory, and it never goes in a chat window.
 *
 * USAGE
 *   node scripts/gsc.js queries   [--days 28] [--limit 40]
 *   node scripts/gsc.js pages     [--days 28]
 *   node scripts/gsc.js striking  [--days 28]   queries ranking 11-20
 *   node scripts/gsc.js summary   [--days 28]   all three, compact
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// Same loader as outreach.js: a gitignored file, because shell exports do not
// survive between tool calls and a real env var should still win for CI.
(function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^['"]|['"]$/g, '').trim();
      if (val && !process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch { /* fine */ }
})();

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const b64url = buf => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Service-account JWT, signed RS256. Google's own libraries do this, but the
// whole flow is thirty lines and adding a dependency tree to read one report is
// not a trade worth making.
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = b64url(
    crypto.createSign('RSA-SHA256').update(header + '.' + claims).sign(key.private_key)
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header + '.' + claims + '.' + signature,
    }),
  });
  const j = await res.json();
  if (!j.access_token) {
    throw new Error('token request failed: ' + JSON.stringify(j));
  }
  return j.access_token;
}

function loadKey() {
  const p = process.env.GSC_KEY_PATH;
  if (!p) throw new Error('GSC_KEY_PATH is not set in .env.local');
  if (!fs.existsSync(p)) throw new Error('GSC_KEY_PATH points at a file that does not exist: ' + p);
  // A key inside the repo is a key one `git add -A` away from being public.
  if (path.resolve(p).startsWith(path.resolve(ROOT) + path.sep)) {
    throw new Error('the service account key is inside the repo (' + p + '). Move it outside.');
  }
  const key = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!key.client_email || !key.private_key) {
    throw new Error('that file is not a service account key (no client_email / private_key)');
  }
  return key;
}

const ymd = d => d.toISOString().slice(0, 10);
function dateRange(days) {
  // Search Console data lags by 2-3 days; ending today returns a tail of empty
  // rows that look like a traffic collapse.
  const end = new Date(Date.now() - 3 * 864e5);
  const start = new Date(end.getTime() - (days - 1) * 864e5);
  return { startDate: ymd(start), endDate: ymd(end) };
}

async function query(token, property, body) {
  const url = 'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(property) + '/searchAnalytics/query';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.error) {
    const hint = j.error.code === 403
      ? '\n  The service account is not a user on this property, or the API is not enabled.'
      : j.error.code === 404
      ? '\n  No such property. A domain property is "sc-domain:getmarcus.app"; a URL-prefix one is "https://getmarcus.app/".'
      : '';
    throw new Error('API ' + j.error.code + ': ' + j.error.message + hint);
  }
  return j.rows || [];
}

const pad = (s, n) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s).padEnd(n);
const num = (n, w) => String(Math.round(n)).padStart(w);

function table(rows, label, width) {
  if (!rows.length) return ['  (no data)'];
  const out = ['  ' + pad(label, width) + '  impr  clicks   ctr   pos'];
  for (const r of rows) {
    out.push('  ' + pad(r.keys[0], width) +
      num(r.impressions, 6) + num(r.clicks, 8) +
      (r.ctr * 100).toFixed(1).padStart(6) + '%' +
      r.position.toFixed(1).padStart(6));
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'summary';
  const days = argv.includes('--days') ? Number(argv[argv.indexOf('--days') + 1]) : 28;
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : 40;
  const property = process.env.GSC_PROPERTY;
  if (!property) throw new Error('GSC_PROPERTY is not set in .env.local');

  const token = await accessToken(loadKey());
  const range = dateRange(days);
  console.log('# ' + property + '   ' + range.startDate + ' to ' + range.endDate +
    '  (' + days + ' days, ending 3 days back because the data lags)\n');

  const fetchDim = dim => query(token, property, { ...range, dimensions: [dim], rowLimit: 500 });

  if (cmd === 'queries' || cmd === 'summary') {
    const rows = await fetchDim('query');
    console.log('## Top queries by impressions\n');
    console.log(table(rows.slice(0, cmd === 'summary' ? 15 : limit), 'query', 46).join('\n') + '\n');
  }
  if (cmd === 'pages' || cmd === 'summary') {
    const rows = await fetchDim('page');
    console.log('## Top pages by impressions\n');
    const short = rows.map(r => ({ ...r, keys: [r.keys[0].replace(/^https?:\/\/(www\.)?getmarcus\.app/, '') || '/'] }));
    console.log(table(short.slice(0, cmd === 'summary' ? 15 : limit), 'page', 46).join('\n') + '\n');
  }
  if (cmd === 'striking' || cmd === 'summary') {
    const rows = await fetchDim('query');
    // 11-20. Page two, where the impressions are real and the clicks are not.
    const striking = rows
      .filter(r => r.position > 10.5 && r.position <= 20.5 && r.impressions >= 5)
      .sort((a, b) => b.impressions - a.impressions);
    console.log('## Striking distance: ranking 11-20, so one edit from page one\n');
    console.log(table(striking.slice(0, limit), 'query', 46).join('\n'));
    if (striking.length) {
      const lost = striking.reduce((s, r) => s + r.impressions, 0);
      console.log('\n  ' + striking.length + ' quer(ies), ' + lost +
        ' impressions currently converting at ' +
        (striking.reduce((s, r) => s + r.clicks, 0) / lost * 100).toFixed(1) + '%.');
    }
  }
}

module.exports = { dateRange, table, loadKey };
if (require.main === module) {
  main().catch(e => { console.error('\n' + e.message + '\n'); process.exit(1); });
}
