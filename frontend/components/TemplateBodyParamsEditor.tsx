import React from 'react';
import QuickInsertMenu from './shared/QuickInsertMenu';

interface ContactField {
  _id: string;
  label: string;
}

interface TemplateBodyParamsEditorProps {
  templateParams: any;
  setTemplateParams: (updater: (p: any) => any) => void;
  contactFields: ContactField[];
  agentName?: string | null;
}

// `token` = the literal key used inside a `$token$` placeholder when this field is
// inserted into a plain-text broadcast message (see PersonalizedTextarea.tsx). Not used
// by the template {{n}} param editor below, only by the free-text personalization flow.
export const STD_FIELDS = [
  { ref: 'full_name', label: 'שם מלא', token: 'name' },
  { ref: 'phone', label: 'טלפון', token: 'phone' },
  { ref: 'whatsapp_name', label: 'שם וואטסאפ', token: 'wa_name' },
  { ref: 'email', label: 'מייל', token: 'email' },
];

/**
 * Shared editor for WhatsApp template BODY parameters ({{1}}, {{2}}...).
 * Used by GroupsPage (broadcast) and ComposerPanel (send messages), which had
 * byte-for-byte duplicated markup for this block.
 */
const TemplateBodyParamsEditor: React.FC<TemplateBodyParamsEditorProps> = ({
  templateParams, setTemplateParams, contactFields, agentName,
}) => {
  if (!Array.isArray(templateParams.body) || templateParams.body.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      <label className="text-xs font-bold text-slate-500 block">פרמטרים:</label>
      {templateParams.body.map((val: string, i: number) => {
        const isFieldMode = typeof val === 'string' && val.startsWith('__field:');
        const fieldRef = isFieldMode ? val.slice(8) : '';

        return (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-500">{`{{${i + 1}}}`}</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTemplateParams((p: any) => {
                    const body = [...(p.body || [])];
                    body[i] = '';
                    return { ...p, body };
                  })}
                  className={`px-2 py-1 transition-colors ${!isFieldMode ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  טקסט
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateParams((p: any) => {
                    const body = [...(p.body || [])];
                    body[i] = '__field:full_name';
                    return { ...p, body };
                  })}
                  className={`px-2 py-1 transition-colors ${isFieldMode ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  שדה מאיש קשר
                </button>
              </div>
              <QuickInsertMenu
                title="מילוי אוטומטי"
                options={[
                  { label: 'שם הנציג', getValue: () => agentName as string, disabled: !agentName },
                ]}
                onSelect={(value) => setTemplateParams((p: any) => {
                  const body = [...(p.body || [])];
                  body[i] = value;
                  return { ...p, body };
                })}
              />
            </div>

            {isFieldMode ? (
              <select
                value={fieldRef}
                onChange={e => setTemplateParams((p: any) => {
                  const body = [...(p.body || [])];
                  body[i] = `__field:${e.target.value}`;
                  return { ...p, body };
                })}
                className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-500"
              >
                <optgroup label="שדות בסיסיים">
                  {STD_FIELDS.map(f => <option key={f.ref} value={f.ref}>{f.label}</option>)}
                </optgroup>
                {contactFields.length > 0 && (
                  <optgroup label="שדות מותאמים אישית">
                    {contactFields.map((f: any) => (
                      <option key={f._id} value={`custom:${f._id}`}>{f.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <input
                value={val}
                onChange={e => setTemplateParams((p: any) => {
                  const body = [...(p.body || [])];
                  body[i] = e.target.value;
                  return { ...p, body };
                })}
                placeholder={`{{${i + 1}}}`}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-500"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TemplateBodyParamsEditor;
