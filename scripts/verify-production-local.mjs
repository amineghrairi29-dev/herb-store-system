// Local HTTPS smoke check only. Requires existing build and ignored local TLS files.
// No business writes. Owns its processes/user; preserves real users and audit history.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:https';
import { request } from 'node:http';
import { randomBytes, randomUUID, X509Certificate, createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const artifacts = process.env.PRODUCTION_ARTIFACT_ROOT ? resolve(process.env.PRODUCTION_ARTIFACT_ROOT) : root;
const require = createRequire(resolve(root, 'backend/package.json'));
require('dotenv').config({ path: resolve(root, 'backend/.env'), quiet: true });
const db = new (require('pg').Client)({ connectionString: process.env.DATABASE_URL });
const origin = 'https://localhost:3443';
const output = resolve(root, '.tmp/deploy-https');
const cert = await readFile(resolve(output, 'cert.pem'));
const key = await readFile(resolve(output, 'key.pem'));
const pin = createHash('sha256').update(new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
const children = [], logs = [];
const publicProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(DATABASE_URL|AUTH_SECRET|ADMIN_.*|PG.*)$/.test(name)));
function launch(command, args, cwd, env, label) {
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = createWriteStream(resolve(output, label + '.log')); logs.push(log);
  child.stdout.pipe(log); child.stderr.pipe(log); children.push(child); return child;
}
let unavailable = false;
const proxy = createServer({ cert, key }, (req, res) => {
  const api = req.url.startsWith('/api/');
  if (api && unavailable) { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"message":"Service indisponible"}'); return; }
  const forwarded = request({ host: '127.0.0.1', port: api ? 3301 : 3300, path: api ? req.url.slice(4) : req.url, method: req.method,
    headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress, 'x-forwarded-proto': 'https', 'x-forwarded-host': 'localhost:3443' } }, reply => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
  forwarded.on('error', () => { res.writeHead(502); res.end('Upstream unavailable'); }); req.pipe(forwarded);
});
let socket, ownedId, floor;
const report = { checks: [], existingRowsUnchanged: false, retainedAuditEvents: 0 };
const tables = ['user','authSession','product','stockMovement','supplier','purchase','purchaseLine','purchasePayment','sale','saleLine','salePayment','cashMovement','expense','onlineOrder','onlineOrderLine','storeSettings'];
async function snapshot() {
  const rows = {};
  for (const table of tables) rows[table] = (await db.query(`SELECT row_to_json(t)::text AS value FROM public."${table}" t ORDER BY id`)).rows;
  return rows;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
await db.connect(); const before = await snapshot();
floor = (await db.query('SELECT coalesce(max(id),0) AS n FROM public."auditEvent"')).rows[0].n;
try {
  const email = `deploy-${randomUUID()}@example.test`, password = randomBytes(32).toString('base64url');
  ownedId = (await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,\'Deployment Smoke\',\'ADMIN\',$2,now()) RETURNING id', [email, await require('bcryptjs').hash(password, 12)])).rows[0].id;
  const env = { ...process.env, NODE_ENV: 'production', AUTH_SECRET: randomBytes(32).toString('hex'), FRONTEND_ORIGIN: origin, TRUST_PROXY: 'loopback', COOKIE_SECURE: 'true', HOST: '127.0.0.1', PORT: '3301' };
  launch(process.execPath, ['dist/main.js'], resolve(artifacts, 'backend'), env, 'backend');
  // The public URL was baked into the frontend build; the extra CA trusts ONLY this local test certificate.
  launch(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3300'], resolve(artifacts, 'frontend'), { ...publicProcessEnv, NODE_ENV: 'production', NEXT_PUBLIC_API_BASE_URL: origin + '/api', NODE_EXTRA_CA_CERTS: resolve(output, 'cert.pem') }, 'frontend');
  await new Promise((ok, fail) => { proxy.once('error', fail); proxy.listen(3443, '127.0.0.1', ok); });
  for (const url of ['http://127.0.0.1:3301/health', 'http://127.0.0.1:3300/login']) {
    let ready = false;
    for (let n=0;n<600;n++) { try { if ((await fetch(url)).ok) { ready = true; break; } } catch {} await delay(100); }
    assert.ok(ready, `Startup failed: ${url}`);
  }
  launch(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--remote-debugging-port=9224',`--user-data-dir=${resolve(output,'browser')}`,`--ignore-certificate-errors-spki-list=${pin}`,'--no-first-run','--no-default-browser-check','about:blank'], root, publicProcessEnv, 'chrome');
  let tabs;
  for (let n=0;n<100;n++) { try { tabs = await (await fetch('http://127.0.0.1:9224/json/list')).json(); if(tabs.length) break; } catch {} await delay(100); }
  socket = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.addEventListener('open', ok, {once:true}); socket.addEventListener('error', fail, {once:true}); });
  let seq=0; const pending=new Map(), exceptions=[];
  const send=(method,params={})=>new Promise((ok,fail)=>{ const id=++seq; const timer=setTimeout(()=>{pending.delete(id);fail(new Error(`CDP timeout: ${method}`));},30000); pending.set(id,{ok,fail,timer}); socket.send(JSON.stringify({id,method,params})); });
  socket.addEventListener('message', event=>{const m=JSON.parse(event.data); if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.fail(new Error(m.error.message));else p.ok(m.result);}} if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);});
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value;};
  const wait=async expression=>{for(let n=0;n<200;n++){if(await evaluate(expression))return;await delay(100);}throw new Error(`UI timeout: ${expression}`);};
  const navigate=async path=>{await evaluate('window.__oldPage=true');await send('Page.navigate',{url:origin+path});await wait(`!window.__oldPage && location.pathname===${JSON.stringify(path)} && (document.querySelector('main h1')!==null || document.querySelector('main [role=alert]')!==null)`);};
  const api=async(path,init={})=>evaluate(`fetch('/api'+${JSON.stringify(path)},${JSON.stringify(init)}).then(async r=>({status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}))`);
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready]')!==null");
  for(const [name,value] of [['email',email],['password',password]]) await evaluate(`(()=>{const i=document.querySelector('[name=${name}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Se connecter').click()");
  await wait("location.pathname==='/' && document.querySelector('[aria-label=\"Navigation principale\"]')!==null");
  const cookies=(await send('Network.getCookies',{urls:[origin]})).cookies;
  const auth=cookies.find(c=>c.name==='__Host-herb_session');
  assert.ok(auth?.secure&&auth.httpOnly&&auth.sameSite==='Lax'&&auth.path==='/'&&auth.expires>Date.now()/1000);
  assert.ok(!await evaluate("document.cookie.includes('herb_session')"));
  assert.ok(!await evaluate("Object.keys(localStorage).some(k=>/token|session/i.test(k))"));
  report.checks.push('Browser HTTPS login; Secure/HttpOnly/Lax/host-only expiring cookie; no readable auth token');
  for(const path of ['/health','/auth/me','/dashboard','/products','/stock-movements','/reports/financial-summary','/settings/store','/audit-events']) {
    const r=await api(path); assert.equal(r.status,200,path); assert.equal(r.cache,'no-store'); if(path==='/auth/me')assert.equal(r.body.role,'ADMIN'); if(path==='/health')assert.deepEqual(r.body,{status:'ok'});
  }
  report.checks.push('Health, me ADMIN, dashboard, products, stock, financial report, settings and audit through /api');
  for(const path of ['/','/products','/stock','/reports','/settings/store','/audit','/shop']) {
    await navigate(path); await wait("!document.querySelector('main')?.textContent.includes('Chargement')");
    assert.ok(!await evaluate("document.querySelector('main [role=alert]')!==null"),path);
  }
  const product=(await db.query('SELECT id FROM public.product WHERE "isActive" AND "isSellable" AND "isVisibleOnline" LIMIT 1')).rows[0];
  if(product) { await navigate('/shop/products/'+product.id); assert.ok(!await evaluate("document.body.textContent.includes('Application error')")); }
  report.checks.push('Production pages and server-side public product fetch over trusted local TLS');
  unavailable=true; await navigate('/products'); await wait("document.querySelector('main [role=alert]')!==null");
  assert.ok(!await evaluate("/passwordHash|DATABASE_URL|node_modules|at Object\\./.test(document.body.textContent)")); unavailable=false;
  await navigate('/products'); await wait("!document.querySelector('main')?.textContent.includes('Chargement')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Se déconnecter').click()"); await wait("location.pathname==='/login'");
  assert.equal((await api('/auth/me')).status,401);
  assert.equal((await api('/public/products/2147483647')).status,404);
  await navigate('/shop/products/2147483647'); assert.ok(!await evaluate("document.body.textContent.includes('node_modules')"));
  assert.deepEqual(exceptions,[]);
  report.checks.push('Backend unavailable friendly error/recovery, logout/401, public 404; no uncaught browser exception');
  await send('Browser.close'); socket.close(); socket=undefined;
} finally {
  unavailable=false; socket?.close();
  await new Promise(ok=>{proxy.closeAllConnections();proxy.close(ok);});
  for(const child of children)if(child.exitCode===null)child.kill();
  for(const child of children)if(child.exitCode===null)await Promise.race([new Promise(ok=>child.once('exit',ok)),delay(5000)]);
  for(const log of logs)log.end();
  if(ownedId)await db.query('DELETE FROM public."user" WHERE id=$1',[ownedId]);
  assert.deepEqual(await snapshot(),before,'Existing data/users/sessions changed');
  report.existingRowsUnchanged=true;
  report.retainedAuditEvents=(await db.query('SELECT count(*)::int AS n FROM public."auditEvent" WHERE id>$1',[floor])).rows[0].n;
  await db.end(); await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({passed:true,...report},null,2));
