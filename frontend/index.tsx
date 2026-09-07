
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import App from './App';
import ErrorBoundary from './components/logsAdmin/ErrorBoundary';
import { installFetchErrorInterceptor, installGlobalCrashReporting } from './components/logsAdmin/reportClientError';

// "תיעוד שגיאות" — install once, before anything else renders/fetches, so
// every error the app produces from here on is captured. See
// frontend/components/logsAdmin/reportClientError.ts for details.
installFetchErrorInterceptor();
installGlobalCrashReporting();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nextProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
