// Both app servers and isolated Chrome on :9223; only UUID fixtures are mutated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('../backend/package.json'));
require('dotenv').config({ path: '../backend/.env', quiet: true });
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const token = `TEST-AUTH-UI-${crypto.randomUUID()}`, customer = `${token} عميل`;
const outputDir = path.resolve('../.tmp', `auth-validation-${Date.now()}`);
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
});
async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function wait(expression) { const end = Date.now() + 30000; while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Condition timed out: ${expression}`); }
async function navigate(route) { await evaluate('window.__fulfillmentNavigation = true'); await send('Page.navigate', { url: `http://localhost:3000${route}` }); await wait(`!window.__fulfillmentNavigation && location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('main h1') !== null`); }
const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
const snapshot = async () => {
  const result = {};
  for (const table of ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine', 'user', 'authSession']) result[table] = (await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows;
  return result;
};
const password = `Aa9-${crypto.randomUUID()}`;
const email = role => `${token}-${role}@example.com`.toLowerCase();
async function field(name, value) {
  await evaluate(`(() => { const input = document.querySelector('[name="${name}"]'); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
}
async function signIn(role) {
  await navigate('/login'); await wait("document.querySelector('[data-auth-ready]') !== null"); await field('email', email(role)); await field('password', password); await click('Se connecter');
  await wait("location.pathname === '/' && document.querySelector('[aria-label=\"Navigation principale\"]') !== null");
}
async function signOut() { await click('Se déconnecter'); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null"); }
await db.connect(); const before = await snapshot();
try {
  const { hash } = require('bcryptjs'), passwordHash = await hash(password, 12);
  for (const role of ['ADMIN']) await db.query('INSERT INTO public."user" (email,"fullName",role,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now())', [email(role), customer, role, passwordHash]);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  assert.equal((await fetch('http://localhost:3001/products')).status, 401);
  assert.equal((await fetch('http://localhost:3000/login')).status, 200);
  const preflight = await fetch('http://localhost:3001/auth/login', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000'); assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  await send('Page.navigate', { url: 'http://localhost:3000/products' }); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null");
  await field('email', email('ADMIN')); await field('password', 'Incorrect9'); await click('Se connecter'); await wait("document.querySelector('[role=alert]')?.textContent.includes('incorrect')");
  for (const [width, height] of [[1280, 900], [390, 844]]) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 390 }); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1')); await writeFile(path.join(outputDir, `login-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
  await signIn('ADMIN'); assert.ok(await evaluate("document.querySelector('[aria-label=\"Navigation principale\"]').textContent.includes('Utilisateurs')"));
  const cookies = await send('Network.getCookies', { urls: ['http://localhost:3001'] }); assert.ok(cookies.cookies.some(c => c.name === 'herb_session' && c.httpOnly && c.sameSite === 'Lax'));
  assert.ok(await evaluate("!document.cookie.includes('herb_session')"));
  await navigate('/users'); await wait("document.querySelector('tbody')?.textContent.includes('عميل')");
  await navigate('/users/new'); await wait("document.querySelector('[name=fullName]') !== null");
  await field('fullName', 'Administrateur اختبار'); await field('email', email('CREATED')); await field('password', password); await click('Enregistrer');
  await wait("location.pathname === '/users' && document.querySelector('tbody')?.textContent.includes('Administrateur اختبار')");
  const created = (await db.query('SELECT id FROM public."user" WHERE email = $1', [email('CREATED')])).rows[0].id;
  await navigate(`/users/${created}/edit`); await wait("document.querySelector('[name=fullName]')?.value === 'Administrateur اختبار'"); await field('role', 'ADMIN'); await click('Enregistrer'); await wait("location.pathname === '/users'");
  await navigate(`/users/${created}/edit`); await wait("document.querySelector('[name=newPassword]') !== null"); await field('newPassword', password); await click('Changer le mot de passe'); await wait("document.querySelector('[role=status]')?.textContent.includes('Mot de passe modifié')");
  await navigate('/products'); await wait("document.querySelector('[aria-label=\"Navigation principale\"]') !== null"); await send('Page.reload'); await wait("document.querySelector('[aria-label=\"Navigation principale\"]')?.textContent.includes('Utilisateurs')");
  await signOut(); assert.equal(await evaluate("fetch('http://localhost:3001/products', {credentials:'include'}).then(r=>r.status)"), 401);
  await signIn('ADMIN');
  for (const route of ['/products', '/categories', '/suppliers', '/purchases', '/sales', '/stock', '/cash', '/expenses', '/finance', '/reports', '/online-orders', '/users', '/settings/store', '/audit']) { await navigate(route); await wait("document.querySelector('main h1') !== null && document.querySelector('main h1').textContent !== 'Accès non autorisé'"); }
  await db.query('UPDATE public."authSession" SET "expiresAt" = now() - interval \'1 second\' WHERE "userId" IN (SELECT id FROM public."user" WHERE email = $1)', [email('ADMIN')]);
  await send('Page.reload'); await wait("location.pathname === '/login' && document.querySelector('[name=password]') !== null");
  await navigate('/shop'); await wait("document.querySelector('main h1') !== null"); assert.equal(await evaluate('location.pathname'), '/shop');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ result: 'passed', checks: 'unauth redirect; generic login failure; ADMIN navigation; anonymous denial; user create/edit/password form; HttpOnly cookie; refresh; logout/revocation; expired session; public shop; Arabic; mobile; no hydration errors', outputDir }, null, 2));
} catch (error) { console.error('Browser page:', await evaluate('document.body.innerText').catch(() => 'unavailable')); console.error('Auth request paths:', requests.filter(r=>r.url.includes('/auth/')).map(r=>({method:r.method,url:r.url}))); throw error; }
finally { await db.query('DELETE FROM public."user" WHERE email LIKE $1', [`${token.toLowerCase()}-%@example.com`]); const after = await snapshot(); await db.end(); await send('Browser.close').catch(() => {}); socket.close(); assert.deepEqual(after, before); console.log('All disposable users/sessions removed; business rows unchanged.'); }
