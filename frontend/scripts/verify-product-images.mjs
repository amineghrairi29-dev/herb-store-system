// Run from frontend with both apps and isolated Chrome on :9223.
// Only UUID-owned user/classification/product fixtures are written and removed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(path.resolve("../backend/package.json"));
require("dotenv").config({ path: "../backend/.env", quiet: true });
const { Client } = require("pg");
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = "ui-images-" + crypto.randomUUID(),
  password = "Aa9-" + crypto.randomUUID();
const output = path.resolve("../.tmp", "product-images-" + Date.now());
await mkdir(output, { recursive: true });
const tabs = await (await fetch("http://localhost:9223/json/list")).json();
const socket = new WebSocket(
  tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((ok) => socket.addEventListener("open", ok, { once: true }));
let seq = 0;
const pending = new Map(),
  errors = [];
function send(method, params = {}) {
  return new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener("message", (event) => {
  const m = JSON.parse(event.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.fail(new Error(m.error.message));
    else p.ok(m.result);
  }
  if (m.method === "Runtime.exceptionThrown") errors.push("Runtime exception");
  if (
    m.method === "Runtime.consoleAPICalled" &&
    (m.params.type === "error" ||
      m.params.args.some((a) => /hydration|hydrating/i.test(a.value ?? "")))
  )
    errors.push("Console error");
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error("Browser evaluation failed");
  return r.result.value;
}
async function wait(expression) {
  for (let n = 0; n < 300; n++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error("UI timeout: " + expression);
}
async function navigate(route) {
  await evaluate("window.__previous=true");
  await send("Page.navigate", { url: "http://localhost:3000" + route });
  await wait('!window.__previous&&document.querySelector("main")!==null');
}
async function fill(name, value) {
  await evaluate(
    `(()=>{const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
const browserFetch = async (route, options = {}) =>
  evaluate(
    `fetch('http://localhost:3001${route}',${JSON.stringify({ credentials: "include", ...options })}).then(async r=>({status:r.status,body:await r.json()}))`,
  );

const { UsersService } = await import('../../backend/dist/auth/users.service.js');
const { discardUnreferencedImage } = await import('../../backend/dist/products/product-image-storage.js');
const sharp = require('sharp');
const users = [];
async function select(name, value) {
  await evaluate(`(()=>{const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
const submit = () => evaluate("document.querySelector('main form').requestSubmit()");
async function api(route, body, method = 'POST') {
  const result = await browserFetch(route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.ok(result.status < 300, route + ': ' + JSON.stringify(result)); return result.body;
}
async function screenshot(label) {
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), label + ' overflow at ' + width);
    await writeFile(path.join(output, `${label}-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  }
}
async function login(user) {
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready=true]')");
  await fill('email', user.email); await fill('password', password); await submit();
  await wait("location.pathname==='/'");
}
async function allCategories() { const r = await browserFetch('/categories'); assert.equal(r.status, 200); return r.body; }

async function chooseFile(file) {
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [file] });
}
const pngPath = path.join(output, 'upload-fixture.png'), jpegPath = path.join(output, 'replacement-fixture.jpg');
let interceptFailure = false;
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method !== 'Fetch.requestPaused') return;
  const requestId = message.params.requestId;
  if (interceptFailure) {
    interceptFailure = false;
    void send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
    ], body: Buffer.from(JSON.stringify({ message: 'Échec simulé du téléversement' })).toString('base64') });
  } else void send('Fetch.continueRequest', { requestId });
});
try {
  await sharp({ create: { width: 480, height: 360, channels: 3, background: '#3c8058' } }).png().toFile(pngPath);
  await sharp({ create: { width: 360, height: 480, channels: 3, background: '#d6a95c' } }).jpeg().toFile(jpegPath);
  const pdfPath = path.join(output, 'invalid.pdf'), oversized = path.join(output, 'oversized.png');
  await writeFile(pdfPath, '%PDF test fixture'); await writeFile(oversized, Buffer.alloc(3 * 1024 * 1024 + 1));
  for (const role of ['ADMIN']) users.push(await new UsersService().create({ fullName: tag, email: `${tag}-${role.toLowerCase()}@example.test`, role, isActive: true, password }));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable');
  await login(users[0]);
  const category = (await allCategories()).find(c => c.slug === 'herbes' && c.isActive); assert.ok(category);
  const legacy = await api('/products', { sku: `${tag}-legacy`, name: 'منتج دون صورة', categoryId: category.id, productType: 'VRAC', storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', salePrice: '1', isVisibleOnline: true });
  await navigate('/products/new'); await wait("document.querySelector('[name=categoryId]')&&!document.querySelector('[name=categoryId]').disabled");
  assert.equal(await evaluate("document.querySelector('[name=image]').required"), true);
  await chooseFile(pdfPath); await wait("document.querySelector('[role=alert]')");
  assert.ok(await evaluate("document.body.textContent.includes('JPG, PNG ou WebP')"));
  await chooseFile(oversized); await wait("document.body.textContent.includes('ne doit pas dépasser 3 Mo')");
  await chooseFile(pngPath); await wait("document.querySelector('img[src^=\"blob:\"]')?.naturalWidth>0");
  await fill('sku', `${tag}-product`); await fill('name', 'نعناع مصور'); await fill('nameFr', 'Menthe avec image');
  await select('productType', 'VRAC'); await select('categoryId', category.id); await select('storageUnit', 'KG'); await select('saleUnit', 'G');
  await fill('conversionFactor', '1000'); await fill('salePrice', '12,500'); await evaluate("document.querySelector('[name=isVisibleOnline]').click()");
  await screenshot('create-image-preview');
  interceptFailure = true;
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/products/*/image', requestStage: 'Request' }] });
  await submit(); await wait("document.querySelector('[role=alert]')?.textContent.includes('Les informations du produit sont enregistrées')");
  assert.equal((await browserFetch('/products')).body.filter(p => p.sku === `${tag}-product`).length, 1);
  await send('Fetch.disable'); await submit(); await wait("location.pathname==='/products'&&document.querySelector('tbody')");
  const products = (await browserFetch('/products')).body;
  const product = products.find(p => p.sku === `${tag}-product`); assert.ok(product?.mainImagePath); assert.equal(products.filter(p => p.sku === product.sku).length, 1);
  await wait("document.querySelector('tbody img')?.naturalWidth>0"); await screenshot('backoffice-thumbnail');
  const originalImage = product.mainImagePath;
  await navigate(`/products/${product.id}/edit`); await wait("document.querySelector('main img')?.naturalWidth>0&&!document.querySelector('[name=categoryId]').disabled");
  assert.equal(await evaluate("document.querySelector('[name=image]').required"), false);
  await fill('nameFr', 'Menthe modifiée sans nouvelle image'); await submit(); await wait("location.pathname==='/products'");
  assert.equal((await browserFetch(`/products/${product.id}`)).body.mainImagePath, originalImage);
  await navigate('/shop'); await wait("document.querySelector('.sf-product-card img')?.naturalWidth>0"); await screenshot('homepage-images');
  await navigate(`/shop/catalogue?q=${encodeURIComponent('نعناع مصور')}`); await wait("document.querySelector('main article img')?.naturalWidth>0"); await screenshot('catalogue-images');
  await navigate(`/shop/products/${product.id}`); await wait("document.querySelector('main article img')?.naturalWidth>0"); await screenshot('detail-image');
  await navigate(`/shop/products/${legacy.id}`); await wait("document.querySelector('main article svg')"); assert.equal(await evaluate("document.querySelectorAll('main article img').length"), 0);
  await api('/auth/logout', {}); await login(users[0]);
  await navigate(`/products/${product.id}/edit`); await wait("document.querySelector('[name=image]')&&document.querySelector('main img')?.naturalWidth>0&&!document.querySelector('[name=categoryId]').disabled");
  await chooseFile(jpegPath); await wait("document.querySelector('img[src^=\"blob:\"]')?.naturalWidth>0");
  await screenshot('replace-image-preview'); await submit(); await wait("location.pathname==='/products'");
  const replacement = (await browserFetch(`/products/${product.id}`)).body.mainImagePath;
  assert.notEqual(replacement, originalImage);
  assert.equal((await fetch('http://localhost:3001' + originalImage)).status, 404);
  await navigate(`/shop/products/${product.id}`); await wait("document.querySelector('main article img')?.naturalWidth>0");
  assert.ok((await evaluate("document.querySelector('main article img').src")).endsWith(replacement));
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, widths: [1920,1440,1024,768,390], retryDoesNotDuplicate: true, unchangedEditPreservesImage: true, replacement: true, legacyFallback: true, consoleErrors: errors, output }, null, 2));
  console.log('Product image browser checks passed: ' + output);
} catch (error) {
  await writeFile(path.join(output, 'failure.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  console.error('Product image browser check failed: ' + output); throw error;
} finally {
  const paths = (await db.query('SELECT "mainImagePath" FROM public.product WHERE sku LIKE $1', [tag + '%'])).rows;
  await db.query('DELETE FROM public.product WHERE sku LIKE $1', [tag + '%']);
  for (const row of paths) await discardUnreferencedImage(row.mainImagePath);
  const ids = users.map(u => u.id);
  await db.query('DELETE FROM public."auditEvent" WHERE "actorUserId" = ANY($1::int[]) AND "actorNameSnapshot" = $2', [ids, tag]);
  await db.query('DELETE FROM public."authSession" WHERE "userId" = ANY($1::int[])', [ids]);
  await db.query('DELETE FROM public."user" WHERE id = ANY($1::int[]) AND "fullName" = $2', [ids, tag]);
  await db.end(); await send('Browser.close').catch(() => {}); socket.close();
}
