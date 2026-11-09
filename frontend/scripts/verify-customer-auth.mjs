// Run from frontend with both apps and isolated Chrome on :9223.
// Only UUID-owned customer/product/order fixtures are written and removed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(path.resolve("../backend/package.json"));
require("dotenv").config({ path: "../backend/.env", quiet: true });
const { Client } = require("pg");
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const tag = "UI-CUSTOMER-" + crypto.randomUUID(),
  email = tag.toLowerCase() + "@example.test",
  password = "Aa9-" + crypto.randomUUID();
const output = path.resolve("../.tmp", "customer-auth-" + Date.now());
await mkdir(output, { recursive: true });
const tabs = await (await fetch("http://localhost:9223/json/list")).json();
const socket = new WebSocket(
  tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
);
await new Promise((ok) => socket.addEventListener("open", ok, { once: true }));
let seq = 0,
  productId;
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
try {
  productId = (
    await db.query(
      `INSERT INTO public.product (sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES ($1,$1,'VRAC',12.5,$1,'KG','KG',1,true,true,true,now()) RETURNING id`,
      [tag],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`,
    [productId],
  );
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await navigate("/shop");
  await evaluate("localStorage.removeItem('herb-store-cart-v1')");
  await browserFetch("/public/auth/logout", { method: "POST" });
  await navigate("/shop/catalogue?q=" + encodeURIComponent(tag));
  await wait(
    "document.querySelector('main article button')&&!document.querySelector('main article button').disabled",
  );
  await evaluate("document.querySelector('main article button').click()");
  await wait(
    "JSON.parse(localStorage.getItem('herb-store-cart-v1')||'{}').items?.length===1",
  );
  await navigate("/shop/cart");
  await wait("document.querySelector('a[href=\"/shop/checkout\"]')!==null");
  const saved = await evaluate("localStorage.getItem('herb-store-cart-v1')");
  assert.equal(JSON.parse(saved).items[0].productId, productId);
  await evaluate(
    "document.querySelector('a[href=\"/shop/checkout\"]').click()",
  );
  await wait(
    "location.pathname==='/shop/auth'&&document.querySelector('input[name=email]')",
  );
  const googleConfig = await (
    await fetch("http://localhost:3001/public/auth/config")
  ).json();
  await wait("document.querySelector('form')!==null");
  assert.equal(
    await evaluate("!!document.querySelector('a[href*=\"google/start\"]')"),
    googleConfig.googleEnabled,
  );
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width === 390,
    });
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),
    );
    await writeFile(
      path.join(output, "auth-" + width + ".png"),
      Buffer.from(
        (
          await send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
          })
        ).data,
        "base64",
      ),
    );
  }
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Créer un compte').click()",
  );
  await wait("document.querySelector('[name=fullName]')!==null");
  await fill("email", email);
  await fill("password", password);
  await fill("fullName", tag);
  await fill("phone", "20123456");
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "location.pathname==='/shop/checkout'&&document.querySelector('[name=customerName]')!==null",
  );
  assert.equal(
    await evaluate("localStorage.getItem('herb-store-cart-v1')"),
    saved,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=customerName]').value"),
    tag,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=customerEmail]').value"),
    email,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=customerPhone]').value"),
    "20123456",
  );
  assert.equal((await browserFetch("/public/auth/me")).body.email, email);
  assert.equal((await browserFetch("/users")).status, 401);
  assert.ok(!(await evaluate("document.cookie.includes('herb_customer')")));
  await wait(
    "!document.querySelector('form button[type=submit],form button').disabled",
  );
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("location.pathname==='/shop/order-success'");
  assert.equal(
    JSON.parse(await evaluate("localStorage.getItem('herb-store-cart-v1')"))
      .items.length,
    0,
  );
  const row = (
    await db.query(
      'SELECT o."customerId",o."customerEmail",o."customerName" FROM public."onlineOrder" o WHERE o."customerName"=$1',
      [tag],
    )
  ).rows[0];
  assert.ok(row.customerId);
  assert.equal(row.customerEmail, email);
  await navigate("/shop/checkout");
  await wait(
    "[...document.querySelectorAll('button')].some(b=>b.textContent==='Se déconnecter')",
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Se déconnecter').click()",
  );
  await wait("location.pathname==='/shop/auth'");
  assert.equal((await browserFetch("/public/auth/me")).status, 401);
  await fill("email", email);
  await fill("password", password);
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("location.pathname==='/shop/checkout'");
  await browserFetch("/public/auth/logout", { method: "POST" });
  await navigate("/shop/auth?returnTo=https://evil.example");
  await wait("document.querySelector('[name=email]')!==null");
  await fill("email", email);
  await fill("password", password);
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("location.pathname==='/shop'");
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        passed: true,
        googleEnabled: googleConfig.googleEnabled,
        checks: [
          "visitor catalogue/cart",
          "checkout auth gate",
          "email registration and login",
          "same cart preserved",
          "contact prefill",
          "authenticated order/customer link",
          "cart clears on success",
          "logout",
          "customer denied back-office",
          "safe return URL",
          "five viewport screenshots",
          "no console/hydration/runtime errors",
        ],
        output,
      },
      null,
      2,
    ),
  );
  console.log("Customer browser checks passed: " + output);
} catch (error) {
  await writeFile(
    path.join(output, "failure.png"),
    Buffer.from(
      (
        await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        })
      ).data,
      "base64",
    ),
  );
  console.error("Browser check failed; screenshot: " + output);
  throw error;
} finally {
  await db.query(
    'DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName"=$1)',
    [tag],
  );
  await db.query('DELETE FROM public."onlineOrder" WHERE "customerName"=$1', [
    tag,
  ]);
  await db.query('DELETE FROM public."stockMovement" WHERE "productId"=$1', [
    productId,
  ]);
  await db.query("DELETE FROM public.product WHERE id=$1", [productId]);
  await db.query("DELETE FROM public.customer WHERE email=$1", [email]);
  await db.end();
  await send("Browser.close").catch(() => {});
  socket.close();
}
