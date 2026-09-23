import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, Upload, Check } from 'lucide-react';
import { InternalDataField } from '../../types';

export interface ImportDataResult {
  imported: number;
  created: number;
  skipped: { row: number; reason: string }[];
  errors: { row: number; error: string }[];
}

interface ImportDataModalProps {
  token: string | null;
  tableId: string;
  fields: InternalDataField[];
  onClose: () => void;
  onImported: (result: ImportDataResult) => void;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/internal-data'
  : `${window.location.origin}/api/internal-data`;

const ImportDataModal: React.FC<ImportDataModalProps> = ({ token, tableId, fields, onClose, onImported }) => {
  const { t } = useTranslation('internalData');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'select' | 'importing' | 'result'>('select');
  const [importResult, setImportResult] = useState<ImportDataResult | null>(null);
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE}/tables/${tableId}/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('importModal.downloadTemplateError'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template', err);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setStage('importing');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/tables/${tableId}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('importModal.importError'));
      setImportResult(data);
      onImported(data);
    } catch (err: unknown) {
      setImportResult({
        imported: 0, created: 0, skipped: [],
        errors: [{ row: 0, error: err instanceof Error ? err.message : t('importModal.unknownError') }],
      });
    } finally {
      setStage('result');
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportFile}
      />

      {stage === 'select' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-8" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">{t('importModal.title')}</h2>
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 rounded-2xl px-5 py-4">
                <p className="text-sm font-bold text-slate-700 mb-1">{t('importModal.wantExample')}</p>
                <p className="text-xs text-slate-400 mb-3">
                  {t('importModal.downloadTemplateHint', { fields: fields.map(f => f.label).join(', ') || t('importModal.noFieldsDefined') })}
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                >
                  <Download size={15} /> {t('importModal.downloadTemplateButton')}
                </button>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors"
              >
                <Upload size={16} />
                {t('importModal.chooseFile')}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
              >
                {t('importModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'importing' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-4" dir="rtl">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full" />
            <p className="text-sm font-bold text-slate-600">{t('importModal.importing')}</p>
          </div>
        </div>
      )}

      {stage === 'result' && importResult && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 sm:p-8 max-h-[85vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900">{t('importModal.resultTitle')}</h2>
              <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-2xl px-5 py-3">
                <Check size={18} className="flex-shrink-0" />
                <span className="font-bold text-sm">
                  {t('importModal.importedSuccessfully', { count: importResult.imported })}
                </span>
              </div>

              {importResult.skipped.length > 0 && (
                <div className="bg-amber-50 rounded-2xl px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-amber-700">{t('importModal.skipped', { count: importResult.skipped.length })}</span>
                    <button
                      onClick={() => setShowSkippedDetails(v => !v)}
                      className="text-xs font-bold text-amber-700 underline hover:text-amber-900 transition-colors"
                    >
                      {showSkippedDetails ? t('importModal.hideDetails') : t('importModal.viewReason')}
                    </button>
                  </div>
                  {showSkippedDetails && (
                    <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto mt-2">
                      {importResult.skipped.map((s, i) => (
                        <li key={i}>{t('importModal.rowDetail', { row: s.row, reason: s.reason })}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-red-600">{t('importModal.errors', { count: importResult.errors.length })}</span>
                    <button
                      onClick={() => setShowErrorDetails(v => !v)}
                      className="text-xs font-bold text-red-600 underline hover:text-red-800 transition-colors"
                    >
                      {showErrorDetails ? t('importModal.hideDetails') : t('importModal.viewReason')}
                    </button>
                  </div>
                  {showErrorDetails && (
                    <ul className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto mt-2">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>{e.row ? t('importModal.rowError', { row: e.row }) : ''}: {e.error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {t('importModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportDataModal;
