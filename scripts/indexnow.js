#!/usr/bin/env node
// IndexNow submitter.  `npm run indexnow`
//
// Pushes every indexable URL at the participating search engines instead of
// waiting to be crawled. One POST covers Bing, Yandex, Seznam and Naver, which
// share the protocol.
//
// GOOGLE DOES NOT PARTICIPATE. Google is still crawl-scheduled, and for that
// the levers are inbound links and GSC's Request Indexing. Do not read a 200
// here as "submitted to Google", because it is not.
//
// Bing matters for more than Bing: it backs ChatGPT search and Copilot answers,
// so this is the fastest route to being citable by an answer engine, which is
// most of the point of the schema work on these pages.
//
// The URL list is read from the built sitemap so this can never drift from it.
// Run after a deploy, since the engines fetch what they are told about, and a
// URL that 404s on arrival is worse than one never submitted.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST = 'getmarcus.app';
const KEY = '269f50a6e7aaea328192caa18dc28f3f';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // The key file has to be live and byte-identical or every submission 403s,
  // and the failure is silent from the caller's side. Check before submitting.
  const local = path.join(ROOT, 'public', `${KEY}.txt`);
  if (!fs.existsSync(local) || fs.readFileSync(local, 'utf8').trim() !== KEY) {
    console.error(`✗ public/${KEY}.txt is missing or does not contain the key`);
    process.exit(1);
  }

  const urlList = sitemapUrls();
  console.log(`${urlList.length} URL(s) from public/sitemap.xml`);

  if (!dryRun) {
    const res = await fetch(KEY_LOCATION);
    const served = (await res.text()).trim();
    if (!res.ok || served !== KEY) {
      console.error(`✗ ${KEY_LOCATION} served ${res.status} "${served.slice(0, 40)}"`);
      console.error('  Deploy the key file before submitting, or the engines reject the batch.');
      process.exit(1);
    }
    console.log('✓ key file live and correct');
  }

  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
  if (dryRun) {
    console.log('--dry-run, not submitting. Payload:');
    console.log(JSON.stringify({ ...body, urlList: urlList.slice(0, 3).concat(['…']) }, null, 2));
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // 200 accepted, 202 accepted but key still validating. Both are fine.
  if (res.status === 200 || res.status === 202) {
    console.log(`✓ ${res.status} — ${urlList.length} URL(s) submitted to IndexNow (Bing, Yandex, Seznam, Naver)`);
    console.log('  Google is unaffected: it does not participate in IndexNow.');
  } else {
    console.error(`✗ ${res.status} ${text.slice(0, 300)}`);
    process.exit(1);
  }
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
