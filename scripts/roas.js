#!/usr/bin/env node
/**
 * Return on Apple Ads spend, by campaign and keyword.
 *
 *   node scripts/roas.js [--since 2026-10-27]
 *
 * Apple Ads reports spend, taps and installs, never revenue: it cannot see
 * what happens inside the app. RevenueCat can, and it tags each customer with
 * the campaign and keyword that brought them (AdServices attribution, enabled
 * in store/purchases.js). This joins the two.
 *
 * READ IT CAUTIOUSLY. Revenue here is what has been collected so far. A
 * Lifetime purchase is counted in full the day it happens; a subscription
 * only as each period is paid, and a trial that has not converted yet counts
 * as nothing. Early on, ROAS understates subscriptions and flatters Lifetime.
 * Cost per trial is the steadier signal while volumes are small.
 *
 * "proceeds" is revenue after Apple's commission and tax: what Harvana is
 * paid. ROAS uses proceeds.
 */
const fs = require('fs');
const path = require('path');
const { api: adsApi } = require('./appleads');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const RC_KEY = process.env.REVENUECAT_SECRET_KEY;
const RC = 'https://api.revenuecat.com';
const PROJECT = '/v2/projects/projfc73796b';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SINCE = arg('--since', '2026-10-27'); // the day Gio handed over the account
const sinceMs = Date.parse(SINCE + 'T00:00:00Z');

async function rc(url) {
  const full = url.startsWith('http') ? url : RC + (url.startsWith('/v2') ? url : PROJECT + url);
  for (let a = 0; a < 5; a++) {
    const r = await fetch(full, { headers: { Authorization: 'Bearer ' + RC_KEY } });
    if (r.status === 429) { await new Promise(z => setTimeout(z, 2000 * (a + 1))); continue; }
    return r.json();
  }
  throw new Error('RevenueCat rate limit: ' + url);
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function customers() {
  let url = '/customers?limit=100', all = [];
  while (url) { const j = await rc(url); all = all.concat(j.items || []); url = j.next_page || null; }
  return all.filter(c => c.first_seen_at >= sinceMs);
}

async function customerDetail(c) {
  const id = encodeURIComponent(c.id);
  const [attrs, subs, buys] = await Promise.all([
    rc('/customers/' + id + '/attributes'), rc('/customers/' + id + '/subscriptions'), rc('/customers/' + id + '/purchases'),
  ]);
  const a = Object.fromEntries((attrs.items || []).map(x => [x.name, x.value]));
  const prodSubs = (subs.items || []).filter(s => s.environment === 'production');
  const prodBuys = (buys.items || []).filter(p => p.environment === 'production');
  const money = k => prodSubs.reduce((t, s) => t + ((s.total_revenue_in_usd || {})[k] || 0), 0) +
    prodBuys.reduce((t, p) => t + ((p.revenue_in_usd || {})[k] || 0), 0);
  return {
    source: a.$mediaSource || '', campaign: a.$campaign || '', keyword: a.$keyword || '',
    trial: prodSubs.length > 0 || prodBuys.length > 0, // started: a subscription (trial or paid) or a Lifetime purchase
    paid: money('gross') > 0,
    gross: money('gross'), proceeds: money('proceeds'),
  };
}

const day = d => d.toISOString().slice(0, 10);
async function adSpend() {
  const body = {
    startTime: SINCE, endTime: day(new Date()), timeZone: 'ORTZ', returnRowTotals: true,
    selector: { orderBy: [{ field: 'localSpend', sortOrder: 'DESCENDING' }], pagination: { offset: 0, limit: 1000 } },
  };
  const camps = (await adsApi('POST', '/reports/campaigns', body)).data.reportingDataResponse.row;
  const out = { campaigns: {}, keywords: {} };
  for (const r of camps) {
    const name = r.metadata.campaignName;
    out.campaigns[name] = { spend: +(r.total.localSpend || {}).amount || 0, installs: r.total.totalInstalls || 0 };
    try {
      const k = await adsApi('POST', `/reports/campaigns/${r.metadata.campaignId}/keywords`, body);
      for (const kr of k.data.reportingDataResponse.row || []) {
        const key = name + ' | ' + kr.metadata.keyword;
        out.keywords[key] = { spend: +(kr.total.localSpend || {}).amount || 0, installs: kr.total.totalInstalls || 0 };
      }
    } catch { /* campaigns without keywords (Product Pages) */ }
  }
  return out;
}

function table(title, spendMap, rows, keyOf) {
  const agg = {};
  for (const r of rows) {
    const k = keyOf(r); if (!k) continue;
    const a = agg[k] || (agg[k] = { users: 0, trials: 0, payers: 0, gross: 0, proceeds: 0 });
    a.users++; a.trials += r.trial; a.payers += r.paid; a.gross += r.gross; a.proceeds += r.proceeds;
  }
  const keys = [...new Set([...Object.keys(spendMap), ...Object.keys(agg)])]
    .sort((x, y) => ((spendMap[y] || {}).spend || 0) - ((spendMap[x] || {}).spend || 0));
  const $ = n => '$' + n.toFixed(2);
  console.log('\n## ' + title + '\n');
  console.log('  ' + 'name'.padEnd(46) + 'spend'.padStart(9) + 'inst'.padStart(6) + 'users'.padStart(7) + 'started'.padStart(8) +
    'payers'.padStart(8) + 'proceeds'.padStart(10) + 'ROAS'.padStart(7) + '  $/start');
  for (const k of keys) {
    const s = spendMap[k] || { spend: 0, installs: 0 }, a = agg[k] || { users: 0, trials: 0, payers: 0, proceeds: 0 };
    if (!s.spend && !a.users) continue;
    console.log('  ' + k.slice(0, 45).padEnd(46) + $(s.spend).padStart(9) + String(s.installs).padStart(6) + String(a.users).padStart(7) +
      String(a.trials).padStart(8) + String(a.payers).padStart(8) + $(a.proceeds).padStart(10) +
      (s.spend ? (a.proceeds / s.spend).toFixed(2) + 'x' : '-').padStart(7) +
      '  ' + (a.trials ? $(s.spend / a.trials) : '-'));
  }
}

(async () => {
  const [cust, spend] = await Promise.all([customers(), adSpend()]);
  const rows = await pool(cust, 6, customerDetail);
  const ads = rows.filter(r => /apple search ads/i.test(r.source));
  const totalSpend = Object.values(spend.campaigns).reduce((t, c) => t + c.spend, 0);
  const sum = (l, k) => l.reduce((t, r) => t + (typeof r[k] === 'boolean' ? +r[k] : r[k]), 0);
  console.log(`# Apple Ads return, ${SINCE} to today\n`);
  console.log(`  Spend $${totalSpend.toFixed(2)} · ${ads.length} attributed users · ${sum(ads, 'trial')} trials or purchases started · ` +
    `${sum(ads, 'paid')} paying · proceeds $${sum(ads, 'proceeds').toFixed(2)} (gross $${sum(ads, 'gross').toFixed(2)})`);
  console.log(`  ROAS ${(sum(ads, 'proceeds') / totalSpend).toFixed(2)}x on proceeds · ` +
    `all new users this period: ${rows.length}, of which ${rows.length - ads.length} not from ads (proceeds $${(sum(rows, 'proceeds') - sum(ads, 'proceeds')).toFixed(2)})`);
  table('By campaign', spend.campaigns, ads, r => r.campaign);
  table('By keyword', spend.keywords, ads, r => r.campaign && r.keyword ? r.campaign + ' | ' + r.keyword : '');
  console.log('\n  Revenue to date only: Lifetime counts in full, subscriptions as paid, unconverted trials as $0.');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
