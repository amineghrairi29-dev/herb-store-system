// Local servers + isolated Chrome :9223. Only UUID-owned fixtures are modified.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const { ProductsService } = await import(pathToFileURL(path.resolve('../backend/dist/products/products.service.js')));
const { ClassificationsService } = await import(pathToFileURL(path.resolve('../backend/dist/classifications/classifications.service.js')));
const { StockMovementsService } = await import(pathToFileURL(path.resolve('../backend/dist/stock-movements/stock-movements.service.js')));
const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const tag = `profile-ui-${crypto.randomUUID()}`, email = `${tag}@example.test`, password = `Aa9-${crypto.randomUUID()}`;
const output = path.resolve('../.tmp', tag); await mkdir(output, { recursive: true });
const tables = ['customer', 'customerSession', 'user', 'authSession', 'product', 'productClassification', 'classification', 'stockMovement', 'onlineOrder', 'onlineOrderLine'];
const snapshot = async () => { const data = []; for (const table of tables) data.push((await db.query(`SELECT jsonb_agg(t ORDER BY id) rows FROM public."${table}" t`)).rows[0].rows); return data; };
const before = await snapshot();
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let sequence = 0; const pending = new Map(), errors = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(Error(method)), 20000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); }); }
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(Error(JSON.stringify(m.error))); else p.resolve(m.result); } } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); });
const ev = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
async function wait(expression) { for (let i = 0; i < 150; i++) { if (await ev(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw Error(expression); }
async function navigate(route) { await ev('window.oldPage=true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait('!window.oldPage'); }
let productId, classificationId;
try {
  await send('Runtime.enable'); await send('Network.clearBrowserCookies');
  await navigate('/shop/profile'); await wait('location.pathname === "/shop/auth"');
  const registration = await fetch('http://localhost:3001/public/auth/register', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName: 'Profile Test' }) }); assert.equal(registration.status, 201);
  const [name, value] = registration.headers.get('set-cookie').split(';')[0].split('=');
  await send('Network.setCookie', { name, value, domain: 'localhost', path: '/', httpOnly: true });
  await navigate('/shop/profile'); await wait('!!document.querySelector("input[name=fullName]")');
  await ev(`document.querySelector('input[name=fullName]').value='عميل Test'; document.querySelector('input[name=phone]').value='20987654'; document.querySelector('textarea[name=deliveryAddress]').value='12 rue des Plantes، تونس'; document.querySelector('form').requestSubmit();`);
  await wait('document.body.textContent.includes("Votre profil a été enregistré")');
  await navigate('/shop/profile'); await wait(`document.querySelector('textarea[name=deliveryAddress]')?.value==='12 rue des Plantes، تونس'`);
  assert.equal(await ev('document.querySelector("input[type=email]").readOnly'), true);
  for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    assert.equal(await ev('document.documentElement.scrollWidth>innerWidth'), false);
    await writeFile(path.join(output, `profile-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  classificationId = (await new ClassificationsService().create({ nameFr: tag })).id;
  productId = (await new ProductsService().create({ sku: tag, name: tag, productType: 'VRAC', salePrice: '12.500', classificationIds: [classificationId], measurementMode: 'WEIGHT', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', isActive: true, isSellable: true, isVisibleOnline: true })).id;
  await new StockMovementsService().create({ productId, type: 'ENTRY', quantity: '1', unit: 'KG' });
  await ev(`localStorage.setItem('herb-store-cart-v1',JSON.stringify({version:1,items:[{productId:${productId},quantity:'1.000'}]}))`);
  await navigate('/shop/checkout'); await wait('!!document.querySelector("input[name=customerName]")');
  assert.deepEqual(await ev(`[document.querySelector('input[name=customerName]').value,document.querySelector('input[name=customerPhone]').value,document.querySelector('textarea[name=deliveryAddress]').value]`), ['عميل Test', '20987654', '12 rue des Plantes، تونس']);
  await navigate('/shop/profile'); await wait('!!document.querySelector("input[name=fullName]")');
  await ev(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Se déconnecter').click()`); await wait('location.pathname === "/shop/auth"');
  assert.deepEqual(errors, []); console.log('PASS: guest redirect, save/reload, read-only email, desktop/mobile, checkout prefill, logout; no orders submitted.', output);
} finally {
  if (productId) { await db.query('DELETE FROM public."stockMovement" WHERE "productId"=$1', [productId]); await db.query('DELETE FROM public.product WHERE id=$1 AND sku=$2', [productId, tag]); }
  if (classificationId) await db.query('DELETE FROM public.classification WHERE id=$1 AND "nameFr"=$2', [classificationId, tag]);
  await db.query('DELETE FROM public.customer WHERE email=$1', [email]);
  assert.deepEqual(await snapshot(), before); await db.end();
  await send('Browser.close'); ws.close();
}
