import * as Y from 'yjs';
import type { BlockNode } from '../types/document.ts';
import { normalizeBlock } from '../utils/blockUtils.ts';
export interface PageSnapshot { title: string; blocks: BlockNode[] }
export const LOCAL_EDIT = Symbol('local-page-edit');
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => left[key] !== undefined);
  const other = Object.keys(right).filter(key => right[key] !== undefined);
  return keys.length === other.length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && same(left[key], right[key]));
}
/** Change only the changed span, preserving CRDT character identity elsewhere. */
export function editText(text: Y.Text, value: string) {
  const current = text.toString();
  let start = 0, end = 0;
  while (start < current.length && start < value.length && current[start] === value[start]) start++;
  while (end < current.length - start && end < value.length - start && current[current.length - 1 - end] === value[value.length - 1 - end]) end++;
  const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
  const low = (code: number) => code >= 0xdc00 && code <= 0xdfff;
  if (start > 0 && high(current.charCodeAt(start - 1)) && low(current.charCodeAt(start))) start--;
  if (end > 0 && high(current.charCodeAt(current.length - end - 1)) && low(current.charCodeAt(current.length - end))) end--;
  if (current.length - start - end) text.delete(start, current.length - start - end);
  if (value.length - start - end) text.insert(start, value.slice(start, value.length - end));
}
/** Rebase buffered edits (initial handshake or IME) without deleting concurrent remote insertions. */
export function mergeBufferedText(base: string, input: string, remote: string) {
  if (base === remote || input === remote) return input;
  if (base === input) return remote;
  const seed = new Y.Doc(), left = new Y.Doc(), right = new Y.Doc();
  try {
    seed.getText('text').insert(0, base);
    const update = Y.encodeStateAsUpdate(seed);
    Y.applyUpdate(left, update); Y.applyUpdate(right, update);
    editText(left.getText('text'), input); editText(right.getText('text'), remote);
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
    return right.getText('text').toString();
  } finally { seed.destroy(); left.destroy(); right.destroy(); }
}
type NodeMap = Y.Map<unknown>;
function uniqueOrder(order: Y.Array<string>, nodes: Y.Map<NodeMap>) {
  const ids = order.toArray();
  return ids.filter((id, index) => nodes.has(id) && ids.lastIndexOf(id) === index);
}
export function readPage(document: Y.Doc): PageSnapshot | null {
  const root = document.getMap('page');
  if (root.get('schema') !== 1) return null;
  const nodes = root.get('nodes') as Y.Map<NodeMap>, order = root.get('order') as Y.Array<string>, title = root.get('title') as Y.Text;
  if (!(nodes instanceof Y.Map) || !(order instanceof Y.Array) || !(title instanceof Y.Text)) return null;
  const visited = new Set<string>();
  const read = (array: Y.Array<string>, depth = 0): BlockNode[] => depth > 10 ? [] : uniqueOrder(array, nodes).flatMap(id => {
    if (visited.has(id)) return []; visited.add(id);
    const node = nodes.get(id)!;
    if (!(node instanceof Y.Map)) return [];
    const content = node.get('content') as Y.Text;
    const props = node.get('properties') as Y.Map<unknown>;
    const children = node.get('children') as Y.Array<string>;
    if (!(content instanceof Y.Text) || !(props instanceof Y.Map) || !(children instanceof Y.Array)) return [];
    const nested = read(children, depth + 1);
    const type = node.get('type') as BlockNode['type'];
    return [normalizeBlock({ id, type, content: content.toString(), ...(props.size ? { properties: props.toJSON() } : {}), ...(nested.length ? { children: nested } : {}) })];
  });
  return { title: title.toString(), blocks: read(order) };
}
function flatten(blocks: BlockNode[], map = new Map<string, BlockNode>()) {
  for (const block of blocks) { map.set(block.id, block); flatten(block.children ?? [], map); }
  return map;
}
/** Apply local differences only: never overwrite unrelated remote fields or resurrect deleted blocks. */
export function writePage(document: Y.Doc, before: PageSnapshot, after: PageSnapshot, buffered = false) {
  const root = document.getMap('page');
  if (root.get('schema') !== 1) return;
  const nodes = root.get('nodes') as Y.Map<NodeMap>;
  const oldNodes = flatten(before.blocks), nextNodes = flatten(after.blocks);
  document.transact(() => {
    const title = root.get('title') as Y.Text;
    if (before.title !== after.title) editText(title, buffered ? mergeBufferedText(before.title, after.title, title.toString()) : after.title);
    for (const id of oldNodes.keys()) if (!nextNodes.has(id)) nodes.delete(id);
    for (const [id, block] of nextNodes) {
      const old = oldNodes.get(id);
      let node = nodes.get(id);
      if (!node) {
        if (old) continue; // A remote delete wins over editing the stale block.
        node = new Y.Map(); nodes.set(id, node);
        node.set('content', new Y.Text()); node.set('properties', new Y.Map()); node.set('children', new Y.Array());
      }
      if (!old || old.type !== block.type) node.set('type', block.type);
      const content = node.get('content') as Y.Text;
      if (!old || old.content !== block.content) editText(content, buffered && old ? mergeBufferedText(old.content, block.content, content.toString()) : block.content);
      const props = node.get('properties') as Y.Map<unknown>;
      for (const key of new Set([...Object.keys(old?.properties ?? {}), ...Object.keys(block.properties ?? {})])) {
        if (same(old?.properties?.[key], block.properties?.[key])) continue;
        if (block.properties?.[key] === undefined) props.delete(key); else props.set(key, block.properties[key]);
      }
    }
    function arrange(previous: BlockNode[], next: BlockNode[], order: Y.Array<string>) {
      const previousIds = previous.map(block => block.id), nextIds = next.map(block => block.id);
      for (let i = order.length - 1; i >= 0; i--) if (previousIds.includes(order.get(i)) && !nextIds.includes(order.get(i))) order.delete(i, 1);
      if (!same(previousIds, nextIds)) {
        for (let i = 0; i < nextIds.length; i++) {
          const id = nextIds[i]; if (!nodes.has(id)) continue;
          const current = order.toArray();
          const previousId = nextIds[i - 1];
          const target = previousId ? current.lastIndexOf(previousId) + 1 : 0;
          const found = current.lastIndexOf(id);
          if (found === target) continue;
          for (let j = order.length - 1; j >= 0; j--) if (order.get(j) === id) order.delete(j, 1);
          const at = previousId ? order.toArray().lastIndexOf(previousId) + 1 : 0;
          order.insert(Math.max(0, at), [id]);
        }
      }
      for (const block of next) {
        const node = nodes.get(block.id); if (!node) continue;
        arrange(oldNodes.get(block.id)?.children ?? [], block.children ?? [], node.get('children') as Y.Array<string>);
      }
    }
    arrange(before.blocks, after.blocks, root.get('order') as Y.Array<string>);
  }, LOCAL_EDIT);
}
