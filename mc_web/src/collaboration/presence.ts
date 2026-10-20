import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { CursorLocation, PresenceMember } from './presenceTypes.ts';

export const COLORS = ['#2563eb', '#9333ea', '#db2777', '#059669', '#d97706', '#0891b2'];
export function normalizeName(value: string) { return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 24).join(''); }
export function createIdentity(clientId: number, savedName?: string | null) {
  return { name: normalizeName(savedName ?? '') || `访客${String(clientId).slice(-4)}`, color: COLORS[clientId % COLORS.length] };
}
export function cursorText(doc: Y.Doc, location: Pick<CursorLocation, 'field' | 'blockId'>): Y.Text | null {
  const root = doc.getMap('page');
  if (location.field === 'title') { const title = root.get('title'); return title instanceof Y.Text ? title : null; }
  const nodes = root.get('nodes');
  const node = nodes instanceof Y.Map ? nodes.get(location.blockId ?? '') : null;
  const text = node instanceof Y.Map ? node.get('content') : null;
  return text instanceof Y.Text ? text : null;
}
function validPosition(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const position = value as Record<string, unknown>;
  if (Object.keys(position).some(key => !['type', 'tname', 'item', 'assoc'].includes(key))) return false;
  if (position.assoc !== undefined && position.assoc !== 0 && position.assoc !== -1) return false;
  if (position.tname !== undefined && (typeof position.tname !== 'string' || position.tname.length > 128)) return false;
  for (const key of ['type', 'item']) {
    const id = position[key];
    if (id !== null && id !== undefined) {
      if (typeof id !== 'object' || Array.isArray(id)) return false;
      const { client, clock } = id as Record<string, unknown>;
      if (!Number.isSafeInteger(client) || !Number.isSafeInteger(clock) || (client as number) < 0 || (clock as number) < 0) return false;
    }
  }
  return !!(position.type || position.tname);
}
export function decodeCursor(doc: Y.Doc, value: unknown): CursorLocation | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const cursor = value as Record<string, unknown>;
    if (cursor.field !== 'title' && cursor.field !== 'block') return null;
    if (cursor.field === 'block' && (typeof cursor.blockId !== 'string' || cursor.blockId.length > 128)) return null;
    if (!validPosition(cursor.anchor) || !validPosition(cursor.head)) return null;
    const location: Pick<CursorLocation, 'field' | 'blockId'> = { field: cursor.field, ...(cursor.field === 'block' ? { blockId: cursor.blockId as string } : {}) };
    const text = cursorText(doc, location);
    if (!text) return null;
    const anchor = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.anchor as object), doc);
    const head = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(cursor.head as object), doc);
    if (!anchor || !head || anchor.type !== text || head.type !== text) return null;
    return { ...location, anchor: anchor.index, head: head.index };
  } catch { return null; }
}
/** Ephemeral state only: no document transactions or undo entries. */
export function bindPresence(options: { document: Y.Doc; awareness: Awareness; name?: string | null; onMembers: (members: PresenceMember[]) => void }) {
  const { document: doc, awareness, onMembers } = options;
  let identity = createIdentity(doc.clientID, options.name), connected = false, destroyed = false;
  const refresh = () => {
    if (destroyed) return;
    const members: PresenceMember[] = [];
    if (connected) for (const [clientId, state] of awareness.getStates()) {
      const user = state.user;
      if (!user || typeof user.name !== 'string' || !normalizeName(user.name) || !COLORS.includes(user.color)) continue;
      members.push({ clientId, name: normalizeName(user.name), color: user.color, self: clientId === doc.clientID, cursor: decodeCursor(doc, state.cursor) });
    }
    members.sort((a, b) => Number(b.self) - Number(a.self) || a.clientId - b.clientId);
    onMembers(members);
  };
  // Renew our local clock on peer arrival so reconnecting clients can replace
  // their cached tombstone immediately instead of waiting for a heartbeat.
  let peers = new Set<number>();
  const changed = () => {
    const current = new Set(awareness.getStates().keys());
    const arrived = Array.from(current).some(id => id !== doc.clientID && !peers.has(id));
    peers = current;
    refresh();
    if (connected && arrived && awareness.getLocalState()) {
      awareness.setLocalState({ ...awareness.getLocalState() });
    }
  };
  awareness.on('change', changed); doc.on('afterTransaction', refresh);
  const publish = (cursor: unknown = null) => { if (connected && !destroyed) awareness.setLocalState({ user: identity, cursor }); };
  return {
    setConnected(value: boolean) {
      if (destroyed || connected === value) return;
      connected = value;
      if (value) publish(); else awareness.setLocalState(null);
      refresh();
    },
    rename(value: string) {
      const name = normalizeName(value); if (!name || destroyed) return;
      identity = { ...identity, name }; publish(awareness.getLocalState()?.cursor ?? null);
    },
    cursor(location: CursorLocation | null) {
      if (!connected || destroyed) return;
      const text = location && cursorText(doc, location);
      let encoded: unknown = null;
      if (location && text && [location.anchor, location.head].every(index => Number.isInteger(index) && index >= 0 && index <= text.length)) {
        encoded = { field: location.field, ...(location.field === 'block' ? { blockId: location.blockId } : {}),
          anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, location.anchor)),
          head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, location.head)) };
      }
      if (JSON.stringify(awareness.getLocalState()?.cursor ?? null) !== JSON.stringify(encoded)) publish(encoded);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; awareness.off('change', changed); doc.off('afterTransaction', refresh);
      awareness.setLocalState(null); onMembers([]);
    },
  };
}
