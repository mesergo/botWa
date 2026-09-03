import React, { useState, useEffect } from 'react';
import {
  Code2, Copy, Check, Play, Send, Sparkles, KeyRound, Globe, Sliders,
  Loader2, Terminal, Phone, Filter, Layers, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { InternalDataTable, InternalDataOutputFormat } from '../../types';
import { updateApiSettings } from './internalDataApi';

interface ApiGeneratorTabProps {
  token: string | null;
  table: InternalDataTable;
  onRefreshTable: () => void;
}

export const ApiGeneratorTab: React.FC<ApiGeneratorTabProps> = ({ token, table, onRefreshTable }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fields = table.fields.map((f) => f.key);

  const [apiMode, setApiMode] = useState<'phone_lookup' | 'dynamic_filter'>('phone_lookup');

  const [lookupKey, setLookupKey] = useState<string>(table.fields.find((f) => f.type === 'phone')?.key || fields[0] || 'phone');
  const [lookupValue, setLookupValue] = useState<string>('0501234567');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [outputFormat, setOutputFormat] = useState<InternalDataOutputFormat>('single_object');
  const [includeApiKeyInUrl, setIncludeApiKeyInUrl] = useState<boolean>(false);
  const [successReturn, setSuccessReturn] = useState<string>('-2');
  const [notFoundReturn, setNotFoundReturn] = useState<string>('0');
  const [notFoundMessage, setNotFoundMessage] = useState<string>('❌ לא נמצאה רשומה תואמת');

  const [filterField, setFilterField] = useState<string>(fields[0] || '');
  const [filterOperator, setFilterOperator] = useState<string>('contains');
  const [filterValue, setFilterValue] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);
  const [testTimeMs, setTestTimeMs] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'js' | 'python' | 'make'>('curl');
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setLookupKey(table.fields.find((f) => f.type === 'phone')?.key || table.fields[0]?.key || 'phone');
  }, [table._id]);

  const generateEndpointUrl = (): { url: string; displayUrl: string; requestBody?: any } => {
    if (apiMode === 'phone_lookup') {
      const params = new URLSearchParams();
      params.set('key', lookupKey);
      params.set('value', lookupValue);
      if (selectedFields.length > 0) params.set('fields', selectedFields.join(','));
      if (outputFormat && outputFormat !== 'single_object') params.set('_format', outputFormat);
      if (outputFormat === 'bot_actions') {
        params.set('_successReturn', successReturn);
        params.set('_notFoundReturn', notFoundReturn);
        params.set('_notFoundMessage', notFoundMessage);
      }
      if (includeApiKeyInUrl && table.api.key && !table.api.enabled) params.set('apiKey', table.api.key);

      if (method === 'GET') {
        const fullUrl = `${origin}/api/v1/collections/${table._id}/lookup?${params.toString()}`;
        return { url: fullUrl, displayUrl: fullUrl };
      }
      const fullUrl = `${origin}/api/v1/collections/${table._id}/lookup`;
      const body: Record<string, any> = { key: lookupKey, value: lookupValue };
      if (selectedFields.length > 0) body.fields = selectedFields;
      if (outputFormat && outputFormat !== 'single_object') body._format = outputFormat;
      if (outputFormat === 'bot_actions') {
        body._successReturn = successReturn;
        body._notFoundReturn = notFoundReturn;
        body._notFoundMessage = notFoundMessage;
      }
      return { url: fullUrl, displayUrl: fullUrl, requestBody: body };
    }

    const params = new URLSearchParams();
    if (filterField && filterValue) {
      params.set(filterOperator === 'equals' ? filterField : `${filterField}__${filterOperator}`, filterValue);
    }
    if (selectedFields.length > 0) params.set('_fields', selectedFields.join(','));
    if (outputFormat && outputFormat !== 'json_array') params.set('_format', outputFormat);
    if (outputFormat === 'bot_actions') {
      params.set('_successReturn', successReturn);
      params.set('_notFoundReturn', notFoundReturn);
      params.set('_notFoundMessage', notFoundMessage);
    }
    if (limit) params.set('_limit', String(limit));
    if (includeApiKeyInUrl && table.api.key && !table.api.enabled) params.set('apiKey', table.api.key);

    if (method === 'GET') {
      const fullUrl = `${origin}/api/v1/collections/${table._id}/query?${params.toString()}`;
      return { url: fullUrl, displayUrl: fullUrl };
    }
    const fullUrl = `${origin}/api/v1/collections/${table._id}/query`;
    const filter: Record<string, any> = {};
    if (filterField && filterValue) {
      if (filterOperator === 'equals') filter[filterField] = filterValue;
      else if (filterOperator === 'contains') filter[filterField] = { $regex: filterValue, $options: 'i' };
      else if (filterOperator === 'gt') filter[filterField] = { $gt: isNaN(Number(filterValue)) ? filterValue : Number(filterValue) };
    }
    const body: Record<string, any> = { filter, limit, format: outputFormat };
    if (selectedFields.length > 0) body.projection = selectedFields;
    if (outputFormat === 'bot_actions') {
      body._successReturn = successReturn;
      body._notFoundReturn = notFoundReturn;
      body._notFoundMessage = notFoundMessage;
    }
    return { url: fullUrl, displayUrl: fullUrl, requestBody: body };
  };

  const { url: currentUrl, displayUrl, requestBody } = generateEndpointUrl();

  const handleExecuteApiCall = async () => {
    setIsExecuting(true);
    setTestResponse(null);
    setTestStatusCode(null);
    setTestTimeMs(null);
    const start = performance.now();
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (table.api.key && !table.api.enabled && !includeApiKeyInUrl) headers['x-api-key'] = table.api.key;

      let res: Response;
      if (method === 'GET') {
        res = await fetch(currentUrl, { method: 'GET', headers });
      } else {
        headers['Content-Type'] = 'application/json';
        res = await fetch(currentUrl, { method: 'POST', headers, body: JSON.stringify(requestBody || {}) });
      }
      setTestTimeMs(Math.round(performance.now() - start));
      setTestStatusCode(res.status);
      const data = await res.json().catch(() => res.text());
      setTestResponse(data);
    } catch (err: any) {
      setTestStatusCode(500);
      setTestResponse({ error: err.message || 'Failed to execute API call' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopy = (text: string, type: 'url' | 'snippet' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }
    else if (type === 'key') { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
    else { setCopiedSnippet(true); setTimeout(() => setCopiedSnippet(false), 2000); }
  };

  const toggleFieldSelection = (f: string) => {
    setSelectedFields((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleTogglePublicApi = async () => {
    setIsTogglingAccess(true);
    try {
      await updateApiSettings(token, table._id, { enabled: !table.api.enabled });
      onRefreshTable();
    } catch (err: any) {
      alert('שגיאה בעדכון הרשאות API: ' + err.message);
    } finally {
      setIsTogglingAccess(false);
    }
  };

  const getCodeSnippet = (): string => {
    const authHeader = !table.api.enabled ? `-H "x-api-key: ${table.api.key}"` : '';
    if (activeSnippetTab === 'curl') {
      if (method === 'GET') return `curl -X GET "${currentUrl}" ${authHeader}`;
      return `curl -X POST "${currentUrl}" \\\n  -H "Content-Type: application/json" \\\n  ${authHeader ? authHeader + ' \\\n  ' : ''}-d '${JSON.stringify(requestBody || {}, null, 2)}'`;
    }
    if (activeSnippetTab === 'js') {
      if (method === 'GET') {
        return `const response = await fetch("${currentUrl}", {\n  method: "GET",\n  headers: {\n    "Accept": "application/json",\n    ${!table.api.enabled ? `"x-api-key": "${table.api.key}",` : ''}\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
      }
      return `const response = await fetch("${currentUrl}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    ${!table.api.enabled ? `"x-api-key": "${table.api.key}",` : ''}\n  },\n  body: JSON.stringify(${JSON.stringify(requestBody || {}, null, 2)})\n});\nconst result = await response.json();\nconsole.log(result);`;
    }
    if (activeSnippetTab === 'python') {
      if (method === 'GET') {
        return `import requests\n\nurl = "${currentUrl}"\nheaders = {\n    ${!table.api.enabled ? `"x-api-key": "${table.api.key}",` : ''}\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
      }
      return `import requests\n\nurl = "${currentUrl}"\npayload = ${JSON.stringify(requestBody || {}, null, 2)}\nheaders = {\n    "Content-Type": "application/json",\n    ${!table.api.enabled ? `"x-api-key": "${table.api.key}",` : ''}\n}\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.json())`;
    }
    return `/* Make.com / Zapier - HTTP Module */\n1. URL: ${currentUrl}\n2. Method: ${method}\n${method === 'POST' ? `3. Body (JSON):\n${JSON.stringify(requestBody || {}, null, 2)}` : ''}\n4. Headers: ${!table.api.enabled ? `x-api-key: ${table.api.key}` : '(none — הטבלה ציבורית)'}`;
  };

  return (
    <div className="space-y-6">

      {/* Access control */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900">הרשאות גישה ל-API</h3>
          </div>
          <button
            onClick={handleTogglePublicApi}
            disabled={isTogglingAccess}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              table.api.enabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            {table.api.enabled ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
            <span>{table.api.enabled ? 'API פתוח (Public) — לחץ לסגירה' : 'API מאובטח עם מפתח — לחץ לפתיחה'}</span>
          </button>
        </div>
        {!table.api.enabled && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 mb-0.5">מפתח API ייעודי לטבלה זו:</div>
              <div className="font-mono text-xs text-amber-700 font-semibold select-all" dir="ltr">{table.api.key}</div>
            </div>
            <button onClick={() => handleCopy(table.api.key, 'key')} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition flex items-center gap-1.5">
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'הועתק!' : 'העתק מפתח'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Archetype Selector Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">מחולל כתובות API חיצוניות</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">REST API v1</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">יצירת נקודות קצה שניתן לשתול במערכות חיצוניות (Make, Zapier, בוטים, CRM, אתרים)</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setApiMode('phone_lookup')} className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${apiMode === 'phone_lookup' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'}`}>
              <Phone className="w-3.5 h-3.5 text-emerald-600" /><span>איתור לפי מפתח</span>
            </button>
            <button onClick={() => setApiMode('dynamic_filter')} className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${apiMode === 'dynamic_filter' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200'}`}>
              <Filter className="w-3.5 h-3.5 text-sky-600" /><span>שאילתת סינון וכללים</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">

          {apiMode === 'phone_lookup' ? (
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-600" /><span>1. שדה חיפוש וערך לבדיקה</span></label>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">שדה המפתח (Lookup Key):</label>
                <select value={lookupKey} onChange={(e) => setLookupKey(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500">
                  {fields.map((f) => (<option key={f} value={f}>{f}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ערך לשליחה בקריאה (Value):</label>
                <input type="text" value={lookupValue} onChange={(e) => setLookupValue(e.target.value)} placeholder="0501234567" className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-emerald-700 font-semibold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500" dir="ltr" />
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-sky-600" /><span>1. כללי שאילתה וסינון</span></label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">שדה לסינון:</label>
                  <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500">
                    {fields.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">תנאי:</label>
                  <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500">
                    <option value="equals">שווה בדיוק (==)</option>
                    <option value="contains">מכיל טקסט (Contains)</option>
                    <option value="startsWith">מתחיל ב-</option>
                    <option value="gt">גדול מ- (&gt;)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ערך מבוקש:</label>
                <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="דוד, פעיל..." className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-amber-600" /><span>2. שיטת קריאה ופורמט תוצאה</span></label>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">שיטת קריאה (HTTP Method):</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMethod('GET')} className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${method === 'GET' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300'}`}>GET (Params)</button>
                <button type="button" onClick={() => setMethod('POST')} className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${method === 'POST' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-300'}`}>POST (JSON Body)</button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">פורמט התוצאה החוזרת:</label>
              <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as InternalDataOutputFormat)} className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500">
                <option value="single_object">אובייקט JSON בודד</option>
                <option value="json_array">מערך JSON מלא</option>
                <option value="fields_only">ערכים נקיים בלבד</option>
                <option value="key_value">מילון מפתחות</option>
                <option value="csv">קובץ CSV</option>
                <option value="xml">פורמט XML</option>
                <option value="bot_actions">Actions לבוט (SetParameter/Return)</option>
              </select>
            </div>
            {outputFormat === 'bot_actions' && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">קוד Return בהצלחה:</label>
                    <input type="text" value={successReturn} onChange={(e) => setSuccessReturn(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">קוד Return כשלא נמצא:</label>
                    <input type="text" value={notFoundReturn} onChange={(e) => setNotFoundReturn(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">הודעה כשלא נמצאה רשומה:</label>
                  <input type="text" value={notFoundMessage} onChange={(e) => setNotFoundMessage(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-violet-600" /><span>3. שדות להחזרה (Projection)</span></span>
              <span className="text-[10px] text-slate-500 font-normal">{selectedFields.length === 0 ? 'כל השדות' : `${selectedFields.length} נבחרו`}</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
              {fields.map((field) => (
                <button key={field} type="button" onClick={() => toggleFieldSelection(field)} className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${selectedFields.includes(field) ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>{field}</button>
              ))}
            </div>
            {!table.api.enabled && (
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">צרף API Key ב-URL:</span>
                <input type="checkbox" checked={includeApiKeyInUrl} onChange={(e) => setIncludeApiKeyInUrl(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </div>
            )}
          </div>

        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-600" />כתובת ה-API החיצונית המוכנה לשתילה:</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] border border-indigo-200">{method}</span>
              <button onClick={() => handleCopy(displayUrl, 'url')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-xs">
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'הועתק!' : 'העתק כתובת API'}</span>
              </button>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-300 font-mono text-xs text-indigo-700 font-medium break-all select-all" dir="ltr">{displayUrl}</div>
          {method === 'POST' && requestBody && (
            <div className="p-3 bg-white rounded-xl border border-slate-300 font-mono text-xs text-slate-800">
              <div className="text-[10px] text-slate-500 mb-1 font-sans">Request Body (JSON):</div>
              <pre className="text-slate-800" dir="ltr">{JSON.stringify(requestBody, null, 2)}</pre>
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-emerald-600" /><h4 className="text-sm font-bold text-slate-900">בדיקה והרצת API חי (Sandbox)</h4></div>
            <button onClick={handleExecuteApiCall} disabled={isExecuting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition disabled:opacity-50 active:scale-95">
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>שגר קריאה לבדיקה</span>
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">תשובת השרת:</span>
              {testStatusCode && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${testStatusCode >= 200 && testStatusCode < 300 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>HTTP {testStatusCode}</span>
                  {testTimeMs !== null && (<span className="text-slate-500 font-mono text-[11px]">{testTimeMs}ms</span>)}
                </div>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 min-h-[220px] max-h-[350px] overflow-auto">
              {isExecuting ? (
                <div className="h-full flex items-center justify-center text-slate-400 gap-2 py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-400" /><span>שולח בקשה...</span></div>
              ) : testResponse !== null ? (
                <pre className="text-emerald-400">{typeof testResponse === 'object' ? JSON.stringify(testResponse, null, 2) : testResponse}</pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center"><Send className="w-6 h-6 mb-2 text-slate-500" /><p className="text-slate-400 text-xs">לחץ על "שגר קריאה לבדיקה" כדי לראות את התוצאה</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2"><Code2 className="w-4 h-4 text-indigo-600" /><h4 className="text-sm font-bold text-slate-900">קוד הטמעה למערכות חיצוניות</h4></div>
            <button onClick={() => handleCopy(getCodeSnippet(), 'snippet')} className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition flex items-center gap-1 text-xs">
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? 'הועתק!' : 'העתק קוד'}</span>
            </button>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto text-xs">
            {(['curl', 'js', 'python', 'make'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveSnippetTab(tab)} className={`py-1.5 px-3 rounded-lg font-semibold transition shrink-0 ${activeSnippetTab === tab ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                {tab === 'curl' ? 'cURL' : tab === 'js' ? 'JavaScript' : tab === 'python' ? 'Python' : 'Make/Zapier'}
              </button>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-sky-300 min-h-[220px] max-h-[350px] overflow-auto">
            <pre className="whitespace-pre-wrap">{getCodeSnippet()}</pre>
          </div>
        </div>

      </div>

    </div>
  );
};
