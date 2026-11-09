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
const tag = 'product-details-check-' + crypto.randomUUID();
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
const ids=[];
const initial = (await db.query(`SELECT to_jsonb(p)::text AS row FROM public.product p ORDER BY id`)).rows;
const initialStock = (await db.query(`SELECT to_jsonb(s)::text AS row FROM public."stockMovement" s ORDER BY id`)).rows;
async function quantity(value) {
  await evaluate(`(()=>{const e=document.querySelector('#product-quantity');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
try {
  const category=(await db.query('SELECT id,slug,"nameFr","measurementMode" FROM public.category WHERE "isActive" AND NOT "isInternal" ORDER BY id LIMIT 1')).rows[0];
  assert.ok(category);
  const image=(await db.query('SELECT "mainImagePath" FROM public.product WHERE "mainImagePath" IS NOT NULL LIMIT 1')).rows[0]?.mainImagePath??null;
  assert.ok(image,'A real uploaded image is needed for image verification');
  const unit=category.measurementMode==='VOLUME'?'L':'KG';
  for(let index=0;index<2;index++) {
    const product=(await db.query(`INSERT INTO public.product (sku,name,"nameFr","categoryId",category,"productType","salePrice","storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","mainImagePath",description,"updatedAt") VALUES ($1,$2,$3,$4,$5,'VRAC',12.5,$6,$6,1,true,true,true,$7,$8,now()) RETURNING id`,[tag+'-'+index,index===0?'نعناع طبيعي':'Produit sans image',index===0?'Menthe naturelle':null,category.id,category.nameFr,unit,index===0?image:null,'Description de test : produit naturel, texte public uniquement.'])).rows[0];
    ids.push(product.id);
  }
  await db.query('INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit",reference) VALUES ($1,\'ENTRY\',10,$2,10,$3)',[ids[0],unit,tag]);
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  for(const [index,id] of ids.entries()) {
    await navigate('/shop/products/'+id); await wait('document.querySelector(".pd-purchase")');
    if(index===0)await wait('!document.querySelector(".pd-add").disabled');
    else assert.ok(await evaluate('document.querySelector(".pd-add").disabled'));
    for(const width of [1920,1440,1024,768,390]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      if(index===0)await wait('document.querySelector(".pd-image img").complete&&document.querySelector(".pd-image img").naturalWidth>0');
      else assert.ok(await evaluate('!!document.querySelector(".pd-placeholder")'));
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      const columns=await evaluate('getComputedStyle(document.querySelector(".pd-overview")).gridTemplateColumns.split(" ").length');
      assert.equal(columns,width<760?1:2);
      if(index===0)assert.equal(await evaluate('getComputedStyle(document.querySelector(".pd-image img")).objectFit'),'contain');
      assert.ok(await evaluate('!!document.querySelector(".pd-description")&&!!document.querySelector(".pd-related .botanical-product-card")'));
      await writeFile(path.join(output,`${index===0?'available':'unavailable'}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
    }
  }
  await navigate('/shop/products/'+ids[0]); await wait('document.querySelector(".pd-add")&&!document.querySelector(".pd-add").disabled');
  await quantity('0');await evaluate('document.querySelector(".pd-purchase").requestSubmit()');
  await wait('document.querySelector(".pd-error")&&document.querySelector(".pd-error").textContent.length>0');
  await quantity('2,5');await evaluate('document.querySelector(".pd-purchase").requestSubmit()');
  await wait('document.querySelector("#purchase-feedback").textContent.includes("Ajouté")');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("herb-store-cart-v1")).items[0].quantity'),'2.500');
  await quantity('1.25');await evaluate('document.querySelector(".pd-purchase").requestSubmit()');
  await wait('document.querySelector("#purchase-feedback").textContent.includes("Ajouté")');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("herb-store-cart-v1")).items[0].quantity'),'3.750');
  await quantity('1000');await evaluate('document.querySelector(".pd-purchase").requestSubmit()');
  await wait('document.querySelector(".pd-error")&&document.querySelector(".pd-error").textContent.length>0');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("herb-store-cart-v1")).items[0].quantity'),'3.750');
  // Existing default one-unit ProductCard add remains unchanged.
  await navigate('/shop/catalogue?q='+encodeURIComponent(tag));
  // Search public SKU is not guaranteed; use the category list instead.
  await navigate('/shop/catalogue?category='+category.slug);
  await wait(`document.querySelector('[data-product-id="${ids[0]}"] button')&&!document.querySelector('[data-product-id="${ids[0]}"] button').disabled`);
  await evaluate(`document.querySelector('[data-product-id="${ids[0]}"] button').click()`);
  await wait(`document.querySelector('[data-product-id="${ids[0]}"] [role=status]')`);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("herb-store-cart-v1")).items[0].quantity'),'4.750');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,widths:[1920,1440,1024,768,390],realCartValidation:true,errors,guestAuthWarnings},null,2));
  console.log('Product details checks passed: '+output);
} catch (failure) {
  console.error(JSON.stringify({ feedback: await evaluate('document.querySelector("#purchase-feedback")?.textContent'), errors }));
  throw failure;
} finally {
  await evaluate('localStorage.removeItem("herb-store-cart-v1")').catch(()=>{});
  await db.query('DELETE FROM public."stockMovement" WHERE "productId"=ANY($1::int[]) AND reference=$2',[ids,tag]);
  await db.query('DELETE FROM public.product WHERE id=ANY($1::int[]) AND sku LIKE $2',[ids,tag+'%']);
  assert.deepEqual((await db.query('SELECT to_jsonb(p)::text AS row FROM public.product p ORDER BY id')).rows,initial);
  assert.deepEqual((await db.query('SELECT to_jsonb(s)::text AS row FROM public."stockMovement" s ORDER BY id')).rows,initialStock);
  await db.end();await send('Browser.close').catch(()=>{});socket.close();
}
