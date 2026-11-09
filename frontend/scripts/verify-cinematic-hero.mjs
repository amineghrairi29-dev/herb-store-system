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
const tag = 'cinematic-check-' + crypto.randomUUID();
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
const results = [];
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});` });
  for(const [width,height] of [[1920,1080],[1440,900],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
    await navigate('/shop');
    await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="playing"');
    const intro = await evaluate(`(()=>{window.__introAnimations=document.getAnimations().filter(a=>a.effect?.target?.closest('.sf-cinematic-top'));window.__introAnimations.forEach(a=>a.pause());return {count:window.__introAnimations.length,duration:Math.max(...window.__introAnimations.map(a=>a.effect.getComputedTiming().endTime)),lines:document.querySelectorAll('.sf-headline-mask').length}})()`);
    assert.ok(intro.count>=15); assert.ok(intro.lines>=2);
    assert.equal(Math.round(intro.duration),width===390?1235:1900);
    for(const time of [450,950,1450]) {
      await evaluate(`window.__introAnimations.forEach(a=>a.currentTime=${time*(width===390?0.65:1)})`);
      await new Promise(resolve=>setTimeout(resolve,40));
      if(time===450)assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".sf-hero-visual")).clipPath'),'none');
      await writeFile(path.join(output,`intro-${width}-${time}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
    }
    await evaluate('window.__introAnimations.forEach(a=>a.finish())');
    await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="complete"');
    await wait('document.querySelector(".sf-hero-image").complete&&document.querySelector(".sf-hero-image").naturalWidth>0');
    const settled = await evaluate(`(()=>{const h=document.querySelector('.sf-hero-banner');return {hero:h.offsetHeight,trust:document.querySelector('.sf-trust').offsetHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,headingOpacity:getComputedStyle(h.querySelector('h1')).opacity,masks:document.querySelectorAll('.sf-headline-masks').length,cls:window.__cls}})()`);
    assert.equal(settled.hero,{1920:460,1440:420,768:400,390:500}[width]);
    assert.equal(settled.trust,width===390?146:80);
    assert.equal(settled.headingOpacity,'1');assert.equal(settled.masks,0);assert.equal(settled.overflow,false);
    await writeFile(path.join(output,`settled-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
    await evaluate('scrollTo(0,350)'); await new Promise(resolve=>setTimeout(resolve,120));
    const depth=await evaluate('getComputedStyle(document.querySelector(".sf-hero-image")).translate');
    if(width>=1440){const y=parseFloat(depth.split(' ')[1]);assert.ok(y>0&&y<=8,depth);}else assert.ok(depth==='none'||depth==='');
    results.push({width,...intro,...settled,depth});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await navigate('/shop');
  await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="playing"');
  await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="complete"');
  assert.equal(await evaluate('document.querySelectorAll(".sf-headline-masks").length'),0);
  await evaluate('scrollTo(0,300)');
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(await evaluate('document.querySelector(".sf-cinematic-top").dataset.intro'),'complete');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/shop');
  await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="complete"');
  assert.ok(await evaluate(`!document.querySelector('.sf-headline-masks')&&getComputedStyle(document.querySelector('.sf-hero-visual')).clipPath==='none'&&getComputedStyle(document.querySelector('h1')).opacity==='1'`));
  await send('Emulation.setEmulatedMedia',{features:[]});
  await navigate('/shop');await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="playing"');
  await evaluate('document.querySelector(".sf-hero-actions a").focus()');
  await wait('document.querySelector(".sf-cinematic-top").dataset.intro==="complete"');
  assert.ok(await evaluate('document.activeElement.matches(".sf-hero-actions a")'));
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,results,errors,guestAuthWarnings},null,2));
  console.log(output);console.log(JSON.stringify(results));
}finally{await db.end();await send('Browser.close').catch(()=>{});socket.close();}
