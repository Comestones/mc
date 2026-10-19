import { useLayoutEffect, useRef, useState } from 'react';
import { editorBinding } from '../../collaboration/editorBridge';
import { mapTextOffset } from '../../collaboration/selectionUtils';
export function PageTitleInput({ pageId, value, onChange }: { pageId: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const composing = useRef(false), base = useRef(value), previous = useRef(value);
  const selection = useRef({ start: 0, end: 0 });
  const [draft, setDraft] = useState<string | null>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (input && document.activeElement === input && !composing.current && previous.current !== value) {
      input.setSelectionRange(mapTextOffset(previous.current, value, selection.current.start), mapTextOffset(previous.current, value, selection.current.end));
    }
    previous.current = value;
  }, [value]);
  return <input ref={ref} type="text" aria-label="页面标题" value={draft ?? value} placeholder="无标题页面"
    className="w-full text-3xl sm:text-4xl font-bold bg-transparent text-text-primary-light dark:text-text-primary-dark placeholder:text-text-muted-light/40 dark:placeholder:text-text-muted-dark/40 outline-none tracking-tight py-1"
    onSelect={event => { selection.current = { start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 }; }}
    onCompositionStart={event => { composing.current = true; base.current = value; setDraft(event.currentTarget.value); }}
    onCompositionEnd={event => {
      composing.current = false;
      const merged = editorBinding(pageId)?.rebaseTitle?.(base.current, event.currentTarget.value) ?? event.currentTarget.value;
      previous.current = merged; setDraft(null); onChange(merged);
    }}
    onChange={event => {
      if (composing.current) setDraft(event.target.value);
      else { previous.current = event.target.value; onChange(event.target.value); }
    }}
    onKeyDown={event => {
      if (composing.current || event.nativeEvent.isComposing || !(event.ctrlKey || event.metaKey)) return;
      const binding = editorBinding(pageId);
      if (binding && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        if (event.shiftKey || event.key.toLowerCase() === 'y') binding.redo(); else binding.undo();
      }
    }} />;
}
