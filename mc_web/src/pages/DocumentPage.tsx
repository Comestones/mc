import React from 'react';
import {
  Image as ImageIcon,
  Smile,
  CheckSquare,
  Square,
  Sparkles,
  Calendar,
  Clock,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { IconPicker } from '../components/common/IconPicker';
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

  const handleToggleTodo = (blockIndex: number) => {
    if (!doc.blocks) return;
    const newBlocks = [...doc.blocks];
    const target = newBlocks[blockIndex];
    if (target && target.type === 'todo') {
      target.properties = {
        ...target.properties,
        checked: !target.properties?.checked,
      };
      updatePage(doc.id, { blocks: newBlocks });
    }
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

        {/* 3. Block 块级内容渲染区 */}
        <div className="space-y-3 mt-6 text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
          {doc.blocks && doc.blocks.length > 0 ? (
            doc.blocks.map((block, idx) => {
              switch (block.type) {
                case 'heading1':
                  return (
                    <h1
                      key={block.id}
                      className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mt-6 mb-2 tracking-tight"
                    >
                      {block.content}
                    </h1>
                  );
                case 'heading2':
                  return (
                    <h2
                      key={block.id}
                      className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mt-4 mb-1.5 tracking-tight"
                    >
                      {block.content}
                    </h2>
                  );
                case 'heading3':
                  return (
                    <h3
                      key={block.id}
                      className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mt-3 mb-1"
                    >
                      {block.content}
                    </h3>
                  );
                case 'callout':
                  return (
                    <div
                      key={block.id}
                      className="p-3.5 rounded-xl bg-sidebar-light dark:bg-sidebar-dark border border-border-light dark:border-border-dark flex items-start gap-3 my-2"
                    >
                      <span className="text-lg select-none">
                        {block.properties?.icon || '💡'}
                      </span>
                      <div className="flex-1 text-xs text-text-primary-light dark:text-text-primary-dark leading-normal">
                        {block.content}
                      </div>
                    </div>
                  );
                case 'todo':
                  const isChecked = block.properties?.checked;
                  return (
                    <div
                      key={block.id}
                      onClick={() => handleToggleTodo(idx)}
                      className="flex items-center gap-2.5 cursor-pointer py-0.5 group"
                    >
                      <button className="text-text-muted-light dark:text-text-muted-dark group-hover:text-blue-500 transition-colors">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-blue-500 fill-blue-500/20" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={cn(
                          'text-xs transition-all',
                          isChecked &&
                            'line-through text-text-muted-light dark:text-text-muted-dark opacity-60'
                        )}
                      >
                        {block.content}
                      </span>
                    </div>
                  );
                case 'bulletList':
                  return (
                    <div key={block.id} className="flex items-start gap-2 text-xs pl-2">
                      <span className="text-text-muted-light dark:text-text-muted-dark select-none">•</span>
                      <span>{block.content}</span>
                    </div>
                  );
                case 'paragraph':
                default:
                  return (
                    <p
                      key={block.id}
                      className="text-xs text-text-primary-light dark:text-text-primary-dark min-h-[1.5rem]"
                    >
                      {block.content || (
                        <span className="text-text-muted-light/40 dark:text-text-muted-dark/40 select-none">
                          键入 '/' 呼出快捷命令，或直接开始写作...
                        </span>
                      )}
                    </p>
                  );
              }
            })
          ) : (
            <p className="text-xs text-text-muted-light/40 dark:text-text-muted-dark/40">
              键入 '/' 呼出快捷命令，或直接开始写作...
            </p>
          )}

          {/* 下一步提示框 */}
          <div className="mt-12 p-4 rounded-xl border border-dashed border-border-light dark:border-border-dark bg-sidebar-light/30 dark:bg-sidebar-dark/30 text-xs text-text-muted-light dark:text-text-muted-dark">
            <div className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>BlockSuite / TipTap 富文本编辑内核插槽已预留</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              当前工作区布局、无限层级页面树、快捷搜索已完全打通。下一阶段将直接在此插槽接入支持 Slash 指令、块级拖拽与 Yjs 协同的富文本核心。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
