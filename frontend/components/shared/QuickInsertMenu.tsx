import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface QuickInsertOption {
  label: string;
  getValue: () => string;
  disabled?: boolean;
}

interface QuickInsertMenuProps {
  options: QuickInsertOption[];
  onSelect: (value: string) => void;
  title?: string;
}

/**
 * Small three-dot (⋮) icon button that opens a dropdown of quick-insert options.
 * The dropdown is rendered in a portal (document.body) so it is never clipped by
 * an ancestor with `overflow-hidden` (e.g. a rounded bordered input container).
 * Renders nothing if there are no options. Disabled options are shown dimmed and
 * do not trigger onSelect.
 */
const QuickInsertMenu: React.FC<QuickInsertMenuProps> = ({ options, onSelect, title }) => {
  const { t } = useTranslation('builder');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!options.length) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-full px-1.5 py-2 bg-slate-50 border-s border-slate-200 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors outline-none flex-shrink-0"
        title={title || t('quickInsert.autoFill')}
      >
        <MoreVertical size={14} />
      </button>
      {open && position && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: position.top, left: position.left }}
          className="bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 min-w-[160px]"
        >
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                setOpen(false);
                onSelect(opt.getValue());
              }}
              title={opt.disabled ? t('quickInsert.userNameMissing') : undefined}
              className={`w-full text-start px-3 py-2 text-xs font-bold transition-colors ${
                opt.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default QuickInsertMenu;

