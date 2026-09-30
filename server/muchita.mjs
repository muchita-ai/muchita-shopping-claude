#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { appendFileSync, realpathSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { coverage, headlineFor, plural, present, priceText } from './answer.mjs';

export { present } from './answer.mjs';
import { TOOLS } from './tools.mjs';

const CLIENT = /^[a-z]{2,16}$/.test(process.env.MUCHITA_CLIENT ?? '') ? process.env.MUCHITA_CLIENT : 'claude';
const EXTENSION_ID = process.env.MUCHITA_EXTENSION_ID || 'kdfhenbdndhjcenmjnbnllenhacpaaok';
const HANDOFF = process.env.MUCHITA_HANDOFF_URL || `https://shopping.muchita.ai/${CLIENT}/`;
const STORE = `https://chromewebstore.google.com/detail/muchita-shopping/kdfhenbdndhjcenmjnbnllenhacpaaok?utm_source=${CLIENT}&utm_medium=referral&utm_campaign=${CLIENT}_handoff`;
const INSTALL = STORE;
const MAX_WAIT_S = 170;
const SETUP_MS = 10 * 60_000;
const TTL_MS = 60 * 60_000;
const jobs = new Map();
let bridge;

export function productUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\u0000- \u007f]/.test(raw)) return;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/\.$/, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    if (/(?:^|\/)(?:cart|basket|checkout|account|login|signin|oauth|payment)(?:\/|$)/i.test(url.pathname) || [...url.searchParams.keys()].some((key) => /^(?:access_token|auth_token|token|session|sessionid|password|secret|api_key)$/i.test(key))) return;
    if (!host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host)) return;
    if (/(^|\.)(localhost|local|internal|lan|home|test|invalid|example|muchita\.ai)$/.test(host)) return;
    if (/ycgic-research/i.test(url.hash)) return;
    return url.href;
  } catch {}
}

export function productName(raw) {
  if (typeof raw !== 'string' || /[\u0000-\u001f\u007f]/.test(raw)) return;
  const query = raw.trim();
  if (query.length < 2 || query.length > 240 || !/[\p{L}\p{N}]/u.test(query)) return;
  if (/^[a-z][a-z\d+.-]*:|https?:\/\/|\bwww\.|\S+@\S+|^[./\\]|^[^\s/]+\.[^\s/]+(?:[/:?#]|$)/i.test(query)) return;
  return query;
}

const settle = (job) => { for (const wake of job.waiters) wake(); job.waiters.clear(); };

function listen() {
  bridge ??= new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
      const job = jobs.get(/^Bearer ([\w-]+)$/.exec(req.headers.authorization ?? '')?.[1]);
      if (req.headers.host !== `127.0.0.1:${server.address().port}` || !job) return send(404, { ok: false });
      if (Date.now() - job.createdAt >= (job.claimed ? TTL_MS : SETUP_MS)) { settle(job); return send(410, { ok: false, error: 'expired' }); }
      if (req.method === 'GET' && req.url === '/job') {
        if (job.claimed) return send(409, { ok: false, error: 'claimed' });
        job.claimed = Date.now();
        if (job.query && req.headers['x-muchita-bridge'] !== '2') {
          job.result = { status: 'extension_update_required' };
          settle(job);
          return send(409, { ok: false, error: 'update_required' });
        }
        settle(job);
        return send(200, { ...(job.url ? { url: job.url } : { query: job.query }), ...(job.market ? { market: job.market } : {}), ...(CLIENT === 'claude' ? {} : { entry: `${CLIENT}_tool` }) });
      }
      if (req.method !== 'POST' || req.url !== '/report') return send(404, { ok: false });
      if (!job.claimed) return send(409, { ok: false, error: 'not_claimed' });
      if (job.result && job.result.status !== 'running') return send(200, { ok: true });
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { body += chunk; if (body.length > 512_000) req.destroy(); });
      req.on('end', () => {
        let result;
        try { result = JSON.parse(body); } catch { return send(400, { ok: false }); }
        if (job.result && job.result.status !== 'running') return send(200, { ok: true });
        if (Date.now() - job.createdAt >= TTL_MS) return send(410, { ok: false, error: 'expired' });
        job.result = result;
        if (process.env.MUCHITA_TRACE) appendFileSync(process.env.MUCHITA_TRACE, `${new Date().toISOString()} << report ${body.slice(0, 2000)}\n`);
        job.updatedAt = Date.now();
        settle(job);
        send(200, { ok: true });
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { server.unref(); resolve(server.address().port); });
  });
  return bridge;
}

function openBrowser(url) {
  const app = process.env.MUCHITA_BROWSER || (process.platform === 'darwin' ? 'Google Chrome' : 'google-chrome');
  const profile = process.env.MUCHITA_CHROME_PROFILE;
  const run = (cmd, args) => new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
    child.on('spawn', () => setTimeout(() => resolve(true), 300));
    child.unref();
  });
  const flags = profile ? [`--profile-directory=${profile}`] : [];
  if (process.platform === 'darwin') return run('open', profile ? ['-na', app, '--args', ...flags, url] : ['-a', app, url]).then((ok) => ok || run('open', [url]));
  if (process.platform === 'win32') return run('cmd', ['/c', 'start', '""', 'chrome', ...flags, `"${url}"`]);
  return run(app, [...flags, url]).then((ok) => ok || run('xdg-open', [url]));
}

export const runtime = { open: openBrowser, notify: () => {} };


// Say exactly what to click: Google's search check is the "I'm not a robot" box; a store's own check varies.
const humanAsk = (result) => result.humanCheck === 'search' ? 'tick "I\'m not a robot" in the Muchita tab' : 'complete the check on the store page in the Muchita tab';

export const progressLine = (result, seen = {}, first = true) => {
  if (!result || result.status !== 'running') return undefined;
  const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  if (result.needsHuman) {
    seen.humanSince ??= Date.now();
    const ends = Date.parse(result.humanCheckEndsAt ?? '');
    return `Waiting for you: ${humanAsk(result)} · ${Number.isFinite(ends) ? `${clock(ends - Date.now())} left` : clock(Date.now() - seen.humanSince)}`;
  }
  seen.humanSince = undefined;
  if (result.coverage?.degraded === 'google_blocked') return 'Human check not completed · checking price-comparison sites instead';
  const found = (result.offers ?? []).find((offer) => !offer.issues && offer.comparableItemPrice);
  if (found && (!seen.best || found.comparableItemPrice.amount < seen.best.comparableItemPrice.amount)) seen.best = found;
  const best = seen.best;
  const coverage = result.coverage ?? {};
  seen.stores = Math.max(seen.stores ?? 0, coverage.storesFound ?? coverage.candidatesFound ?? 0);
  seen.checked = Math.max(seen.checked ?? 0, coverage.pagesChecked ?? 0);
  seen.storesChecked = Math.min(seen.stores, Math.max(seen.storesChecked ?? 0, coverage.storesChecked ?? 0));
  seen.total = Math.max(seen.total ?? 0, seen.checked + (coverage.remainingToCheck ?? 0));
  // A restarted hunt (the extension relaunched it after its worker died) says so instead of silently starting over.
  if (result.huntId && seen.huntId && result.huntId !== seen.huntId) seen.restartAt = Date.now();
  seen.huntId = result.huntId ?? seen.huntId;
  // "4 of 9 stores checked" says how much of the market is covered; older extensions only send pages.
  // While search is still finding stores the total isn't settled: "8 of 8" would look finished.
  const counts = coverage.storesChecked != null && seen.checked && result.phase === 'discovering' ? `${seen.storesChecked} ${plural(seen.storesChecked, 'store')} checked · finding more stores`
    : coverage.storesChecked != null && seen.checked ? `${seen.storesChecked} of ${seen.stores} ${plural(seen.stores, 'store')} checked`
    : seen.checked ? `${seen.checked}${seen.total > seen.checked ? ` of ~${seen.total}` : ''} ${plural(seen.total || seen.checked, 'page')}`
    : seen.stores ? `${seen.stores} ${plural(seen.stores, 'store')} found` : 'Searching stores…';
  // A count that hasn't moved for 20 s names the store page Muchita is waiting on, instead of repeating.
  if (counts !== seen.counts) { seen.counts = counts; seen.countsAt = Date.now(); }
  const left = coverage.storesChecked != null ? Math.max(0, seen.stores - seen.storesChecked) : Math.max(0, seen.total - seen.checked);
  const tail = result.checking && Date.now() - seen.countsAt >= 20_000 ? `waiting for ${result.checking}`
    : seen.slow ? (left ? `${left} ${plural(left, coverage.storesChecked != null ? 'store' : 'page')} left` : 'finishing up') : '';
  const own = result.source?.itemPrice;
  const lead = Date.now() - (seen.restartAt ?? 0) < 20_000 ? 'Restarting the hunt in Chrome'
    : best ? `Best so far ${priceText(best.comparableItemPrice, result.currency)} at ${best.store}`
    : own ? `Your price ${priceText(own, result.currency)}, looking for cheaper` : '';
  return [lead, counts, tail].filter(Boolean).join(' · ');
};

// Also shown when Chrome is merely slow to open the page, so it reads right for an installed Muchita too.
const SETUP_LINE = 'If Muchita asks you to install, click Install Muchita on that page, then Add to Chrome and confirm Chrome\'s permissions. The same check starts automatically.';
// How long to wait for Muchita before saying setup is needed.
const connectWindow = () => Number(process.env.MUCHITA_CONNECT_MS) || 20_000;
const setupLine = () => SETUP_LINE;
const VALUE = ['Muchita reads live prices in your own Chrome, so what it finds are real offers you can open and buy.', 'The browsing runs in your Chrome; your assistant receives the verified result.'];

function nextLine(job) {
  if (!job.claimed) return Date.now() - job.createdAt < connectWindow(job) ? 'Opening Muchita in Chrome…' : setupLine(job);
  job.seen ??= {};
  job.seen.slow = Date.now() - job.claimed > 150_000;
  const status = progressLine(job.result, job.seen, !job.shownStatus) ?? 'Starting the hunt in Chrome…';
  if (job.result?.status === 'running') job.shownStatus = true;
  if (job.seen.restartAt) job.restarted = true;
  job.extras ??= [...VALUE, ...(job.tips ?? []).map((tip) => `Tip: ${tip}`)];
  // A note or tip at most every 15 s, always between status lines, and never over a human check.
  const quiet = job.result?.needsHuman || job.result?.coverage?.degraded;
  if (job.lastLine !== 'extra' && job.extras.length && !quiet && Date.now() - (job.extraAt ?? 0) >= (Number(process.env.MUCHITA_EXTRA_GAP_MS) || 15_000)) {
    job.lastLine = 'extra'; job.extraAt = Date.now();
    return job.extras.shift();
  }
  job.lastLine = 'status';
  return status;
}

const wait = (job, ms) => new Promise((resolve) => {
  const done = () => { clearTimeout(timer); job.waiters.delete(done); resolve(); };
  const timer = setTimeout(done, ms);
  job.waiters.add(done);
});

async function follow(job, seconds, connectMs = connectWindow(job), started = false) {
  const deadline = Date.now() + Math.min(Math.max(Number(seconds) || MAX_WAIT_S, 5), MAX_WAIT_S) * 1000;
  const connectBy = Math.min(deadline, Date.now() + connectMs);
  const silence = Number(process.env.MUCHITA_SILENCE_MS) || 90_000;
  for (;;) {
    const now = Date.now(), heard = job.updatedAt ?? job.claimed;
    if (job.claimed && (!job.result || job.result.status === 'running') && now - heard >= silence) {
      job.result = { ...job.result, status: 'hunt_interrupted' };
      settle(job);
    }
    const limit = Math.min(job.claimed ? deadline : connectBy, job.claimed ? heard + silence : Infinity);
    if (job.result?.needsHuman && !job.toldHuman) {
      job.toldHuman = true;
      return report(job);
    }
    if (!job.claimed && now >= connectBy && !job.toldSetup) { job.toldSetup = true; job.notify?.(setupLine(job)); }
    if ((job.result && (started || job.result.status !== 'running')) || now >= (job.claimed ? deadline : connectBy)) return report(job);
    job.notify?.(nextLine(job));
    await wait(job, Math.max(Math.min(limit, now + (job.claimed ? 9000 : 4000)) - now, 0));
  }
}

const NEXT = {
  hunting: 'The hunt is running in Chrome and usually takes 1-3 minutes. Before calling any tool, write the shopper a short message now: that the hunt is running (1-3 minutes; a human check may need their attention) plus two or three smart-shopping tips that fit this product. Then call get_price_check with this job_id.',
  extension_update_required: 'This Chrome has an older Muchita that can only hunt from a product link. Chrome updates extensions on its own within hours. For now, find the product page at a store in the shopper\'s country and call check_price with url.',
  product_not_read: 'Muchita could not read a product on that page. A fetch from here is usually blocked too. In one sentence, ask for the product name and variant, or the same product\'s link from another store, then hunt with that. Do not add "Reply hunt": a bare "hunt" gives you nothing to search for.',
  store_blocked: 'The store in the shopper\'s link (source.store) blocked the check from this connection, so Muchita could not read that page. Say that in one sentence. A fetch from here is usually blocked too. If the shopper already told you the product name, offer to hunt for it by name, which checks other stores, ending with "Reply **hunt** to try that." Otherwise ask, in one sentence, for the product name and variant or the same product\'s link from another store, without "Reply hunt".',
  hunt_interrupted: 'The hunt stopped early. Say exactly that; do not blame stores, pages or loading, and do not guess a cause. Share any verified offers below and offer one next step: hunt again.',
  hunt_incomplete: 'Most store pages did not finish loading, which is usually temporary. Say so plainly, share any verified offers below, and offer one clear next step: hunt again.',
  stopped_by_shopper: 'The shopper stopped the hunt. Acknowledge it in a few words and share whatever was verified so far.',
  human_check_unsolved: 'Chrome asked for a human check that was not completed, so the store search was skipped, and the price-comparison sites Muchita tried instead did not confirm a price either. Say that in one or two sentences, share any verified offers below, and offer to hunt again, adding that they only need to tick the box when Chrome shows it.',
  needs_you: 'Chrome needs the shopper: a human check is waiting in the Muchita tab (Chrome was brought to the front). Tell them in one short sentence to complete it there; the hunt continues by itself. Then call get_price_check again.',
};

const BLOCKED_NEXT = 'Several stores blocked the check from this connection, so Muchita could not confirm their prices. Say that plainly in one sentence (a block is not a loading problem), share any verified offers below, and offer to hunt again later, which usually works.';





function report(job) {
  const base = { job_id: job.id, product: job.url ?? job.query };
  if (!job.claimed && Date.now() - job.createdAt >= SETUP_MS) return { ...base, status: 'setup_expired', next: 'This setup request ended. Stop polling. Ask the shopper whether to start a fresh check after completing setup.', install: INSTALL };
  if (!job.claimed) return {
    ...base,
    status: 'setup_needed',
    next: 'Muchita has not connected yet. Tell the shopper: Chrome is opening their product check; if that page asks them to install, click Install Muchita, then Add to Chrome and confirm Chrome\'s permissions. Keep the original check tab open; the same hunt starts automatically. This is a free one-time setup. Then call get_price_check with this job_id until the hunt starts or setup_expired is returned. Do not ask them to tell you when it is done.',
    install: INSTALL,
  };
  if (!job.result) return { ...base, status: 'hunting', next: NEXT.hunting };
  const shown = present(job.result);
  const reached = shown.coverage?.pagesChecked ?? 0, stores = shown.coverage?.storesFound ?? 0;
  const next = shown.status === 'hunt_incomplete' && shown.coverage?.pagesBlocked ? BLOCKED_NEXT
    : shown.status === 'hunt_incomplete' && reached < stores / 2 ? `The hunt was cut short: Muchita reached ${reached} of the ${stores} stores it found, so nothing is confirmed either way. Say that plainly, list any leads below as unconfirmed, and offer to hunt again.`
    : NEXT[shown.status];
  const restarted = job.restarted ? ' The hunt had to restart in Chrome along the way; mention it in a few words.' : '';
  const headline = headlineFor(shown);
  const { found, closing: tail, coverageLine } = coverage(shown, job.seen);
  // An answer with no verified offer ends with the same retry prompt, in the same place, every time.
  const retry = !found && ['no_offer_verified', 'hunt_incomplete', 'hunt_interrupted', 'human_check_unsolved', 'no_cheaper_offer_found'].includes(shown.status) ? 'Reply **hunt** to try again. ' : '';
  const closing = shown.status !== 'running' && (tail || retry) ? { closing: retry + (tail ?? '') } : {};
  return { ...base, ...shown, ...(headline ? { headline } : {}), ...(next ? { next: next + restarted } : {}), ...(coverageLine ? { coverageLine } : {}), ...closing };
}

async function checkPrice({ url, product: name, market, tips, wait_seconds }, notify) {
  const product = url == null ? undefined : productUrl(url), query = url == null ? productName(name) : undefined;
  if (!product && !query) throw new Error(url == null ? 'Give product as the exact product name and variant (for example "AirPods Pro 3" or "Sony WH-1000XM5 black"), or url as a public product page.' : 'Use a public HTTPS product page URL (not a search, cart, account, or private address).');
  if (market != null && !/^[a-z]{2}$/i.test(market)) throw new Error('market must be a two-letter ISO country code, such as DE or US.');
  for (const [key, job] of jobs) if (Date.now() - job.createdAt > TTL_MS) jobs.delete(key);
  const port = await listen();
  const code = randomBytes(24).toString('base64url');
  const params = new URLSearchParams({ ...(product ? { url: product } : { query }), bridge: `${port}.${code}`, ...(EXTENSION_ID ? { ext: EXTENSION_ID } : {}) });
  const job = { id: randomBytes(6).toString('hex'), url: product, query, market: market?.toLowerCase(), createdAt: Date.now(), waiters: new Set(), link: '', notify, tips: (Array.isArray(tips) ? tips : []).filter((tip) => typeof tip === 'string' && tip.trim()).slice(0, 3).map((tip) => tip.trim().slice(0, 160)) };
  job.link = `${HANDOFF}?utm_source=${CLIENT}&utm_medium=referral&utm_campaign=${CLIENT}_handoff#${params}`;
  jobs.set(code, job);
  if (!(await runtime.open(job.link))) return { job_id: job.id, status: 'browser_not_opened', next: 'Could not open Chrome from this machine. Give the shopper the handoff link to open in Chrome on this computer, then call get_price_check with this job_id.', handoff: job.link, install: INSTALL };
  return follow(job, wait_seconds, undefined, true);
}

function priceCheck({ job_id, wait_seconds }, notify) {
  for (const [key, entry] of jobs) if (Date.now() - entry.createdAt > TTL_MS || (!entry.claimed && Date.now() - entry.createdAt >= SETUP_MS)) {
    if (entry.id === job_id && !entry.claimed) { jobs.delete(key); return report(entry); }
    jobs.delete(key);
  }
  const job = [...jobs.values()].find((entry) => entry.id === job_id);
  if (!job) throw new Error('Unknown or expired job_id. Start a new check with check_price.');
  job.notify = notify;
  wait_seconds ??= CLIENT === 'claude' ? undefined : 20;
  if (!job.claimed) return follow(job, wait_seconds, Infinity, true);
  return follow(job, wait_seconds, Infinity);
}

const HANDLERS = { check_price: checkPrice, get_price_check: priceCheck };

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'muchita-shopping', version: '0.5.11' } };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: TOOLS };
  if (method === 'tools/call') {
    const handler = HANDLERS[params?.name];
    if (!handler) throw Object.assign(new Error(`Unknown tool ${params?.name}`), { code: -32602 });
    try {
      const progress = params?._meta?.progressToken;
      let step = 0;
      const notify = progress == null ? undefined : (message) => runtime.notify({ method: 'notifications/progress', params: { progressToken: progress, progress: ++step, message } });
      return { content: [{ type: 'text', text: JSON.stringify(await handler(params.arguments ?? {}, notify)) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
  }
  if (id !== undefined) throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = (body) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...body })}\n`);
  const trace = process.env.MUCHITA_TRACE;
  runtime.notify = (body) => { if (trace) appendFileSync(trace, `${new Date().toISOString()} >> ${JSON.stringify(body)}\n`); out(body); };
  createInterface({ input: process.stdin }).on('line', async (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (trace) appendFileSync(trace, `${new Date().toISOString()} ${line}\n`);
    try {
      const result = await handle(message);
      if (message.id !== undefined) out({ id: message.id, result });
    } catch (error) {
      if (message.id !== undefined) out({ id: message.id, error: { code: error.code ?? -32603, message: error.message } });
    }
  }).on('close', () => process.exit(0));
}

export { handle, jobs, listen };
