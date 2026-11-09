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
const tag = "ui-category-" + crypto.randomUUID(),
  password = "Aa9-" + crypto.randomUUID();
const output = path.resolve("../.tmp", "categories-" + Date.now());
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
const users = [], createdCategories = [];
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
try {
  for (const role of ['ADMIN']) users.push(await new UsersService().create({ fullName: tag, email: `${tag}-${role.toLowerCase()}@example.test`, role, isActive: true, password }));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await login(users[0]);
  await navigate('/categories'); await wait("document.querySelector('tbody tr')");
  const seeds = await allCategories();
  for (const slug of ['herbes', 'epices', 'huiles-et-liquides-naturels', 'parfums', 'melanges-speciaux']) assert.ok(seeds.some(c => c.slug === slug));
  await screenshot('categories-admin');
  await navigate('/categories/new'); await wait("document.querySelector('[name=nameAr]')");
  await fill('nameAr', 'أعشاب تجريبية'); await fill('nameFr', tag); await fill('slug', tag); await select('measurementMode', 'FLEXIBLE'); await fill('sortOrder', '1'); await submit();
  await wait("location.pathname==='/categories'&&document.querySelector('tbody')");
  const category = (await allCategories()).find(c => c.slug === tag); assert.ok(category); createdCategories.push(category.id);
  await navigate(`/categories/${category.id}/edit`); await wait("document.querySelector('[name=nameFr]')");
  await fill('nameFr', tag + ' modifiée'); await submit(); await wait("location.pathname==='/categories'");
  assert.equal((await allCategories()).find(c => c.id === category.id).nameFr, tag + ' modifiée');
  await navigate(`/categories/${category.id}/subcategories`); await wait("document.querySelector('main table')");
  await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Ajouter une sous-catégorie').click()");
  await wait("document.querySelector('[name=nameAr]')");
  await fill('nameAr', 'أوراق تجريبية'); await fill('nameFr', 'Feuilles test'); await fill('slug', 'feuilles-test'); await submit();
  await wait("document.querySelector('tbody tr')&&!document.querySelector('main form')");
  await evaluate("[...document.querySelectorAll('tbody button')].find(b=>b.textContent==='Modifier').click()");
  await fill('nameFr', 'Feuilles modifiées'); await submit(); await wait("!document.querySelector('main form')");
  for (const label of ['Désactiver', 'Activer']) {
    await evaluate(`[...document.querySelectorAll('tbody button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
    await wait(`document.querySelector('tbody').textContent.includes('${label === 'Désactiver' ? 'Inactif' : 'Actif'}')`);
  }
  await screenshot('subcategories');
  await navigate('/products/new'); await wait("document.querySelector('[name=categoryId] option[value]')&&document.querySelectorAll('[name=categoryId] option').length>3");
  for (const seed of seeds.filter(c => !c.isInternal)) {
    await select('categoryId', seed.id);
    assert.deepEqual(await evaluate("[...document.querySelector('[name=storageUnit]').options].map(o=>o.value).filter(Boolean)"), seed.allowedUnits);
  }
  await select('categoryId', seeds.find(c => c.slug === 'herbes').id); await select('storageUnit', 'KG'); await select('saleUnit', 'G');
  await select('categoryId', seeds.find(c => c.slug === 'huiles-et-liquides-naturels').id);
  assert.equal(await evaluate("document.querySelector('[name=storageUnit]').value"), '');
  assert.equal(await evaluate("document.querySelector('[name=saleUnit]').value"), '');
  assert.equal(await evaluate("document.querySelector('[name=subcategoryId]').options.length"), 3);
  await select('categoryId', category.id);
  const sub = (await allCategories()).find(c => c.id === category.id).subcategories[0]; await select('subcategoryId', sub.id);
  await fill('sku', tag + '-product'); await fill('name', 'نعناع تجريبي'); await select('productType', 'VRAC');
  await select('storageUnit', 'KG'); await select('saleUnit', 'G'); await fill('conversionFactor', '1000'); await fill('salePrice', '12,500');
  await evaluate("document.querySelector('[name=isVisibleOnline]').click()");
  await screenshot('product-form'); await submit(); await wait("location.pathname==='/products'");
  const rows = (await browserFetch('/products')).body; const product = rows.find(p => p.sku === tag + '-product'); assert.ok(product);
  await navigate(`/products/${product.id}/edit`); await wait("document.querySelector('[name=categoryId]')&&!document.querySelector('[name=categoryId]').disabled");
  assert.equal(await evaluate("document.querySelector('[name=categoryId]').value"), String(category.id));
  assert.equal(await evaluate("document.querySelector('[name=subcategoryId]').value"), String(sub.id));
  await fill('name', 'نعناع معدل'); await submit(); await wait("location.pathname==='/products'");
  for (let n = 1; n < 7; n++) {
    const c = await api('/categories', { nameAr: 'فئة تجريبية', nameFr: `${tag}-${n}`, slug: `${tag}-${n}`, measurementMode: 'WEIGHT' }); createdCategories.push(c.id);
    await api('/products', { sku: `${tag}-p${n}`, name: 'منتج تجريبي', categoryId: c.id, productType: 'VRAC', storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', salePrice: '1', isVisibleOnline: true });
  }
  await navigate('/shop'); await wait("document.querySelectorAll('.sf-category-card').length>=7");
  await screenshot('shop-dynamic-categories');
  await navigate(`/shop/catalogue?category=${category.slug}&subcategory=${sub.id}`); await wait("document.querySelector('main article')");
  assert.equal(await evaluate("document.querySelectorAll('main article').length"), 1);
  await screenshot('catalogue-filters');
  await api(`/categories/${category.id}`, { isActive: false }, 'PATCH');
  await navigate('/shop'); await wait("document.querySelectorAll('.sf-category-card').length===6");
  await api(`/categories/${category.id}`, { isActive: true }, 'PATCH');
  await navigate('/shop'); await wait("document.querySelectorAll('.sf-category-card').length===7");
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, widths: [1920,1440,1024,768,390], roles: ['ADMIN'], dynamicCategories: 7, consoleErrors: errors, output }, null, 2));
  console.log('Category browser checks passed: ' + output);
} catch (error) {
  await writeFile(path.join(output, 'failure.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  console.error('Category browser check failed: ' + output); throw error;
} finally {
  await db.query('DELETE FROM public.product WHERE sku LIKE $1', [tag + '%']);
  await db.query('DELETE FROM public.subcategory WHERE "categoryId" IN (SELECT id FROM public.category WHERE slug LIKE $1)', [tag + '%']);
  await db.query('DELETE FROM public.category WHERE slug LIKE $1', [tag + '%']);
  const ids = users.map(u => u.id);
  await db.query('DELETE FROM public."auditEvent" WHERE "actorUserId" = ANY($1::int[]) AND "actorNameSnapshot" = $2', [ids, tag]);
  await db.query('DELETE FROM public."authSession" WHERE "userId" = ANY($1::int[])', [ids]);
  await db.query('DELETE FROM public."user" WHERE id = ANY($1::int[]) AND "fullName" = $2', [ids, tag]);
  await db.end(); await send('Browser.close').catch(() => {}); socket.close();
}
