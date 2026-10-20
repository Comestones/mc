import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCollaborationStore } from './store';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { cursorRects, type CursorRects } from './presenceDom';
import type { BlockNode } from '../types/document';
import type { PresenceMember } from './presenceTypes';

export function PresenceOverlay() {
  const members = useCollaborationStore(state => state.members);
  const page = useWorkspaceStore(state => state.documents[state.activePageId]);
  const [markers, setMarkers] = useState<Array<{ member: PresenceMember; rects: CursorRects }>>([]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nodes = (blocks: BlockNode[] | undefined): BlockNode[] => (blocks ?? []).flatMap(block => [block, ...nodes(block.children)]);
      const blocks = nodes(page?.blocks);
      setMarkers(members.filter(member => !member.self && member.cursor).flatMap(member => {
        const cursor = member.cursor!;
        const content = cursor.field === 'block' ? blocks?.find(block => block.id === cursor.blockId)?.content : undefined;
        const rects = cursorRects(cursor, content);
        return rects ? [{ member, rects }] : [];
      }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true);
    const observer = new ResizeObserver(schedule); observer.observe(document.body);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true); };
  }, [members, page]);
  return createPortal(<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden" data-testid="presence-overlay">
    {markers.map(({ member, rects }) => <div key={member.clientId} data-remote-cursor={member.clientId}>
      {rects.selection.map((rect, index) => <div key={index} className="fixed" style={{ ...rect, backgroundColor: member.color, opacity: 0.16 }} />)}
      <div className="fixed border-l-2" style={{ ...rects.caret, borderColor: member.color }}>
        <span className="absolute bottom-full left-[-2px] rounded-t px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap max-w-40 truncate" style={{ backgroundColor: member.color }}>{member.name}</span>
      </div>
    </div>)}
  </div>, document.body);
}
