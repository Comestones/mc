import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { seedPage } from '../src/pageSeed.mjs';
const payload = () => ({ kind: 'initialize-page', source: 'first', page: { title: 'Page', blocks: [{ id: 'a', type: 'paragraph', content: 'hello' }] } });
test('server initializes once and ignores stale subsequent page proposals', () => {
  const document = new Y.Doc();
  try {
    assert.equal(seedPage(document, payload()), true);
    const second = payload(); second.page.title = 'stale';
    assert.equal(seedPage(document, second), false);
    assert.equal(document.getMap('page').get('title').toString(), 'Page');
    assert.deepEqual(document.getMap('page').get('order').toArray(), ['a']);
  } finally { document.destroy(); }
});
test('malformed initial snapshots fail without partially initializing a page', () => {
  for (const bad of [null, {}, { ...payload(), source: null }, { ...payload(), page: { title: 1, blocks: [] } },
    { ...payload(), page: { title: '', blocks: [{ id: 'x', type: 'unknown', content: '' }] } },
    { ...payload(), page: { title: '', blocks: [payload().page.blocks[0], payload().page.blocks[0]] } }]) {
    const document = new Y.Doc();
    try { assert.equal(seedPage(document, bad), false); assert.equal(document.getMap('page').has('schema'), false); }
    finally { document.destroy(); }
  }
});
