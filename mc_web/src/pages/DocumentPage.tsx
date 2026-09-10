import React from 'react';
import {
  Image as ImageIcon,
  Smile,
  Calendar,
  Clock,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { IconPicker } from '../components/common/IconPicker';
import { BlockEditor } from '../components/editor/BlockEditor';
import { cn } from '../utils/cn';

const RANDOM_COVERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop',
];

export const DocumentPage: React.FC = () => {
  const { activePageId, documents, updatePage } = useWorkspaceStore();
  const doc = documents[activePageId];

  if (!doc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted-light dark:text-text-muted-dark p-8">
        <div className="text-5xl mb-4">🌌</div>
        <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          选择一个页面开始阅读与创作
        </h2>
        <p className="text-xs mt-1">从左侧目录选择现有文档，或点击加号新建页面</p>
      </div>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePage(doc.id, { title: e.target.value });
  };

  const handleSelectIcon = (icon: string) => {
    updatePage(doc.id, { icon });
  };

  const handleAddCover = () => {
    const random = RANDOM_COVERS[Math.floor(Math.random() * RANDOM_COVERS.length)];
    updatePage(doc.id, { coverImage: random });
  };

  const handleRemoveCover = () => {
    updatePage(doc.id, { coverImage: undefined });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark transition-colors pb-32">
      {/* 1. 顶部封面图 (Cover) */}
      {doc.coverImage ? (
        <div className="group relative w-full h-48 sm:h-64 overflow-hidden">
          <img
            src={doc.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute right-4 bottom-3 opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white">
            <button
              onClick={handleAddCover}
              className="hover:underline flex items-center gap-1"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>更换封面</span>
            </button>
            <span>|</span>
            <button onClick={handleRemoveCover} className="hover:underline">
              移除封面
            </button>
          </div>
        </div>
      ) : (
        <div className="h-12" />
      )}

      {/* 2. 主页面内容限制容器 (Max Width Layout) */}
      <div className="max-w-4xl mx-auto px-6 sm:px-12">
        {/* 顶部操作区 (Icon + Hover Actions) */}
        <div className="relative mb-4">
          {/* 悬浮快捷添加图标/封面按钮（在没有封面或图标时展示） */}
          <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark mb-2">
            {!doc.icon && (
              <button
                onClick={() => handleSelectIcon('📄')}
                className="flex items-center gap-1 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
              >
                <Smile className="w-3.5 h-3.5" />
                <span>添加图标</span>
              </button>
            )}
            {!doc.coverImage && (
              <button
                onClick={handleAddCover}
                className="flex items-center gap-1 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>添加封面</span>
              </button>
            )}
          </div>

          {/* 页面 Icon */}
          {doc.icon && (
            <div className={cn(doc.coverImage ? '-mt-14 mb-2' : 'mb-2')}>
              <IconPicker currentIcon={doc.icon} onSelect={handleSelectIcon} />
            </div>
          )}

          {/* 页面大标题输入框 */}
          <input
            type="text"
            value={doc.title}
            onChange={handleTitleChange}
            placeholder="无标题页面"
            className="w-full text-3xl sm:text-4xl font-bold bg-transparent text-text-primary-light dark:text-text-primary-dark placeholder:text-text-muted-light/40 dark:placeholder:text-text-muted-dark/40 outline-none tracking-tight py-1"
          />

          {/* 页面时间元信息 */}
          <div className="flex items-center gap-4 text-xs text-text-muted-light dark:text-text-muted-dark mt-2 pb-4 border-b border-border-light/60 dark:border-border-dark/60">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              创建于 {new Date(doc.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              最后更新 {new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* 3. Block 块级内容编辑区 */}
        <BlockEditor
          key={doc.id}
          documentId={doc.id}
          initialBlocks={doc.blocks}
        />
      </div>
    </div>
  );
};
