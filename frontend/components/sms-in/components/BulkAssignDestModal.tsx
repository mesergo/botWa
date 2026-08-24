/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Client } from '../types';

interface BulkAssignResult {
  assigned: number;
  total: number;
  skipped: number;
  errors: { dest: string; error: string }[];
}

interface BulkAssignDestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  apiBase: string;
  buildApiHeaders: (extra?: HeadersInit) => HeadersInit;
  /** Called after a successful bulk assignment so the parent can reload dest settings */
  onComplete: () => void;
}

export default function BulkAssignDestModal({
  isOpen,
  onClose,
  clients,
  apiBase,
  buildApiHeaders,
  onComplete,
}: BulkAssignDestModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      setError('יש לבחור לקוח לשיוך');
      return;
    }
    if (!selectedFile) {
      setError('יש לבחור קובץ Excel / CSV להעלאה');
      return;
    }
    setError('');
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', selectedClientId);
      formData.append('clientName', selectedClient?.name || '');

      const res = await fetch(`${apiBase}/admin/dest-settings/bulk-assign`, {
        method: 'POST',
        headers: buildApiHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בייבוא הקובץ');

      setResult(data);
      onComplete();
    } catch (e: any) {
      setError(e.message || 'שגיאה בייבוא הקובץ');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedClientId('');
    setSelectedFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 space-y-4"
        dir="rtl"
        style={{ fontFamily: "'Heebo', sans-serif" }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-black text-slate-900 text-base">ייבוא Excel — שיוך קווים בכמות</h4>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          העלה קובץ Excel / CSV עם רשימת מספרי קווים (עמודה בשם "dest", "מספר" או "טלפון" — או פשוט עמודה ראשונה
          ללא כותרת מיוחדת), בחר את הלקוח שאליו ישויכו כל המספרים ולחץ על "שייך את כל המספרים". קווים חדשים
          ייווצרו אוטומטית ויופעלו; קווים קיימים רק יעודכן השיוך שלהם — שאר ההגדרות (Webhook, הערות וכו') יישמרו.
        </p>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">לקוח יעד לשיוך</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 font-medium"
          >
            <option value="">בחר לקוח...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">קובץ מספרים (Excel / CSV)</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 text-slate-600 rounded-2xl font-bold text-sm transition-colors cursor-pointer"
          >
            <Upload size={15} />
            <span>{selectedFile ? selectedFile.name : 'בחר קובץ...'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-1.5">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold space-y-1">
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span>{result.assigned} מספרים שויכו בהצלחה{selectedClient ? ` ל-${selectedClient.name}` : ''}</span>
            </div>
            {result.skipped > 0 && <p>{result.skipped} שורות דולגו (ריקות / לא תקינות)</p>}
            {result.errors.length > 0 && (
              <p className="text-rose-700">{result.errors.length} שגיאות בעת השיוך</p>
            )}
          </div>
        )}

        <div className="flex gap-2.5 justify-end text-sm font-bold pt-2">
          <button
            onClick={handleClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl"
          >
            {result ? 'סגור' : 'ביטול'}
          </button>
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-2xl flex items-center gap-1.5"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isUploading ? 'מייבא...' : 'שייך את כל המספרים'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
