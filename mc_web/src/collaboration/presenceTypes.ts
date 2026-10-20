export interface CursorLocation { field: 'title' | 'block'; blockId?: string; anchor: number; head: number }
export interface PresenceMember { clientId: number; name: string; color: string; self: boolean; cursor: CursorLocation | null }
