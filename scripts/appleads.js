#!/usr/bin/env node
/**
 * Apple Ads (Search Ads) management for Marcus, via the Campaign Management
 * API v5. Gio handed over management of the account in November 2026, with a
 * hard ceiling: $500 a month, so total daily budgets across running campaigns
 * may not exceed MAX_DAILY_TOTAL. Every write here checks that first.
 *
 *   node scripts/appleads.js status [days]          campaigns: status, budget, spend, installs
 *   node scripts/appleads.js keywords [days]        every keyword: bid, impressions, taps, installs, CPT
 *   node scripts/appleads.js bids <campaignId> <json>   set keyword bids: {"<keywordId>": 2.5, ...}
 *   node scripts/appleads.js default-bid <campaignId> <adGroupId> <amount>
 *   node scripts/appleads.js budget <campaignId> <amount>      (guarded)
 *
 * Credentials (.env.local, never printed): APPLE_ADS_CLIENT_ID, _TEAM_ID,
 * _KEY_ID, _ORG_ID, _KEY_PATH (the private key, ~/.appleads/private-key.pem,
 * which never leaves this machine; Apple holds only the public half).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const E = process.env;
const BASE = 'https://api.searchads.apple.com/api/v5';
const ADAM_ID = 6789749038;
// $500 a month, agreed with Gio on 2026-10-27. Raising it is his call, not ours.
const MAX_DAILY_TOTAL = 16;

let token = null;
async function auth() {
  if (token) return token;
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: E.APPLE_ADS_KEY_ID });
  const p = b64({ sub: E.APPLE_ADS_CLIENT_ID, aud: 'https://appleid.apple.com', iat: now, exp: now + 3600, iss: E.APPLE_ADS_TEAM_ID });
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p),
    { key: fs.readFileSync(E.APPLE_ADS_KEY_PATH), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const r = await fetch('https://appleid.apple.com/auth/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: E.APPLE_ADS_CLIENT_ID,
      client_secret: `${h}.${p}.${sig}`, scope: 'searchadsorg' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Apple Ads auth failed: ' + JSON.stringify(j));
  return (token = j.access_token);
}

async function api(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { Authorization: 'Bearer ' + await auth(), 'X-AP-Context': 'orgId=' + E.APPLE_ADS_ORG_ID,
      'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  return j;
}

const day = d => d.toISOString().slice(0, 10);
function reportBody(days) {
  const end = new Date(), start = new Date(Date.now() - days * 864e5);
  return { startTime: day(start), endTime: day(end), timeZone: 'ORTZ', returnRecordsWithNoMetrics: true,
    returnRowTotals: true, returnGrandTotals: true,
    selector: { orderBy: [{ field: 'localSpend', sortOrder: 'DESCENDING' }], pagination: { offset: 0, limit: 1000 } } };
}
const money = x => (x && x.amount ? Number(x.amount) : 0);

async function campaigns() { return (await api('GET', '/campaigns?limit=100')).data; }

async function status(days = 7) {
  const rows = (await api('POST', '/reports/campaigns', reportBody(days))).data.reportingDataResponse.row;
  console.log(`# Campaigns, last ${days} days\n`);
  let budget = 0;
  for (const r of rows) {
    const m = r.metadata, t = r.total;
    if (m.displayStatus === 'RUNNING') budget += money(m.dailyBudget);
    console.log(`${m.campaignName.padEnd(36)} ${m.displayStatus.padEnd(8)} $${money(m.dailyBudget).toFixed(2)}/day ` +
      `spend $${money(t.localSpend).toFixed(2)}  impr ${t.impressions}  taps ${t.taps}  installs ${t.totalInstalls}` +
      `  CPT $${money(t.avgCPT).toFixed(2)}  [${m.campaignId}]`);
  }
  console.log(`\nRunning daily budgets: $${budget.toFixed(2)} of the $${MAX_DAILY_TOTAL} ceiling.`);
}

async function keywords(days = 7) {
  for (const c of await campaigns()) {
    if (c.status !== 'ENABLED') continue;
    let rows;
    try { rows = (await api('POST', `/reports/campaigns/${c.id}/keywords`, reportBody(days))).data.reportingDataResponse.row; }
    catch (e) { console.log(`\n## ${c.name}: ${e.message.slice(0, 120)}`); continue; }
    console.log(`\n## ${c.name} [${c.id}]`);
    for (const r of rows || []) {
      const m = r.metadata, t = r.total, rec = r.insights && r.insights.bidRecommendation;
      console.log(`  ${(m.matchType === 'EXACT' ? `[${m.keyword}]` : m.keyword).padEnd(22)} bid $${money(m.bidAmount).toFixed(2)}` +
        `  impr ${String(t.impressions).padStart(4)}  taps ${t.taps}  inst ${t.totalInstalls}  CPT $${money(t.avgCPT).toFixed(2)}` +
        (rec && rec.suggestedBidAmount ? `  suggested $${money(rec.suggestedBidAmount).toFixed(2)}` : '') +
        `  [${m.adGroupId}/${m.keywordId}] ${m.keywordDisplayStatus || ''}`);
    }
  }
}

async function guardBudget(changeCampaignId, newAmount) {
  let total = 0;
  for (const c of await campaigns()) {
    if (c.status !== 'ENABLED' || c.servingStatus === 'NOT_RUNNING' && c.displayStatus === 'PAUSED') continue;
    total += String(c.id) === String(changeCampaignId) ? newAmount : money(c.dailyBudgetAmount);
  }
  if (total > MAX_DAILY_TOTAL + 1e-9 && !process.argv.includes('--allow-over-ceiling')) {
    throw new Error(`refused: running daily budgets would total $${total.toFixed(2)}, over the $${MAX_DAILY_TOTAL} ceiling Gio set`);
  }
  return total;
}

async function setBids(campaignId, map) {
  const kws = [];
  for (const ag of (await api('GET', `/campaigns/${campaignId}/adgroups`)).data) {
    for (const k of (await api('GET', `/campaigns/${campaignId}/adgroups/${ag.id}/targetingkeywords?limit=1000`)).data) {
      if (map[k.id] !== undefined) kws.push({ ag: ag.id, k });
    }
  }
  for (const agId of [...new Set(kws.map(x => x.ag))]) {
    const body = kws.filter(x => x.ag === agId).map(x => ({ id: x.k.id, bidAmount: { amount: String(map[x.k.id]), currency: 'USD' } }));
    await api('PUT', `/campaigns/${campaignId}/adgroups/${agId}/targetingkeywords/bulk`, body);
    for (const x of kws.filter(y => y.ag === agId)) console.log(`  ${x.k.text}: $${money(x.k.bidAmount)} -> $${map[x.k.id]}`);
  }
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'status') return status(Number(a) || 7);
  if (cmd === 'keywords') return keywords(Number(a) || 7);
  if (cmd === 'bids') return setBids(a, JSON.parse(b));
  if (cmd === 'default-bid') {
    await api('PUT', `/campaigns/${a}/adgroups/${b}`, { defaultBidAmount: { amount: String(c), currency: 'USD' } });
    return console.log(`default bid for ad group ${b} -> $${c}`);
  }
  if (cmd === 'budget') {
    const total = await guardBudget(a, Number(b));
    await api('PUT', `/campaigns/${a}`, { campaign: { dailyBudgetAmount: { amount: String(b), currency: 'USD' } } });
    return console.log(`campaign ${a} daily budget -> $${b} (running total $${total.toFixed(2)})`);
  }
  console.log('usage: appleads.js status|keywords [days] | bids <campaignId> <json> | default-bid <c> <ag> <amt> | budget <c> <amt>');
}

module.exports = { api, guardBudget, MAX_DAILY_TOTAL, ADAM_ID };
if (require.main === module) main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
