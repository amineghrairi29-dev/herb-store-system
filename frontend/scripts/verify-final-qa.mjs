// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `FINAL-QA-${crypto.randomUUID()}`;
const outputDir = path.resolve('../.tmp', `final-qa-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let seq = 0, accept = false;
const pending = new Map(), errors = [], requests = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept }).catch(e => errors.push(e.message));
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.args.some(a => /hydration|hydrating|did not match/i.test(a.value ?? ''))) errors.push('Hydration error');
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request);
  if (message.method === 'Network.loadingFailed') console.error('Browser transport failure:', JSON.stringify({ error: message.params.errorText, blocked: message.params.blockedReason, cors: message.params.corsErrorStatus }));
});
async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function wait(expression) { const end = Date.now() + 30000; while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__fulfillmentNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__fulfillmentNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const password = `Aa9-${crypto.randomUUID()}`;
const email = role => `${token}-${role}@example.com`.toLowerCase();
async function field(name, value) {
  await evaluate(`(() => { const input = document.querySelector('[name="${name}"]'); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
}
async function signIn(role) {
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready]') !== null"); await field('email', email(role)); await field('password', password); await click('Se connecter');
  await wait("location.pathname === '/' && document.querySelector('[aria-label=\"Navigation principale\"]') !== null");
}
async function signOut() { await click('Se déconnecter'); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null"); }
const api = (route, method = 'GET', body) => evaluate(`fetch('http://localhost:3001'+${JSON.stringify(route)}, {method:${JSON.stringify(method)},credentials:'include',headers:{'Content-Type':'application/json'},${body === undefined ? '' : `body:JSON.stringify(${JSON.stringify(body)}),`}}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.message);return body})`);
const { moneyUnits } = await import('../../backend/dist/purchases/purchase-validation.js');
const signedUnits = value => value.startsWith('-') ? -moneyUnits(value.slice(1)) : moneyUnits(value);
let auditFloor = 0;
async function snapshot() {
  const state = {};
  for (const table of ['product','stockMovement','supplier','purchase','purchaseLine','purchasePayment','sale','saleLine','salePayment','cashMovement','expense','onlineOrder','onlineOrderLine','user','authSession','storeSettings','auditEvent']) {
    state[table] = (await db.query(`SELECT row_to_json(t)::text AS value FROM public."${table}" t ${table === 'auditEvent' ? 'WHERE id <= $1' : ''} ORDER BY id`, table === 'auditEvent' ? [auditFloor] : [])).rows.map(row=>row.value);
  }
  return JSON.stringify(state);
}
const checks = [], layout = [], links = new Set(), failures = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 500) failures.push({ url: message.params.response.url.split('?')[0], status: message.params.response.status });
  if (message.method === 'Runtime.consoleAPICalled' && message.params.args.some(a=>/unique.*key|Each child/i.test(a.value ?? ''))) errors.push('React key warning');
});
async function responsive(route) {
  await navigate(route);
  await wait("!document.querySelector('main')?.textContent.includes('Chargement') && !document.querySelector('main')?.textContent.includes('Actualisation')");
  assert.ok(!await evaluate("document.querySelector('main [role=alert]') !== null"), `Unexpected alert ${route}`);
  for (const width of [1440, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    const overflow = await evaluate('document.documentElement.scrollWidth - innerWidth');
    layout.push({ route, width, overflow });
    if (overflow > 1) throw new Error(`Viewport overflow ${route}: ${width} (+${overflow})`);
    if (width === 390) await writeFile(path.join(outputDir, (route.replaceAll('/','_') || '_dashboard')+'.png'), Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  }
  for (const href of await evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/')&&!h.startsWith('//'))")) links.add(href);
  await send('Emulation.setDeviceMetricsOverride', { width:1440,height:1000,deviceScaleFactor:1,mobile:false });
}
let productId, supplierId, purchaseId, saleId, convertedId, expenseId, orderId;
const ownedUsers = [];
await db.connect(); auditFloor = (await db.query('SELECT coalesce(max(id),0) AS n FROM public."auditEvent"')).rows[0].n;
const before = await snapshot();
try {
  const passwordHash = await require('bcryptjs').hash(password, 12);
  for (const role of ['ADMIN']) ownedUsers.push((await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now()) RETURNING id',[email(role),`${token} ${role} اختبار`,role,passwordHash])).rows[0].id);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await responsive('/login'); await signIn('ADMIN');
  assert.equal((await api('/auth/me')).role,'ADMIN');
  const cashBefore = signedUnits((await api('/cash/summary')).physicalCashBalance);
  await navigate('/products/new'); await wait("document.querySelector('[name=sku]') !== null");
  for (const [name,value] of Object.entries({sku:token,name:'نعناع تجريبي',nameFr:'Menthe fraîche',scientificName:'Mentha',productType:'VRAC',salePrice:'12.500',category:token,storageUnit:'KG',saleUnit:'KG',conversionFactor:'1'})) await field(name,value);
  await evaluate("document.querySelector('form').requestSubmit()"); await wait("location.pathname === '/products'");
  productId = (await db.query('SELECT id FROM public.product WHERE sku=$1',[token])).rows[0]?.id; assert.ok(productId);
  assert.equal((await api(`/products/${productId}`)).barcode,null);
  for (const barcode of [token+'-CODE','  ']) {
    await navigate(`/products/${productId}/edit`); await wait("document.querySelector('[name=barcode]') !== null"); await field('barcode',barcode);
    await evaluate("document.querySelector('form').requestSubmit()"); await wait("location.pathname === '/products'");
    assert.equal((await api(`/products/${productId}`)).barcode,barcode.trim()||null);
  }
  checks.push('Product create/edit in browser: null barcode, real barcode, clearing; Arabic/French names');
  supplierId = (await api('/suppliers','POST',{code:token,name:'مورد تجريبي Épices',isActive:true})).id;
  const day = new Date().toISOString().slice(0,10);
  purchaseId = (await api('/purchases','POST',{reference:token+'-PURCHASE',supplierId,purchaseDate:day,lines:[{productId,quantity:'12',unit:'KG',unitPurchasePrice:'0.1'}]})).id;
  // A draft document blocks deletion even before stock history exists.
  assert.equal(await evaluate(`fetch('http://localhost:3001/products/${productId}',{method:'DELETE',credentials:'include'}).then(r=>r.status)`),409);
  await api(`/purchases/${purchaseId}/confirm`,'POST');
  const stock = async()=> (await api(`/products/${productId}/stock`)).stock;
  assert.equal(await stock(),'12.000');
  saleId = (await api('/sales','POST',{reference:token+'-SALE',saleDate:day,customerName:'عميل تجريبي Élodie',lines:[{productId,quantity:'2',unit:'KG',unitSalePrice:'0.3'}]})).id;
  await navigate(`/sales/${saleId}`); await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Confirmer')"); await click('Confirmer'); await click('Confirmer la vente'); await wait("document.querySelector('main').textContent.includes('Les sorties de stock ont été enregistrées')");
  assert.equal(await stock(),'10.000');
  await api(`/sales/${saleId}/payments`,'POST',{amount:'0.3',paymentDate:day,paymentMethod:'CASH',reference:token});
  await api(`/purchases/${purchaseId}/payments`,'POST',{amount:'0.2',paymentDate:day,paymentMethod:'CASH',reference:token});
  expenseId = (await api('/expenses','POST',{reference:token+'-EXPENSE',description:'نقل تجريبي Dépense',category:'TRANSPORT',amount:'0.1',paymentMethod:'CASH',expenseDate:day})).id;
  assert.equal(signedUnits((await api('/cash/summary')).physicalCashBalance),cashBefore);
  const linkedId = (await db.query('SELECT id FROM public."cashMovement" WHERE "expenseId"=$1',[expenseId])).rows[0].id;
  await api(`/expenses/${expenseId}`,'PATCH',{paymentMethod:'CARD'});
  assert.equal(signedUnits((await api('/cash/summary')).physicalCashBalance),cashBefore+moneyUnits('0.1'));
  await api(`/expenses/${expenseId}`,'PATCH',{paymentMethod:'CASH'});
  assert.equal((await db.query('SELECT id FROM public."cashMovement" WHERE "expenseId"=$1',[expenseId])).rows[0].id,linkedId);
  assert.equal(await stock(),'10.000'); checks.push('Purchase ENTRY, sale EXIT, payments, expense update and exact cash delta; no payment stock effect; draft-reference delete 409');
  await api(`/products/${productId}`,'PATCH',{isVisibleOnline:true});
  await signOut(); await navigate('/shop/cart');
  await evaluate("localStorage.setItem('herb-store-cart-v1','{broken')"); await navigate('/shop/cart'); await wait("document.querySelector('main').textContent.includes('vide')");
  await navigate(`/shop?category=${encodeURIComponent(token)}`); await wait("document.querySelector('main article button')?.disabled === false");
  for (let i=0;i<2;i++) { await evaluate("document.querySelector('main article button').click()"); await wait("document.querySelector('main article').textContent.includes('Ajouté au panier.') && !document.querySelector('main article button').disabled"); }
  await responsive('/shop/cart'); await wait("document.querySelector('[data-cart-total=true]')?.textContent === '25,000 DT'");
  assert.equal(await evaluate("document.querySelectorAll('[data-cart-line]').length"),1);
  await navigate('/shop/cart'); await wait("document.querySelector('[data-cart-total=true]')?.textContent === '25,000 DT'");
  await responsive('/shop/checkout'); await wait("document.querySelector('form button')?.disabled === false");
  await field('customerName',token+' عميل'); await field('customerPhone','20123456'); await field('notes','Commande test Épices');
  await click('Envoyer la commande'); await wait("location.pathname === '/shop/order-success'");
  const order = (await db.query('SELECT id,reference,status,"totalAmount"::text FROM public."onlineOrder" WHERE "customerName"=$1',[token+' عميل'])).rows[0]; orderId=order.id;
  assert.equal(order.status,'PENDING'); assert.equal(moneyUnits(order.totalAmount),moneyUnits('25'));
  const lookup = await fetch(`http://localhost:3001/public/orders/${encodeURIComponent(order.reference)}?phone=20123456`); assert.equal(lookup.status,200);
  assert.equal((await fetch(`http://localhost:3001/public/orders/${encodeURIComponent(order.reference)}?phone=99999999`)).status,404);
  checks.push('Corrupted cart recovery, duplicate merge, refresh persistence, exact total and real browser checkout; public phone lookup');
  await signIn('ADMIN'); assert.equal(await stock(),'10.000');
  await api(`/online-orders/${orderId}/status`,'PATCH',{status:'CONFIRMED'}); assert.equal(await stock(),'10.000');
  const converted = await api(`/online-orders/${orderId}/convert-to-sale`,'POST'); convertedId=converted.saleId; assert.equal(converted.saleStatus,'DRAFT'); assert.equal(await stock(),'10.000');
  assert.equal((await api(`/online-orders/${orderId}/convert-to-sale`,'POST')).saleId,convertedId);
  await api(`/sales/${convertedId}/confirm`,'POST'); assert.equal(await stock(),'8.000');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."stockMovement" WHERE "productId"=$1 AND type=\'EXIT\' AND reference=$2',[productId,converted.saleReference])).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."salePayment" WHERE "saleId"=$1',[convertedId])).rows[0].n,0);
  checks.push('Order lifecycle 10 -> 10 -> DRAFT/10 -> 8; idempotent conversion, exactly one EXIT, no automatic payment');
  const dates=`dateFrom=${day}&dateTo=${day}`;
  const financial = await api(`/finance/summary?${dates}`), report = await api(`/reports/financial-summary?${dates}`);
  for (const row of report.data) assert.equal(financial[row.id],row.amount, 'Financial summary report value mismatch');
  for (const kind of ['sales','purchases','expenses','customer-collections','supplier-payments','cash','financial-summary']) {
    await navigate(`/reports/${kind}`); await wait("document.querySelector('.report-content') !== null");
    const csv = await evaluate(`fetch('http://localhost:3001/reports/${kind}/export.csv?${dates}',{credentials:'include'}).then(async r=>({status:r.status,bytes:Array.from(new Uint8Array(await r.arrayBuffer()))}))`);
    assert.equal(csv.status,200); assert.deepEqual(csv.bytes.slice(0,3),[239,187,191]);
    await writeFile(path.join(outputDir,kind+'.csv'),Buffer.from(csv.bytes));
    await evaluate("window.print=()=>{window.__printed=true}"); await click('Imprimer / PDF'); await wait('window.__printed === true');
    await send('Emulation.setEmulatedMedia',{media:'print'});
    await writeFile(path.join(outputDir,kind+'.pdf'),Buffer.from((await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true})).data,'base64'));
    await evaluate("window.dispatchEvent(new Event('afterprint'));delete window.__printed"); await send('Emulation.setEmulatedMedia',{media:''});
  }
  checks.push('Seven reports: live CSV BOM and browser print/PDF; finance consistency');
  for (const route of ['/','/products','/stock','/purchases','/sales','/cash','/finance','/reports','/online-orders','/users','/settings/store','/audit']) await responsive(route);
  const events = await api(`/audit-events?actorUserId=${ownedUsers[0]}&pageSize=100`);
  for (const action of ['PRODUCT_CREATE','PRODUCT_UPDATE','PURCHASE_CONFIRM','SALE_CONFIRM','SALE_PAYMENT_CREATE','PURCHASE_PAYMENT_CREATE','EXPENSE_CREATE','ONLINE_ORDER_CONVERT_TO_SALE']) assert.ok(events.data.some(row=>row.action===action),`Audit missing ${action}`);
  assert.ok(!JSON.stringify(events).includes(password));
  await signOut();
  await responsive('/shop'); await responsive('/shop/cart'); await responsive('/shop/checkout');
  assert.ok(!await evaluate("[...document.querySelectorAll('header a')].some(a=>['/users','/audit','/settings/store'].includes(a.getAttribute('href')))"));
  for (const href of links) { const response=await fetch('http://localhost:3000'+href); assert.equal(response.status,200,`Broken navigation link ${href}`); }
  checks.push('ADMIN/public navigation; 3 viewport sizes; no dead collected links');
  assert.deepEqual(errors,[]); assert.deepEqual(failures,[]);
  await writeFile(path.join(outputDir,'results.json'),JSON.stringify({checks,layout,links:[...links],errors,failures},null,2));
  console.log(JSON.stringify({passed:true,checks,responsiveChecks:layout.length,linksChecked:links.size,outputDir},null,2));
} finally {
  // Only exact UUID-owned business fixtures. Preserve every audit event, including test actions.
  const productRows=(await db.query('SELECT id FROM public.product WHERE sku=$1',[token])).rows.map(r=>r.id);
  const sales=(await db.query('SELECT DISTINCT "saleId" AS id FROM public."saleLine" WHERE "productId"=ANY($1::int[])',[productRows])).rows.map(r=>r.id);
  await db.query('BEGIN');
  await db.query('DELETE FROM public."cashMovement" WHERE "salePaymentId" IN (SELECT id FROM public."salePayment" WHERE "saleId"=ANY($1::int[])) OR "purchasePaymentId" IN (SELECT id FROM public."purchasePayment" WHERE "purchaseId"=$2) OR "expenseId"=$3',[sales,purchaseId,expenseId]);
  await db.query('DELETE FROM public."salePayment" WHERE "saleId"=ANY($1::int[])',[sales]);
  await db.query('DELETE FROM public."purchasePayment" WHERE "purchaseId"=$1',[purchaseId]);
  await db.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName"=$1)',[token+' عميل']);
  await db.query('DELETE FROM public."onlineOrder" WHERE "customerName"=$1',[token+' عميل']);
  await db.query('DELETE FROM public."saleLine" WHERE "saleId"=ANY($1::int[])',[sales]); await db.query('DELETE FROM public.sale WHERE id=ANY($1::int[])',[sales]);
  await db.query('DELETE FROM public."purchaseLine" WHERE "purchaseId"=$1',[purchaseId]); await db.query('DELETE FROM public.purchase WHERE id=$1',[purchaseId]);
  await db.query('DELETE FROM public.expense WHERE id=$1',[expenseId]); await db.query('DELETE FROM public.supplier WHERE id=$1',[supplierId]);
  await db.query('DELETE FROM public."stockMovement" WHERE "productId"=ANY($1::int[])',[productRows]); await db.query('DELETE FROM public.product WHERE id=ANY($1::int[])',[productRows]);
  await db.query('DELETE FROM public."user" WHERE id=ANY($1::int[])',[ownedUsers]); await db.query('COMMIT');
  const retainedEvents=(await db.query('SELECT count(*)::int AS n FROM public."auditEvent" WHERE id>$1',[auditFloor])).rows[0].n;
  const unchanged=await snapshot()===before; await db.end(); await send('Browser.close').catch(()=>{}); socket.close();
  assert.ok(unchanged,'Pre-existing rows changed during QA');
  console.log(JSON.stringify({preExistingRecordsUnchanged:true,retainedAuditEvents:retainedEvents,fixturesRemoved:true}));
}
