/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "תיעוד שגיאות" — client-side error capture.
 *
 * Every existing component in this app calls the global `fetch` directly with
 * its own local try/catch, so there is no shared HTTP wrapper to instrument
 * one-by-one. Instead, `installFetchErrorInterceptor()` monkey-patches
 * `window.fetch` ONCE at app startup: any response with `!res.ok`, or any
 * network-level failure, is reported to the backend ErrorLog automatically —
 * covering every existing and future fetch call-site with zero per-file edits.
 * `installGlobalCrashReporting()` is a separate, smaller safety net for
 * genuinely uncaught JS/render exceptions (see the ErrorBoundary below and
 * frontend/index.tsx, where both are installed once).
 */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const getToken = (): string | null =>
  localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token');

interface ReportPayload {
  message: string;
  url?: string;
  status?: number;
  kind?: 'network' | 'client_ui';
  stack?: string;
  details?: unknown;
}

// Fire-and-forget — must never throw, and must never itself trigger another
// intercepted fetch failure loop (it calls the un-patched original fetch).
export const reportClientError = (originalFetch: typeof fetch, payload: ReportPayload): void => {
  try {
    const token = getToken();
    originalFetch(`${API_BASE}/admin/error-logs/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // never let error reporting itself break the app
  }
};

let installed = false;

export const installFetchErrorInterceptor = (): void => {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const requestUrl = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
    try {
      const res = await originalFetch(...args);
      // Never report failures of the report endpoint itself, or it can loop.
      if (!res.ok && !requestUrl?.includes('/admin/error-logs/report')) {
        let message = `HTTP ${res.status}`;
        try {
          const clone = res.clone();
          const body = await clone.json();
          message = body?.error || body?.message || message;
        } catch {
          // body wasn't JSON (or already consumed) — keep the generic message
        }
        reportClientError(originalFetch, {
          message,
          url: requestUrl,
          status: res.status,
          kind: 'client_ui',
        });
      }
      return res;
    } catch (networkErr: any) {
      if (!requestUrl?.includes('/admin/error-logs/report')) {
        reportClientError(originalFetch, {
          message: networkErr?.message || 'Network request failed',
          url: requestUrl,
          kind: 'network',
        });
      }
      throw networkErr;
    }
  };
};

export const installGlobalCrashReporting = (): void => {
  const originalFetch = window.fetch.bind(window);

  window.addEventListener('error', (event: ErrorEvent) => {
    reportClientError(originalFetch, {
      message: event.message || 'Uncaught error',
      url: event.filename,
      kind: 'client_ui',
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientError(originalFetch, {
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      kind: 'client_ui',
      stack: reason?.stack,
    });
  });
};
