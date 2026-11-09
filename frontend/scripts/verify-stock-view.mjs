import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the actual pure UI helpers in memory using the existing TypeScript dependency.
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const decimals = moduleUrl(compile("../src/lib/decimal.ts"));
const helpers = compile("../src/lib/stock-view.ts").replace('from "./decimal"', `from "${decimals}"`);
const { stockStatus, filterStock, filterMovements, stockSummary, movementTime, emptyMovementFilters } = await import(moduleUrl(helpers));

assert.equal(stockStatus("0.000", null), "Rupture");
assert.equal(stockStatus("0", "0"), "Rupture");
assert.equal(stockStatus("1.500", "1.5"), "Stock faible");
assert.equal(stockStatus("0.001", "1"), "Stock faible");
assert.equal(stockStatus("1.501", "1.5"), "Normal");
assert.equal(stockStatus("1", null), "Normal");
assert.equal(stockStatus("1", "0"), "Normal");
assert.equal(stockStatus("9007199254740993.001", "9007199254740993.002"), "Stock faible");
const row = (id, name, stock, minStock) => ({ product: { id, name, sku: `SKU-${id}`, minStock }, balance: { productId: id, stock, unit: "KG" } });
const rows = [row(1, "Zulu", "1", null), row(2, "زعتر", "0", "1"), row(3, "Basilic", "0.5", "1"), row(4, "Anis", "0.5", "1")];
assert.deepEqual(filterStock(rows, "", "").map((r) => r.product.id), [2, 4, 3, 1]);
assert.deepEqual(filterStock(rows, "زعتر", "").map((r) => r.product.id), [2]);
assert.deepEqual(filterStock(rows, "sku-3", "Stock faible").map((r) => r.product.id), [3]);
assert.equal(filterStock(rows, "missing", "").length, 0);

const asOf = Date.parse("2026-09-06T12:00:00Z");
const week = 7 * 24 * 60 * 60 * 1000;
const movement = (id, productId, type, time) => ({ id, productId, type, createdAt: new Date(time).toISOString() });
const movements = [movement(1, 1, "ENTRY", asOf - week), movement(2, 2, "LOSS", asOf), movement(3, 1, "EXIT", asOf - week - 1), movement(4, 1, "ENTRY", asOf + 1)];
assert.deepEqual(stockSummary(rows, movements, asOf), { total: 4, low: 2, empty: 1, recent: 2 });
assert.equal(movementTime("2026-09-06 12:00:00.123456+00"), Date.parse("2026-09-06T12:00:00.123Z"));
assert.deepEqual(filterMovements(movements, { ...emptyMovementFilters, productId: "1", type: "EXIT" }).map((m) => m.id), [3]);
assert.equal(filterMovements(movements, emptyMovementFilters).length, 4);
const localStart = new Date("2026-09-06T00:00:00").getTime();
const localEnd = new Date("2026-09-07T00:00:00").getTime();
const dated = [movement(1, 1, "ENTRY", localStart), movement(2, 1, "ENTRY", localEnd - 1), movement(3, 1, "ENTRY", localEnd)];
assert.deepEqual(filterMovements(dated, { ...emptyMovementFilters, from: "2026-09-06", to: "2026-09-06" }).map((m) => m.id), [2, 1]);
assert.equal(filterMovements(dated, { ...emptyMovementFilters, from: "2026-09-07", to: "2026-09-06" }).length, 0);
console.log("Stock status, decimal boundaries, Arabic/SKU search, sorting, date/product/type filters, reset, and seven-day window checks passed.");

if (process.env.VERIFY_LIVE_STOCK === "1") {
  const get = async (path) => {
    const response = await fetch(`http://localhost:3001${path}`);
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const products = await get("/products");
  const history = await get("/stock-movements");
  const liveRows = [];
  for (const product of products) liveRows.push({ product, balance: await get(`/products/${product.id}/stock`) });
  const now = Date.now();
  const summary = stockSummary(liveRows, history, now);
  const scaled = (value) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0")); };
  assert.equal(summary.total, products.length);
  assert.equal(summary.empty, liveRows.filter((r) => scaled(r.balance.stock) === 0n).length);
  assert.equal(summary.low, liveRows.filter((r) => r.product.minStock !== null && scaled(r.balance.stock) > 0n && scaled(r.balance.stock) <= scaled(r.product.minStock)).length);
  assert.equal(summary.recent, history.filter((m) => { const age = now - movementTime(m.createdAt); return age >= 0 && age <= week; }).length);
  console.log("Live GET-only summary verification:", summary);
}
