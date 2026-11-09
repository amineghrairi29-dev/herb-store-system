// Run from frontend with both apps and isolated Chrome on :9223.
// Browser-only API fixtures. No database writes, uploads, orders or stock changes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = 'product-card-check-' + crypto.randomUUID();
const output = path.resolve('../.tmp', tag);
await mkdir(output, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), errors = [], guestAuthWarnings = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const callback = pending.get(message.id); pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push('Runtime exception');
  if (message.method === 'Runtime.consoleAPICalled' && (message.params.type === 'error' || message.params.args.some(arg => /hydration|hydrating/i.test(arg.value ?? '')))) errors.push('Console/hydration error');
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    const entry = message.params.entry;
    if (/status of 401/.test(entry.text) && /^http:\/\/localhost:3001\/(public\/)?auth\/me$/.test(entry.url ?? '')) guestAuthWarnings.push({ url: entry.url, text: entry.text });
    else errors.push({ url: entry.url, text: entry.text });
  }
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + expression);
  return result.result.value;
}
async function wait(expression) {
  for (let count = 0; count < 300; count++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('UI timeout: ' + expression);
}
async function navigate(route) {
  await evaluate('window.__previous=true');
  await send('Page.navigate', { url: 'http://localhost:3000' + route });
  await wait('!window.__previous&&document.querySelector("main")');
}
const live = await (await fetch('http://localhost:3001/public/products')).json();
assert.ok(live.data.length, 'A public product is needed for the read-only baseline');
const base = live.data[0];
const categories = ['Herbes', 'Huiles', 'Mélanges'].map((name, i) => ({ id: 900001 + i, slug: 'card-check-' + i, nameFr: name, nameAr: name, imagePath: null, subcategories: [] }));
const products = ['Menthe', 'Huile naturelle aux plantes et fleurs — un nom volontairement très long pour vérifier les deux lignes', 'Mélange', 'نعناع طبيعي', 'Tisane douce'].map((name, i) => ({ ...base, id: 900001 + i, sku: 'CARD-' + i, name, category: categories[i % 3], subcategory: null, salePrice: '12.500', saleUnit: ['G', 'ML', 'PIECE', 'KG', 'L'][i], mainImagePath: i === 2 ? null : base.mainImagePath, availabilityStatus: i === 3 ? 'OUT_OF_STOCK' : i === 4 ? 'LOW_STOCK' : 'IN_STOCK' }));
let mocked = false;
socket.addEventListener('message', async event => {
  const m = JSON.parse(event.data);
  if (m.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = m.params;
  if (request.method === 'OPTIONS') { await send('Fetch.continueRequest', { requestId }); return; }
  const url = new URL(request.url);
  let body;
  if (mocked && url.pathname === '/public/products') {
    const items = products.filter(p => (!url.searchParams.get('category') || p.category.slug === url.searchParams.get('category')) && (!url.searchParams.get('q') || p.name.includes(url.searchParams.get('q'))));
    body = { data: items, pagination: { page: 1, pageSize: 24, totalItems: items.length, totalPages: 1 } };
  } else if (mocked && url.pathname === '/public/categories') body = categories;
  else if (mocked && /^\/public\/products\/90000[1-5]$/.test(url.pathname)) body = products.find(p => String(p.id) === url.pathname.split('/').at(-1));
  else if (mocked && url.pathname === '/public/cart/validate') {
    body = { items: JSON.parse(request.postData).items.map(line => {
      const product = products.find(p => p.id === line.productId);
      return { productId: line.productId, valid: true, quantityAvailable: true, message: null, currentPrice: product.salePrice, availabilityStatus: product.availabilityStatus, product: { ...product, category: product.category.nameFr } };
    }) };
  }
  if (body) await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  else await send('Fetch.continueRequest', { requestId });
});
try {
  await send('Fetch.disable'); await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await navigate('/shop'); await wait('document.querySelector(".botanical-product-card")');
  await evaluate('document.querySelector(".botanical-product-card").scrollIntoView()');
  await wait('document.querySelector(".botanical-product-card img").complete&&document.querySelector(".botanical-product-card img").naturalWidth>0');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/public/*', requestStage: 'Request' }] });
  mocked = true;
  for (const route of ['/shop', '/shop/catalogue']) {
    await navigate(route); await wait('document.querySelectorAll(".botanical-product-card").length===5');
    for (const width of [1920,1440,1024,768,600,390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
      await evaluate('document.querySelector(".botanical-product-grid").scrollIntoView()');
      await wait('[...document.querySelectorAll(".bpc-image img")].every(i=>i.complete&&i.naturalWidth>0)');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Overflow: ' + route + width);
      assert.ok(await evaluate('[...document.querySelectorAll(".bpc-image img")].every(i=>getComputedStyle(i).objectFit==="contain")'));
      assert.ok(await evaluate('[...document.querySelectorAll(".bpc-name")].every(n=>n.clientHeight===44&&getComputedStyle(n).webkitLineClamp==="2")'));
      const proportions = await evaluate('[...document.querySelectorAll(".botanical-product-card")].map(c=>({height:c.getBoundingClientRect().height,image:c.querySelector(".bpc-image-link").getBoundingClientRect().height}))');
      assert.ok(proportions.every(c => c.height < 370 && c.image / c.height >= 0.34 && c.image / c.height <= 0.43), 'Compact proportions: ' + route + width);
      await writeFile(path.join(output, `${route === '/shop' ? 'home' : 'catalogue'}-${width}-dimensions.json`), JSON.stringify(proportions, null, 2));
      const cards = await evaluate('[...document.querySelectorAll(".botanical-product-card")].map(c=>({top:Math.round(c.getBoundingClientRect().top),height:Math.round(c.getBoundingClientRect().height),button:Math.round(c.querySelector("button").getBoundingClientRect().top)}))');
      for (const card of cards) for (const other of cards.filter(c=>c.top===card.top)) { assert.equal(card.height, other.height); assert.equal(card.button, other.button); }
      await writeFile(path.join(output, `${route === '/shop' ? 'home' : 'catalogue'}-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
    }
  }
  assert.ok(await evaluate(`document.querySelector('[data-product-id="900004"] button').disabled`));
  assert.ok(await evaluate(`!!document.querySelector('[data-product-id="900003"] .bpc-placeholder svg')`));
  await evaluate('document.querySelector(".bpc-name-link").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.ok(await evaluate('document.activeElement.tagName==="BUTTON"&&getComputedStyle(document.activeElement).outlineStyle!=="none"'));
  await evaluate(`document.querySelector('[data-product-id="900001"] button').click()`);
  await wait(`document.querySelector('[data-product-id="900001"] [role=status]')`);
  assert.equal(await evaluate('location.pathname'), '/shop/catalogue');
  assert.ok(await evaluate('localStorage.getItem("herb-store-cart-v1").includes("900001")'));
  await evaluate('document.querySelector(".bpc-name-link").click()');
  await wait('location.pathname==="/shop/products/900001"');
  await navigate('/shop/catalogue?category=card-check-1'); await wait('document.querySelectorAll(".botanical-product-card").length===2');
  await navigate('/shop/catalogue?q=Menthe'); await wait('document.querySelectorAll(".botanical-product-card").length===1');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, browserOnlyFixtures: true, widths: [1920,1440,1024,768,600,390], errors, guestAuthWarnings, output }, null, 2));
  console.log('Product card checks passed: ' + output);
} finally {
  await evaluate('localStorage.removeItem("herb-store-cart-v1")').catch(()=>{});
  await db.end(); await send('Browser.close').catch(()=>{}); socket.close();
}
