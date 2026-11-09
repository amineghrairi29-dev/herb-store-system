// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-SETTINGS-UI-${crypto.randomUUID()}`;
const outputDir = path.resolve('../.tmp', `settings-validation-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let seq = 0, accept = false;
const pending = new Map(), errors = [], requests = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept }).catch(e => errors.push(e.message));
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.args.some(a => /hydration|hydrating|did not match/i.test(a.value ?? ''))) errors.push('Hydration error');
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request);
  if (message.method === 'Network.loadingFailed') console.error('Browser transport failure:', JSON.stringify({ error: message.params.errorText, blocked: message.params.blockedReason, cors: message.params.corsErrorStatus }));
});
async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function wait(expression) { const end = Date.now() + 30000; while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__fulfillmentNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__fulfillmentNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const snapshot = async () => {
  const result = {};
  for (const table of ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine', 'user', 'authSession', 'purchase', 'purchaseLine', 'purchasePayment', 'expense', 'supplier', 'storeSettings']) result[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows;
  return result;
};
const password = `Aa9-${crypto.randomUUID()}`;
const email = role => `${token}-${role}@example.com`.toLowerCase();
async function field(name, value) {
  await evaluate(`(() => { const input = document.querySelector('[name="${name}"]'); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
}
async function signIn(role) {
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready]') !== null"); await field('email', email(role)); await field('password', password); await click('Se connecter');
  await wait("location.pathname === '/' && document.querySelector('[aria-label=\"Navigation principale\"]') !== null");
}
async function signOut() { await click('Se déconnecter'); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null"); }
// Browser network fixtures exercise UI states without changing the singleton.
// Real PATCH persistence/concurrency is covered by store-settings.e2e-spec.ts against an isolated table.
let store = { id: 1, storeName: 'Herb Store', currency: 'TND', phone: null, secondaryPhone: null, email: null, website: null, address: null, city: null, country: null, reportFooter: null, createdAt: null, updatedAt: null };
let mode = 'pass', patchCount = 0;
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data); if (message.method !== 'Fetch.requestPaused') return;
  void (async () => {
    const { requestId, request } = message.params, url = new URL(request.url);
    if (request.method === 'OPTIONS') return send('Fetch.continueRequest', { requestId });
    let responseCode = 200, body;
    if (url.pathname === '/settings/store') {
      if (mode === 'load-error' && request.method === 'GET' || mode === 'save-error' && request.method === 'PATCH') { responseCode = 503; body = { message: 'Erreur temporaire de validation.' }; }
      else {
        if (request.method === 'PATCH') {
          patchCount++; const input = JSON.parse(request.postData); assert.equal(input.currency, 'TND'); assert.equal(input.storeName, 'Herboristerie Test · أعشاب تونس');
          store = { ...store, ...input }; await new Promise(resolve => setTimeout(resolve, 500));
        }
        body = store;
      }
    } else if (mode === 'identity-error') { responseCode = 503; body = { message: 'Unavailable' }; }
    else if (url.pathname === '/public/store-info') body = { storeName: store.storeName };
    else body = Object.fromEntries(['storeName', 'phone', 'email', 'address', 'city', 'reportFooter'].map(key => [key, store[key]]));
    await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  })().catch(error => errors.push(error.message));
});
await db.connect(); const before = await snapshot();
try {
  assert.deepEqual(Object.keys(await (await fetch('http://localhost:3001/public/store-info')).json()), ['storeName']);
  assert.equal((await fetch('http://localhost:3001/settings/store')).status, 401);
  const { hash } = require('bcryptjs'), passwordHash = await hash(password, 12);
  for (const role of ['ADMIN']) await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now())', [email(role), `${role} اختبار`, role, passwordHash]);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: ['/settings/store', '/public/store-info', '/reports/store-info/identity'].map(route => ({ urlPattern: `http://localhost:3001${route}` })) });
  await signIn('ADMIN'); await navigate('/settings/store'); await wait("document.querySelector('[name=storeName]') !== null");
  assert.equal(await evaluate("document.querySelector('[name=storeName]').value"), 'Herb Store');
  assert.ok(await evaluate("document.querySelector('[aria-label=\"Navigation principale\"]').textContent.includes('Paramètres')"));
  await field('storeName', '   '); await click('Enregistrer les modifications'); await wait("document.querySelector('[role=alert]')?.textContent.includes('obligatoire')"); assert.equal(patchCount, 0);
  for (const [name, value] of Object.entries({ storeName: 'Herboristerie Test · أعشاب تونس', phone: '22111222', city: 'Tunis', country: 'Tunisie', email: 'contact@example.com', address: 'شارع الأعشاب · Tunis', reportFooter: 'Merci · شكراً لزيارتكم', website: 'https://example.com' })) await field(name, value);
  assert.equal(patchCount, 0); // No auto-save.
  mode = 'save-error'; await click('Enregistrer les modifications'); await wait("document.querySelector('[role=alert]')?.textContent.includes('Erreur temporaire')");
  assert.equal(await evaluate("document.querySelector('[name=storeName]').value"), store.storeName === 'Herb Store' ? 'Herboristerie Test · أعشاب تونس' : store.storeName);
  mode = 'pass'; await click('Enregistrer les modifications'); await wait("document.querySelector('button[type=submit]').disabled && document.querySelector('button[type=submit]').textContent === 'Enregistrement...'");
  await wait("document.querySelector('[role=status]')?.textContent.includes('enregistrés')"); assert.equal(patchCount, 1);
  await wait("document.querySelector('[data-store-name]').textContent.includes('أعشاب تونس')");
  await navigate('/settings/store'); await wait("document.querySelector('[name=storeName]')?.value.includes('أعشاب تونس')");
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 }); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    await writeFile(path.join(outputDir, `settings-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  mode = 'load-error'; await navigate('/settings/store'); await wait("document.querySelector('[role=alert]')?.textContent.includes('Impossible de charger')"); mode = 'pass'; await click('Réessayer'); await wait("document.querySelector('[name=storeName]') !== null");
  await navigate('/reports/sales'); await wait("document.querySelector('[data-report-store]')?.textContent.includes('أعشاب تونس') && document.querySelector('[data-report-footer]')?.textContent.includes('شكراً')");
  await evaluate('window.print = () => { window.__printed = true; }'); await click('Imprimer / PDF'); await wait("window.__printed && document.querySelector('.report-print-view [data-report-footer]')?.textContent.includes('شكراً')");
  assert.ok(await evaluate("document.querySelector('.report-print-view [data-report-store]').textContent.includes('22111222')")); await evaluate("window.dispatchEvent(new Event('afterprint'))");
  await signOut();
  await navigate('/shop'); await wait("document.querySelector('[data-store-name]')?.textContent.includes('أعشاب تونس')");
  mode = 'identity-error'; await navigate('/shop'); await wait("document.querySelector('[data-store-name]')?.textContent === 'Herb Store'");
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', checks: 'real ADMIN auth; mocked save/error/retry/loading/no auto-save; Arabic; responsive; report/print identity/footer; public branding/fallback', outputDir }, null, 2));
} catch (error) { console.error('Browser page:', await evaluate('document.body.innerText').catch(() => 'unavailable')); throw error; }
finally {
  await db.query('DELETE FROM public."user" WHERE email LIKE $1', [`${token.toLowerCase()}-%@example.com`]);
  const after = await snapshot(); await db.end(); await send('Browser.close').catch(() => {}); socket.close(); assert.deepEqual(after, before); console.log('Disposable users removed; settings, business data and retained manual accounts unchanged.');
}
