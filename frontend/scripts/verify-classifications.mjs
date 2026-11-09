// Local servers + isolated Chrome :9223. Only this script's UUID-owned records are changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const { UsersService } = await import(pathToFileURL(path.resolve('../backend/dist/auth/users.service.js')));
const { ClassificationsService } = await import(pathToFileURL(path.resolve('../backend/dist/classifications/classifications.service.js')));
const { ProductsService } = await import(pathToFileURL(path.resolve('../backend/dist/products/products.service.js')));
const tag = `test-classification-ui-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`;
const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const output = path.resolve('../.tmp', tag); await mkdir(output, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0; const pending = new Map(), errors = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(Error(method)), 30000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id) { const c = pending.get(m.id); if (c) { clearTimeout(c.timer); pending.delete(m.id); if (m.error) c.reject(Error(JSON.stringify(m.error))); else c.resolve(m.result); } } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); else if (m.method === 'Runtime.consoleAPICalled' && m.params.args.some(a => /hydration|hydrating|did not match/i.test(a.value ?? ''))) errors.push('Hydration error'); });
async function ev(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function wait(expression) { const end = Date.now() + 20000; while (Date.now() < end) { if (await ev(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw Error(`Timed out: ${expression}`); }
async function navigate(route) { await ev('window.__oldPage = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait('!window.__oldPage && !!document.querySelector("main h1")'); }
async function field(selector, value) { await ev(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
const click = label => ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
let productId; const snapshots = {};
for (const table of ['product', 'stockMovement', 'sale', 'purchase', 'onlineOrder', 'customer', 'customerSession', 'user', 'authSession', 'classification', 'productClassification']) snapshots[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) rows FROM public."${table}" t`)).rows[0].rows;
try {
  await new UsersService().create({ fullName: tag, email: `${tag}@example.test`, role: 'ADMIN', password });
  const a = await new ClassificationsService().create({ nameFr: `${tag} A` }), b = await new ClassificationsService().create({ nameFr: `${tag} B` });
  const p = await new ProductsService().create({ sku: tag, name: 'منتج اختبار التصنيف', productType: 'VRAC', salePrice: '12.500', classificationIds: [a.id, b.id], measurementMode: 'WEIGHT', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', isActive: true, isSellable: true, isVisibleOnline: true }); productId = p.id;
  const login = await fetch('http://localhost:3001/auth/login', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${tag}@example.test`, password }) }); assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0]; const [name, value] = cookie.split('=');
  await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable'); await send('Network.setCookie', { name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' });
  await navigate(`/products/${p.id}/edit`); await wait("document.querySelectorAll('[name=classificationIds]:checked').length===2");
  for (const width of [1440, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    assert.equal(await ev('document.documentElement.scrollWidth > innerWidth + 1'), false);
    await writeFile(path.join(output, `product-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  await ev("document.querySelectorAll('[name=classificationIds]:checked').forEach(c=>c.click())");
  await click('Enregistrer le produit'); await wait("document.querySelector('[role=alert]')?.textContent.includes('besoin actif')");
  assert.equal((await new ProductsService().findOne(p.id)).classificationIds.length, 2);
  await click('+ Ajouter un besoin');
  await field('input[placeholder="Ex. Cheveux"]', `${tag} C`); await click('Créer et sélectionner'); await wait("document.querySelectorAll('[name=classificationIds]:checked').length===1");
  assert.equal(await ev("document.querySelector('[name=measurementMode]').value"), 'WEIGHT');
  assert.equal(await ev("document.querySelector('[name=storageUnit]').value"), 'KG');
  await ev(`document.querySelector('[name=classificationIds][value="${b.id}"]').click()`);
  await click('Enregistrer le produit'); await wait("location.pathname==='/products'");
  const updated = await new ProductsService().findOne(p.id); assert.equal(updated.classificationIds.length, 2); assert.equal(updated.salePrice, '12.500');
  const c = (await new ClassificationsService().list()).find(row => row.nameFr === `${tag} C`); assert.ok(c); assert.ok(updated.classificationIds.includes(c.id));
  await navigate(`/products/${p.id}/edit`); await wait("document.querySelectorAll('[name=classificationIds]:checked').length===2");
  await navigate('/classifications'); await wait(`document.querySelector('main').textContent.includes(${JSON.stringify(c.nameFr)})`);
  await ev(`[...document.querySelectorAll('li')].find(li=>li.textContent.includes(${JSON.stringify(c.nameFr)})).querySelector('button').click()`);
  await wait(`document.querySelector('[name=nameFr]')?.value===${JSON.stringify(c.nameFr)}`);
  await field('[name=nameFr]', `${tag} C renamed`); await click('Enregistrer'); await wait(`document.querySelector('li') && document.querySelector('main').textContent.includes(${JSON.stringify(`${tag} C renamed`)})`);
  await navigate(`/shop/besoins/${c.slug}`); await wait(`!!document.querySelector('a[href="/shop/products/${p.id}"]')`);
  assert.equal(await ev('document.documentElement.scrollWidth > innerWidth + 1'), false);
  await writeFile(path.join(output, 'public-filter-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  await navigate('/shop'); await wait('!!document.querySelector("#products")'); assert.equal(await ev('!!document.querySelector("#categories")'), false);
  for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    await ev(`document.querySelector('button[aria-controls="shop-needs-drawer"]').click()`);
    await wait(`!!document.querySelector('#shop-needs-drawer[open] a[href="/shop/besoins/${c.slug}"]')`);
    assert.equal(await ev('document.documentElement.scrollWidth > innerWidth + 1'), false);
    await new Promise(resolve => setTimeout(resolve, 250));
    await writeFile(path.join(output, `drawer-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait('!document.querySelector("#shop-needs-drawer[open]")');
  }
  const publicNeeds = await (await fetch('http://localhost:3001/public/classifications')).json();
  const secondNeed = publicNeeds.find(item => item.id === b.id);
  await navigate(`/shop/besoins/${secondNeed.slug}`); await wait(`!!document.querySelector('a[href="/shop/products/${p.id}"]')`);
  await navigate('/shop/catalogue?classification=ignored'); await wait('location.pathname === "/shop" && !!document.querySelector("#products")');
  assert.equal(await ev('!!document.querySelector("select[name=classification]")'), false);
  await navigate(`/shop/products/${p.id}`); await wait("!!document.querySelector('.pd-category')"); assert.ok((await ev("document.querySelector('.pd-category').textContent")).includes('C renamed'));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, checks: 'required classification; inline create; multiple saved selections; independent units; ADMIN management; public filter/home/detail; 1440/768/390; no overflow or hydration exceptions', output }));
} finally {
  await db.query('DELETE FROM public.product WHERE id=$1 AND sku=$2', [productId ?? -1, tag]);
  await db.query('DELETE FROM public.classification WHERE "nameFr" LIKE $1', [`${tag}%`]);
  await db.query('DELETE FROM public."user" WHERE email=$1', [`${tag}@example.test`]);
  for (const [table, before] of Object.entries(snapshots)) assert.deepEqual((await db.query(`SELECT jsonb_agg(t ORDER BY id) rows FROM public."${table}" t`)).rows[0].rows, before);
  await db.end(); await send('Browser.close').catch(() => {}); socket.close();
  console.log('Disposable fixtures removed; original records unchanged. Security audit entries retained.');
}
