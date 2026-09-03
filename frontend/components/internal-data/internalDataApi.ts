import {
  InternalDataTable, InternalDataRow, InternalDataSyncLog, InternalDataStats,
  InternalDataSyncMode, InternalDataOutputFormat,
} from '../../types';

export const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/internal-data'
  : `${window.location.origin}/api/internal-data`;

const authHeaders = (token: string | null): HeadersInit => ({ Authorization: `Bearer ${token}` });
const jsonHeaders = (token: string | null): HeadersInit => ({ ...authHeaders(token), 'Content-Type': 'application/json' });

async function unwrap<T>(res: Response, fallbackError: string): Promise<T> {
  const json = await res.json();
  if (!res.ok || json?.success === false) throw new Error(json?.error || fallbackError);
  return json;
}

export async function fetchTables(token: string | null): Promise<InternalDataTable[]> {
  const res = await fetch(`${API_BASE}/tables`, { headers: authHeaders(token) });
  return unwrap(res, 'שגיאה בטעינת הטבלאות');
}

export async function fetchStats(token: string | null): Promise<InternalDataStats> {
  const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders(token) });
  const json = await unwrap<{ data: InternalDataStats }>(res, 'שגיאה בטעינת נתוני מערכת');
  return json.data;
}

export async function previewGoogleSheet(token: string | null, url: string): Promise<{ headers: string[]; previewRows: any[]; totalRows: number }> {
  const res = await fetch(`${API_BASE}/sheets/preview`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify({ url }),
  });
  return unwrap(res, 'שגיאה בטעינת הגיליון');
}

export interface CreateTablePayload {
  name: string;
  description?: string;
  fields?: any[];
  source_type?: 'google_sheet' | 'excel_url' | 'manual';
  source_config?: { google_sheets_url?: string };
  sync?: { enabled?: boolean; interval_minutes?: number; mode?: InternalDataSyncMode; unique_key_field?: string };
  api?: { enabled?: boolean };
}

export async function createTable(token: string | null, payload: CreateTablePayload): Promise<InternalDataTable> {
  const res = await fetch(`${API_BASE}/tables`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת הטבלה');
  return data;
}

export async function updateTable(token: string | null, id: string, payload: { name?: string; description?: string; fields?: any[] }): Promise<InternalDataTable> {
  const res = await fetch(`${API_BASE}/tables/${id}`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הטבלה');
  return data;
}

export async function deleteTable(token: string | null, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tables/${id}`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error((await res.json()).error || 'שגיאה במחיקת הטבלה');
}

export async function fetchRows(
  token: string | null, tableId: string,
  params: { page?: number; limit?: number; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc' } = {}
): Promise<{ rows: InternalDataRow[]; total: number; page: number; totalPages: number }> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.search) search.set('search', params.search);
  if (params.sortField) search.set('sortField', params.sortField);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const res = await fetch(`${API_BASE}/tables/${tableId}/rows?${search.toString()}`, { headers: authHeaders(token) });
  return unwrap(res, 'שגיאה בטעינת רשומות');
}

export async function insertRow(token: string | null, tableId: string, values: Record<string, any>): Promise<InternalDataRow> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/rows`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify({ values }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת רשומה');
  return data;
}

export async function updateRow(token: string | null, rowId: string, values: Record<string, any>): Promise<InternalDataRow> {
  const res = await fetch(`${API_BASE}/rows/${rowId}`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify({ values }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון רשומה');
  return data;
}

export async function deleteRow(token: string | null, rowId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rows/${rowId}`, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error((await res.json()).error || 'שגיאה במחיקת רשומה');
}

export interface ImportDataResult {
  imported: number; created: number;
  skipped: { row: number; reason: string }[];
  errors: { row: number; error: string }[];
  collection?: InternalDataTable;
}

export async function importJsonRows(
  token: string | null, tableId: string,
  data: { jsonRows: any[]; syncMode?: InternalDataSyncMode; uniqueKeyField?: string }
): Promise<ImportDataResult> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/import-data`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(data),
  });
  const json = await unwrap<{ data: ImportDataResult }>(res, 'שגיאה בייבוא נתונים');
  return json.data;
}

export async function updateSyncSettings(token: string | null, tableId: string, payload: {
  enabled?: boolean; source_type?: string; source_url?: string; interval_minutes?: number;
  mode?: InternalDataSyncMode; unique_key_field?: string;
}): Promise<InternalDataTable> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/sync`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הגדרות הסנכרון');
  return data;
}

export async function triggerManualSync(token: string | null, tableId: string): Promise<{
  success: boolean; message: string; imported?: number; added?: number; updated?: number; deleted?: number; collection?: InternalDataTable; error?: string;
}> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/sync/run-now`, { method: 'POST', headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'הסנכרון נכשל');
  return data;
}

export async function fetchSyncLogs(token: string | null, tableId: string): Promise<InternalDataSyncLog[]> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/logs`, { headers: authHeaders(token) });
  const json = await unwrap<{ data: InternalDataSyncLog[] }>(res, 'שגיאה בטעינת יומן הסנכרון');
  return json.data;
}

export async function updateApiSettings(token: string | null, tableId: string, payload: {
  enabled?: boolean;
  regenerate?: boolean;
  response_format?: string | null;
  bot_success_return?: number;
  bot_not_found_return?: number;
  bot_not_found_message?: string;
  bot_success_message?: string;
}): Promise<InternalDataTable> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/api`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון הגדרות ה-API');
  return data;
}

export interface MongoQueryPayload {
  filter?: Record<string, any>;
  projection?: string[];
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  single?: boolean;
}

export async function runMongoQuery(token: string | null, tableId: string, payload: MongoQueryPayload): Promise<any> {
  const res = await fetch(`${API_BASE}/tables/${tableId}/query`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload),
  });
  return res.json();
}

export const downloadTemplateUrl = (tableId: string) => `${API_BASE}/tables/${tableId}/template`;
export const importFileUrl = (tableId: string) => `${API_BASE}/tables/${tableId}/import`;
