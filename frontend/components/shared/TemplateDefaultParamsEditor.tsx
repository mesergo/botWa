import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STD_FIELDS } from '../TemplateBodyParamsEditor';
import { AGENT_NAME_TOKEN, FIELD_PREFIX } from './templateDefaultParams';

interface TemplateDefaultParamsEditorProps {
  count: number;
  value: string[];
  contactFields: { _id: string; label: string }[];
  onSave: (next: string[]) => void;
}

const TEXT_MODE = '__text';

const modeOf = (v: string) =>
  !v ? '' : v === AGENT_NAME_TOKEN || v.startsWith(FIELD_PREFIX) ? v : TEXT_MODE;

/**
 * Settings-side editor for a template's fixed BODY params ({{1}}, {{2}}...).
 * Each param can be left empty, bound to the sending agent's name, bound to a
 * contact field, or set to a fixed text. Saved values are pre-filled whenever
 * the template is picked for sending (see templateDefaultParams.ts).
 */
const TemplateDefaultParamsEditor: React.FC<TemplateDefaultParamsEditorProps> = ({
  count, value, contactFields, onSave,
}) => {
  const { t } = useTranslation('dashboard');
  const [draft, setDraft] = useState<string[]>([]);
  // Slots switched to "fixed text" whose text is still empty (otherwise the mode
  // would be derived as "none" from the empty value).
  const [textSlots, setTextSlots] = useState<Set<number>>(new Set());

  useEffect(() => {
    setDraft(Array.from({ length: count }, (_, i) => value[i] || ''));
  }, [count, value]);

  if (count === 0) return null;

  const commit = (next: string[]) => {
    setDraft(next);
    onSave(next);
  };

  return (
    <div className="mt-3 space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">
        {t('settings.templates.defaultParamsLabel')}
      </label>
      {draft.map((val, i) => {
        const mode = textSlots.has(i) && !val ? TEXT_MODE : modeOf(val);
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 w-8 shrink-0">{`{{${i + 1}}}`}</span>
            <select
              value={mode}
              onChange={e => {
                const m = e.target.value;
                const next = [...draft];
                setTextSlots(prev => {
                  const s = new Set(prev);
                  if (m === TEXT_MODE) s.add(i); else s.delete(i);
                  return s;
                });
                if (m === TEXT_MODE) {
                  // Keep an existing literal; otherwise wait for the user to type one.
                  next[i] = modeOf(val) === TEXT_MODE ? val : '';
                  if (next[i] !== val) commit(next); else setDraft(next);
                  return;
                }
                next[i] = m;
                commit(next);
              }}
              className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none focus:border-sky-400"
            >
              <option value="">{t('settings.templates.defaultParamNone')}</option>
              <option value={AGENT_NAME_TOKEN}>{t('settings.templates.defaultParamAgentName')}</option>
              <option value={TEXT_MODE}>{t('settings.templates.defaultParamText')}</option>
              <optgroup label={t('settings.templates.defaultParamBaseFields')}>
                {STD_FIELDS.map(f => (
                  <option key={f.ref} value={`${FIELD_PREFIX}${f.ref}`}>{f.label}</option>
                ))}
              </optgroup>
              {contactFields.length > 0 && (
                <optgroup label={t('settings.templates.defaultParamCustomFields')}>
                  {contactFields.map(f => (
                    <option key={f._id} value={`${FIELD_PREFIX}custom:${f._id}`}>{f.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {mode === TEXT_MODE && (
              <input
                value={val}
                onChange={e => {
                  const next = [...draft];
                  next[i] = e.target.value;
                  setDraft(next);
                }}
                onBlur={() => { if ((value[i] || '') !== val) onSave(draft); }}
                placeholder={t('settings.templates.defaultParamTextPlaceholder')}
                className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] outline-none focus:border-sky-400"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TemplateDefaultParamsEditor;
