import React, { useRef, useState } from 'react';
import { MoreVertical, Edit2, Copy, Trash2 } from 'lucide-react';
import AnchoredDropdown from '../../AnchoredDropdown';

interface TemplateActionsMenuProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

const TemplateActionsMenu: React.FC<TemplateActionsMenuProps> = ({ onEdit, onDuplicate, onDelete, deleting }) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white"
        title="פעולות נוספות"
      >
        <MoreVertical size={16} />
      </button>
      <AnchoredDropdown anchorRef={anchorRef} open={open} onClose={close} align="right">
        <button
          type="button"
          onClick={() => { close(); onEdit(); }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-start"
        >
          <Edit2 size={15} /> עריכה
        </button>
        <button
          type="button"
          onClick={() => { close(); onDuplicate(); }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-start"
        >
          <Copy size={15} /> שכפול
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => { onDelete(); }}
            disabled={deleting}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors text-start disabled:opacity-60"
          >
            <Trash2 size={15} /> {deleting ? 'מוחק...' : 'לחץ שוב לאישור מחיקה'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors text-start"
          >
            <Trash2 size={15} /> מחיקה
          </button>
        )}
      </AnchoredDropdown>
    </>
  );
};

export default TemplateActionsMenu;
