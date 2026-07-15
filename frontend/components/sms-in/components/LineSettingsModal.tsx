/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DestSetting, Client } from '../types';
import { X, Check, Globe, HelpCircle, Loader2, Send, Link2, Copy, Terminal, History } from 'lucide-react';
import { GOOGLE_SHEETS_APPS_SCRIPT } from '../googleSheetsScript';

interface LineSettingsModalProps {
  setting: DestSetting;
  allClients: Client[];
  historyMessageCount: number;
  onSyncHistory: (draft: DestSetting) => Promise<{ sent: number; total: number }>;
  onClose: () => void;
  onSave: (updated: DestSetting) => void | Promise<void>;
}

type TestTarget = 'googleSheets' | 'webhook' | null;

export default function LineSettingsModal({
  setting,
  allClients,
  historyMessageCount,
  onSyncHistory,
  onClose,
  onSave,
}: LineSettingsModalProps) {
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(setting.googleSheetsUrl);
  const [webhookUrl, setWebhookUrl] = useState(setting.webhookUrl);
  const [selectedClient, setSelectedClient] = useState<string>(setting.assignedClients[0] ?? '');
  const [isActive, setIsActive] = useState(setting.isActive);
  const [notes, setNotes] = useState(setting.notes || '');
  
  const [testTarget, setTestTarget] = useState<TestTarget>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [historySyncResult, setHistorySyncResult] = useState<string>('');

  const selectedClientObj = allClients.find(c => c.id === selectedClient);

  const buildDraftSetting = (): DestSetting => ({
    ...setting,
    googleSheetsUrl,
    webhookUrl,
    assignedClients: selectedClient ? [selectedClient] : [],
    assignedClientName: selectedClientObj?.name || setting.assignedClientName || '',
    isActive,
    notes,
  });

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(prev => prev === clientId ? '' : clientId);
  };

  const handleSave = () => {
    onSave(buildDraftSetting());
  };

  const handleSyncHistory = async () => {
    if (!googleSheetsUrl) {
      setHistorySyncResult('יש להזין כתובת Google Sheets לפני סנכרון היסטוריה');
      return;
    }
    if (historyMessageCount === 0) {
      setHistorySyncResult('אין הודעות היסטוריות לקו זה');
      return;
    }

    setIsSyncingHistory(true);
    setHistorySyncResult('');
    try {
      const { sent, total } = await onSyncHistory(buildDraftSetting());
      setHistorySyncResult(`${sent} מתוך ${total} הודעות נשלחו לגוגל שיטס (כפילויות מדולגות אוטומטית)`);
    } catch {
      setHistorySyncResult('שגיאה בסנכרון ההיסטוריה — ודא שהכתובת תקינה');
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleTestWebhook = async (target: 'googleSheets' | 'webhook') => {
    const url = target === 'googleSheets' ? googleSheetsUrl : webhookUrl;
    const label = target === 'googleSheets' ? 'Google Sheets' : 'Webhook';

    if (!url) {
      setTestTarget(target);
      setTestStatus('failed');
      setTestMessage(`אנא הזן כתובת ${label} תקינה לפני בדיקת החיבור`);
      return;
    }

    setTestTarget(target);
    setTestStatus('testing');
    setTestMessage('');

    try {
      const payload = {
        event: 'test_webhook_mesergo',
        timestamp: new Date().toISOString(),
        testMessage: `בדיקת חיבור ${label} ממערכת ניתוב SMS מסרגו`,
        dest: setting.dest,
        assignedClients: selectedClient ? [selectedClient] : [],
        sampleSMS: {
          id_: 'MongoDB\\BSON\\ObjectID("69test_test_test_test_test69")',
          dest: setting.dest,
          phone: '0551112222',
          date: '12:00:00 15/06/26',
          message: 'הודעת בדיקה מוצלחת 📊🚀'
        }
      };

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      setTimeout(() => {
        setTestStatus('success');
        setTestMessage(`בקשת הבדיקה ל-${label} נשלחה בהצלחה! אם היעד מוגדר כראוי, הנתונים התקבלו.`);
      }, 1200);

    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(`שגיאה בשליחת הבקשה: ${err.message || err}. ודא שכתובת ה-URL פתוחה לקבלת בקשות חיצוניות.`);
    }
  };

  const renderTestResult = (target: 'googleSheets' | 'webhook') => {
    if (testTarget !== target || testStatus === 'idle') return null;
    return (
      <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed flex items-start gap-1.5 ${
        testStatus === 'success' 
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
          : testStatus === 'failed'
          ? 'bg-rose-50 text-rose-800 border border-rose-100'
          : 'bg-slate-50 text-slate-700 border border-slate-100'
      }`}>
        {testStatus === 'success' && <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />}
        <div className="flex-1 whitespace-pre-line">{testMessage}</div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col text-slate-800" id="line-settings-modal">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <div>
            <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full uppercase tracking-wider">הגדרות קו</span>
            <h3 className="text-xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              קו נמען: <span className="font-mono text-sky-700 font-semibold">{setting.dest}</span>
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 text-right">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">סטטוס קו פעיל</h4>
              <p className="text-xs text-slate-500 mt-0.5">כאשר כבוי, הודעות נכנסות לקו זה אינן מנותבות ונשמרות בלוג בלבד</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={() => setIsActive(!isActive)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
          </div>

          {/* Client Allocation */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-slate-900">
                שיוך לקוח קצה לקו זה <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-500">לקוח אחד בלבד לכל קו</span>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto bg-slate-50">
              {allClients.map((client) => {
                const isChecked = selectedClient === client.id;
                return (
                  <label 
                    key={client.id}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-white border hover:border-slate-200 border-transparent transition-all cursor-pointer"
                  >
                    <input 
                      type="radio" 
                      name="assignedClient"
                      checked={isChecked}
                      onChange={() => handleClientSelect(client.id)}
                      className="border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-800">{client.name}</span>
                      <span className="text-xs text-slate-400 block">{client.email} · {client.phone}</span>
                    </div>
                  </label>
                );
              })}
              {allClients.length === 0 && (
                <div className="text-center p-4 text-slate-400 text-sm">
                  אין לקוחות קיימים. אנא הוסף לקוחות בלשונית "ניהול לקוחות".
                </div>
              )}
            </div>
          </div>

          {/* Google Sheets Integration */}
          <div className="p-4 bg-sky-50/40 rounded-lg border border-sky-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe size={16} className="text-sky-600" />
              <label className="block text-sm font-bold text-slate-900">
                Google Sheets — כתובת Apps Script
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              כל הודעה שנכנסת לקו זה — <b>כולל היסטוריה</b> — תישלח לגוגל שיטס. בעת שמירה, כל ההודעות הקיימות מסונכרנות אוטומטית.
              הודעות חדשות ימשיכו להישלח בזמן אמת.
            </p>
            <div className="flex gap-2">
              <input 
                type="url"
                dir="ltr"
                placeholder="https://script.google.com/macros/s/..."
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              <button
                type="button"
                onClick={() => handleTestWebhook('googleSheets')}
                disabled={testTarget === 'googleSheets' && testStatus === 'testing'}
                className="bg-sky-700 text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-sky-600 min-w-24 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                {testTarget === 'googleSheets' && testStatus === 'testing' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>בדיקה</span>
              </button>
            </div>
            {renderTestResult('googleSheets')}

            {googleSheetsUrl && historyMessageCount > 0 && (
              <div className="mt-3 pt-3 border-t border-sky-100">
                <button
                  type="button"
                  onClick={handleSyncHistory}
                  disabled={isSyncingHistory}
                  className="w-full bg-white border border-sky-200 hover:bg-sky-50 text-sky-800 rounded-lg px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSyncingHistory ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <History size={13} />
                  )}
                  <span>
                    {isSyncingHistory
                      ? `מסנכרן ${historyMessageCount} הודעות...`
                      : `סנכרון היסטוריה (${historyMessageCount} הודעות)`}
                  </span>
                </button>
                {historySyncResult && (
                  <p className="text-[10px] text-sky-700 mt-2 text-center">{historySyncResult}</p>
                )}
              </div>
            )}
          </div>

          {/* Regular Webhook */}
          <div className="p-4 bg-indigo-50/40 rounded-lg border border-indigo-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Link2 size={16} className="text-indigo-600" />
              <label className="block text-sm font-bold text-slate-900">
                Webhook רגיל (אופציונלי)
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              כתובת Webhook נפרדת — יכולה להיות כל שירות חיצוני, כולל גיליון Google Sheets נוסף.
            </p>
            <div className="flex gap-2">
              <input 
                type="url"
                dir="ltr"
                placeholder="https://your-service.com/webhook..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <button
                type="button"
                onClick={() => handleTestWebhook('webhook')}
                disabled={testTarget === 'webhook' && testStatus === 'testing'}
                className="bg-indigo-700 text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-indigo-600 min-w-24 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                {testTarget === 'webhook' && testStatus === 'testing' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>בדיקה</span>
              </button>
            </div>
            {renderTestResult('webhook')}
          </div>

          {/* Notes description */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">הערות פנימיות</label>
            <textarea
              placeholder="רשום הערות כגון מיקום הגיליון, ייעוד וכד'..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
            />
          </div>

          {/* Google Sheets Steps Guide Help */}
          <div className="p-3.5 bg-sky-50/50 rounded-lg border border-sky-100 text-xs text-sky-900 space-y-3">
            <span className="font-bold flex items-center gap-1 text-sky-900">
              <HelpCircle size={13} /> איך מחברים לגוגל שיטס?
            </span>
            <ol className="list-decimal list-inside space-y-1.5 pr-1 font-medium text-sky-800">
              <li>פתח <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-sky-700 underline">גיליון Google Sheets חדש</a>.</li>
              <li>בתפריט: <b>תוספים (Extensions)</b> → <b>Apps Script</b>.</li>
              <li>מחק את הקוד הקיים בעורך, והדבק את הקוד למטה (כפתור "העתק קוד"). שמור עם Ctrl+S.</li>
              <li><b>פריסה (Deploy)</b> → <b>פריסה חדשה (Web app)</b> → גישה: <b>Anyone / כולם</b> — קריטי!</li>
              <li>העתק את ה-Web app URL שהתקבל והדבק בשדה Google Sheets למעלה.</li>
            </ol>

            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden" dir="ltr">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Terminal size={12} className="text-sky-400" /> Code.gs — הדבק ב-Apps Script
                </span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {codeCopied ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      הועתק!
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      העתק קוד
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[9px] text-slate-300 font-mono overflow-auto max-h-40 p-3 whitespace-pre-wrap">
                {GOOGLE_SHEETS_APPS_SCRIPT}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1"
          >
            <Check size={14} />
            שמור שינויים לנתב
          </button>
        </div>
      </div>
    </div>
  );
}
