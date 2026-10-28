#!/usr/bin/env node
/**
 * The subscriber funnel in one read-only report.
 *
 *   node scripts/funnel.js            last 28 days
 *   node scripts/funnel.js --days=7
 *
 * Three sources, each answering a different question:
 *
 *   App Store search rank   can people find it? (iTunes Search API, no key)
 *   App Store analytics     do they open the page and download? (Analytics
 *                           Reports API, ASC key with the Sales role; Apple
 *                           takes a day or two to produce the first reports
 *                           after the request is made, so early runs say so)
 *   RevenueCat              do they start a trial, and does it convert?
 *
 * Built in October 2026, when the answer was: ~40 downloads a month, 5 trials
 * from 81 users ever, one paid month, and a search rank outside the top 100
 * for every category term. Everything done since is measured against that.
 *
 * Keys come from .env.local (REVENUECAT_SECRET_KEY, ASC_SALES_KEY_ID,
 * ASC_SALES_KEY_PATH) and are never printed. Nothing here writes anywhere.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const APP_ID = 6789749038;
const RC_PROJECT = 'projfc73796b';
const ASC_ISSUER = 'c0a86229-2a0a-48ea-9626-35f9da6c083b';
const TERMS = ['stoic', 'stoicism', 'stoic journal', 'daily stoic', 'stoic quotes', 'stoic app',
  'stoic philosophy', 'marcus aurelius', 'meditations marcus aurelius'];
const DAYS = Number((process.argv.find(a => a.startsWith('--days=')) || '=28').split('=')[1]);
const since = new Date(Date.now() - DAYS * 864e5);

// ── search rank ─────────────────────────────────────────────────────────────
async function ranks() {
  const out = [];
  for (const t of TERMS) {
    const r = await (await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(t)}&entity=software&country=us&limit=200`)).json();
    const i = r.results.findIndex(a => a.trackId === APP_ID);
    out.push([t, i === -1 ? `not in top ${r.results.length}` : `#${i + 1}`]);
  }
  return out;
}

// ── App Store Connect analytics ─────────────────────────────────────────────
function ascToken() {
  const key = fs.readFileSync(process.env.ASC_SALES_KEY_PATH);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: process.env.ASC_SALES_KEY_ID, typ: 'JWT' });
  const body = b64({ iss: ASC_ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return head + '.' + body + '.' + sig;
}
async function asc(p) {
  const url = p.startsWith('http') ? p : 'https://api.appstoreconnect.apple.com' + p;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + ascToken() } });
  if (!r.ok) throw new Error(`ASC ${r.status} on ${p}`);
  return r.json();
}

// Sums one numeric column of a daily report over the window, grouped by an
// optional column (e.g. Event). Reports arrive as gzipped TSV segments.
async function dailyReport(name) {
  const reqs = await asc(`/v1/apps/${APP_ID}/analyticsReportRequests`);
  const req = reqs.data.find(x => x.attributes.accessType === 'ONGOING');
  if (!req) return { missing: 'no ongoing analytics request' };
  const reports = await asc(`/v1/analyticsReportRequests/${req.id}/reports?filter[name]=${encodeURIComponent(name)}`);
  if (!reports.data.length) return { missing: 'Apple has not produced this report yet' };
  const rows = [];
  let next = `/v1/analyticsReports/${reports.data[0].id}/instances?filter[granularity]=DAILY&limit=200`;
  while (next) {
    const inst = await asc(next);
    for (const i of inst.data) {
      if (new Date(i.attributes.processingDate) < since) continue;
      const segs = await asc(`/v1/analyticsReportInstances/${i.id}/segments`);
      for (const s of segs.data) {
        const gz = Buffer.from(await (await fetch(s.attributes.url)).arrayBuffer());
        const [head, ...lines] = zlib.gunzipSync(gz).toString('utf8').trim().split('\n').map(l => l.split('\t'));
        for (const l of lines) rows.push(Object.fromEntries(head.map((h, k) => [h, l[k]])));
      }
    }
    next = inst.links && inst.links.next;
  }
  if (!rows.length) return { missing: 'no daily instances in the window yet' };
  return { rows };
}

async function storeFunnel() {
  if (!process.env.ASC_SALES_KEY_PATH) return { missing: 'ASC_SALES_KEY_PATH not set' };
  const out = {};
  const disc = await dailyReport('App Store Discovery and Engagement Standard');
  if (disc.rows) {
    for (const r of disc.rows) {
      const k = r['Event'] || 'events';
      out[k] = (out[k] || 0) + Number(r['Counts'] || r['Count'] || 0);
    }
  } else out.discovery = disc.missing;
  const dl = await dailyReport('App Downloads Standard');
  if (dl.rows) {
    for (const r of dl.rows) {
      const k = 'downloads: ' + (r['Download Type'] || 'all');
      out[k] = (out[k] || 0) + Number(r['Counts'] || r['Count'] || 0);
    }
  } else out.downloads = dl.missing;
  return out;
}

// ── RevenueCat ──────────────────────────────────────────────────────────────
async function rc(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://api.revenuecat.com/v2/projects/${RC_PROJECT}${p}`,
      { headers: { Authorization: 'Bearer ' + process.env.REVENUECAT_SECRET_KEY } });
    if (r.status === 429) { await new Promise(z => setTimeout(z, 3000)); continue; }
    return r.json();
  }
  throw new Error('RevenueCat rate limit');
}

async function subscriptions() {
  const overview = Object.fromEntries(((await rc('/metrics/overview')).metrics || []).map(m => [m.id, m.value]));
  const customers = [];
  let next = '/customers?limit=100';
  while (next) {
    const c = await rc(next);
    customers.push(...(c.items || []));
    next = c.next_page ? c.next_page.replace(/^.*\/projects\/[^/]+/, '') : null;
  }
  const recent = customers.filter(c => new Date(c.last_seen_at) >= since);
  let trials = 0, paid = 0, lifetime = 0;
  for (const c of recent) {
    const subs = await rc(`/customers/${encodeURIComponent(c.id)}/subscriptions`);
    for (const s of subs.items || []) {
      if (s.environment !== 'production' || new Date(s.starts_at) < since) continue;
      trials++;
      if (s.total_revenue_in_usd && s.total_revenue_in_usd.gross > 0) paid++;
    }
    const buys = await rc(`/customers/${encodeURIComponent(c.id)}/purchases`);
    for (const b of buys.items || []) {
      if (b.environment === 'production' && new Date(b.purchased_at) >= since) lifetime++;
    }
  }
  return { overview, activeInWindow: recent.length, trials, paid, lifetime };
}

(async () => {
  console.log(`# Marcus funnel, last ${DAYS} days (to ${new Date().toISOString().slice(0, 10)})\n`);
  console.log('## Can people find it? (App Store search, US)\n');
  for (const [t, r] of await ranks()) console.log(`  ${t.padEnd(28)} ${r}`);
  console.log('\n## Do they look and download? (App Store analytics)\n');
  try {
    for (const [k, v] of Object.entries(await storeFunnel())) console.log(`  ${k.padEnd(28)} ${v}`);
  } catch (e) { console.log('  unavailable: ' + e.message); }
  console.log('\n## Do they try and pay? (RevenueCat, production only)\n');
  const s = await subscriptions();
  console.log(`  users active in window       ${s.activeInWindow}`);
  console.log(`  subscriptions started        ${s.trials}  (trials, or straight to paid)`);
  console.log(`  ...that have paid            ${s.paid}`);
  console.log(`  lifetime purchases           ${s.lifetime}`);
  console.log(`  active trials now            ${s.overview.active_trials ?? '?'}`);
  console.log(`  active subscriptions now     ${s.overview.active_subscriptions ?? '?'}`);
  console.log(`  MRR                          $${s.overview.mrr ?? '?'}`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
