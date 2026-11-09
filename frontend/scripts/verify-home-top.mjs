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
const tag = 'home-top-check-' + crypto.randomUUID();
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
const baseline = process.argv.includes('--before');
const measurements = [];
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__layoutShifts=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__layoutShifts+=e.value}).observe({type:'layout-shift',buffered:true});` });
  for (const [width,height] of [[1920,1080],[1440,900],[1280,800],[1024,900],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:width===390 });
    await navigate('/shop');
    await wait('document.querySelector(".sf-hero-image").complete&&document.querySelector(".sf-hero-image").naturalWidth>0');
    await new Promise(resolve=>setTimeout(resolve,1000));
    const metrics = await evaluate(`(()=>{const hero=document.querySelector('.sf-hero-banner'),trust=document.querySelector('.sf-trust'),heading=document.querySelector('#categories-title');return {hero:hero.offsetHeight,trust:trust.offsetHeight,categoriesTop:heading.getBoundingClientRect().top+scrollY,headline:parseFloat(getComputedStyle(hero.querySelector('h1')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth+1,layoutShift:window.__layoutShifts}})()`);
    measurements.push({width,height,...metrics});
    assert.equal(metrics.overflow,false);
    if (!baseline) {
      if(width>=1100)assert.ok(metrics.hero>=420&&metrics.hero<=470);
      if(width>=760&&width<1100)assert.ok(metrics.hero>=380&&metrics.hero<=430);
      if(width>=760)assert.ok(metrics.trust>=72&&metrics.trust<=90);
      assert.ok(metrics.layoutShift<0.01, 'layout shift '+metrics.layoutShift);
    }
    await writeFile(path.join(output, `top-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  }
  if(!baseline) {
    await evaluate('document.querySelector("#categories-title").scrollIntoView()');
    await wait('document.querySelector(".sf-scroll-reveal").dataset.revealed==="true"');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await navigate('/shop');
    assert.ok(await evaluate('[...document.querySelectorAll(".sf-top-enter,.sf-hero-visual,.sf-scroll-reveal")].every(e=>getComputedStyle(e).animationName==="none"&&getComputedStyle(e).opacity==="1"&&getComputedStyle(e).transform==="none")'));
    await send('Emulation.setEmulatedMedia',{features:[]});
    assert.deepEqual(errors,[]);
  }
  await writeFile(path.join(output,'result.json'),JSON.stringify({baseline,measurements,errors,guestAuthWarnings},null,2));
  console.log(output); console.log(JSON.stringify(measurements));
}finally {await db.end();if(!baseline)await send('Browser.close').catch(()=>{});socket.close();}
