import React from 'react';
import { X, Plus } from 'lucide-react';
import { FileUploader } from '../../FileUploader';
import {
  TemplateComponentsFormState,
  TemplateHeaderType,
  TemplateButtonType,
  extractBodyVariableIndexes,
} from './types';

interface TemplateComponentsEditorProps {
  value: TemplateComponentsFormState;
  onChange: (next: TemplateComponentsFormState) => void;
  token: string;
}

const HEADER_OPTIONS: { value: TemplateHeaderType; label: string }[] = [
  { value: 'none', label: 'ללא' },
  { value: 'text', label: 'טקסט' },
  { value: 'image', label: 'תמונה' },
  { value: 'video', label: 'וידאו' },
  { value: 'document', label: 'מסמך' },
];

const BUTTON_TYPE_OPTIONS: { value: TemplateButtonType; label: string }[] = [
  { value: 'quick_reply', label: 'תגובה מהירה' },
  { value: 'url', label: 'קישור' },
  { value: 'phone_number', label: 'טלפון' },
];

const MAX_RECOMMENDED_BUTTONS = 3;

const TemplateComponentsEditor: React.FC<TemplateComponentsEditorProps> = ({ value, onChange, token }) => {
  const setHeaderType = (headerType: TemplateHeaderType) => {
    onChange({ ...value, headerType, headerText: '', headerMediaUrl: '' });
  };

  const setBodyText = (bodyText: string) => {
    const indexes = extractBodyVariableIndexes(bodyText);
    const existingByIndex = new Map(value.bodyVariables.map(v => [v.index, v.example]));
    const bodyVariables = indexes.map(idx => ({ index: idx, example: existingByIndex.get(idx) || '' }));
    onChange({ ...value, bodyText, bodyVariables });
  };

  const setVariableExample = (index: number, example: string) => {
    onChange({
      ...value,
      bodyVariables: value.bodyVariables.map(v => (v.index === index ? { ...v, example } : v)),
    });
  };

  const addButton = () => {
    if (value.buttons.length >= 10) return;
    onChange({ ...value, buttons: [...value.buttons, { type: 'quick_reply', text: '' }] });
  };

  const updateButton = (idx: number, patch: Partial<typeof value.buttons[number]>) => {
    onChange({
      ...value,
      buttons: value.buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };

  const removeButton = (idx: number) => {
    onChange({ ...value, buttons: value.buttons.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">כותרת (Header)</label>
        <div className="flex gap-2 mb-3 flex-wrap">
          {HEADER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setHeaderType(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                value.headerType === opt.value
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {value.headerType === 'text' && (
          <input
            type="text"
            value={value.headerText}
            onChange={(e) => onChange({ ...value, headerText: e.target.value })}
            placeholder="טקסט הכותרת"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-start outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        )}
        {['image', 'video', 'document'].includes(value.headerType) && (
          <FileUploader
            value={value.headerMediaUrl}
            onChange={(url) => onChange({ ...value, headerMediaUrl: url })}
            accept={value.headerType === 'image' ? 'image/*' : value.headerType === 'video' ? 'video/*' : '*/*'}
            label={value.headerType === 'image' ? 'תמונה' : value.headerType === 'video' ? 'וידאו' : 'מסמך'}
            mediaType={value.headerType as 'image' | 'video' | 'document'}
            token={token}
          />
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">גוף ההודעה (Body)</label>
        <textarea
          value={value.bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={5}
          placeholder="לדוגמה: שלום {{1}}, ההזמנה שלך מוכנה"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-start outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
          השתמש ב-<span className="font-mono font-black bg-slate-100 px-1 rounded">{'{{1}}'}</span>, <span className="font-mono font-black bg-slate-100 px-1 rounded">{'{{2}}'}</span> וכו׳ עבור משתנים
        </p>

        {value.bodyVariables.length > 0 && (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-bold text-slate-500">ערכי דוגמה למשתנים</label>
            {value.bodyVariables.map(v => (
              <div key={v.index} className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-sky-600 bg-sky-50 px-2 py-2 rounded-lg border border-sky-100 flex-shrink-0">
                  {`{{${v.index}}}`}
                </span>
                <input
                  type="text"
                  value={v.example}
                  onChange={(e) => setVariableExample(v.index, e.target.value)}
                  placeholder={`ערך דוגמה עבור {{${v.index}}}`}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div>
        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">כותרת תחתונה (Footer) — אופציונלי</label>
        <input
          type="text"
          value={value.footerText}
          onChange={(e) => onChange({ ...value, footerText: e.target.value.slice(0, 60) })}
          placeholder="טקסט קצר בתחתית ההודעה"
          maxLength={60}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-start outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
        />
      </div>

      {/* Buttons */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">כפתורים — אופציונלי</label>
          <button
            type="button"
            onClick={addButton}
            className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
          >
            <Plus size={14} /> הוספת כפתור
          </button>
        </div>
        {value.buttons.length > MAX_RECOMMENDED_BUTTONS && (
          <p className="text-[11px] text-amber-600 font-bold mb-2">
            שים לב: מומלץ עד {MAX_RECOMMENDED_BUTTONS} כפתורים — WhatsApp עשוי לדחות כמות גדולה יותר
          </p>
        )}
        <div className="space-y-3">
          {value.buttons.map((btn, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <select
                value={btn.type}
                onChange={(e) => updateButton(idx, { type: e.target.value as TemplateButtonType })}
                className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
              >
                {BUTTON_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={btn.text}
                  onChange={(e) => updateButton(idx, { text: e.target.value })}
                  placeholder="טקסט הכפתור"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
                {btn.type === 'url' && (
                  <input
                    type="text"
                    value={btn.url || ''}
                    onChange={(e) => updateButton(idx, { url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                )}
                {btn.type === 'phone_number' && (
                  <input
                    type="text"
                    value={btn.phone_number || ''}
                    onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                    placeholder="+972501234567"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeButton(idx)}
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors flex-shrink-0"
                title="הסר כפתור"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplateComponentsEditor;
