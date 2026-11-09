// Run from frontend with both apps and isolated Chrome on :9223.
// Only UUID-owned temporary products/category are inserted and removed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = 'category-image-check-' + crypto.randomUUID();
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
const mappings = {
  herbes: 'herbes', 'huiles-et-liquides-naturels': 'huiles-liquides',
  epices: 'epices', parfums: 'parfums', 'melanges-speciaux': 'melanges-speciaux',
};
const productIds = [];
let futureId;
try {
  const seeds = (await db.query('SELECT id, slug, "nameFr", "imagePath", "measurementMode" FROM public.category WHERE slug = ANY($1::text[]) ORDER BY "sortOrder"', [Object.keys(mappings)])).rows;
  assert.equal(seeds.length, 5);
  for (const category of seeds) {
    assert.equal(category.imagePath, `/images/categories/${mappings[category.slug]}.png`);
    const unit = category.measurementMode === 'VOLUME' ? 'L' : 'KG';
    const result = await db.query(`INSERT INTO public.product (sku, name, "categoryId", category, "productType", "salePrice", "storageUnit", "saleUnit", "conversionFactor", "isActive", "isSellable", "isVisibleOnline", "updatedAt") VALUES ($1,$2,$3,$2,'VRAC',1,$4,$4,1,true,true,true,now()) RETURNING id`, [tag + '-' + category.slug, category.nameFr, category.id, unit]);
    productIds.push(result.rows[0].id);
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await navigate('/shop');
  await wait('document.querySelectorAll(".sf-category-card img").length===5');
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await evaluate('document.querySelector("#categories").scrollIntoView()');
    await wait('[...document.querySelectorAll(".sf-category-card img")].every(image=>image.complete&&image.naturalWidth>0)');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'overflow at ' + width);
    const dimensions = await evaluate('[...document.querySelectorAll(".sf-category-card img")].map(i=>({fit:getComputedStyle(i).objectFit,alt:i.alt,width:i.clientWidth,height:i.clientHeight}))');
    assert.ok(dimensions.every(d => d.fit === 'cover' && d.alt && d.width > 0 && d.height > 0));
    assert.ok(await evaluate('[...document.querySelectorAll(".sf-category-card")].every(c=>c.querySelector("span").getBoundingClientRect().bottom<=c.getBoundingClientRect().bottom)'), 'clipped card caption at ' + width);
    if (width >= 1440) assert.equal(await evaluate('new Set([...document.querySelectorAll(".sf-category-card")].map(c=>Math.round(c.getBoundingClientRect().top))).size'), 1);
    await writeFile(path.join(output, `shop-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
  for (const category of seeds) {
    await navigate('/shop'); await wait('document.querySelectorAll(".sf-category-card img").length===5');
    await evaluate(`document.querySelector('a.sf-category-card[href="/shop/catalogue?category=${category.slug}"]').click()`);
    await wait(`location.pathname==='/shop/catalogue'&&new URLSearchParams(location.search).get('category')==='${category.slug}'&&document.querySelector('main article')`);
    const result = await evaluate(`fetch('http://localhost:3001/public/products?category=${category.slug}').then(r=>r.json())`);
    assert.ok(result.data.length > 0 && result.data.every(p => p.category.id === category.id));
  }
  futureId = (await db.query(`INSERT INTO public.category ("nameAr","nameFr",slug,"measurementMode","sortOrder","updatedAt") VALUES ($1,$2,$3,'WEIGHT',60,now()) RETURNING id`, ['فئة تجريبية', 'Catégorie sans image', tag])).rows[0].id;
  productIds.push((await db.query(`INSERT INTO public.product (sku,name,"categoryId",category,"productType","salePrice","storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,$2,$3,$2,'VRAC',1,'KG','KG',1,true,true,true,now()) RETURNING id`, [tag + '-future', 'Produit de test', futureId])).rows[0].id);
  await navigate('/shop'); await wait('document.querySelectorAll(".sf-category-card").length===6');
  assert.ok(await evaluate(`!!document.querySelector('a.sf-category-card[href="/shop/catalogue?category=${tag}"] .sf-category-visual svg')`));
  await evaluate(`document.querySelector('a.sf-category-card[href="/shop/catalogue?category=${tag}"]').scrollIntoView()`);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await writeFile(path.join(output, 'fallback-390.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, widths: [1920,1440,1024,768,390], images: 5, linksAndFilters: 5, noImageFallback: true, errors, guestAuthWarnings, output }, null, 2));
  console.log('Category image browser checks passed: ' + output);
} finally {
  await db.query('DELETE FROM public.product WHERE id = ANY($1::int[]) AND sku LIKE $2', [productIds, tag + '%']);
  if (futureId) await db.query('DELETE FROM public.category WHERE id = $1 AND slug = $2', [futureId, tag]);
  await db.end();
  await send('Browser.close').catch(() => {}); socket.close();
}
