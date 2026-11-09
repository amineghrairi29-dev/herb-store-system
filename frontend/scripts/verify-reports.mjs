// No dependencies: connects to an explicitly launched, isolated headless Chrome on port 9223.
// Uses live GET requests, then mocks report responses only in this browser to test pagination.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const outputDir = path.resolve('../.tmp', `reports-validation-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const tabs = await (await fetch('http://localhost:9223/json/list')).json();
const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0, mock = false, template;
const pending = new Map(), requests = [], errors = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); });
}
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result); } return; }
  if (message.method === 'Network.requestWillBeSent' && message.params.request.url.startsWith('http://localhost:3001/')) requests.push(message.params.request);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') void (async () => {
    const { requestId, request } = message.params;
    if (!mock || request.url.includes('export.csv')) { await send('Fetch.continueRequest', { requestId }); return; }
    const query = new URL(request.url).searchParams, page = Number(query.get('page') || 1), pageSize = Number(query.get('pageSize') || 25), complete = query.get('view') === 'print';
    const rows = Array.from({ length: 27 }, (_, index) => ({ id: `ui-${index}`, reference: `TEST-UI-${index}`, date: '2026-09-06', party: 'عميل الواجهة', status: 'Confirmé', total: '0.100', paid: '0.000', remaining: '0.100', paymentStatus: 'Non payé' }));
    const result = { ...template, data: complete ? rows : rows.slice((page - 1) * pageSize, page * pageSize), summary: { count: '27', confirmedTotal: '2.700', paid: '0.000', remaining: '2.700' }, pagination: { page, pageSize, totalItems: 27, totalPages: Math.ceil(27 / pageSize) }, complete };
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' }], body: Buffer.from(JSON.stringify(result)).toString('base64') });
  })().catch((error) => errors.push(error.message));
});
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function wait(expression) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Condition timed out: ${expression}`); }
const click = (label) => evaluate(`document.querySelectorAll('button').values().find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`);
async function input(label, value, select = false) { await evaluate(`(() => { const field = [...document.querySelectorAll('label')].find(label => label.textContent.trim().startsWith(${JSON.stringify(label)})).querySelector(${JSON.stringify(select ? 'select' : 'input')}); Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(${JSON.stringify(select ? 'change' : 'input')}, { bubbles: true })); })()`); }
async function navigate(kind) { await send('Page.navigate', { url: `http://localhost:3000/reports/${kind}` }); await wait(`location.pathname === '/reports/${kind}' && document.querySelector('.report-content') !== null`); }
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: outputDir });
  for (const kind of ['sales', 'purchases', 'expenses', 'customer-collections', 'supplier-payments', 'cash', 'financial-summary']) { await navigate(kind); assert.ok(await evaluate("document.querySelector('.report-content h1').textContent.length > 0")); }
  await navigate('sales');
  const start = requests.length; await click('Aujourd’hui'); await wait("document.querySelector('.report-content') !== null"); assert.ok(requests.slice(start).some((request) => request.url.includes('period=today')));
  await click('Personnalisé'); await input('Date début', '2026-09-07'); await input('Date fin', '2026-09-06'); await click('Appliquer'); await wait("document.body.textContent.includes('Choisissez une plage de dates valide.')");
  await input('Date début', '2026-09-01'); await input('Date fin', '2026-09-30'); await click('Appliquer'); await wait("document.querySelector('.report-content') !== null && document.querySelector('.report-content').textContent.includes('30/09/2026')");
  await input('Statut', 'DRAFT', true); await click('Appliquer'); await wait("document.querySelector('.report-content') !== null && document.querySelector('.report-content').textContent.includes('Brouillon')");
  await click('Exporter CSV');
  const deadline = Date.now() + 15000; let files = [];
  while (Date.now() < deadline) { files = (await readdir(outputDir)).filter((file) => file.endsWith('.csv')); if (files.length) break; await new Promise((resolve) => setTimeout(resolve, 100)); }
  assert.equal(files.length, 1); const csv = await readFile(path.join(outputDir, files[0]), 'utf8'); assert.equal(csv.charCodeAt(0), 0xfeff); assert.ok(csv.includes('2026-09-30')); assert.ok(requests.some((request) => request.url.includes('export.csv') && request.url.includes('status=DRAFT')));
  await click('Réinitialiser'); await wait("document.querySelector('.report-content') !== null");
  template = await (await fetch('http://localhost:3001/reports/sales?period=month')).json();
  mock = true; await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3001/reports/sales*' }] }); await navigate('sales');
  await wait("document.querySelectorAll('.report-content tbody tr').length === 25"); await click('Suivant'); await wait("document.querySelectorAll('.report-content tbody tr').length === 2"); assert.ok(await evaluate("document.querySelector('.report-summary').textContent.includes('2,700')"));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
  await writeFile(path.join(outputDir, 'mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  await evaluate("window.print = () => { window.__reportPrintRows = document.querySelectorAll('.report-print-view tbody tr').length; window.__reportPrintCalls = (window.__reportPrintCalls || 0) + 1; }");
  await click('Imprimer / PDF'); await wait('window.__reportPrintRows === 27'); assert.equal(await evaluate('window.__reportPrintCalls'), 1);
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.report-screen')).display"), 'none');
  await writeFile(path.join(outputDir, 'report.pdf'), Buffer.from((await send('Page.printToPDF', { landscape: true, printBackground: true, preferCSSPageSize: true })).data, 'base64'));
  await evaluate("window.dispatchEvent(new Event('afterprint'))"); await wait("!document.querySelector('.report-print-view')");
  assert.ok(requests.every((request) => ['GET', 'OPTIONS'].includes(request.method))); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', liveReports: 7, csv: files[0], pagination: '25 + 2 rows, full summary unchanged', print: '27 rows, one call, PDF generated', mobile: '390px without viewport overflow', backendRequests: 'GET only', outputDir }, null, 2));
} finally { await send('Browser.close').catch(() => {}); socket.close(); }
