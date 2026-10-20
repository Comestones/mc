import type * as Y from 'yjs';
import { cursorText } from './presence';
import type { CursorLocation } from './presenceTypes';

/** Map visible UTF-16 text boundaries to the HTML string stored in Y.Text. */
export function htmlOffsets(raw: string): { text: string; offsets: number[] } {
  let text = ''; const offsets: number[] = [0];
  const decoder = document.createElement('textarea');
  const tokens = /<[^>]*>|&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);|[^<&]|[<&]/g;
  for (const match of raw.matchAll(tokens)) {
    const token = match[0], start = match.index!;
    if (token.startsWith('<') && token.endsWith('>')) { offsets[text.length] = start + token.length; continue; }
    decoder.innerHTML = token.startsWith('&') ? token : '';
    const visible = token.startsWith('&') ? decoder.value : token;
    for (let i = 0; i < visible.length; i++) { text += visible[i]; offsets[text.length] = i === visible.length - 1 ? start + token.length : start; }
  }
  return { text, offsets };
}
export function fieldElement(location: Pick<CursorLocation, 'field' | 'blockId'>): HTMLElement | null {
  if (location.field === 'title') return document.querySelector<HTMLInputElement>('[aria-label="页面标题"]');
  const editable = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"][data-block-id]')).find(el => el.dataset.blockId === location.blockId);
  if (editable) return editable;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-code-id]')).find(el => el.dataset.blockCodeId === location.blockId)?.querySelector('textarea') ?? null;
}
function locationFor(element: Element | null): Pick<CursorLocation, 'field' | 'blockId'> | null {
  if (!element) return null;
  if (element.matches('[aria-label="页面标题"]')) return { field: 'title' };
  const block = element.closest<HTMLElement>('[contenteditable="true"][data-block-id]');
  if (block) return { field: 'block', blockId: block.dataset.blockId };
  const code = element.closest<HTMLElement>('[data-block-code-id]');
  return element.matches('textarea') && code ? { field: 'block', blockId: code.dataset.blockCodeId } : null;
}
const isInput = (el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
export function readCursor(doc: Y.Doc): CursorLocation | null {
  const location = locationFor(document.activeElement), root = location && fieldElement(location);
  const text = location && cursorText(doc, location);
  if (!location || !root || !text) return null;
  if (isInput(root)) {
    if (root.value !== text.toString()) return null;
    const a = root.selectionStart, b = root.selectionEnd;
    return a === null || b === null ? null : { ...location, anchor: root.selectionDirection === 'backward' ? b : a, head: root.selectionDirection === 'backward' ? a : b };
  }
  const selection = window.getSelection();
  if (!selection?.anchorNode || !selection.focusNode || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  const map = htmlOffsets(text.toString());
  if (map.text !== root.textContent) return null;
  const offset = (node: Node, index: number) => { const range = document.createRange(); range.selectNodeContents(root); range.setEnd(node, index); return range.toString().length; };
  return { ...location, anchor: map.offsets[offset(selection.anchorNode, selection.anchorOffset)], head: map.offsets[offset(selection.focusNode, selection.focusOffset)] };
}
export function bindPresenceDom(doc: Y.Doc, publish: (cursor: CursorLocation | null) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined, composing = false;
  const flush = () => { timer = undefined; publish(!composing && document.hasFocus() ? readCursor(doc) : null); };
  const schedule = () => { if (timer === undefined) timer = setTimeout(flush, 50); };
  const clear = () => { clearTimeout(timer); timer = undefined; publish(null); };
  const start = () => { composing = true; clear(); };
  const end = () => { composing = false; schedule(); };
  const events = ['selectionchange', 'select', 'input', 'keyup', 'pointerup', 'focusin', 'focusout'];
  events.forEach(event => document.addEventListener(event, schedule));
  document.addEventListener('compositionstart', start); document.addEventListener('compositionend', end);
  window.addEventListener('blur', clear); window.addEventListener('focus', schedule);
  return () => {
    clearTimeout(timer); events.forEach(event => document.removeEventListener(event, schedule));
    document.removeEventListener('compositionstart', start); document.removeEventListener('compositionend', end);
    window.removeEventListener('blur', clear); window.removeEventListener('focus', schedule); publish(null);
  };
}
function point(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (offset <= length) return { node, offset }; offset -= length;
  }
  return offset === 0 ? { node: root, offset: root.childNodes.length } : null;
}
export interface CursorRects { caret: { left: number; top: number; height: number }; selection: Array<{ left: number; top: number; width: number; height: number }> }
export function cursorRects(location: CursorLocation, docText?: string): CursorRects | null {
  const element = fieldElement(location);
  if (!element || !element.getClientRects().length) return null;
  let root = element, anchor = location.anchor, head = location.head, mirror: HTMLElement | undefined;
  if (isInput(element)) {
    if (Math.max(anchor, head) > element.value.length) return null;
    // Mirror the input's typography, padding, wrapping and scroll without touching its selection.
    mirror = document.createElement('div'); const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'textAlign', 'tabSize'] as const) mirror.style[property] = style[property];
    Object.assign(mirror.style, { position: 'fixed', left: `${rect.left - element.scrollLeft}px`, top: `${rect.top - element.scrollTop}px`, width: `${rect.width}px`, whiteSpace: element instanceof HTMLInputElement || element.wrap === 'off' ? 'pre' : 'pre-wrap', overflowWrap: 'break-word', visibility: 'hidden', pointerEvents: 'none', borderStyle: 'solid', borderColor: 'transparent' });
    mirror.textContent = element.value + '\u200b'; mirror.setAttribute('aria-hidden', 'true'); document.body.appendChild(mirror); root = mirror;
  } else {
    if (docText === undefined) return null;
    const map = htmlOffsets(docText);
    if (map.text !== element.textContent) return null;
    const visible = (raw: number) => { let index = 0; for (let i = 0; i < map.offsets.length; i++) { if (map.offsets[i] <= raw) index = i; } return index; };
    anchor = visible(anchor); head = visible(head);
  }
  try {
    const a = point(root, Math.min(anchor, head)), b = point(root, Math.max(anchor, head)), caret = point(root, head);
    if (!a || !b || !caret) return null;
    const range = document.createRange(); range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
    const bounds = element.getBoundingClientRect();
    const visible = (r: DOMRect) => r.height > 0 && r.bottom > Math.max(44, bounds.top) && r.top < Math.min(window.innerHeight, bounds.bottom) && r.right >= bounds.left && r.left <= bounds.right;
    const selection = anchor === head ? [] : Array.from(range.getClientRects()).filter(visible).map(r => ({ left: Math.max(bounds.left, r.left), top: r.top, width: Math.min(bounds.right, r.right) - Math.max(bounds.left, r.left), height: r.height }));
    range.setStart(caret.node, caret.offset); range.collapse(true);
    let rect = range.getClientRects()[0];
    if (!rect?.height && root.textContent?.length === 0) rect = bounds;
    if (!rect || !visible(rect)) return null;
    return { caret: { left: rect.left, top: rect.top, height: rect.height }, selection };
  } finally { mirror?.remove(); }
}
