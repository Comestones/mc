import type { BlockNode } from '../types/document';
export interface EditorCollaborationBridge {
  undo: () => void;
  redo: () => void;
  stopCapturing?: () => void;
  rebaseTitle?: (base: string, input: string) => string;
  rebase: (id: string, base: string, input: string) => string | undefined;
  blocks?: BlockNode[];
}
const bindings = new Map<string, EditorCollaborationBridge>();
export function editorBinding(pageId?: string) { return pageId ? bindings.get(pageId) : undefined; }
export function registerEditorBinding(pageId: string, bridge: EditorCollaborationBridge) {
  bindings.set(pageId, bridge);
  return () => { if (bindings.get(pageId) === bridge) bindings.delete(pageId); };
}
export function rebaseComposition(id: string, base: string, input: string) {
  for (const binding of bindings.values()) {
    const value = binding.rebase(id, base, input);
    if (value !== undefined) return value;
  }
  return input;
}
