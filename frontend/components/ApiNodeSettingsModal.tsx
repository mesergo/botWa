import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Settings, Plus, Trash2, Code } from 'lucide-react';
import { NodeData } from '../types';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST:   'bg-blue-50 text-blue-700 border-blue-200',
  PUT:    'bg-amber-50 text-amber-700 border-amber-200',
  PATCH:  'bg-violet-50 text-violet-700 border-violet-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
};

const BODY_PLACEHOLDER = `{
  "phone": "--phone--",
  "name": "--name--",
  "value": "--last_answer--"
}`;

interface ApiNodeSettingsModalProps {
  nodeId: string;
  data: NodeData;
  onChange: (data: Partial<NodeData>) => void;
  onClose: () => void;
}

const ApiNodeSettingsModal: React.FC<ApiNodeSettingsModalProps> = ({
  nodeId,
  data,
  onChange,
  onClose,
}) => {
  const [url, setUrl] = useState(data.url || '');
  const [method, setMethod] = useState<HttpMethod>((data.apiMethod as HttpMethod) || 'POST');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    data.apiHeaders && data.apiHeaders.length > 0 ? data.apiHeaders : []
  );
  const [body, setBody] = useState(data.apiBody || '');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }]);

  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i));

  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(h => h.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const formatJson = useCallback(() => {
    if (!body.trim()) return;
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: any) {
      setJsonError('JSON לא תקין — בדוק תחביר');
    }
  }, [body]);

  const validateJson = (val: string) => {
    if (!val.trim()) { setJsonError(null); return; }
    try { JSON.parse(val); setJsonError(null); }
    catch { setJsonError('JSON לא תקין'); }
  };

  const handleSave = () => {
    if (body.trim()) {
      try { JSON.parse(body); }
      catch { setJsonError('JSON לא תקין — תקן לפני שמירה'); return; }
    }
    const cleanedHeaders = headers.filter(h => h.key.trim());
    onChange({
      url,
      apiMethod: method,
      apiHeaders: cleanedHeaders.length > 0 ? cleanedHeaders : undefined,
      apiBody: body.trim() || undefined,
    });
    onClose();
  };

  const modal = (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-8"
      dir="rtl"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={22} className="text-slate-400" />
          </button>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <Settings size={20} className="text-slate-400" />
            הגדרות קריאת API
          </h3>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-10 py-8 space-y-9 flex-1">

          {/* URL */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              כתובת URL
            </label>
            <textarea
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none font-mono leading-relaxed"
              rows={3}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint?phone=--phone--&name=--name--"
              dir="ltr"
            />
            <p className="text-[11px] text-slate-400 mt-2 text-right">
              ניתן להשתמש ב-<code className="bg-slate-100 px-1.5 py-0.5 rounded-md">--שם_משתנה--</code> בכתובת
            </p>
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              שיטת בקשה (Method)
            </label>
            <div className="flex gap-3 flex-wrap">
              {HTTP_METHODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`px-6 py-2.5 rounded-xl border font-black text-sm tracking-wide transition-all ${
                    method === m
                      ? METHOD_COLORS[m]
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={addHeader}
                className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={15} />
                הוסף Header
              </button>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Headers (אופציונלי)
              </label>
            </div>

            {headers.length === 0 ? (
              <div className="text-center py-5 text-[12px] text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
                לא הוגדרו headers — ייעשה שימוש בברירת המחדל בלבד
              </div>
            ) : (
              <div className="space-y-3">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <button
                      onClick={() => removeHeader(i)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                    <input
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono"
                      placeholder="Key  (e.g. Authorization)"
                      value={h.key}
                      onChange={e => updateHeader(i, 'key', e.target.value)}
                      dir="ltr"
                    />
                    <input
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono"
                      placeholder="Value  (e.g. Bearer TOKEN)"
                      value={h.value}
                      onChange={e => updateHeader(i, 'value', e.target.value)}
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={formatJson}
                disabled={!body.trim()}
                className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition-colors"
                title="Pretty print JSON"
              >
                <Code size={15} />
                Format JSON
              </button>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Body (JSON) — אופציונלי
              </label>
            </div>
            <textarea
              className={`w-full px-5 py-4 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none font-mono leading-relaxed ${
                jsonError ? 'border-red-300 bg-red-50' : 'bg-slate-50 border-slate-200'
              }`}
              rows={10}
              value={body}
              onChange={e => { setBody(e.target.value); validateJson(e.target.value); }}
              placeholder={BODY_PLACEHOLDER}
              dir="ltr"
            />
            {jsonError ? (
              <p className="text-[12px] text-red-500 mt-2 text-right font-bold">{jsonError}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-2 text-right">
                {body.trim()
                  ? 'ה-Body הזה יישלח במקום ה-payload הסטנדרטי'
                  : 'ריק = ישלח payload סטנדרטי של הבוט (ברירת מחדל)'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition-all"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={!!jsonError}
            className="px-9 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            שמור הגדרות
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
};

export default ApiNodeSettingsModal;
