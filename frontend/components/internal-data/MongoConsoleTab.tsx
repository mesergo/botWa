import React, { useState } from 'react';
import { Database, Play, Sparkles, Loader2, Copy, Check, Terminal, FileJson, Clock } from 'lucide-react';
import { InternalDataTable } from '../../types';
import { runMongoQuery } from './internalDataApi';

interface MongoConsoleTabProps {
  token: string | null;
  table: InternalDataTable;
}

export const MongoConsoleTab: React.FC<MongoConsoleTabProps> = ({ token, table }) => {
  const firstField = table.fields[0]?.key || 'status';
  const [filterQuery, setFilterQuery] = useState<string>(`{\n  "${firstField}": ""\n}`);
  const [projection, setProjection] = useState<string>(table.fields.slice(0, 5).map((f) => f.key).join(', '));
  const [limit, setLimit] = useState<number>(20);

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const templates = [
    { name: 'כל הרשומות', query: '{}' },
    { name: 'תנאי OR מרובה', query: `{\n  "$or": [\n    { "${firstField}": "" }\n  ]\n}` },
  ];

  const handleRunQuery = async () => {
    setIsLoading(true);
    setResponse(null);
    setExecutionTime(null);
    const start = performance.now();
    try {
      let parsedFilter = {};
      if (filterQuery.trim()) parsedFilter = JSON.parse(filterQuery);
      const parsedProjection = projection.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await runMongoQuery(token, table._id, {
        filter: parsedFilter,
        projection: parsedProjection.length > 0 ? parsedProjection : undefined,
        limit,
      });
      setExecutionTime(Math.round(performance.now() - start));
      setResponse(res);
    } catch (err: any) {
      setResponse({ success: false, error: err.message || 'שאילתת JSON אינה תקינה' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">מסוף שאילתות (Query Console)</h3>
          </div>
          <span className="text-xs text-slate-500">
            תומך במפעילי סינון: <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">$eq, $gt, $regex, $in, $or, $and</code>
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-700 mb-2 block">תבניות שאילתה מהירות:</span>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl, i) => (
              <button key={i} type="button" onClick={() => setFilterQuery(tpl.query)} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /><span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-emerald-600" /><span>שאילתת סינון (Filter JSON)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">{table.slug}.find()</span>
            </div>

            <textarea
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              rows={8}
              className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-800 rounded-2xl text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              dir="ltr"
            />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">שדות להחזרה (Projection):</label>
                <input type="text" value={projection} onChange={(e) => setProjection(e.target.value)} placeholder="phone, fullName, email" className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500" dir="ltr" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">הגבלת תוצאות (Limit):</label>
                <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button onClick={handleRunQuery} disabled={isLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition disabled:opacity-50">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>הרץ שאילתה</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-900">תוצאות השאילתה (Query Results)</span>
            </div>
            <div className="flex items-center gap-2">
              {executionTime !== null && (
                <span className="text-xs text-slate-500 font-mono flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />{executionTime}ms</span>
              )}
              {response && (
                <button onClick={handleCopy} className="p-1 text-slate-500 hover:text-slate-900 rounded-lg transition" title="העתק תוצאה">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 min-h-[320px] max-h-[420px] overflow-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 gap-2 py-16">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /><span>מבצע חיפוש...</span>
              </div>
            ) : response !== null ? (
              <pre className="text-emerald-400">{typeof response === 'object' ? JSON.stringify(response, null, 2) : response}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center">
                <Terminal className="w-8 h-8 mb-2 text-slate-600" />
                <p>הזן שאילתה ולחץ "הרץ שאילתה" לצפייה ברשומות המותאמות</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
