#!/usr/bin/env node
/**
 * Why people cancelled, in their words.
 *
 *   node scripts/cancel-reasons.js                 every answer on record
 *   node scripts/cancel-reasons.js --hours 26      only answers from the last 26 hours
 *   node scripts/cancel-reasons.js --hours 26 --mail   and email them to Gio, if there are any
 *
 * The app asks one question the first time it is opened after renewal is
 * turned off (lib/cancelSurvey.js) and stores the answer as RevenueCat
 * customer attributes. This reads them back and sets each beside what that
 * customer actually did: when they first opened the app, when the trial
 * started, whether they ever paid, when they were last seen. With a handful
 * of answers a month, that context is most of the value.
 *
 * --mail is for the daily workflow (.github/workflows/cancel-reasons.yml). It
 * writes to MAIL_TO only, the same inbox the newsletter's failure notices use.
 * It sends nothing when there is nothing new.
 *
 * Needs REVENUECAT_SECRET_KEY (read-only v2 key), from .env.local or the
 * environment.
 */
const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env.local in CI, which is fine */ }

const RC = 'https://api.revenuecat.com/v2/projects/projfc73796b';
// Kept in step with CANCEL_REASONS in lib/cancelSurvey.js by scripts/check.js.
const LABELS = {
  price: 'It costs more than I want to pay',
  usage: 'I wasn’t using it enough',
  expectation: 'It wasn’t what I expected',
  missing: 'Something was missing or didn’t work',
  trying: 'I was only trying it out',
  other: 'Something else',
};

async function rc(p) {
  const url = p.startsWith('http') ? p : (p.startsWith('/v2') ? 'https://api.revenuecat.com' + p : RC + p);
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.REVENUECAT_SECRET_KEY } });
    if (r.status === 429) { await new Promise(z => setTimeout(z, 2500 * (a + 1))); continue; }
    if (!r.ok) throw new Error('RevenueCat HTTP ' + r.status + ' on ' + p.split('?')[0]);
    return r.json();
  }
  throw new Error('RevenueCat rate limit');
}

const day = t => (t ? new Date(t).toISOString().slice(0, 10) : 'unknown');

async function answers(sinceMs) {
  let url = '/customers?limit=100', all = [];
  while (url) { const j = await rc(url); all = all.concat(j.items || []); url = j.next_page || null; }
  // Someone who answered inside the window was, by definition, seen inside it.
  const pool = sinceMs ? all.filter(c => c.last_seen_at >= sinceMs) : all;
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (i < pool.length) {
      const c = pool[i++];
      const id = encodeURIComponent(c.id);
      const attrs = Object.fromEntries(((await rc('/customers/' + id + '/attributes')).items || []).map(x => [x.name, x.value]));
      if (!attrs.cancel_reason) continue;
      const at = Date.parse(attrs.cancel_at || '') || 0;
      if (sinceMs && at < sinceMs) continue;
      const subs = ((await rc('/customers/' + id + '/subscriptions')).items || []).filter(s => s.environment === 'production');
      const first = subs.sort((a, b) => a.starts_at - b.starts_at)[0];
      out.push({
        at, reason: attrs.cancel_reason, note: attrs.cancel_note || '', stage: attrs.cancel_stage || '',
        version: attrs.cancel_version || c.last_seen_app_version || '', country: c.last_seen_country || '',
        firstSeen: c.first_seen_at, lastSeen: c.last_seen_at,
        trialStart: first && first.starts_at,
        paid: subs.reduce((t, s) => t + ((s.total_revenue_in_usd || {}).gross || 0), 0),
        sandbox: !subs.length,
      });
    }
  }));
  return out.sort((a, b) => a.at - b.at);
}

function render(list) {
  return list.map(a => [
    `${day(a.at)}  ${LABELS[a.reason] || a.reason}  (${a.stage || 'stage unknown'}${a.sandbox ? ', test account' : ''})`,
    a.note ? `  "${a.note}"` : '  (no note)',
    `  first opened ${day(a.firstSeen)}, ` + (a.trialStart ? `trial started ${day(a.trialStart)}, ` : '') +
      `last seen ${day(a.lastSeen)}, paid $${a.paid.toFixed(2)}, ${a.country || 'country unknown'}, version ${a.version || 'unknown'}`,
  ].join('\n')).join('\n\n');
}

(async () => {
  if (!process.env.REVENUECAT_SECRET_KEY) throw new Error('REVENUECAT_SECRET_KEY is not set');
  const h = process.argv.indexOf('--hours');
  const hours = h > -1 ? Number(process.argv[h + 1]) : 0;
  const list = await answers(hours ? Date.now() - hours * 3600e3 : 0);
  if (!list.length) { console.log(hours ? `No cancel answers in the last ${hours} hours.` : 'No cancel answers on record yet.'); return; }
  const tally = {};
  for (const a of list) tally[a.reason] = (tally[a.reason] || 0) + 1;
  const body = `${list.length} answer${list.length === 1 ? '' : 's'}` + (hours ? ` in the last ${hours} hours` : ' on record') + '\n\n' +
    Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${String(n).padStart(3)}  ${LABELS[k] || k}`).join('\n') +
    '\n\n' + render(list) + '\n';
  console.log(body);
  if (!process.argv.includes('--mail')) return;
  const { MAIL_USER, MAIL_PASS } = process.env;
  if (!(MAIL_USER && MAIL_PASS)) throw new Error('--mail needs MAIL_USER and MAIL_PASS');
  const transporter = require('nodemailer').createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: MAIL_USER, pass: MAIL_PASS } });
  await transporter.sendMail({
    from: MAIL_USER, to: process.env.MAIL_TO || MAIL_USER,
    subject: `Marcus: ${list.length} cancel answer${list.length === 1 ? '' : 's'} (${day(Date.now())})`,
    text: body + '\nAll answers: node scripts/cancel-reasons.js\n',
  });
  console.log('Emailed to the owner inbox.');
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
