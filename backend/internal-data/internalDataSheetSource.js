// Shared fetch/parse helpers for reading an online source (a "publish to web" Google
// Sheet CSV/XLSX link, or a direct URL to a web-hosted Excel file) into rows —
// used by the preview endpoint (before a table exists) and the sync ticker
// (recurring updates to an existing table).
import XLSX from 'xlsx';

// Rewrites a regular Google Sheets browser link (/edit, /view, /htmlview, /pubhtml)
// to its CSV export, keeping the tab (gid). Otherwise the fetch returns the HTML page,
// which XLSX happily parses into junk columns (A, B, C, __EMPTY) with HTML entities.
export const toGoogleSheetCsvUrl = (sourceUrl) => {
  let u;
  try { u = new URL(String(sourceUrl).trim()); } catch { return sourceUrl; }
  if (u.hostname !== 'docs.google.com') return sourceUrl;
  const gid = u.searchParams.get('gid') || (u.hash.match(/gid=(\d+)/) || [])[1];
  const gidParam = gid ? `&gid=${gid}` : '';

  const published = u.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)/);
  if (published) {
    if (u.searchParams.get('output') === 'csv') return sourceUrl;
    return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv${gidParam}`;
  }
  const regular = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);
  if (regular) {
    if (u.pathname.endsWith('/export') && u.searchParams.get('format') === 'csv') return sourceUrl;
    return `https://docs.google.com/spreadsheets/d/${regular[1]}/export?format=csv${gidParam}`;
  }
  return sourceUrl;
};

export const parseWorkbookFromSource = async (sourceType, sourceUrl) => {
  const url = sourceType === 'google_sheet' ? toGoogleSheetCsvUrl(sourceUrl) : sourceUrl;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`שגיאת הורדה (${response.status})`);

  if (sourceType === 'google_sheet') {
    // A non-sheet link (or a private sheet's login page) returns HTML, which XLSX
    // either rejects cryptically or parses into junk rows — fail with a clear message.
    if ((response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('הקישור אינו מוביל לגיליון Google Sheets ציבורי. יש להדביק קישור מסוג docs.google.com/spreadsheets/... ולוודא שהגיליון משותף כ"כל מי שיש לו את הקישור"');
    }
    const text = await response.text();
    // raw: keep CSV cells as the sheet shows them. Without it XLSX guesses dates in US
    // order — "01/09/2026" becomes a serial for Jan 9 while "14/08/2026" stays text.
    return XLSX.read(text, { type: 'string', raw: true });
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
