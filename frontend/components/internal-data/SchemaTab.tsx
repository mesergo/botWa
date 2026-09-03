import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Layers } from 'lucide-react';
import { InternalDataField, InternalDataFieldType, InternalDataTable } from '../../types';
import { updateTable } from './internalDataApi';

const FIELD_TYPE_LABELS: Record<InternalDataFieldType, string> = {
  string: 'טקסט', number: 'מספר', date: 'תאריך', boolean: 'כן/לא', email: 'מייל', phone: 'טלפון', json: 'JSON',
};

interface EditorField extends InternalDataField {
  _localId: string;
}

interface SchemaTabProps {
  token: string | null;
  table: InternalDataTable;
  onRefreshTable: () => void;
}

export const SchemaTab: React.FC<SchemaTabProps> = ({ token, table, onRefreshTable }) => {
  const [fields, setFields] = useState<EditorField[]>(
    [...table.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((f, i) => ({ ...f, _localId: `${f.key}_${i}` }))
  );
  const [isSaving, setIsSaving] = useState(false);

  const addField = () => setFields((prev) => [...prev, { _localId: `new_${Date.now()}`, key: '', label: '', type: 'string', required: false, order: prev.length }]);
  const updateField = (localId: string, patch: Partial<InternalDataField>) => setFields((prev) => prev.map((f) => f._localId === localId ? { ...f, ...patch } : f));
  const removeField = (localId: string) => setFields((prev) => prev.filter((f) => f._localId !== localId));
  const moveField = (localId: string, dir: -1 | 1) => setFields((prev) => {
    const idx = prev.findIndex((f) => f._localId === localId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  });

  const handleSave = async () => {
    if (fields.some((f) => !f.label.trim())) { alert('לכל שדה חייבת להיות תווית'); return; }
    setIsSaving(true);
    try {
      await updateTable(token, table._id, { fields: fields.map(({ _localId, ...f }) => f) });
      onRefreshTable();
    } catch (err: any) {
      alert(err.message || 'שגיאה בשמירת מבנה הטבלה');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">מבנה שדות הטבלה ({fields.length})</h3>
        </div>
        <button onClick={addField} className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors">
          <Plus size={14} /> הוסף שדה
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl">אין שדות עדיין — הוסף שדה ראשון, או ייבא/סנכרן נתונים כדי שהשדות יזוהו אוטומטית</p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((f, idx) => (
            <div key={f._localId} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
              <div className="flex flex-col">
                <button disabled={idx === 0} onClick={() => moveField(f._localId, -1)} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button disabled={idx === fields.length - 1} onClick={() => moveField(f._localId, 1)} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
              <input
                type="text"
                className="flex-1 min-w-0 p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="תווית השדה"
                value={f.label}
                onChange={(e) => updateField(f._localId, { label: e.target.value })}
              />
              <select
                className="p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none cursor-pointer"
                value={f.type}
                onChange={(e) => updateField(f._localId, { type: e.target.value as InternalDataFieldType })}
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer select-none flex-shrink-0">
                <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" checked={f.required === true} onChange={(e) => updateField(f._localId, { required: e.target.checked })} />
                חובה
              </label>
              <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">{f.key}</span>
              <button onClick={() => removeField(f._localId)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60">
          <Save size={16} /> שמור מבנה
        </button>
      </div>
    </div>
  );
};
