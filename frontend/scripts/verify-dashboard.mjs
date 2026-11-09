// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-DASHBOARD-UI-${crypto.randomUUID()}`;
const outputDir = path.resolve('../.tmp', `dashboard-validation-${Date.now()}`);
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
});
async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function wait(expression) { const end = Date.now() + 30000; while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__fulfillmentNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__fulfillmentNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const snapshot = async () => {
  const result = {};
  for (const table of ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine', 'user', 'authSession']) result[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows;
  return result;
};
const password = `Aa9-${crypto.randomUUID()}`;
const email = role => `${token}-${role}@example.com`.toLowerCase();
async function field(name, value) {
  await evaluate(`(() => { const input = document.querySelector('[name="${name}"]'); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
}
async function signIn(role) {
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready]') !== null"); await field('email', email(role)); await field('password', password); await click('Se connecter');
  await wait("location.pathname === '/' && document.querySelector('[aria-label=\"Navigation principale\"]') !== null");
}
async function signOut() { await click('Se déconnecter'); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null"); }
let mode = 'pass', emptyResponse;
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data); if (message.method !== 'Fetch.requestPaused') return;
  void (async () => {
    const { requestId, request } = message.params;
    if (mode === 'pass' || request.method === 'OPTIONS') return send('Fetch.continueRequest', { requestId });
    if (mode === 'delay') { await new Promise(resolve => setTimeout(resolve, 700)); return send('Fetch.continueRequest', { requestId }); }
    return send('Fetch.fulfillRequest', { requestId, responseCode: mode === 'error' ? 503 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(mode === 'error' ? { message: 'Erreur temporaire de validation.' } : emptyResponse)).toString('base64') });
  })().catch(error => errors.push(error.message));
});
const ready = count => wait(`document.querySelectorAll('[data-dashboard-metric]').length === ${count}`);
const readResponse = () => evaluate("fetch('http://localhost:3001/dashboard', {credentials:'include'}).then(async r => {if(!r.ok)throw new Error('Dashboard API '+r.status);return r.json()})");
let productId, orderId;
await db.connect(); const before = await snapshot();
try {
  const { hash } = require('bcryptjs'), passwordHash = await hash(password, 12);
  for (const role of ['ADMIN']) await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now())', [email(role), `${role} اختبار`, role, passwordHash]);
  productId = (await db.query('INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","minStock","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,$2,\'VRAC\',0.1,$3,\'KG\',\'KG\',1,2,true,true,true,now()) RETURNING id', [token, 'نعناع لوحة القيادة', 'أعشاب'])) .rows[0].id;
  orderId = (await db.query('INSERT INTO public."onlineOrder" (reference,"customerName","customerPhone","totalAmount","updatedAt") VALUES ($1,$2,\'20123456\',0.100000000000000001,now()) RETURNING id', [token, 'عميل لوحة القيادة'])).rows[0].id;
  await db.query('INSERT INTO public."onlineOrderLine" ("orderId","productId","productNameSnapshot","unitSnapshot",quantity,"unitPrice","lineTotal") VALUES ($1,$2,$3,\'KG\',1,0.100000000000000001,0.100000000000000001)', [orderId, productId, 'نعناع لوحة القيادة']);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  assert.equal((await fetch('http://localhost:3001/dashboard')).status, 401);
  await send('Page.navigate', { url: 'http://localhost:3000/' }); await wait("location.pathname === '/login' && document.querySelector('[data-auth-ready]') !== null");
  await signIn('ADMIN'); await ready(10);
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Navigation principale\"] a').textContent"), 'Tableau de bord');
  assert.ok(await evaluate("document.querySelector('main').textContent.includes('Bonjour, ADMIN اختبار')"));
  const full = await readResponse(); assert.ok(full.balances); assert.ok(full.today.purchases !== undefined);
  for (const title of ['Stock à surveiller', 'Commandes en attente', 'Dernière activité', 'Actions rapides']) assert.ok(await evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(title)})`));
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[aria-label=\"Actions rapides\"] a')].map(a=>a.textContent)"), ['Nouvelle vente','Nouvel achat','Entrée stock','Nouvelle dépense','Commandes en ligne']);
  assert.ok(await evaluate("document.querySelector('main').textContent.includes('نعناع لوحة القيادة') && document.querySelector('main').textContent.includes('عميل لوحة القيادة')"));
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    await writeFile(path.join(outputDir, `admin-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  await navigate('/'); await ready(10);
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/dashboard*' }] });
  mode = 'error'; await navigate('/'); await wait("document.querySelector('[role=alert]')?.textContent.includes('Impossible de charger le tableau de bord')");
  mode = 'delay'; await click('Réessayer'); await wait("document.querySelector('[role=status]')?.textContent.includes('Chargement du tableau de bord')"); await ready(10);
  emptyResponse = { ...full, today: { sales: '0.000', customerCollections: '0.000', purchases: '0.000', expenses: '0.000' }, balances: { physicalCash: '0.000', customerReceivables: '0.000', supplierPayables: '0.000' }, alerts: { pendingOnlineOrders: 0, outOfStockProducts: 0, lowStockProducts: 0 }, pendingOrders: [], stockAttention: [], recentActivity: [] };
  mode = 'empty'; await navigate('/'); await ready(10);
  for (const text of ['Aucune commande en attente.', 'Aucune alerte de stock.', 'Aucune activité récente.']) assert.ok(await evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(text)})`));
  mode = 'pass'; await send('Fetch.disable'); await signOut();
  await signIn('ADMIN'); await ready(10);
  await evaluate(`document.querySelector('a[href="/stock/products/${productId}"]').click()`); await wait(`location.pathname === '/stock/products/${productId}'`);
  await navigate('/'); await ready(10); await evaluate(`document.querySelector('a[href="/online-orders/${orderId}"]').click()`); await wait(`location.pathname === '/online-orders/${orderId}'`);
  await signOut(); await navigate('/shop'); assert.equal(await evaluate('location.pathname'), '/shop');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', checks: 'login -> dashboard; ADMIN cards/actions and response; refresh; stock/order links; error/loading/retry; empty states; desktop/tablet/mobile; Arabic; public shop; no hydration errors', outputDir }, null, 2));
} catch (error) { console.error('Browser page:', await evaluate('document.body.innerText').catch(() => 'unavailable')); throw error; }
finally {
  await db.query('BEGIN'); await db.query('DELETE FROM public."onlineOrderLine" WHERE "orderId"=$1', [orderId]); await db.query('DELETE FROM public."onlineOrder" WHERE id=$1 AND reference=$2', [orderId, token]); await db.query('DELETE FROM public.product WHERE id=$1 AND sku=$2', [productId, token]); await db.query('DELETE FROM public."user" WHERE email LIKE $1', [`${token.toLowerCase()}-%@example.com`]); await db.query('COMMIT');
  const after = await snapshot(); await db.end(); await send('Browser.close').catch(() => {}); socket.close(); assert.deepEqual(after, before); console.log('Disposable fixtures removed; all existing business data and manual accounts unchanged.');
}
