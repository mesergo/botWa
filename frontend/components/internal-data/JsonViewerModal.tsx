import React, { useState } from 'react';
import { X, Copy, Check, FileJson } from 'lucide-react';
import { InternalDataRow } from '../../types';

interface JsonViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: InternalDataRow | null;
}

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({ isOpen, onClose, row }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !row) return null;

  const jsonString = JSON.stringify({ _id: row._id, ...row.values, _createdAt: row.createdAt, _updatedAt: row.updatedAt }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">רשומה גולמית (JSON)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition flex items-center gap-1.5 text-xs border border-slate-200 shadow-2xs font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'הועתק!' : 'העתק JSON'}</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <pre className="p-4 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
};
