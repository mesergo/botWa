import React, { useState, useEffect } from 'react';
import { X, Save, Edit3, Plus, AlertCircle, FileCode } from 'lucide-react';
import { InternalDataTable, InternalDataRow, InternalDataField } from '../../types';
import { insertRow, updateRow } from './internalDataApi';

interface RecordModalProps {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
  table: InternalDataTable;
  initialRow?: InternalDataRow | null;
  onSaved: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  token, isOpen, onClose, table, initialRow, onSaved,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isRawJsonMode, setIsRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!initialRow;
  const fields: InternalDataField[] = table.fields.length > 0
    ? table.fields
    : Object.keys(initialRow?.values || {}).map((k) => ({ key: k, label: k, type: 'string' as const }));

  useEffect(() => {
    if (initialRow) {
      setFormData(initialRow.values || {});
      setRawJsonText(JSON.stringify(initialRow.values || {}, null, 2));
    } else {
      const initial: Record<string, any> = {};
      table.fields.forEach((f) => { initial[f.key] = f.type === 'boolean' ? false : ''; });
      setFormData(initial);
      setRawJsonText(JSON.stringify(initial, null, 2));
    }
  }, [initialRow, table]);

  if (!isOpen) return null;

  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      let finalData = formData;
      if (isRawJsonMode) {
        try {
          finalData = JSON.parse(rawJsonText);
        } catch {
          throw new Error('קוד ה-JSON אינו תקין');
        }
      }

      if (isEditing && initialRow) {
        await updateRow(token, initialRow._id, finalData);
      } else {
        await insertRow(token, table._id, finalData);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת הרשומה');
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (field: InternalDataField) => {
    if (field.type === 'boolean') {
      return (
        <input type="checkbox" className="w-4 h-4 accent-indigo-600 cursor-pointer"
          checked={formData[field.key] === true} onChange={(e) => handleFieldChange(field.key, e.target.checked)} />
      );
    }
    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
        value={formData[field.key] ?? ''}
        onChange={(e) => handleFieldChange(field.key, e.target.value)}
        placeholder={`הזן ${field.label || field.key}...`}
        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden my-8">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              {isEditing ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditing ? 'עריכת רשומה במסד הנתונים' : 'הוספת רשומה חדשה'}
              </h3>
              <p className="text-[11px] text-slate-500">טבלה: {table.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRawJsonMode(!isRawJsonMode)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 border border-slate-200 shadow-2xs transition"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isRawJsonMode ? 'מצב טופס' : 'מצב JSON'}</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {isRawJsonMode ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">נתונים בפורמט JSON:</label>
              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                rows={12}
                className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                    <span>{field.label || field.key}</span>
                    <span className="text-[10px] font-mono text-slate-400">{field.key}</span>
                  </label>
                  {renderInput(field)}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition font-medium">
              ביטול
            </button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              <span>{isEditing ? 'שמור שינויים' : 'הוסף רשומה'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
