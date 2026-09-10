import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import TemplateComponentsEditor from './TemplateComponentsEditor';
import {
  TemplateFormState,
  TemplateModalMode,
  TemplateCategory,
  CURATED_LANGUAGES,
  emptyTemplateForm,
  componentsToFormState,
} from './types';

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'MARKETING', label: 'שיווקי (Marketing)' },
  { value: 'UTILITY', label: 'שירותי (Utility)' },
  { value: 'AUTHENTICATION', label: 'אימות (Authentication)' },
];

const NAME_REGEX = /^[a-z0-9_]+$/;

interface TemplateFormModalProps {
  mode: TemplateModalMode;
  sourceTemplate: any | null; // existing template (for edit/duplicate prefill)
  token: string;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (payload: { mode: TemplateModalMode; form: TemplateFormState; templateId?: string }) => void;
}

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({ mode, sourceTemplate, token, saving, serverError, onClose, onSubmit }) => {
  const [form, setForm] = useState<TemplateFormState>(() => {
    if (!sourceTemplate) return emptyTemplateForm();
    const name = sourceTemplate.name || sourceTemplate.elementName || sourceTemplate.template_name || '';
    return {
      name: mode === 'duplicate' ? `${name}_copy` : name,
      category: (sourceTemplate.category || 'MARKETING') as TemplateCategory,
      language: sourceTemplate.language || 'he',
      components: componentsToFormState(sourceTemplate.components || []),
    };
  });
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setNameError(null);
  }, [form.name]);

  const title = mode === 'add' ? 'הוספת תבנית חדשה' : mode === 'duplicate' ? 'שכפול תבנית' : 'עריכת תבנית';
  const isEdit = mode === 'edit';

  const handleSubmit = () => {
    if (!isEdit && !NAME_REGEX.test(form.name)) {
      setNameError('שם התבנית חייב להכיל אותיות אנגלית קטנות, ספרות וקו תחתון בלבד (a-z, 0-9, _)');
      return;
    }
    onSubmit({ mode, form, templateId: sourceTemplate?.id });
  };

  const canSubmit = form.components.bodyText.trim().length > 0 && (isEdit || form.name.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {serverError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm font-bold text-rose-700">
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">שם התבנית</label>
            <input
              type="text"
              value={form.name}
              disabled={isEdit}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value.trim() }))}
              placeholder="my_template_name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-start outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all disabled:opacity-60"
            />
            {!isEdit && (
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">אותיות אנגלית קטנות, ספרות וקו תחתון בלבד</p>
            )}
            {nameError && <p className="text-[11px] text-rose-600 mt-1.5 font-bold">{nameError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">קטגוריה</label>
              <select
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value as TemplateCategory }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">שפה</label>
              <select
                value={form.language}
                disabled={isEdit}
                onChange={(e) => setForm(f => ({ ...f, language: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all disabled:opacity-60"
              >
                {CURATED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                {!CURATED_LANGUAGES.some(l => l.code === form.language) && (
                  <option value={form.language}>{form.language}</option>
                )}
              </select>
            </div>
          </div>

          <TemplateComponentsEditor
            value={form.components}
            onChange={(components) => setForm(f => ({ ...f, components }))}
            token={token}
          />
        </div>

        <div className="flex gap-3 pt-5 border-t border-slate-100 mt-5 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="flex-[2] py-3 bg-sky-600 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-sky-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saving ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateFormModal;
