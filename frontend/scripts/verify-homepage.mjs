// Run from frontend with both local apps and isolated Chrome on :9223.
// Uses real public data; only POST is the existing read-only cart validation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('../.tmp',`shop-homepage-${Date.now()}`);await mkdir(output,{recursive:true});
const tabs=await(await fetch('http://localhost:9223/json/list')).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
let seq=0,mode='live';const pending=new Map(),errors=[],requests=[],checks=[];
function send(method,params={}){return new Promise((ok,fail)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);fail(new Error(method+' timed out'));},30000);pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.fail(new Error(m.error.message));else p.ok(m.result);}}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 if(m.method==='Runtime.consoleAPICalled'&&(m.params.type==='error'||m.params.args.some(a=>/hydration|hydrating|unique.*key/i.test(a.value??''))))errors.push('Console error');
 if(m.method==='Network.requestWillBeSent'&&m.params.request.url.startsWith('http://localhost:3001/'))requests.push({url:m.params.request.url,method:m.params.request.method});
 if(m.method==='Fetch.requestPaused')void(async()=>{const {requestId,request}=m.params;if(mode==='live')return send('Fetch.continueRequest',{requestId});const categories=request.url.includes('/categories');let body=categories?[]:{data:[],pagination:{page:1,pageSize:6,totalItems:0,totalPages:0}};
 if(mode==='full')body=categories?Array.from({length:5},(_,i)=>({category:'Test category '+i,subcategory:null})):{data:Array.from({length:6},(_,i)=>({id:2147483000+i,name:'Test product '+i,scientificName:'Mentha',category:'Test category '+i,salePrice:'12.500',saleUnit:'KG',availabilityStatus:'IN_STOCK'})),pagination:{page:1,pageSize:6,totalItems:6,totalPages:1}};
 if(mode==='out'&&!categories)body={...body,data:[{id:2147483647,name:'نبتة تجريبية',scientificName:'Mentha',category:'Test visuel',salePrice:'12.500',saleUnit:'KG',availabilityStatus:'OUT_OF_STOCK'}]};
 await send('Fetch.fulfillRequest',{requestId,responseCode:mode==='error'?503:200,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'},{name:'Access-Control-Allow-Origin',value:'http://localhost:3000'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});})().catch(e=>errors.push(e.message));
});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value;};
const wait=async expression=>{for(let n=0;n<300;n++){if(await evaluate(expression))return;await new Promise(ok=>setTimeout(ok,100));}throw new Error('UI timeout: '+expression);};
const navigate=async route=>{await evaluate('window.__previous=true');await send('Page.navigate',{url:'http://localhost:3000'+route});await wait(`!window.__previous&&location.pathname===${JSON.stringify(route.split('?')[0])}&&document.querySelector('main h1')!==null`);};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await navigate('/shop');await evaluate("localStorage.removeItem('herb-store-cart-v1')");await navigate('/shop');await wait("!document.querySelector('.sf-loading')");
 const products=(await(await fetch('http://localhost:3001/public/products?pageSize=6&sort=name_asc')).json()).data;
 assert.equal(await evaluate("document.querySelectorAll('.sf-product-card').length"),products.length);
 assert.ok(await evaluate("document.querySelector('h1').textContent.includes('plantes naturelles')"));
 assert.ok(await evaluate("document.querySelector('h1').textContent.includes('Découvrez') && document.querySelector('.sf-hero-description').textContent.includes('sélectionnés')"));
 for(const p of products)assert.ok(await evaluate(`document.querySelector('.sf-product-grid').textContent.includes(${JSON.stringify(p.name)})`));
 assert.ok(!await evaluate("[...document.querySelectorAll('header a')].some(a=>/users|login|dashboard|settings|audit/.test(a.getAttribute('href')))"));
 const available=products.find(p=>p.availabilityStatus!=='OUT_OF_STOCK');
 if(available){await wait(`document.querySelector('.sf-product-card a[href="/shop/products/${available.id}"]').closest('article').querySelector('button').disabled===false`);await evaluate(`document.querySelector('.sf-product-card a[href="/shop/products/${available.id}"]').closest('article').querySelector('button').click()`);await wait("document.querySelector('header').textContent.includes('Panier (1)')");checks.push('Real featured add-to-cart and count');}
 const category=await evaluate("document.querySelector('.sf-category-card')?.getAttribute('href')");
 if(category){await navigate(category);await wait("!document.querySelector('main').textContent.includes('Chargement du catalogue')");assert.equal(await evaluate("document.querySelector('[name=category]').value"),new URL(category,'http://localhost').searchParams.get('category'));await wait("!document.querySelector('main').textContent.includes('Chargement du catalogue')");checks.push('Real category card filter');}
 if(products[0]){const p=products[0];const q=new URLSearchParams({q:p.name,category:p.category,sort:'price_desc',availability:p.availabilityStatus,pageSize:'1'});await navigate('/shop/catalogue?'+q);await wait("document.querySelector('main article')!==null");assert.equal(await evaluate("document.querySelector('[name=q]').value"),p.name);assert.equal(await evaluate("document.querySelector('[name=sort]').value"),'price_desc');await navigate('/shop/products/'+p.id);assert.ok(!await evaluate("document.querySelector('.storefront')!==null"));checks.push('Search/category/availability/sort and unchanged detail shell');}
 for(const route of ['/shop','/shop/catalogue','/shop/about','/shop/contact']){assert.equal((await fetch('http://localhost:3000'+route)).status,200);for(const width of [1920,1440,1024,768,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await navigate(route);await wait("!document.querySelector('.sf-loading')");assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await writeFile(path.join(output,route.replaceAll('/','_')+'-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));}}
 await navigate('/shop');await evaluate("document.querySelector('.sf-menu-button').click()");assert.ok(await evaluate("document.querySelector('#shop-menu').hidden===false"));await evaluate("document.querySelector('#shop-menu a[href=\"/shop/about\"]').click()");await wait("location.pathname==='/shop/about'&&document.querySelector('#shop-menu').hidden");
 await send('Page.navigate',{url:'http://localhost:3000/shop?sort=price_desc'});await wait("location.pathname==='/shop/catalogue'&&location.search==='?sort=price_desc'");
 checks.push('20 responsive page checks, mobile menu, old filtered URLs redirect');
 await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3001/public/products?*'},{urlPattern:'http://localhost:3001/public/categories'}]});
 mode='full';await navigate('/shop');await wait("document.querySelectorAll('.sf-product-card').length===6&&document.querySelectorAll('.sf-category-card').length===5");
 for(const [width,products,categories] of [[1920,6,5],[1440,5,5],[1024,4,3],[768,3,3],[390,1,1]]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});const metrics=await evaluate("({products:getComputedStyle(document.querySelector('.sf-product-grid')).gridTemplateColumns.split(' ').length,categories:getComputedStyle(document.querySelector('.sf-category-grid')).gridTemplateColumns.split(' ').length,width:document.querySelector('.sf-product-card').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1})");assert.equal(metrics.products,products);assert.equal(metrics.categories,categories);assert.equal(metrics.overflow,false);if(width>=1440)assert.ok(metrics.width>=220&&metrics.width<=270);await writeFile(path.join(output,'dense-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));}checks.push('Five full-grid responsive checks; desktop product widths 220-270px; browser-only fixtures');
 mode='empty';await navigate('/shop');await wait("document.body.textContent.includes('Aucun produit disponible')");
 mode='out';await navigate('/shop');await wait("document.querySelector('.sf-product-card button')!==null");assert.ok(await evaluate("document.querySelector('.sf-product-card button').disabled"));assert.ok(await evaluate("document.querySelector('.sf-product-card').textContent.includes('Rupture de stock')"));
 mode='error';await navigate('/shop');await wait("document.querySelector('.sf-empty[role=alert]')!==null");mode='live';await evaluate("document.querySelector('.sf-empty button').click()");await wait("!document.querySelector('.sf-loading')&&!document.querySelector('.sf-empty[role=alert]')");
 checks.push('Mocked empty/out-of-stock/API error and live retry; no DB fixtures');
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&r.url.endsWith('/public/cart/validate')));
 await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,checks,errors,output},null,2));console.log(JSON.stringify({passed:true,checks,output},null,2));
}finally{await send('Browser.close').catch(()=>{});socket.close();}
