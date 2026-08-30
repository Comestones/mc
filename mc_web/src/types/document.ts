export type BlockType = 
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'todo'
  | 'code'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'database';

export interface BlockNode {
  id: string;
  type: BlockType;
  content: string;
  properties?: Record<string, any>;
  children?: BlockNode[];
}

export interface DocumentItem {
  id: string;
  title: string;
  icon?: string;
  coverImage?: string;
  parentId: string | null;
  isArchived?: boolean;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt: number;
  blocks?: BlockNode[];
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  icon?: string;
}
