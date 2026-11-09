// Run from frontend with isolated Chrome on localhost:9223 and both app servers running.
// All DB writes target UUID-tagged disposable products; cart requests themselves are read-only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-CART-UI-${crypto.randomUUID()}`, ids = [];
const outputDir = path.resolve('../.tmp', `cart-validation-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0, fail = false, confirm = false;
const pending = new Map(), requests = [], errors = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
}
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Network.requestWillBeSent' && message.params.request.url.startsWith('http://localhost:3001/')) requests.push(message.params.request);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.args.some((arg) => /hydration|hydrating|did not match/i.test(arg.value ?? ''))) errors.push('Hydration error');
  if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: confirm }).catch((error) => errors.push(error.message));
  if (message.method === 'Fetch.requestPaused') void (async () => {
    const { requestId } = message.params;
    if (!fail) return send('Fetch.continueRequest', { requestId });
    await send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'POST,OPTIONS' }], body: Buffer.from('{}').toString('base64') });
  })().catch((error) => errors.push(error.message));
});
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function wait(expression) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__cartTestNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__cartTestNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = (label) => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const count = (n) => wait(`document.querySelector('header').textContent.includes('Panier (${n})')`);
const total = (value) => wait(`document.querySelector('[data-cart-total="true"]')?.textContent === ${JSON.stringify(value)}`);
async function quantity(value) { await evaluate(`(() => { const field = document.querySelector('input[aria-label="Quantité"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`); await click('Mettre à jour'); }
async function add(id) {
  await wait(`document.querySelector('a[href="/shop/products/${id}"]')?.closest('article')?.querySelector('button')?.disabled === false`);
  await evaluate(`document.querySelector('a[href="/shop/products/${id}"]').closest('article').querySelector('button').click()`);
  await wait(`document.querySelector('a[href="/shop/products/${id}"]').closest('article').textContent.includes('Ajouté au panier.') && !document.querySelector('a[href="/shop/products/${id}"]').closest('article').querySelector('button').disabled`);
}
const snapshot = async () => (await client.query(`SELECT (SELECT jsonb_agg(p ORDER BY id) FROM public.product p) AS products, (SELECT jsonb_agg(m ORDER BY id) FROM public."stockMovement" m) AS stock, (SELECT jsonb_agg(s ORDER BY id) FROM public.sale s) AS sales, (SELECT jsonb_agg(c ORDER BY id) FROM public."cashMovement" c) AS cash`)).rows;
await client.connect(); const before = await snapshot();
try {
  await client.query('BEGIN');
  for (let i = 0; i < 3; i++) {
    const result = await client.query(`INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,$2,'VRAC',0.1,$3,'KG','KG',1,true,true,true,now()) RETURNING id`, [`${token}-${i}`, i === 0 ? 'نعناع' : `Menthe ${i}`, token]); ids.push(result.rows[0].id);
    if (i !== 1) await client.query(`INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`, [ids[i]]);
  }
  await client.query('COMMIT'); const fixtures = await snapshot();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  assert.equal((await fetch('http://localhost:3000/shop/cart')).status, 200);
  const route = `/shop/catalogue?category=${encodeURIComponent(token)}`;
  await navigate(route); await wait("document.querySelectorAll('main article').length === 3");
  await evaluate("localStorage.removeItem('herb-store-cart-v1')"); await navigate(route); await count(0); await wait("document.querySelectorAll('main article').length === 3");
  assert.ok(await evaluate(`document.querySelector('a[href="/shop/products/${ids[1]}"]').closest('article').querySelector('button').disabled`));
  await add(ids[0]); await count(1); await add(ids[0]); await count(1);
  await navigate('/shop/cart'); await total('0,200 DT');
  assert.equal(await evaluate("document.querySelectorAll('[data-cart-line]').length"), 1);
  assert.ok(await evaluate("document.querySelector('[data-cart-line]').textContent.includes('نعناع')"));
  await evaluate("document.querySelector('[aria-label=" + JSON.stringify('Augmenter la quantité') + "]').click()"); await total('0,300 DT');
  await navigate('/shop/cart'); await total('0,300 DT');
  await quantity('2,5'); await total('0,250 DT');
  await evaluate("document.querySelector('[aria-label=" + JSON.stringify('Diminuer la quantité') + "]').click()"); await total('0,150 DT');
  await quantity('0'); await wait("document.body.textContent.includes('Saisissez une quantité supérieure')"); await quantity('1,5');
  await click('Retirer'); await count(0); await wait("document.body.textContent.includes('Votre panier est vide.')");
  await navigate(route); await add(ids[0]); await add(ids[2]); await count(2); await navigate('/shop/cart'); await total('0,200 DT');
  confirm = false; await click('Vider le panier'); await count(2);
  confirm = true; await click('Vider le panier'); await count(0);
  await navigate(`/shop/products/${ids[0]}`); await wait("[...document.querySelectorAll('button')].some(b => b.textContent === 'Ajouter au panier' && !b.disabled)"); await click('Ajouter au panier'); await count(1);
  await client.query('UPDATE public.product SET "salePrice" = 0.2 WHERE id = $1 AND category = $2', [ids[0], token]);
  await navigate('/shop/cart'); await total('0,200 DT');
  await client.query('UPDATE public.product SET "isVisibleOnline" = false WHERE id = $1 AND category = $2', [ids[0], token]);
  await navigate('/shop/cart'); await wait("document.querySelector('[data-cart-line]')?.textContent.includes('Produit indisponible')");
  assert.ok(await evaluate("document.querySelector('[aria-label=" + JSON.stringify('Augmenter la quantité') + "]').disabled"));
  assert.equal(await evaluate("document.querySelector('[data-cart-total=" + JSON.stringify('true') + "]').textContent"), '—');
  await click('Retirer'); await count(0);
  await client.query('UPDATE public.product SET "isVisibleOnline" = true, "salePrice" = 0.1 WHERE id = $1 AND category = $2', [ids[0], token]);
  await evaluate("localStorage.setItem('herb-store-cart-v1', '{broken')"); await navigate('/shop/cart'); await count(0); await wait("document.body.textContent.includes('Certaines données du panier étaient invalides')");
  const stored = { version: 1, items: [{ productId: ids[0], quantity: '3', price: '999' }, { productId: ids[0], quantity: '2' }, { productId: ids[2], quantity: '-1' }] };
  await evaluate(`localStorage.setItem('herb-store-cart-v1', ${JSON.stringify(JSON.stringify(stored))})`); await navigate('/shop/cart'); await total('0,300 DT'); await count(1);
  await quantity('999'); await wait("document.body.textContent.includes('Quantité indisponible')"); await total('—');
  await quantity('0,5'); await total('0,050 DT');
  for (const [width, height] of [[1280, 900], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
    await writeFile(path.join(outputDir, `${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  }
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/public/cart/validate*' }] }); fail = true;
  await click('Actualiser le panier'); await wait("document.body.textContent.includes('Impossible de vérifier le panier')"); await total('—');
  fail = false; await click('Réessayer'); await total('0,050 DT');
  assert.ok(requests.every((r) => ['GET', 'OPTIONS'].includes(r.method) || (r.method === 'POST' && r.url === 'http://localhost:3001/public/cart/validate')));
  assert.deepEqual(errors, []); assert.deepEqual(await snapshot(), fixtures);
  console.log(JSON.stringify({ result: 'passed', cases: 'add/card/detail, duplicate increment, persistence, decimal/comma updates, decrease, removal, clear confirmation, exact totals, count, unavailable/hidden, current price, corrupted storage, stock overrun, endpoint failure/retry, UTF-8, no hydration errors, desktop/tablet/mobile', outputDir }, null, 2));
} finally {
  await client.query('ROLLBACK'); await client.query('BEGIN');
  await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1)', [token]);
  await client.query('DELETE FROM public.product WHERE category = $1 AND sku LIKE $2', [token, `${token}-%`]); await client.query('COMMIT');
  const after = await snapshot(); await client.end(); await send('Browser.close').catch(() => {}); socket.close();
  assert.deepEqual(after, before, 'Existing business data must remain unchanged'); console.log('Disposable fixtures removed; existing product, stock, sale and cash rows unchanged.');
}
