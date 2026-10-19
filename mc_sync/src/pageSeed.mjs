import * as Y from 'yjs';

const TYPES = new Set(['paragraph','heading1','heading2','heading3','bulletList','numberedList','todo','code','quote','callout','divider','database']);
export function seedPage(document, payload) {
  const root = document.getMap('page');
  if (root.has('schema')) return false;
  if (!payload || payload.kind !== 'initialize-page' || typeof payload.source !== 'string' || payload.source.length > 128
    || typeof payload.page?.title !== 'string' || payload.page.title.length > 10000 || !Array.isArray(payload.page.blocks)) return false;
  const ids = new Set(); let count = 0;
  function valid(blocks, depth = 0) {
    return depth < 10 && blocks.every(block => {
      if (++count > 5000 || !block || typeof block.id !== 'string' || !block.id || block.id.length > 128 || ids.has(block.id)
        || !TYPES.has(block.type) || typeof block.content !== 'string' || block.content.length > 500000
        || (block.properties !== undefined && (!block.properties || typeof block.properties !== 'object' || Array.isArray(block.properties)))) return false;
      ids.add(block.id);
      return block.children === undefined || (Array.isArray(block.children) && valid(block.children, depth + 1));
    });
  }
  if (!valid(payload.page.blocks)) return false;
  document.transact(() => {
    const nodes = new Y.Map(), order = new Y.Array(), title = new Y.Text();
    root.set('nodes', nodes); root.set('order', order); root.set('title', title);
    title.insert(0, payload.page.title);
    function insert(blocks, target) {
      for (const block of blocks) {
        const node = new Y.Map(), content = new Y.Text(), props = new Y.Map(), children = new Y.Array();
        nodes.set(block.id, node); node.set('type', block.type); node.set('content', content);
        node.set('properties', props); node.set('children', children);
        content.insert(0, block.content);
        for (const [key, value] of Object.entries(block.properties ?? {})) props.set(key, value);
        target.push([block.id]); insert(block.children ?? [], children);
      }
    }
    insert(payload.page.blocks, order);
    root.set('seedSource', payload.source); root.set('schema', 1);
  }, 'server-initialize');
  return true;
}
