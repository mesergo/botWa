import React, { useRef, useState } from 'react';
import { X, Download, Upload, Check } from 'lucide-react';
import { useContactFields } from '../context/ContactFieldsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportContactsResult {
  imported: number;
  skipped: number;
  errors: { phone: string; error: string }[];
}

interface ImportContactsModalProps {
  token: string | null;
  /** Non-blocklist groups available to assign imported contacts to. Caller is responsible for loading these. */
  groups: { _id: string; name: string }[];
  groupsLoading?: boolean;
  onClose: () => void;
  /** Fired as soon as the import request completes successfully, before the user dismisses the result dialog. */
  onImported: (result: ImportContactsResult) => void;
  initialAssignToGroups?: boolean;
  initialSelectedGroupIds?: string[];
  /** Lets the caller reflect the in-flight import state on its own trigger button. */
  onImportingChange?: (importing: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

// ─── Component ────────────────────────────────────────────────────────────────

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  token, groups, groupsLoading = false, onClose, onImported,
  initialAssignToGroups = false, initialSelectedGroupIds = [], onImportingChange,
}) => {
  const { fields: contactFieldDefs } = useContactFields();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 'select' → choosing options / picking a file, 'result' → showing the outcome
  const [stage, setStage] = useState<'select' | 'importing' | 'result'>('select');
  const [importResult, setImportResult] = useState<ImportContactsResult | null>(null);

  const [assignToGroups, setAssignToGroups] = useState(initialAssignToGroups);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialSelectedGroupIds);

  const toggleGroupId = (id: string) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── Sample file download ──────────────────────────────────────────────────

  const downloadSample = () => {
    const customLabels = contactFieldDefs.map(f => f.label);
    const header = ['טלפון', 'שם מלא', 'שם וואטסאפ', 'מייל', ...customLabels].join(',');
    const customEmpty = customLabels.map(() => '').join(',');
    const customSep = customLabels.length > 0 ? ',' : '';
    const rows = [
      `972501234567,ישראל ישראלי,ישראל,israel@example.com${customSep}${customEmpty}`,
      `972529876543,שרה כהן,שרה' כהן,sarah@example.com${customSep}${customEmpty}`,
    ];
    const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM for Excel Hebrew support
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import from Excel/CSV ─────────────────────────────────────────────────

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so same file can be chosen again
    e.target.value = '';
    setStage('importing');
    onImportingChange?.(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (assignToGroups && selectedGroupIds.length > 0) {
        formData.append('groupIds', JSON.stringify(selectedGroupIds));
      }
      const res = await fetch(`${API_BASE}/contacts/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בייבוא');
      setImportResult(data);
      onImported(data);
    } catch (err: unknown) {
      setImportResult({ imported: 0, skipped: 0, errors: [{ phone: '', error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }] });
    } finally {
      onImportingChange?.(false);
      setStage('result');
    }
  };

  return (
    <>
      {/* Hidden file input — always mounted so the browse dialog can be triggered */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Selection dialog */}
      {stage === 'select' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-8" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">ייבוא אנשי קשר</h2>
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Download sample */}
              <div className="bg-slate-50 rounded-2xl px-5 py-4">
                <p className="text-sm font-bold text-slate-700 mb-1">רוצה לראות דוגמה?</p>
                <p className="text-xs text-slate-400 mb-3">הורד קובץ לדוגמה כדי לראות את פורמט הנתונים הנדרש</p>
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                >
                  <Download size={15} /> הורד קובץ לדוגמה
                </button>
              </div>

              {/* Assign to groups */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={assignToGroups}
                    onChange={e => { setAssignToGroups(e.target.checked); if (!e.target.checked) setSelectedGroupIds([]); }}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-indigo-800">שייך לרשימת תפוצה</span>
                </label>
                {assignToGroups && (
                  <div className="flex flex-col gap-2">
                    {groupsLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full" />
                      </div>
                    ) : groups.length === 0 ? (
                      <p className="text-xs text-indigo-400 font-semibold px-1">אין רשימות תפוצה. צור קבוצה תחילה.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {groups.map(g => (
                          <label key={g._id} className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(g._id)}
                              onChange={() => toggleGroupId(g._id)}
                              className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                            />
                            <span className="text-sm font-semibold text-indigo-800 truncate">{g.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={assignToGroups && selectedGroupIds.length === 0 && groups.length > 0}
                title={assignToGroups && selectedGroupIds.length === 0 && groups.length > 0 ? 'בחר לפחות רשימת תפוצה אחת' : undefined}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-60"
              >
                <Upload size={16} />
                בחר קובץ Excel / CSV לייבוא
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result dialog */}
      {stage === 'result' && importResult && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-8" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900">תוצאות ייבוא</h2>
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-2xl px-5 py-3">
                <Check size={18} className="flex-shrink-0" />
                <span className="font-bold text-sm">יובאו בהצלחה: <span className="text-lg">{importResult.imported}</span> אנשי קשר</span>
              </div>
              {importResult.skipped > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 text-amber-700 rounded-2xl px-5 py-3">
                  <span className="font-bold text-sm">דולגו (ללא טלפון): <span className="text-lg">{importResult.skipped}</span></span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl px-5 py-3">
                  <p className="text-red-600 font-bold text-sm mb-2">שגיאות ({importResult.errors.length}):</p>
                  <ul className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>{e.phone ? `${e.phone}: ` : ''}{e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportContactsModal;
