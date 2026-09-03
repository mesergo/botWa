// Shared fetch/parse helpers for reading an online source (a "publish to web" Google
// Sheet CSV/XLSX link, or a direct URL to a web-hosted Excel file) into rows —
// used by the preview endpoint (before a table exists) and the sync ticker
// (recurring updates to an existing table).
import XLSX from 'xlsx';

export const parseWorkbookFromSource = async (sourceType, sourceUrl) => {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`שגיאת הורדה (${response.status})`);

  if (sourceType === 'google_sheet') {
    const text = await response.text();
    return XLSX.read(text, { type: 'string' });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return XLSX.read(buffer, { type: 'buffer' });
};

// Fetches and parses a source into { headers, rows } — rows are objects keyed by
// header label, as produced by XLSX.utils.sheet_to_json.
export const fetchSourceRows = async (sourceType, sourceUrl) => {
  const workbook = await parseWorkbookFromSource(sourceType, sourceUrl);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
};
