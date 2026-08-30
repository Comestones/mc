import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const COMMON_EMOJIS = [
  '📄', '🌌', '⚡', '📊', '🏗️', '📝', '💡', '🚀', '📌', '🎯',
  '📚', '🛠️', '🔍', '🎨', '📂', '🌟', '💻', '🔮', '📐', '🏷️',
  '🔥', '✨', '☕', '🧠', '📅', '⚙️', '💬', '🔔', '📈', '🧪'
];

interface IconPickerProps {
  currentIcon?: string;
  onSelect: (emoji: string) => void;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  currentIcon,
  onSelect,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center text-4xl p-1 rounded-lg hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-all duration-150 cursor-pointer"
        title="更改页面图标"
      >
        <span>{currentIcon || '📄'}</span>
        <div className="absolute inset-0 bg-black/10 dark:bg-white/10 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
          <Smile className="w-5 h-5 text-text-primary-light dark:text-text-primary-dark" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 p-3 w-64 bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark animate-in fade-in zoom-in-95 duration-150">
          <div className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark mb-2 px-1">
            常用图标
          </div>
          <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSelect(emoji);
                  setIsOpen(false);
                }}
                className={`text-xl p-2 rounded-md hover:bg-sidebar-hover-light dark:hover:bg-sidebar-hover-dark transition-colors flex items-center justify-center ${
                  currentIcon === emoji ? 'bg-sidebar-hover-light dark:bg-sidebar-hover-dark ring-1 ring-blue-500' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
