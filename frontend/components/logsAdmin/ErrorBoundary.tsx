/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { reportClientError } from './reportClientError';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Part of the "תיעוד שגיאות" error-capture net — catches React render
// exceptions that never reach a fetch call (window.fetch/onerror can't see
// these). Reports to the backend ErrorLog, then shows a minimal fallback
// instead of a blank white screen.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportClientError(window.fetch.bind(window), {
      message: error.message || 'Unhandled render error',
      kind: 'client_ui',
      stack: error.stack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', direction: 'rtl' }}>
          <p>אירעה שגיאה בלתי צפויה. אנא רענן את הדף.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
