// Run from frontend with isolated headless Chrome on localhost:9223.
// UUID-scoped disposable products only. Real business rows are never updated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-SHOP-UI-${crypto.randomUUID()}`, ids = [];
const outputDir = path.resolve('../.tmp', `shop-validation-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0, fail = false;
const pending = new Map(), requests = [], errors = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
}
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Network.requestWillBeSent' && message.params.request.url.startsWith('http://localhost:3001/')) requests.push(message.params.request);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') void (async () => {
    const { requestId } = message.params;
    if (!fail) return send('Fetch.continueRequest', { requestId });
    await send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }], body: Buffer.from('{}').toString('base64') });
  })().catch((error) => errors.push(error.message));
});
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function wait(expression) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
async function loaded(count) { await wait(`document.querySelectorAll('main h2').length === ${count}`); }
async function field(name, value) { await evaluate(`(() => { const field = document.querySelector('[name="${name}"]'); Object.getOwnPropertyDescriptor(field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`); }
const submit = () => evaluate("document.querySelector('form').requestSubmit()");
const snapshot = async () => (await client.query(`SELECT (SELECT jsonb_agg(p ORDER BY id) FROM public.product p) AS products, (SELECT jsonb_agg(m ORDER BY id) FROM public."stockMovement" m) AS stock, (SELECT jsonb_agg(s ORDER BY id) FROM public.sale s) AS sales, (SELECT jsonb_agg(c ORDER BY id) FROM public."cashMovement" c) AS cash`)).rows;
await client.connect();
const before = await snapshot();
try {
  await client.query('BEGIN');
  for (let i = 0; i < 28; i++) {
    const row = await client.query(`INSERT INTO public.product (sku, name, "nameFr", "scientificName", "productType", "salePrice", category, subcategory, "storageUnit", "saleUnit", "conversionFactor", "isActive", "isSellable", "isVisibleOnline", "minStock", description, "updatedAt") VALUES ($1,$2,'Menthe fraîche','Mentha spicata','VRAC',$3,$4,'Feuilles','KG','G',1000,true,true,$5,$6,'Plante aromatique — نبات عطري',now()) RETURNING id`, [`${token}-${i}`, i === 0 ? 'نعناع' : `Menthe ${String(i).padStart(2, '0')}`, i === 0 ? '12.500000000000000001' : String(i + 1), token, i !== 27, i === 1 ? '2.5' : null]);
    ids.push(row.rows[0].id);
    if (i < 2) await client.query(`INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',2.5,'KG',2.5)`, [ids[i]]);
  }
  await client.query('COMMIT');
  const withFixtures = await snapshot();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const route = `/shop?category=${encodeURIComponent(token)}`;
  assert.equal((await fetch('http://localhost:3000/shop')).status, 200);
  await navigate(route); await loaded(24);
  assert.ok(await evaluate("!document.querySelector('header').textContent.match(/Achats|Finance|Rapports/)") );
  await evaluate("[...document.querySelectorAll('a')].find(a => a.textContent === 'Suivant').click()"); await loaded(3);
  await navigate(route); await loaded(24);
  await field('q', 'نعناع'); await submit(); await loaded(1);
  assert.ok(await evaluate("document.querySelector('main').textContent.includes('12,500000000000000001 DT')"));
  await evaluate("document.querySelector('h2').closest('a').click()"); await wait("document.querySelector('article') !== null");
  assert.ok(await evaluate("document.querySelector('h1').textContent.includes('نعناع')"));
  assert.equal((await fetch(`http://localhost:3001/public/products/${ids[27]}`)).status, 404);
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
  }
  await navigate(route); await loaded(24);
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
    await writeFile(path.join(outputDir, `${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  }
  await field('availability', 'LOW_STOCK'); await submit(); await loaded(1); assert.ok(await evaluate("document.querySelector('main').textContent.includes('Stock limité')"));
  await field('availability', 'OUT_OF_STOCK'); await submit(); await loaded(24);
  await field('sort', 'price_desc'); await submit(); await wait("document.querySelector('h2')?.textContent === 'Menthe 26'");
  await field('q', 'zzzz-no-match'); await submit(); await wait("document.body.textContent.includes('Aucun produit ne correspond à votre recherche.')");
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/public/products*' }] }); fail = true;
  await navigate(route); await wait("document.body.textContent.includes('Impossible de charger le catalogue.')");
  fail = false; await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent === 'Réessayer').click()"); await loaded(24);
  assert.ok(requests.every((request) => ['GET', 'OPTIONS'].includes(request.method) || (request.method === 'POST' && request.url === 'http://localhost:3001/public/cart/validate')));
  assert.ok(requests.every((request) => request.url.includes('/public/')));
  assert.deepEqual(errors, []); assert.deepEqual(await snapshot(), withFixtures);
  console.log(JSON.stringify({ result: 'passed', pagination: '24 + 3', checks: 'live search, category, availability, price sorting, Arabic detail, exact price, retry, desktop/tablet/mobile, public reads only (GET and cart validation)', outputDir }, null, 2));
} finally {
  await client.query('ROLLBACK');
  await client.query('BEGIN');
  await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1)', [token]);
  await client.query('DELETE FROM public.product WHERE category = $1 AND sku LIKE $2', [token, `${token}-%`]);
  await client.query('COMMIT');
  const after = await snapshot();
  await client.end(); await send('Browser.close').catch(() => {}); socket.close();
  assert.deepEqual(after, before, 'All existing product, stock, sale and cash rows must remain unchanged');
  console.log('Disposable fixtures removed; existing business data unchanged.');
}
