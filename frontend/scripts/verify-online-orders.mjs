// Isolated Chrome (localhost:9223), both app servers, and disposable UUID fixtures only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-ORDER-UI-${crypto.randomUUID()}`, customer = `عميل ${token}`;
const outputDir = path.resolve('../.tmp', `online-orders-validation-${Date.now()}`); await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0, fail = false, confirm = false, productId;
const pending = new Map(), requests = [], errors = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Network.requestWillBeSent' && message.params.request.url.startsWith('http://localhost:3001/')) requests.push(message.params.request);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.args.some((arg) => /hydration|hydrating|did not match/i.test(arg.value ?? ''))) errors.push('Hydration error');
  if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: confirm }).catch((error) => errors.push(error.message));
  if (message.method === 'Fetch.requestPaused') void (async () => {
    const { requestId, request } = message.params;
    if (!fail || request.method === 'OPTIONS') return send('Fetch.continueRequest', { requestId });
    await send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }], body: Buffer.from(JSON.stringify({ message: 'Test : service temporairement indisponible.' })).toString('base64') });
  })().catch((error) => errors.push(error.message));
});
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function wait(expression) { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__orderTestNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__orderTestNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = (label) => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const ready = () => wait("[...document.querySelectorAll('button')].some(b => b.textContent === 'Envoyer la commande' && !b.disabled)");
async function field(name, value) { await evaluate(`(() => { const field = document.querySelector('[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`); }
const snapshot = async () => (await client.query(`SELECT (SELECT jsonb_agg(p ORDER BY id) FROM public.product p) AS products, (SELECT jsonb_agg(m ORDER BY id) FROM public."stockMovement" m) AS stock, (SELECT jsonb_agg(s ORDER BY id) FROM public.sale s) AS sales, (SELECT jsonb_agg(c ORDER BY id) FROM public."cashMovement" c) AS cash, (SELECT jsonb_agg(o ORDER BY id) FROM public."onlineOrder" o) AS orders, (SELECT jsonb_agg(l ORDER BY id) FROM public."onlineOrderLine" l) AS lines`)).rows;
await client.connect(); const before = await snapshot();
try {
  const created = await client.query(`INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,'نعناع','VRAC',0.1,$1,'KG','KG',1,true,true,true,now()) RETURNING id`, [token]); productId = created.rows[0].id;
  await client.query(`INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`, [productId]);
  const fixtures = await snapshot();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  for (const route of ['/shop/checkout', '/shop/order-success', '/online-orders']) assert.equal((await fetch(`http://localhost:3000${route}`)).status, 200);
  await navigate(`/shop/products/${productId}`); await evaluate("localStorage.removeItem('herb-store-cart-v1')"); await navigate(`/shop/products/${productId}`);
  await wait("[...document.querySelectorAll('button')].some(b => b.textContent === 'Ajouter au panier' && !b.disabled)"); await click('Ajouter au panier'); await wait("document.querySelector('header').textContent.includes('Panier (1)')");
  await navigate('/shop/cart'); await wait("document.querySelector('a[href=" + JSON.stringify('/shop/checkout') + "]') !== null"); await evaluate("document.querySelector('a[href=" + JSON.stringify('/shop/checkout') + "]').click()"); await wait("location.pathname === '/shop/checkout'"); await ready();
  await click('Envoyer la commande'); assert.ok(await evaluate("document.querySelectorAll('input:invalid').length >= 2"));
  assert.equal(requests.filter((r) => r.method === 'POST' && r.url.endsWith('/public/orders')).length, 0);
  await field('customerName', customer); await field('customerPhone', '20123456'); await field('customerEmail', 'bad'); await click('Envoyer la commande'); assert.ok(await evaluate("!document.querySelector('[name=customerEmail]').validity.valid")); await field('customerEmail', 'test@example.com');
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 }); assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')); await writeFile(path.join(outputDir, `checkout-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/public/orders' }] }); fail = true;
  await click('Envoyer la commande'); await wait("document.body.textContent.includes('service temporairement indisponible')");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('herb-store-cart-v1')).items.length"), 1);
  assert.equal((await client.query('SELECT id FROM public."onlineOrder" WHERE "customerName" = $1', [customer])).rowCount, 0);
  fail = false; await ready(); const attempts = requests.filter((r) => r.method === 'POST' && r.url.endsWith('/public/orders')).length;
  await evaluate("document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit()");
  await wait("location.pathname === '/shop/order-success' && document.body.textContent.includes('Commande enregistrée')");
  assert.equal(requests.filter((r) => r.method === 'POST' && r.url.endsWith('/public/orders')).length - attempts, 1);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('herb-store-cart-v1')).items.length"), 0);
  assert.ok(await evaluate("document.querySelector('main').textContent.includes('0,100 DT')"));
  const receipt = await evaluate("JSON.parse(sessionStorage.getItem('herb-store-order-receipt-v1'))");
  assert.ok(await evaluate(`document.body.textContent.includes(${JSON.stringify(receipt.reference)})`));
  const first = (await client.query('SELECT id FROM public."onlineOrder" WHERE reference = $1', [receipt.reference])).rows[0].id;
  await navigate(`/online-orders?q=${encodeURIComponent(token)}`); await wait("document.querySelector('tbody tr') !== null");
  assert.ok(await evaluate("document.querySelector('tbody').textContent.includes('عميل')"));
  await evaluate("document.querySelector('tbody a').click()"); await wait("document.querySelector('[data-order-status]')?.textContent === 'En attente'");
  confirm = false; await click('Confirmer'); await wait("document.querySelector('[data-order-status]')?.textContent === 'En attente'");
  confirm = true; await click('Confirmer'); await wait("document.querySelector('[data-order-status]')?.textContent === 'Confirmée'");
  assert.equal((await client.query('SELECT status FROM public."onlineOrder" WHERE id = $1', [first])).rows[0].status, 'CONFIRMED');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
  await writeFile(path.join(outputDir, 'admin-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  // A second order through checkout validates cancellation independently.
  await navigate(`/shop/products/${productId}`); await wait("[...document.querySelectorAll('button')].some(b => b.textContent === 'Ajouter au panier' && !b.disabled)"); await click('Ajouter au panier'); await wait("document.querySelector('header').textContent.includes('Panier (1)')");
  await navigate('/shop/checkout'); await ready(); await field('customerName', customer); await field('customerPhone', '20123456'); await click('Envoyer la commande'); await wait("location.pathname === '/shop/order-success' && document.body.textContent.includes('Commande enregistrée')");
  const secondReceipt = await evaluate("JSON.parse(sessionStorage.getItem('herb-store-order-receipt-v1'))"); const second = (await client.query('SELECT id FROM public."onlineOrder" WHERE reference = $1', [secondReceipt.reference])).rows[0].id;
  await navigate(`/online-orders/${second}`); await wait("document.querySelector('[data-order-status]')?.textContent === 'En attente'"); await click('Annuler'); await wait("document.querySelector('[data-order-status]')?.textContent === 'Annulée'");
  const afterActions = await snapshot(); for (const key of ['products', 'stock', 'sales', 'cash']) assert.deepEqual(afterActions[0][key], fixtures[0][key]);
  assert.ok(requests.every((r) => ['GET', 'OPTIONS'].includes(r.method) || (r.method === 'POST' && ['/public/cart/validate', '/public/orders', '/public/orders/preview'].some((suffix) => r.url.endsWith(suffix))) || (r.method === 'PATCH' && new RegExp(`/online-orders/(${first}|${second})/status$`).test(r.url))));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', cases: 'cart -> checkout, required/email validation, failed order preserves cart, double submit blocked, success receipt and cleared cart, admin list/details, confirm/cancel dialogs, UTF-8, no hydration errors, desktop/tablet/mobile, unchanged stock/Sale/cash', references: [receipt.reference, secondReceipt.reference], outputDir }, null, 2));
} catch (error) {
  console.error('Browser page at failure:', await evaluate('document.body.innerText').catch(() => 'unavailable'));
  throw error;
} finally {
  await client.query('BEGIN');
  await client.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName" = $1)', [customer]); await client.query('DELETE FROM public."onlineOrder" WHERE "customerName" = $1', [customer]);
  await client.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [productId]); await client.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [productId, token]); await client.query('COMMIT');
  const after = await snapshot(); await client.end(); await send('Browser.close').catch(() => {}); socket.close(); assert.deepEqual(after, before); console.log('Disposable orders/products removed; existing business data unchanged.');
}
