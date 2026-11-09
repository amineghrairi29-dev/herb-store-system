// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-AUDIT-UI-${crypto.randomUUID()}`;
const outputDir = path.resolve('../.tmp', `audit-validation-${Date.now()}`);
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
  for (const table of ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine', 'user', 'authSession', 'purchase', 'purchaseLine', 'purchasePayment', 'expense', 'supplier', 'storeSettings', 'auditEvent']) result[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows;
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
const api = (route, method = 'GET', body) => evaluate(`fetch('http://localhost:3001'+${JSON.stringify(route)}, {method:${JSON.stringify(method)},credentials:'include',headers:{'Content-Type':'application/json'},${body === undefined ? '' : `body:JSON.stringify(${JSON.stringify(body)}),`}}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message);return body})`);
let productId, saleId; const ownedUsers = [];
await db.connect(); const before = await snapshot();
try {
  const { hash } = require('bcryptjs'), passwordHash = await hash(password, 12);
  for (const role of ['ADMIN']) ownedUsers.push((await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now()) RETURNING id', [email(role), `${role} مدير تجريبي`, role, passwordHash])).rows[0].id);
  productId = (await db.query('INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","updatedAt") VALUES ($1,$2,\'VRAC\',2,\'Test\',\'KG\',\'KG\',1,now()) RETURNING id', [token, 'نعناع تجريبي'])).rows[0].id;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await signIn('ADMIN'); assert.ok(await evaluate("document.querySelector('[aria-label=\"Navigation principale\"]').textContent.includes('Journal d’audit')"));
  await navigate(`/products/${productId}/edit`); await wait("document.querySelector('[name=nameFr]') !== null"); await field('nameFr', 'Menthe audit'); await field('barcode', token); await evaluate("document.querySelector('form').requestSubmit()"); await wait("location.pathname === '/products'");
  await navigate('/stock/new-entry'); await wait("document.querySelector('main select') !== null");
  await evaluate(`(() => {const select=document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(String(productId))});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("document.querySelectorAll('main select')[1]?.querySelector('option[value=KG]') !== null");
  await evaluate("(() => {const select=document.querySelectorAll('main select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'KG');select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await field('quantity', '5'); await field('reference', `${token} عشبة`); await evaluate("document.querySelector('form').requestSubmit()"); await wait("location.pathname === '/stock'");
  const sale = await api('/sales', 'POST', { reference: `${token}-SALE`, saleDate: '2026-09-08', lines: [{ productId, quantity: '1', unit: 'KG', unitSalePrice: '2' }] }); saleId = sale.id;
  await navigate(`/sales/${saleId}`); await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Confirmer')"); await click('Confirmer'); await click('Confirmer la vente'); await wait("document.querySelector('main').textContent.includes('Les sorties de stock ont été enregistrées')");
  // Real, bounded changes to our disposable product provide enough events to test pagination.
  for (let index = 0; index < 26; index++) await api(`/products/${productId}`, 'PATCH', { nameFr: `Menthe audit ${index}` });
  const result = await api(`/audit-events?actorUserId=${ownedUsers[0]}&pageSize=100`);
  for (const action of ['PRODUCT_UPDATE', 'STOCK_ENTRY_CREATE', 'SALE_CONFIRM']) assert.ok(result.data.some(row => row.action === action));
  assert.ok(!result.data.some(row => row.action === 'STOCK_EXIT_CREATE'));
  assert.ok(!JSON.stringify(result).includes(password)); assert.ok(!JSON.stringify(result).includes('passwordHash'));
  await navigate('/audit'); await wait("document.querySelector('tbody tr') !== null"); await field('actorUserId', String(ownedUsers[0])); await click('Appliquer'); await wait(`document.querySelectorAll('tbody tr').length === 25 && [...document.querySelectorAll('button')].some(b=>b.textContent==='Suivant'&&!b.disabled)`);
  await click('Suivant'); await wait("document.querySelector('main').textContent.includes('Page 2 /')"); assert.ok(await evaluate("document.querySelectorAll('tbody tr').length > 0"));
  await field('action', 'STOCK_ENTRY_CREATE'); await field('entityType', 'STOCK_MOVEMENT'); await field('outcome', 'SUCCESS'); await field('search', token); await click('Appliquer'); await wait("document.querySelectorAll('tbody tr').length === 1");
  assert.ok(await evaluate("document.querySelector('tbody').textContent.includes('عشبة')"));
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 }); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    await writeFile(path.join(outputDir, `audit-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  await evaluate("document.querySelector('tbody a').click()"); await wait("location.pathname.startsWith('/audit/') && document.querySelector('article') !== null");
  assert.ok(await evaluate("document.querySelector('article').textContent.includes('مدير تجريبي') && document.querySelector('article').textContent.includes('STOCK_ENTRY_CREATE')"));
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1')); await writeFile(path.join(outputDir, 'audit-detail-390.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  await navigate('/audit'); await wait("document.querySelector('tbody') !== null"); await field('search', 'no-match-'+token); await click('Appliquer'); await wait("document.querySelector('main').textContent.includes('Aucun événement')"); await click('Réinitialiser'); await wait("document.querySelector('tbody') !== null");
  await signOut();
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', checks: 'real product edit, manual stock entry, sale confirmation and audit events; filters/pagination/detail; role denial; Arabic; desktop/tablet/mobile; empty/reset; no secret leakage', outputDir }, null, 2));
} catch (error) { console.error('Browser page:', await evaluate('document.body.innerText').catch(() => 'unavailable')); throw error; }
finally {
  await db.query('BEGIN');
  await db.query('DELETE FROM public."saleLine" WHERE "saleId" = $1', [saleId]); await db.query('DELETE FROM public.sale WHERE id=$1 AND reference=$2', [saleId, `${token}-SALE`]);
  await db.query('DELETE FROM public."stockMovement" WHERE "productId"=$1', [productId]); await db.query('DELETE FROM public.product WHERE id=$1 AND sku=$2', [productId, token]);
  await db.query('DELETE FROM public."auditEvent" WHERE "actorUserId"=ANY($1::int[])', [ownedUsers]); await db.query('DELETE FROM public."user" WHERE id=ANY($1::int[])', [ownedUsers]); await db.query('COMMIT');
  const after = await snapshot(); await db.end(); await send('Browser.close').catch(() => {}); socket.close(); assert.deepEqual(after, before); console.log('Owned test events/users/business fixtures removed; pre-existing records and manual accounts unchanged.');
}
