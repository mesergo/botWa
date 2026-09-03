import React, { useRef, useState } from 'react';
import { X, FileSpreadsheet, Upload, Sparkles, Link, Clock, CheckCircle2, AlertCircle, Loader2, Table as TableIcon } from 'lucide-react';
import { InternalDataTable, InternalDataSyncMode } from '../../types';
import { previewGoogleSheet, createTable, importFileUrl, importJsonRows } from './internalDataApi';

interface CreateDatasetModalProps {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (table: InternalDataTable) => void;
}

export const CreateDatasetModal: React.FC<CreateDatasetModalProps> = ({ token, isOpen, onClose, onCreated }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'google_sheets' | 'file_upload' | 'sample_templates'>('google_sheets');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [syncMode, setSyncMode] = useState<InternalDataSyncMode>('replace');
  const [uniqueKeyField, setUniqueKeyField] = useState('phone');
  const [isPublicApi, setIsPublicApi] = useState(false);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; previewRows: any[]; totalRows: number } | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreviewSheet = async () => {
    if (!googleSheetsUrl.trim()) { setPreviewError('נא להזין קישור ל-Google Sheets'); return; }
    setIsPreviewing(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const res = await previewGoogleSheet(token, googleSheetsUrl);
      setPreviewData(res);
      if (!name) setName('Google Sheet - ' + new Date().toLocaleDateString('he-IL'));
      const phoneCol = res.headers.find((h) => h.toLowerCase().includes('phone') || h.includes('טלפון'));
      const emailCol = res.headers.find((h) => h.toLowerCase().includes('email') || h.includes('מייל'));
      setUniqueKeyField(phoneCol || emailCol || res.headers[0] || 'phone');
    } catch (err: any) {
      setPreviewError(err.message || 'שגיאה בטעינת הגיליון');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    if (!name) setName(file.name.replace(/\.[^/.]+$/, ''));
  };

  const loadPresetTemplate = (templateType: string) => {
    if (templateType === 'crm') {
      setName('מאגר לקוחות ולידים (CRM)');
      setDescription('טבלת לקוחות עם מספרי טלפון, שמות, מיילים וסטטוסים לסנכרון ושאילתות');
    } else if (templateType === 'products') {
      setName('קטלוג מוצרים ומלאי');
      setDescription('מאגר מוצרים, מק"טים, מחירים וכמויות במלאי עם API לשליפה מהירה');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setSubmitError('נא להזין שם עבור הטבלה'); return; }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let createdTable: InternalDataTable;

      if (activeTab === 'google_sheets') {
        if (!googleSheetsUrl.trim()) throw new Error('נא להזין קישור ל-Google Sheets');
        createdTable = await createTable(token, {
          name: name.trim(),
          description: description.trim(),
          source_type: 'google_sheet',
          source_config: { google_sheets_url: googleSheetsUrl.trim() },
          sync: { enabled: autoSyncEnabled, interval_minutes: intervalMinutes, mode: syncMode, unique_key_field: syncMode === 'upsert' ? uniqueKeyField : '' },
          api: { enabled: isPublicApi },
        });
      } else if (activeTab === 'file_upload') {
        if (!uploadedFile) throw new Error('נא להעלות קובץ');
        createdTable = await createTable(token, { name: name.trim(), description: description.trim(), source_type: 'manual', api: { enabled: isPublicApi } });

        const formData = new FormData();
        formData.append('file', uploadedFile);
        const res = await fetch(importFileUrl(createdTable._id), { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בייבוא הקובץ');
      } else {
        createdTable = await createTable(token, {
          name: name.trim() || 'טבלת לקוחות ולידים CRM',
          description: description.trim() || 'מאגר לקוחות עם חיפוש לפי טלפון ושם',
          source_type: 'manual',
          api: { enabled: isPublicApi },
        });
        const sampleRows = [
          { phone: '0501234567', fullName: 'ישראל ישראלי', email: 'israel@example.com', city: 'תל אביב', status: 'לקוח VIP', package: 'Enterprise', amount: 6200 },
          { phone: '0529876543', fullName: 'שרה לוי', email: 'sara.levi@gmail.com', city: 'ירושלים', status: 'פעיל', package: 'Business', amount: 3500 },
          { phone: '0543332211', fullName: 'דוד כהן', email: 'david.cohen@walla.co.il', city: 'חיפה', status: 'בטיפול', package: 'Starter', amount: 850 },
          { phone: '0537778899', fullName: 'מיכל אברהם', email: 'michal.ab@tech-israel.co.il', city: 'הרצליה', status: 'פעיל', package: 'Pro Plus', amount: 2400 },
        ];
        await importJsonRows(token, createdTable._id, { jsonRows: sampleRows, syncMode: 'replace', uniqueKeyField: 'phone' });
      }

      onCreated(createdTable);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'שגיאה ביצירת הטבלה');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden my-8">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100"><FileSpreadsheet className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">חיבור טבלה ומקור נתונים</h2>
              <p className="text-xs text-slate-500">ייבוא נתונים מ-Google Sheets או קבצים למסד נתונים פנימי</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1.5 m-6 mb-4 bg-slate-100 rounded-2xl border border-slate-200">
          <button type="button" onClick={() => setActiveTab('google_sheets')} className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${activeTab === 'google_sheets' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /><span>Google Sheets</span>
          </button>
          <button type="button" onClick={() => setActiveTab('file_upload')} className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${activeTab === 'file_upload' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
            <Upload className="w-4 h-4 text-sky-600" /><span>העלאת קובץ (CSV/Excel)</span>
          </button>
          <button type="button" onClick={() => setActiveTab('sample_templates')} className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${activeTab === 'sample_templates' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
            <Sparkles className="w-4 h-4 text-amber-500" /><span>תבנית מוכנה להדגמה</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">שם הטבלה / המאגר *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: לקוחות ולידים" className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">תיאור (אופציונלי)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="למשל: סנכרון אוטומטי של טופס הרשמה" className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {activeTab === 'google_sheets' && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5 text-indigo-600" />קישור ל-Google Sheets *</span>
                  <span className="text-[11px] text-slate-500">יש לוודא שהגיליון מוגדר כ-Public / Anyone with the link</span>
                </label>
                <div className="flex gap-2">
                  <input type="url" value={googleSheetsUrl} onChange={(e) => setGoogleSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="flex-1 px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" dir="ltr" />
                  <button type="button" onClick={handlePreviewSheet} disabled={isPreviewing || !googleSheetsUrl} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs">
                    {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TableIcon className="w-3.5 h-3.5" />}
                    <span>בדוק קישור</span>
                  </button>
                </div>
              </div>

              {previewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div><span className="font-semibold">שגיאה בגישה לגיליון: </span>{previewError}</div>
                </div>
              )}

              {previewData && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" />הגיליון נקרא בהצלחה! זוהו {previewData.totalRows} שורות ו-{previewData.headers.length} עמודות</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {previewData.headers.map((h, i) => (<span key={i} className="px-2 py-0.5 rounded-md bg-white text-slate-700 text-[11px] font-mono border border-slate-200 shadow-2xs">{h}</span>))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">תזמון סנכרון אוטומטי</h4>
                      <p className="text-[11px] text-slate-500">המערכת תשאב את הנתונים מ-Google Sheets ברקע</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={autoSyncEnabled} onChange={(e) => setAutoSyncEnabled(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {autoSyncEnabled && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">תדירות עדכון אוטומטי</label>
                      <select value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800">
                        <option value={1}>כל דקה (1m)</option><option value={5}>כל 5 דקות (5m)</option><option value={15}>כל 15 דקות (15m)</option>
                        <option value={30}>כל 30 דקות (30m)</option><option value={60}>כל שעה (1h)</option><option value={360}>כל 6 שעות (6h)</option><option value={1440}>כל 24 שעות (יומי)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">אופן הסנכרון</label>
                      <select value={syncMode} onChange={(e) => setSyncMode(e.target.value as InternalDataSyncMode)} className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800">
                        <option value="replace">החלפה מלאה (Replace All)</option>
                        <option value="upsert">עדכון לפי מפתח ייחודי (Upsert)</option>
                        <option value="append">הוספה בלבד (Append Only)</option>
                      </select>
                    </div>
                    {syncMode === 'upsert' && (
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">שדה מפתח ייחודי (Phone/Email)</label>
                        <input type="text" value={uniqueKeyField} onChange={(e) => setUniqueKeyField(e.target.value)} placeholder="phone, email, id..." className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'file_upload' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center transition cursor-pointer relative bg-white">
                <input ref={fileInputRef} type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-indigo-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-900">גרור לכאן קובץ או לחץ לבחירה</p>
                  <p className="text-[11px] text-slate-500 mt-1">תומך ב-CSV ו-Excel (.xlsx, .xls)</p>
                </div>
              </div>
              {uploadedFile && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                  <div>
                    <span className="font-semibold text-slate-900">{uploadedFile.name}</span>
                    <span className="text-slate-500 mr-2">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sample_templates' && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div onClick={() => loadPresetTemplate('crm')} className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 cursor-pointer transition shadow-2xs">
                <div className="flex items-center gap-2 mb-1.5"><span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">👥</span><h4 className="text-xs font-bold text-slate-900">לקוחות ולידים CRM</h4></div>
                <p className="text-[11px] text-slate-500">כולל מספרי טלפון, שמות, מיילים וסטטוסים, מוכן לקריאות API ואיתור טלפונים.</p>
              </div>
              <div onClick={() => loadPresetTemplate('products')} className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 cursor-pointer transition shadow-2xs">
                <div className="flex items-center gap-2 mb-1.5"><span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">📦</span><h4 className="text-xs font-bold text-slate-900">קטלוג מוצרים ומלאי</h4></div>
                <p className="text-[11px] text-slate-500">כולל מק"טים, תיאורי מוצרים, מחירים וכמויות מלאי.</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs font-medium text-slate-900">הרשאות גישה ל-API (ציבורי או מפתח סודי)</span>
              <p className="text-[11px] text-slate-500">גישה ציבורית מאפשרת קריאות API ללא צורך במפתח — ניתן לשנות בכל עת</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isPublicApi} onChange={(e) => setIsPublicApi(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /><span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition">ביטול</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50">
              {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>יוצר טבלה ומייבא נתונים...</span></>) : (<><CheckCircle2 className="w-4 h-4" /><span>צור טבלה</span></>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
