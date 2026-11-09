// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-FULFILL-UI-${crypto.randomUUID()}`, customer = `${token} عميل`;
const outputDir = path.resolve('../.tmp', `fulfillment-validation-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let seq = 0, accept = false, productId;
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
async function api(route, method = 'GET', body) { const response = await fetch(`http://localhost:3001${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); assert.ok(response.ok, `${method} ${route}: ${response.status} ${response.ok ? '' : await response.text()}`); return response.json(); }
const snapshot = async () => {
  const result = {};
  for (const table of ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine']) result[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows;
  return result;
};
const stock = async () => Number((await db.query('SELECT sum(CASE WHEN type IN (\'EXIT\',\'LOSS\',\'ADJUSTMENT_OUT\') THEN -"quantityInStorageUnit" ELSE "quantityInStorageUnit" END) AS stock FROM public."stockMovement" WHERE "productId" = $1', [productId])).rows[0].stock);
await db.connect(); const before = await snapshot();
try {
  productId = (await db.query(`INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,'نعناع','VRAC',0.1,$1,'KG','KG',1,true,true,true,now()) RETURNING id`, [token])).rows[0].id;
  await db.query(`INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`, [productId]);
  const receipt = await api('/public/orders', 'POST', { customerName: customer, customerPhone: '20123456', items: [{ productId, quantity: '2' }] });
  const orderId = (await db.query('SELECT id FROM public."onlineOrder" WHERE reference = $1', [receipt.reference])).rows[0].id;
  assert.equal(await stock(), 10);
  const preflight = await fetch(`http://localhost:3001/online-orders/${orderId}/convert-to-sale`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.ok(preflight.ok); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000'); assert.ok(preflight.headers.get('access-control-allow-methods').includes('POST'));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await navigate(`/online-orders/${orderId}`); await wait("document.querySelector('[data-order-status]')?.textContent === 'En attente'");
  accept = true; await click('Confirmer'); await wait("document.querySelector('[data-order-status]')?.textContent === 'Confirmée'"); assert.equal(await stock(), 10);
  await wait("document.body.textContent.includes('Créer la vente')"); accept = false; await click('Créer la vente');
  assert.equal((await api(`/online-orders/${orderId}`)).saleId, null);
  accept = true; await click('Créer la vente'); await wait("document.body.textContent.includes('Vente créée')");
  const converted = await api(`/online-orders/${orderId}`); assert.equal(converted.sale.status, 'DRAFT'); assert.equal(await stock(), 10);
  assert.equal(requests.filter(r => r.method === 'POST' && r.url.endsWith('/convert-to-sale')).length, 1);
  assert.ok(await evaluate("document.body.textContent.includes('عميل') && document.body.textContent.includes('نعناع')"));
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    await writeFile(path.join(outputDir, `order-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  await evaluate("[...document.querySelectorAll('a')].find(a => a.textContent === 'Voir la vente').click()");
  await wait(`location.pathname === '/sales/${converted.saleId}' && document.body.textContent.includes('Commande en ligne')`);
  assert.ok(await evaluate(`document.querySelector('a[href="/online-orders/${orderId}"]') !== null`));
  await click('Confirmer'); await wait("document.querySelector('dialog[open]') !== null"); await click('Confirmer la vente');
  await wait("document.querySelector('dialog[open]') === null && ![...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Confirmer')");
  assert.equal((await api(`/sales/${converted.saleId}`)).status, 'CONFIRMED'); assert.equal(await stock(), 8);
  assert.equal((await db.query('SELECT id FROM public."stockMovement" WHERE "productId" = $1 AND type = \'EXIT\'', [productId])).rowCount, 1);
  await navigate(`/online-orders/${orderId}`); await wait("document.body.textContent.includes('Vente créée')");
  assert.ok(await evaluate("![...document.querySelectorAll('button')].some(b => ['Créer la vente','Annuler'].includes(b.textContent.trim()))"));
  await navigate(`/online-orders?q=${encodeURIComponent(token)}`); await wait(`document.querySelector('tbody')?.textContent.includes(${JSON.stringify(converted.sale.reference)})`);
  assert.ok(await evaluate("document.querySelector('thead').textContent.includes('Traitement') && document.querySelector('tbody').textContent.includes('Vente créée')"));
  const afterActions = await snapshot(); for (const table of ['salePayment', 'cashMovement']) assert.deepEqual(afterActions[table], before[table]);
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', lifecycle: '10 -> 10 -> 10 -> 8', checks: 'cancel conversion; one POST; draft link; Sale source; confirmation; one EXIT; refreshed list; UTF-8; desktop/tablet/mobile; CORS; no hydration errors or payments/cash', outputDir }, null, 2));
} catch (error) { console.error('Browser page:', await evaluate('document.body.innerText').catch(() => 'unavailable')); throw error; }
finally {
  await db.query('BEGIN');
  await db.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName" = $1)', [customer]);
  await db.query('DELETE FROM public."onlineOrder" WHERE "customerName" = $1', [customer]);
  await db.query('DELETE FROM public."saleLine" WHERE "saleId" IN (SELECT id FROM public.sale WHERE "customerName" = $1)', [customer]);
  await db.query('DELETE FROM public.sale WHERE "customerName" = $1', [customer]);
  await db.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [productId]);
  await db.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [productId, token]);
  await db.query('COMMIT'); const after = await snapshot(); await db.end(); await send('Browser.close').catch(() => {}); socket.close();
  assert.deepEqual(after, before); console.log('Disposable fixtures removed; existing business data unchanged.');
}
