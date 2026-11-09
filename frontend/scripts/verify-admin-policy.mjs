import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(source) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({ apiBase: 'http://localhost:3001' }) });
  return exports;
}
const { canOpen, readCurrentUser, roleLabels } = load('src/lib/auth.ts');
const paths = ['/', '/products', '/products/new', '/classifications', '/categories', '/stock', '/suppliers', '/purchases', '/sales', '/cash', '/expenses', '/finance', '/reports', '/online-orders', '/settings/store', '/audit', '/users', '/users/new'];
assert.deepEqual(Object.keys(roleLabels), ['ADMIN']);
for (const path of paths) assert.equal(canOpen('ADMIN', path), true);
// Rejection inputs only: these values must never become supported role choices.
for (const role of ['CUSTOMER', 'MANAGER', 'SELLER', 'AGENT', 'UNKNOWN', undefined]) {
  for (const path of paths) assert.equal(canOpen(role, path), false);
  assert.throws(() => readCurrentUser({ id: 1, fullName: 'Test', email: 'test@example.test', role }));
}
for (const path of ['/shop', '/shop/auth', '/shop/checkout', '/shop/catalogue']) assert.equal(canOpen('CUSTOMER', path), true);
assert.equal(readCurrentUser({ id: 1, fullName: 'Test', email: 'test@example.test', role: 'ADMIN' }).role, 'ADMIN');
const { auditRoleLabel } = load('src/types/audit.ts');
assert.equal(auditRoleLabel('ADMIN'), 'Administrateur');
assert.equal(auditRoleLabel('LEGACY'), 'LEGACY (historique)');
console.log('PASS: ADMIN navigation; customer/obsolete actor denial; ADMIN-only choices; historical audit display.');
