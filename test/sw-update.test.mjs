import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers = new Map();
const cached = new Map([['./index.html', { body: 'offline shell' }]]);
const calls = [];
let online = true;
const response = { ok: true, type: 'basic', url: 'https://ks2.insafin.store/', body: 'fresh shell', clone() { return this; } };
const caches = {
  async open() { return { async put(key, value) { cached.set(key, value); } }; },
  async match(key) { return cached.get(key); },
};
const self = {
  location: { origin: 'https://ks2.insafin.store' },
  addEventListener(name, fn) { handlers.set(name, fn); },
};
vm.runInNewContext(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), {
  self, caches, Request, Response,
  async fetch(request) {
    calls.push(request.url);
    if (!online) throw new Error('offline');
    return response;
  },
  URL,
});
async function navigate() {
  let promise;
  handlers.get('fetch')({
    request: { method: 'GET', mode: 'navigate', url: 'https://ks2.insafin.store/' },
    respondWith(value) { promise = value; },
  });
  return promise;
}

assert.equal(await navigate(), response, 'online navigation should use the current HTML');
assert.equal(calls.length, 1);
assert.equal(cached.get('./index.html'), response, 'the offline shell should refresh');

online = false;
assert.equal(await navigate(), response, 'offline navigation should use the cached HTML');
console.log('Service worker online update and offline fallback passed.');
