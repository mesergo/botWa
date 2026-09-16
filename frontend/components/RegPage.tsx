import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window { google: any; }
}

// Real onboarding wizard for brand-new WhatsApp Business customers — a genuine page
// inside this app (mounted at /reg by FlowBuilder in App.tsx, before the login gate),
// not a separate static file. Signing in with Google here creates/logs into a real
// account (same backend endpoint + same localStorage keys as RegisterPage.tsx), so the
// visitor lands in the real dashboard once done, and the dashboard's OnboardingBanner
// can send them back here to resume at their saved step.

const GOOGLE_CLIENT_ID = '266548688904-n1qrelk64op0usdbf52ae2gupcjld0vv.apps.googleusercontent.com';
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const persistAuth = (token: string, user: any) => {
  localStorage.setItem('flowbot_token', token);
  localStorage.setItem('flowbot_user', JSON.stringify(user));
  window.dispatchEvent(new Event('flowbot-auth-change'));
};

// ---- inline icons (currentColor), converted 1:1 from the original design ----
const ICON_PATHS: Record<string, { d: string; fill?: 'currentColor' }> = {
  rocket: { d: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3a22 22 0 0 1 8-11c3 0 5 2 5 5a22 22 0 0 1-11 8zM9 12H4s.5-2.8 2-4a3 3 0 0 1 3 0M12 15v5s2.8-.5 4-2a3 3 0 0 0 0-3' },
  facebook: { d: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12', fill: 'currentColor' },
  shield: { d: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4' },
  business: { d: 'M3 21h18M4 21V8l6-4 6 4M20 21V11M8 21v-4h4v4M8 11h.01M12 11h.01M8 14h.01M12 14h.01' },
  plus: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8v8M8 12h8' },
  phone: { d: 'M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2' },
  check2: { d: 'M2 12l5 5M8 15l5-5M13 17l8-9' },
  whatsapp: { d: 'M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2m0 2a8 8 0 0 1 6.8 12.2l.9 2.7-2.8-.7A8 8 0 1 1 12 4m-3 3.5c-.2 0-.5 0-.7.4-.3.4-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3 4.8 4.1 2.3.9 2.8.7 3.3.7.5-.1 1.6-.7 1.9-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.4-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1s-.7.9-.8 1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4z', fill: 'currentColor' },
  cart: { d: 'M3 4h2l2.4 12.4A2 2 0 0 0 9.3 18h8.4a2 2 0 0 0 2-1.6L21 8H6M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2M18 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2' },
  keypad: { d: 'M7 4h.01M12 4h.01M17 4h.01M7 9h.01M12 9h.01M17 9h.01M7 14h.01M12 14h.01M17 14h.01M12 19h.01' },
  network: { d: 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M19 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M12 8v4M12 12l-5 4M12 12l5 4' },
  sparkles: { d: 'M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5zM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5 13l.6 1.6L7 15l-1.4.6L5 17l-.6-1.4L3 15l1.4-.4z' },
  checkc: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.5 12l2.5 2.5L16 9' },
  alert: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8v5M12 16h.01' },
  open: { d: 'M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5' },
  bookmark: { d: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1' },
  docs: { d: 'M8 4h7l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M15 4v4h4M9 13h6M9 17h4' },
  send: { d: 'M21 3L3 10.5 10 13m11-10L10 13m11-10L14 21l-4-8' },
  bots: { d: 'M12 3v3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2M9 13h.01M15 13h.01M3 12v3M21 12v3' },
  apps: { d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  chat: { d: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M8 10h.01M12 10h.01M16 10h.01' },
  chip: { d: 'M7 7h10v10H7zM9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2' },
  megaphone: { d: 'M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1M18 8a4 4 0 0 1 0 8' },
};
const Ic: React.FC<{ name: keyof typeof ICON_PATHS | 'google' }> = ({ name }) => {
  if (name === 'google') return <svg viewBox="0 0 24 24" aria-hidden="true" />;
  const p = ICON_PATHS[name];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill={p.fill || 'none'} stroke={p.fill ? undefined : 'currentColor'} strokeWidth={p.fill ? undefined : 2} strokeLinecap="round" strokeLinejoin="round" d={p.d} />
    </svg>
  );
};
const CircleOutline = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
const CheckSquare = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="var(--teal)" />
    <path d="M7 12l3.2 3.2L17 8.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const EmptySquare = () => <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;

interface VirtualNumber { number: string; price: number }

interface Answers {
  useCases: string[];
  agentCount: string | null;
  fbStatus: string | null;
  numberStatus: string | null;
  virtualNumber: string | null;
  googleConnected: boolean;
  fbConnected: boolean;
}
const DEFAULT_ANSWERS: Answers = { useCases: [], agentCount: null, fbStatus: null, numberStatus: null, virtualNumber: null, googleConnected: false, fbConnected: false };
const STORAGE_KEY = 'mesergo.onboarding.web.v1';

type StepId = 'intro' | 'usecases' | 'facebook' | 'number' | 'virtual' | 'google' | 'connect' | 'done';
type GoogleContext = 'main' | 'fbsave' | 'pause' | null;

const RegPage: React.FC = () => {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('flowbot_token'));
  const [stepId, setStepId] = useState<StepId>('intro');
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswersState] = useState<Answers>(DEFAULT_ANSWERS);
  const [selectedVn, setSelectedVn] = useState<string | null>(null); // the chosen number itself
  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [virtualNumbersError, setVirtualNumbersError] = useState('');
  const [pausedView, setPausedView] = useState(false);
  const [pauseGoogleMode, setPauseGoogleMode] = useState<false | true | 'hint'>(false);
  const [authError, setAuthError] = useState('');
  const [restored, setRestored] = useState(false); // gates first paint until server state (if any) is loaded

  const order = useMemo(() => {
    const o: StepId[] = ['intro', 'usecases', 'facebook', 'number'];
    if (answers.numberStatus === 'none') o.push('virtual');
    o.push('google', 'connect', 'done');
    return o;
  }, [answers.numberStatus]);

  // ---- local + server persistence ----
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!restored) return; // don't push the pre-restore default state over a just-loaded server state
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepId, completed, answers })); } catch { /* ignore */ }
    if (!authToken) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch(`${API_BASE}/auth/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ current_step: stepId, answers, completed }),
      }).catch(() => { /* best-effort */ });
    }, 300);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [stepId, completed, answers, authToken, restored]);

  // Load saved progress on mount: from the server if signed in (works across devices —
  // this is what makes the dashboard's "resume" banner land on the right step), else
  // fall back to this browser's local copy for an anonymous visitor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authToken) {
        try {
          const res = await fetch(`${API_BASE}/auth/onboarding`, { headers: { Authorization: `Bearer ${authToken}` } });
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('flowbot_token');
            localStorage.removeItem('flowbot_user');
            if (!cancelled) setAuthToken(null);
          } else if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              setStepId((data.current_step as StepId) || 'intro');
              setCompleted(!!data.completed);
              setAnswersState({ ...DEFAULT_ANSWERS, ...(data.answers || {}) });
            }
          }
        } catch { /* fall through to local */ }
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const p = JSON.parse(raw);
            if (!cancelled) {
              setStepId(p.stepId || 'intro');
              setCompleted(!!p.completed);
              setAnswersState({ ...DEFAULT_ANSWERS, ...(p.answers || {}) });
            }
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) setRestored(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a real account exists (Google sign-in can happen anywhere in the wizard,
  // after the number was already picked), record the picked number as "pending
  // assignment" — NOT an automatic assignment, a rep completes that manually (see
  // backend/controllers/whatsappRegistrationController.js:requestPendingNumber).
  // Settings → מספרים מחוברים then shows it while the customer waits.
  const requestedNumberRef = useRef<string | null>(null);
  useEffect(() => {
    if (!restored || !authToken || !answers.virtualNumber) return;
    if (requestedNumberRef.current === answers.virtualNumber) return;
    requestedNumberRef.current = answers.virtualNumber;
    fetch(`${API_BASE}/whatsapp-registration/request-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ number: answers.virtualNumber }),
    }).catch(() => { requestedNumberRef.current = null; }); // allow retry on next relevant render
  }, [restored, authToken, answers.virtualNumber]);

  const setAnswer = useCallback((patch: Partial<Answers>) => {
    setAnswersState(prev => ({ ...prev, ...patch }));
  }, []);
  const go = useCallback((step: StepId) => setStepId(step), []);
  const next = useCallback(() => {
    setStepId(cur => { const i = order.indexOf(cur); return order[Math.min(i + 1, order.length - 1)]; });
  }, [order]);
  const back = useCallback(() => {
    setStepId(cur => { const i = order.indexOf(cur); return order[Math.max(i - 1, 0)]; });
  }, [order]);

  // ---- real Google sign-in (mirrors RegisterPage.tsx) ----
  const [pendingGoogleContext, setPendingGoogleContext] = useState<GoogleContext>(null);
  const pendingGoogleContextRef = useRef<GoogleContext>(null);
  useEffect(() => { pendingGoogleContextRef.current = pendingGoogleContext; }, [pendingGoogleContext]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        persistAuth(data.token, data.user);
        setAuthToken(data.token);
        setAnswer({ googleConnected: true });
        if (pendingGoogleContextRef.current === 'pause') {
          setPauseGoogleMode(false);
          setPausedView(true);
        }
        setPendingGoogleContext(null);
      } else {
        setAuthError(data.error || 'ההתחברות נכשלה, נסה שוב');
      }
    } catch {
      setAuthError('שגיאת רשת, נסה שוב');
    }
  }, [setAnswer]);

  const handleGoogleCredentialRef = useRef(handleGoogleCredential);
  useEffect(() => { handleGoogleCredentialRef.current = handleGoogleCredential; }, [handleGoogleCredential]);

  const googleInitializedRef = useRef(false);
  const mainBtnRef = useRef<HTMLDivElement>(null);
  const fbsaveBtnRef = useRef<HTMLDivElement>(null);
  const pauseBtnRef = useRef<HTMLDivElement>(null);

  // Which single google-btn-* container is on screen right now (at most one, by construction
  // — see the pause-mode guard below), and its ref — kept in sync so the render effect
  // below can (re)draw the official Google button into whichever one exists.
  const activeGoogleSlot: { ctx: GoogleContext; ref: React.RefObject<HTMLDivElement | null> } | null = !restored ? null
    : (stepId === 'google' && !answers.googleConnected) ? { ctx: 'main', ref: mainBtnRef }
    : (stepId === 'facebook' && answers.fbStatus === 'none' && !answers.googleConnected) ? { ctx: 'fbsave', ref: fbsaveBtnRef }
    : (pauseGoogleMode === true) ? { ctx: 'pause', ref: pauseBtnRef }
    : null;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    const renderInto = () => {
      if (cancelled || !window.google || !activeGoogleSlot?.ref.current) return;
      setPendingGoogleContext(activeGoogleSlot.ctx);
      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => handleGoogleCredentialRef.current(response.credential),
        });
        googleInitializedRef.current = true;
      }
      activeGoogleSlot.ref.current.innerHTML = '';
      window.google.accounts.id.renderButton(activeGoogleSlot.ref.current, {
        theme: 'outline', size: 'large', width: 280, locale: 'he', text: 'signup_with',
      });
    };
    if (window.google) {
      renderInto();
    } else {
      const scriptEl = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');
      if (scriptEl) scriptEl.addEventListener('load', renderInto);
      return () => { cancelled = true; scriptEl?.removeEventListener('load', renderInto); };
    }
    return () => { cancelled = true; };
  }, [activeGoogleSlot]);

  // Load the Google Identity Services script once (RegisterPage.tsx / AuthScreen.tsx load
  // it globally too, but loading it again here is a harmless no-op if already present).
  useEffect(() => {
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  const pauseAndSave = useCallback(() => {
    if (authToken) { setPausedView(true); return; }
    const stepAlreadyShowsGoogleButton = stepId === 'google' || (stepId === 'facebook' && answers.fbStatus === 'none');
    setPauseGoogleMode(stepAlreadyShowsGoogleButton ? 'hint' : true);
  }, [authToken, stepId, answers.fbStatus]);

  // Real available numbers — unassigned lines from the sms_dest_settings table
  // (see backend/sms-in/controllers/destSettings.controller.js:getAvailableNumbers),
  // fetched fresh whenever this step is entered without a number picked yet.
  const virtualStepEnteredRef = useRef(false);
  useEffect(() => {
    if (stepId === 'virtual' && !answers.virtualNumber && !virtualStepEnteredRef.current) {
      virtualStepEnteredRef.current = true;
      setLoadingNumbers(true);
      setVirtualNumbersError('');
      let cancelled = false;
      fetch(`${API_BASE}/sms-in/available-numbers`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          setVirtualNumbers(Array.isArray(data.numbers) ? data.numbers : []);
        })
        .catch(() => { if (!cancelled) setVirtualNumbersError('לא הצלחנו לטעון מספרים פנויים, נסה שוב.'); })
        .finally(() => { if (!cancelled) setLoadingNumbers(false); });
      return () => { cancelled = true; };
    }
    if (stepId !== 'virtual') virtualStepEnteredRef.current = false;
  }, [stepId, answers.virtualNumber]);

  const resetAll = () => {
    setStepId('intro'); setCompleted(false); setAnswersState(DEFAULT_ANSWERS);
    setSelectedVn(null); setPausedView(false); setPauseGoogleMode(false);
  };

  if (!restored) return <div className="reg-wizard" />;

  const idx = Math.max(0, order.indexOf(stepId));
  const total = order.length;
  const hasConversations = answers.useCases.includes('conversations');

  return (
    <div className="reg-wizard">
      <RegWizardStyles />
      <div className="app">
        <div className="head">
          <div className="brand">
            <div className="logo" aria-hidden="true">
              <div className="dot" />
              <div className="eye"><div className="white"><div className="iris"><div className="hi" /></div></div></div>
            </div>
            <span className="name">מסר גו</span>
          </div>
          <button className="exit" type="button" onClick={resetAll}>התחלה מחדש</button>
        </div>

        <div className="processtitle">הקמת החשבון העסקי שלך</div>

        <div className="progress">
          <div className="track"><div className="fill" style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>
          <div className="steplabel">{pausedView ? '' : `שלב ${idx + 1} מתוך ${total}`}</div>
        </div>

        <div className="body">
          {pausedView ? (
            <div className="done-screen enter">
              <div className="done-badge" style={{ background: 'var(--brand-wash)', color: 'var(--brand)' }}><Ic name="bookmark" /></div>
              <h1 className="title" style={{ textAlign: 'center' }}>נרשמת! שמרנו את המקום שלך</h1>
              <p className="subtitle" style={{ textAlign: 'center' }}>אין בעיה לעצור כאן. נרשמת עם Google ושמרנו בדיוק את השלב שבו אתה נמצא — חזור בכל עת (מהקישור הזה או מהאפליקציה) כדי להמשיך את החיבור מאותה נקודה.</p>
            </div>
          ) : (
            <>
              {/* Visible from the step right after picking a number onward — the line itself
                  isn't assigned automatically; a rep completes that manually (see request-number
                  endpoint + Settings → מספרים מחוברים, which shows "בהמתנה לשיוך" in the meantime). */}
              {answers.virtualNumber && stepId !== 'virtual' && (
                <div className="savednote">
                  <Ic name="bookmark" />
                  <span>המספר <b className="mono">{answers.virtualNumber}</b> נשמר עבורך — נציג יחזור אליך בהקדם להשלמת השיוך.</span>
                </div>
              )}
              <StepBody
                stepId={stepId}
                answers={answers}
                setAnswer={setAnswer}
                authError={authError}
                mainBtnRef={mainBtnRef}
                fbsaveBtnRef={fbsaveBtnRef}
                selectedVn={selectedVn}
                setSelectedVn={setSelectedVn}
                virtualNumbers={virtualNumbers}
                loadingNumbers={loadingNumbers}
                virtualNumbersError={virtualNumbersError}
                completed={completed}
                authToken={authToken}
              />
            </>
          )}
        </div>

        <RegFooter
          pausedView={pausedView}
          stepId={stepId}
          answers={answers}
          completed={completed}
          selectedVn={selectedVn}
          loadingNumbers={loadingNumbers}
          hasConversations={hasConversations}
          authToken={authToken}
          onBack={back}
          onNext={next}
          onContinueNow={() => setPausedView(false)}
          onBuyNumber={() => {
            setAnswer({ virtualNumber: selectedVn });
            next();
          }}
          onFinishIntro={() => setCompleted(true)}
          onGoToDashboard={() => { window.location.href = '/'; }}
        />

        {stepId !== 'done' && !pausedView && (
          <div className="pausebar">
            {pauseGoogleMode === 'hint' ? (
              <>
                <span style={{ fontSize: 12.5, color: 'var(--subtext)' }}>התחבר עם Google למעלה כדי לשמור את ההתקדמות</span>
                <button className="pauselink" type="button" onClick={() => setPauseGoogleMode(false)}>ביטול</button>
              </>
            ) : pauseGoogleMode === true ? (
              <>
                <div ref={pauseBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
                <button className="pauselink" type="button" style={{ fontSize: 12 }} onClick={() => setPauseGoogleMode(false)}>ביטול</button>
              </>
            ) : (
              <button className="pauselink" type="button" onClick={pauseAndSave}>רשמו אותי, אמשיך את תהליך החיבור אח״כ</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---- step content ----
const StepBody: React.FC<{
  stepId: StepId; answers: Answers; setAnswer: (p: Partial<Answers>) => void; authError: string;
  mainBtnRef: React.RefObject<HTMLDivElement | null>; fbsaveBtnRef: React.RefObject<HTMLDivElement | null>;
  selectedVn: string | null; setSelectedVn: (id: string) => void;
  virtualNumbers: VirtualNumber[]; loadingNumbers: boolean; virtualNumbersError: string;
  completed: boolean; authToken: string | null;
}> = ({ stepId, answers, setAnswer, authError, mainBtnRef, fbsaveBtnRef, selectedVn, setSelectedVn, virtualNumbers, loadingNumbers, virtualNumbersError, completed, authToken }) => {
  switch (stepId) {
    case 'intro':
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="rocket" /></div>
          <h1 className="title">בוא נחבר את הוואטסאפ העסקי שלך</h1>
          <p className="subtitle">עוד כמה צעדים קצרים ותהיה מוכן לשלוח הודעות ובוטים דרך וואטסאפ הרשמי (WhatsApp Business Platform).</p>
          <div className="stack">
            {['חשבון פייסבוק ביזנס', 'מספר טלפון ייעודי לוואטסאפ העסקי', 'חיבור מול Google ופייסבוק'].map(t => (
              <div className="tip" key={t}>
                <div className="tIcon" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}><Ic name="checkc" /></div>
                <div><div className="tTitle">{t}</div></div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'usecases': {
      const opts = [
        { k: 'conversations', icon: 'chat' as const, t: 'שיחות עם לקוחות', d: 'מענה אישי לפניות בזמן אמת' },
        { k: 'bot', icon: 'chip' as const, t: 'בוט למענה אוטומטי', d: 'תשובות אוטומטיות לשאלות נפוצות, 24/7' },
        { k: 'broadcast', icon: 'megaphone' as const, t: 'הפצת הודעות ללקוחות', d: 'שליחה יזומה של עדכונים, מבצעים ותזכורות' },
      ];
      const has = (k: string) => answers.useCases.includes(k);
      const toggleUseCase = (k: string) => {
        const cases = answers.useCases.slice();
        const i = cases.indexOf(k);
        if (i === -1) cases.push(k); else cases.splice(i, 1);
        const patch: Partial<Answers> = { useCases: cases };
        if (k === 'conversations' && i !== -1) patch.agentCount = null;
        setAnswer(patch);
      };
      const aopts = [
        { k: 'solo', l: 'רק אני' }, { k: '2_5', l: '2–5 נציגים' },
        { k: '6_20', l: '6–20 נציגים' }, { k: '20plus', l: 'מעל 20 נציגים' },
      ];
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="apps" /></div>
          <h1 className="title">איזה שירות אתה מצפה מהוואטסאפ?</h1>
          <p className="subtitle">מה השימושים העיקריים שלך? אפשר לבחור כמה שרוצים — זה יעזור לנו להתאים לך את המערכת.</p>
          <div className="stack">
            {opts.map(o => (
              <button key={o.k} className={`choice${has(o.k) ? ' sel' : ''}`} onClick={() => toggleUseCase(o.k)}>
                <span className="cIcon"><Ic name={o.icon} /></span>
                <span className="cText"><span className="cTitle">{o.t}</span><span className="cDesc">{o.d}</span></span>
                <span className="cMark">{has(o.k) ? <CheckSquare /> : <EmptySquare />}</span>
              </button>
            ))}
          </div>
          {has('conversations') && (
            <div className="agentsbox enter">
              <h3>כמה נציגים יענו ללקוחות?</h3>
              <div className="chiprow">
                {aopts.map(a => (
                  <button key={a.k} className={`chip${answers.agentCount === a.k ? ' sel' : ''}`} onClick={() => setAnswer({ agentCount: a.k })}>{a.l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'facebook': {
      const fb = answers.fbStatus;
      const opts = [
        { k: 'verified', icon: 'shield' as const, t: 'יש לי חשבון מאומת', d: 'מתחיל עם עד 1,000 הודעות יוצאות ביום' },
        { k: 'unverified', icon: 'business' as const, t: 'יש לי חשבון (לא מאומת)', d: 'מוגבל ל-250 הודעות יוצאות ביום בהתחלה' },
        { k: 'none', icon: 'plus' as const, t: 'אין לי עדיין', d: 'נראה לך איך פותחים — וההתקדמות תישמר' },
      ];
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="facebook" /></div>
          <h1 className="title">חשבון פייסבוק ביזנס</h1>
          <p className="subtitle">כדי להשתמש בוואטסאפ הרשמי צריך חשבון Facebook Business. חשבון מאומת מתחיל במגבלת הודעות גבוהה יותר.</p>
          <div className="stack">
            {opts.map(o => (
              <button key={o.k} className={`choice${fb === o.k ? ' sel' : ''}`} onClick={() => setAnswer({ fbStatus: o.k })}>
                <span className="cIcon"><Ic name={o.icon} /></span>
                <span className="cText"><span className="cTitle">{o.t}</span><span className="cDesc">{o.d}</span></span>
                <span className="cMark">{fb === o.k ? <Ic name="checkc" /> : <CircleOutline />}</span>
              </button>
            ))}
          </div>
          {fb === 'none' && !answers.googleConnected && (
            <div className="guide enter">
              <h3>שמור את ההתקדמות שלך</h3>
              <p className="gnote">כדי לפתוח חשבון פייסבוק ביזנס תצטרך לצאת מכאן לרגע. התחבר עם Google ונשמור בדיוק את המקום שבו אתה נמצא — תוכל לחזור ולהמשיך מכאן בכל עת.</p>
              <div ref={fbsaveBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
              {authError && <p className="err">{authError}</p>}
            </div>
          )}
          {fb === 'none' && answers.googleConnected && (
            <div className="guide enter">
              <div className="savedbadge"><Ic name="checkc" /> ההתקדמות נשמרה לחשבון Google שלך</div>
              <h3>איך פותחים חשבון פייסבוק ביזנס</h3>
              {[
                'היכנס ל-business.facebook.com והתחבר עם חשבון הפייסבוק שלך.',
                'צור תיק עסקי (Business Portfolio) חדש עם שם העסק, האימייל והכתובת.',
                '(מומלץ) הגש את העסק לאימות כדי להעלות את מגבלת ההודעות.',
              ].map((s, i) => (
                <div className="gstep" key={i}><span className="gnum">{i + 1}</span><span>{s}</span></div>
              ))}
              <button className="btn2" onClick={() => window.open('https://business.facebook.com/', '_blank', 'noopener')}>
                <Ic name="open" /> פתח את פייסבוק ביזנס
              </button>
              <div className="savednote"><Ic name="bookmark" /><span>שמרנו את המקום שלך — חזור והמשך מכאן אחרי שתפתח את החשבון.</span></div>
            </div>
          )}
        </div>
      );
    }

    case 'number': {
      const num = answers.numberStatus;
      const opts = [
        { k: 'clean', icon: 'check2' as const, t: 'יש לי מספר פנוי', d: 'מספר שאין עליו וואטסאפ כלל' },
        { k: 'hasWhatsapp', icon: 'whatsapp' as const, t: 'יש לי מספר — אבל יש עליו וואטסאפ', d: 'צריך למחוק/לנתק את הוואטסאפ מהמספר' },
        { k: 'none', icon: 'cart' as const, t: 'אין לי מספר', d: 'נציע לך מספר וירטואלי לרכישה' },
      ];
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="phone" /></div>
          <h1 className="title">מספר לוואטסאפ העסקי</h1>
          <p className="subtitle">צריך מספר טלפון ייעודי שאין עליו וואטסאפ פעיל. מספר שיש עליו וואטסאפ רגיל צריך לנתק תחילה.</p>
          <div className="stack">
            <div className="notice wa">
              <div className="nHead"><Ic name="whatsapp" />שים לב — בוואטסאפ הרשמי:</div>
              <ul><li>אין קבוצות (כמו בוואטסאפ הרגיל)</li><li>אין אפשרות להעלות סטטוסים</li></ul>
            </div>
            {opts.map(o => (
              <button key={o.k} className={`choice${num === o.k ? ' sel' : ''}`} onClick={() => setAnswer({ numberStatus: o.k })}>
                <span className="cIcon"><Ic name={o.icon} /></span>
                <span className="cText"><span className="cTitle">{o.t}</span><span className="cDesc">{o.d}</span></span>
                <span className="cMark">{num === o.k ? <Ic name="checkc" /> : <CircleOutline />}</span>
              </button>
            ))}
          </div>
          {num === 'hasWhatsapp' && (
            <div className="guide enter">
              <h3>איך מנתקים וואטסאפ ממספר קיים</h3>
              {[
                'פתח וואטסאפ במכשיר עם המספר → הגדרות → חשבון.',
                'בחר "מחיקת החשבון" והזן את המספר לאישור.',
                'המתן מספר דקות עד שהמספר משתחרר, ואז חזור לכאן.',
              ].map((s, i) => (
                <div className="gstep" key={i}><span className="gnum">{i + 1}</span><span>{s}</span></div>
              ))}
              <div className="savednote"><Ic name="bookmark" /><span>המספר חייב להיות מנותק מוואטסאפ לפני החיבור למערכת הרשמית.</span></div>
            </div>
          )}
        </div>
      );
    }

    case 'virtual':
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="keypad" /></div>
          <h1 className="title">בחירת מספר וירטואלי</h1>
          <p className="subtitle">בחר אחד מהמספרים הפנויים. המספר יוקצה לוואטסאפ העסקי שלך.</p>
          {loadingNumbers ? (
            <div className="loading"><div className="spinner" />טוען מספרים פנויים...</div>
          ) : virtualNumbersError ? (
            <p className="err">{virtualNumbersError}</p>
          ) : virtualNumbers.length === 0 ? (
            <p className="err">אין כרגע מספרים פנויים — נסה שוב מאוחר יותר.</p>
          ) : (
            <div className="stack">
              {virtualNumbers.map(n => (
                <button key={n.number} className={`vn${selectedVn === n.number ? ' sel' : ''}`} onClick={() => setSelectedVn(n.number)}>
                  <span className="radio" />
                  <span className="num"><span className="digits mono">{n.number}</span></span>
                  <span className="price">₪{n.price} לחודש</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );

    case 'google': {
      const c = answers.googleConnected;
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="google" /></div>
          <h1 className="title">התחברות עם Google</h1>
          <p className="subtitle">נתחבר עם חשבון Google שלך כדי לאבטח את החשבון ולשמור את ההגדרות.</p>
          <div className="stack">
            {c ? (
              <div className="connected"><Ic name="checkc" /> מחובר ל-Google</div>
            ) : (
              <>
                <div ref={mainBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
                {authError && <p className="err">{authError}</p>}
              </>
            )}
          </div>
        </div>
      );
    }

    case 'connect': {
      const c = answers.fbConnected;
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="network" /></div>
          <h1 className="title">חיבור מול פייסבוק</h1>
          <p className="subtitle">עכשיו נחבר את חשבון הוואטסאפ העסקי שלך דרך פייסבוק (Embedded Signup של מטא).</p>
          <div className="stack">
            <div className="notice">
              <div className="nHead"><Ic name="alert" />לפני שמתחילים</div>
              <ul><li>ייפתח חלון של פייסבוק/מטא — אשר את ההרשאות ובחר את חשבון הוואטסאפ העסקי.</li></ul>
            </div>
            {c ? (
              <div className="connected"><Ic name="checkc" /> החיבור הושלם</div>
            ) : (
              // Still simulated: real Meta Embedded Signup needs its own SDK popup + app id
              // (see backend/routes/whatsappRegistrationRoutes.js for the real post-signup flow).
              <button className="btn2" onClick={() => { window.open('https://business.facebook.com/wa/manage/', '_blank', 'noopener'); setAnswer({ fbConnected: true }); }}>
                <Ic name="facebook" /> התחל חיבור מול פייסבוק
              </button>
            )}
          </div>
        </div>
      );
    }

    case 'done':
      if (completed) {
        return (
          <div className="done-screen enter">
            <div className="done-badge"><Ic name="checkc" /></div>
            <h1 className="title" style={{ textAlign: 'center' }}>המערכת מוכנה! 🎉</h1>
            <p className="subtitle" style={{ textAlign: 'center' }}>הוואטסאפ העסקי שלך מחובר. אפשר להתחיל לעבוד עם תבניות, בוטים ושליחת הודעות.</p>
            {!authToken && <p className="err">יש להתחבר עם Google כדי להיכנס לדשבורד.</p>}
          </div>
        );
      }
      return (
        <div className="enter">
          <div className="stepicon"><Ic name="sparkles" /></div>
          <h1 className="title">הכול מוכן! 🎉</h1>
          <p className="subtitle">הוואטסאפ העסקי שלך מחובר. הנה כמה צעדים ראשונים כדי להתחיל:</p>
          <div className="stack">
            {[
              { icon: 'docs' as const, t: 'תבניות הודעה', d: 'צור תבניות מאושרות לשליחה יזומה ללקוחות.' },
              { icon: 'send' as const, t: 'הודעה ראשונה', d: 'שלח הודעת בדיקה כדי לוודא שהכול עובד.' },
              { icon: 'bots' as const, t: 'בוטים ואוטומציות', d: 'הגדר מענה אוטומטי לפניות נפוצות.' },
            ].map(x => (
              <div className="tip" key={x.t}>
                <div className="tIcon"><Ic name={x.icon} /></div>
                <div><div className="tTitle">{x.t}</div><div className="tDesc">{x.d}</div></div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};

// ---- footer (back / next), mirrors each step's next-button rules ----
const RegFooter: React.FC<{
  pausedView: boolean; stepId: StepId; answers: Answers; completed: boolean;
  selectedVn: string | null; loadingNumbers: boolean; hasConversations: boolean; authToken: string | null;
  onBack: () => void; onNext: () => void; onContinueNow: () => void; onBuyNumber: () => void;
  onFinishIntro: () => void; onGoToDashboard: () => void;
}> = ({ pausedView, stepId, answers, completed, selectedVn, loadingNumbers, hasConversations, authToken, onBack, onNext, onContinueNow, onBuyNumber, onFinishIntro, onGoToDashboard }) => {
  if (pausedView) {
    return (
      <div className="foot">
        <button className="back" type="button" style={{ visibility: 'hidden' }}>חזרה</button>
        <button className="next" type="button" onClick={onContinueNow}>המשך עכשיו</button>
      </div>
    );
  }

  let showBack = true;
  let label = 'המשך';
  let enabled = false;
  let onClick = onNext;

  switch (stepId) {
    case 'intro':
      showBack = false; label = 'מתחילים'; enabled = true; onClick = onNext;
      break;
    case 'usecases':
      enabled = answers.useCases.length > 0 && (!hasConversations || !!answers.agentCount);
      break;
    case 'facebook':
      enabled = !!answers.fbStatus && (answers.fbStatus !== 'none' || answers.googleConnected);
      break;
    case 'number':
      enabled = !!answers.numberStatus;
      break;
    case 'virtual':
      label = 'רכישת המספר'; enabled = !!selectedVn && !loadingNumbers; onClick = onBuyNumber;
      break;
    case 'google':
      enabled = answers.googleConnected;
      break;
    case 'connect':
      enabled = answers.fbConnected;
      break;
    case 'done':
      if (completed) {
        showBack = false;
        if (!authToken) return <div className="foot" style={{ display: 'none' }} />;
        label = 'כניסה לדשבורד'; enabled = true; onClick = onGoToDashboard;
      } else {
        label = 'כניסה למערכת'; enabled = true; onClick = onFinishIntro;
      }
      break;
    default:
      break;
  }

  return (
    <div className="foot">
      <button className="back" type="button" style={{ visibility: showBack ? 'visible' : 'hidden' }} onClick={onBack}>חזרה</button>
      <button className="next" type="button" disabled={!enabled} onClick={enabled ? onClick : undefined}>{label}</button>
    </div>
  );
};

// Scoped CSS — every selector prefixed under .reg-wizard so it can't leak into (or be
// leaked into by) the rest of the app's global styles, unlike a real standalone page.
const RegWizardStyles = () => (
  <style>{`
.reg-wizard {
  --brand: #1877C2; --brand-ink: #0F5FA0; --yellow: #F5D21A; --teal: #12B5A5; --teal-soft: #E6F7F4;
  --wa: #25D366; --wa-ink: #0E7A3C; --bg: #EEF2F6; --surface: #FFFFFF; --surface-2: #F7F9FB;
  --text: #1A1A2E; --subtext: #6B7280; --border: #E5E7EB; --hairline: #EDF1F5; --error: #C0392B;
  --brand-wash: rgba(24,119,194,.08); --brand-line: rgba(24,119,194,.22); --yellow-wash: rgba(245,210,26,.16);
  --shadow: 0 1px 2px rgba(20,40,80,.05), 0 10px 34px rgba(20,40,80,.09);
  --shadow-soft: 0 1px 2px rgba(20,40,80,.04), 0 4px 14px rgba(20,40,80,.05);
  --radius: 10px; --radius-lg: 16px;
  direction: rtl; min-height: 100dvh; box-sizing: border-box;
  background: radial-gradient(1200px 600px at 90% -10%, var(--brand-wash), transparent 60%), var(--bg);
  color: var(--text); font-family: 'Heebo','Segoe UI',Arial,sans-serif; line-height: 1.6;
  -webkit-font-smoothing: antialiased; display: flex; align-items: center; justify-content: center; padding: 24px 16px;
}
@media (prefers-color-scheme: dark) {
  .reg-wizard {
    --bg:#0A0F18;--surface:#141C28;--surface-2:#0F1622;--text:#E8EDF3;--subtext:#94A1B2;--border:#263143;--hairline:#1E2836;
    --brand-wash:rgba(46,142,214,.14);--brand-line:rgba(46,142,214,.34);--yellow-wash:rgba(245,210,26,.12);--teal-soft:rgba(18,181,165,.14);
    --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 34px rgba(0,0,0,.42);--shadow-soft:0 1px 2px rgba(0,0,0,.35),0 4px 14px rgba(0,0,0,.3);
  }
}
.reg-wizard * { box-sizing: border-box; }
.reg-wizard .mono { font-family: 'JetBrains Mono','Consolas',monospace; direction: ltr; unicode-bidi: embed; }
.reg-wizard .app { width: 100%; max-width: 468px; background: var(--surface); border: 1px solid var(--border); border-radius: 22px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; min-height: min(720px, calc(100dvh - 48px)); }
.reg-wizard .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px 12px; }
.reg-wizard .brand { display: flex; align-items: center; gap: 9px; }
.reg-wizard .brand .name { font-weight: 800; font-size: 16px; letter-spacing: -.2px; }
.reg-wizard .exit { background: none; border: 0; color: var(--subtext); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px; border-radius: 8px; }
.reg-wizard .exit:hover { color: var(--text); }
.reg-wizard .logo { position: relative; width: 30px; height: 30px; flex-shrink: 0; }
.reg-wizard .logo .eye { position: absolute; left: 0; bottom: 0; width: 25px; height: 25px; border-radius: 50%; background: var(--brand); display: grid; place-items: center; }
.reg-wizard .logo .white { width: 15.5px; height: 15.5px; border-radius: 50%; background: #fff; display: grid; place-items: center; }
.reg-wizard .logo .iris { position: relative; width: 12.5px; height: 12.5px; border-radius: 50%; background: #4A4A4A; }
.reg-wizard .logo .hi { position: absolute; top: 1.5px; right: 1.5px; width: 4px; height: 4px; border-radius: 50%; background: #fff; }
.reg-wizard .logo .dot { position: absolute; top: 0; right: 0; width: 7px; height: 7px; border-radius: 50%; background: var(--yellow); }
.reg-wizard .processtitle { padding: 0 20px 12px; font-size: 20px; font-weight: 800; letter-spacing: -.3px; }
.reg-wizard .progress { padding: 0 20px 14px; }
.reg-wizard .track { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; }
.reg-wizard .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--brand), #3E9BE0); transition: width .45s cubic-bezier(.4,0,.2,1); }
.reg-wizard .steplabel { font-size: 12px; color: var(--subtext); margin-top: 6px; font-variant-numeric: tabular-nums; }
.reg-wizard .body { flex: 1; overflow-y: auto; padding: 8px 24px 4px; }
.reg-wizard .stepicon { width: 58px; height: 58px; border-radius: 18px; margin: 6px auto 16px; background: var(--brand-wash); display: grid; place-items: center; color: var(--brand); border: 1px solid var(--brand-line); }
.reg-wizard .stepicon svg { width: 28px; height: 28px; }
.reg-wizard h1.title { font-size: 22px; font-weight: 800; margin: 0 0 8px; letter-spacing: -.3px; }
.reg-wizard p.subtitle { color: var(--subtext); font-size: 15px; margin: 0 0 4px; }
.reg-wizard .stack { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
.reg-wizard .enter { animation: reg-enter .4s cubic-bezier(.2,.7,.3,1) both; }
@keyframes reg-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.reg-wizard .choice { display: flex; align-items: center; gap: 12px; text-align: right; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 14px; cursor: pointer; width: 100%; font: inherit; transition: border-color .15s, background .15s, transform .05s; }
.reg-wizard .choice:hover { border-color: var(--brand-line); }
.reg-wizard .choice:active { transform: scale(.995); }
.reg-wizard .choice.sel { border-color: var(--teal); background: var(--teal-soft); }
.reg-wizard .choice .cIcon { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--brand-wash); color: var(--brand); }
.reg-wizard .choice.sel .cIcon { background: var(--brand); color: #fff; }
.reg-wizard .choice .cText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.reg-wizard .choice .cTitle { font-weight: 700; font-size: 15px; }
.reg-wizard .choice .cDesc { font-size: 13px; color: var(--subtext); line-height: 1.45; }
.reg-wizard .choice .cMark { color: var(--border); flex-shrink: 0; }
.reg-wizard .choice.sel .cMark { color: var(--teal); }
.reg-wizard .choice svg { width: 20px; height: 20px; }
.reg-wizard .choice .cMark svg { width: 22px; height: 22px; }
.reg-wizard .notice { background: var(--brand-wash); border: 1px solid var(--brand-line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.reg-wizard .notice .nHead { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
.reg-wizard .notice .nHead svg { width: 18px; height: 18px; color: var(--brand); flex-shrink: 0; }
.reg-wizard .notice ul { margin: 0; padding: 0 22px 0 0; }
.reg-wizard .notice li { font-size: 14px; }
.reg-wizard .notice.wa { background: rgba(37,211,102,.09); border-color: rgba(37,211,102,.32); }
.reg-wizard .notice.wa .nHead svg { color: var(--wa-ink); }
.reg-wizard .guide { margin-top: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.reg-wizard .guide h3 { margin: 0; font-size: 15px; font-weight: 700; }
.reg-wizard .gnote { margin: 0; font-size: 14px; color: var(--subtext); line-height: 1.5; }
.reg-wizard .savedbadge { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--teal); background: var(--teal-soft); border-radius: 10px; padding: 10px 12px; }
.reg-wizard .savedbadge svg { width: 18px; height: 18px; flex-shrink: 0; }
.reg-wizard .gstep { display: flex; align-items: flex-start; gap: 12px; }
.reg-wizard .gnum { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; background: var(--brand); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; }
.reg-wizard .gstep span { font-size: 14px; line-height: 1.5; padding-top: 2px; }
.reg-wizard .savednote { display: flex; gap: 8px; align-items: flex-start; background: var(--yellow-wash); border-radius: 10px; padding: 12px; font-size: 13px; }
.reg-wizard .savednote svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 3px; color: #B8860B; }
.reg-wizard .agentsbox { margin-top: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.reg-wizard .agentsbox h3 { margin: 0; font-size: 15px; font-weight: 700; }
.reg-wizard .chiprow { display: flex; flex-wrap: wrap; gap: 8px; }
.reg-wizard .chip { border: 1.5px solid var(--border); background: var(--surface); border-radius: 999px; padding: 9px 16px; font: inherit; font-size: 14px; font-weight: 700; color: var(--subtext); cursor: pointer; }
.reg-wizard .chip:hover { border-color: var(--brand-line); }
.reg-wizard .chip.sel { border-color: var(--teal); background: var(--teal-soft); color: var(--teal); }
.reg-wizard .btn2 { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: 1.5px solid var(--brand); color: var(--brand); background: var(--surface); border-radius: var(--radius); padding: 13px; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; }
.reg-wizard .btn2:hover { background: var(--brand-wash); }
.reg-wizard .btn2 svg { width: 18px; height: 18px; }
.reg-wizard .connected { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; color: var(--teal); font-weight: 700; }
.reg-wizard .connected svg { width: 22px; height: 22px; }
.reg-wizard .err { color: var(--error); font-size: 13px; text-align: center; margin: 4px 0 0; }
.reg-wizard .vn { display: flex; align-items: center; gap: 12px; width: 100%; text-align: right; background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 14px; cursor: pointer; font: inherit; transition: border-color .15s, background .15s; }
.reg-wizard .vn:hover { border-color: var(--brand-line); }
.reg-wizard .vn.sel { border-color: var(--teal); background: var(--teal-soft); }
.reg-wizard .vn .radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; display: grid; place-items: center; }
.reg-wizard .vn.sel .radio { border-color: var(--teal); }
.reg-wizard .vn.sel .radio::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--teal); }
.reg-wizard .vn .num { flex: 1; display: flex; flex-direction: column; }
.reg-wizard .vn .digits { font-size: 17px; font-weight: 600; letter-spacing: .5px; }
.reg-wizard .vn .region { font-size: 12px; color: var(--subtext); }
.reg-wizard .vn .price { font-size: 13px; font-weight: 700; color: var(--brand); font-variant-numeric: tabular-nums; }
.reg-wizard .loading { text-align: center; color: var(--subtext); padding: 30px 0; font-size: 14px; }
.reg-wizard .spinner { width: 26px; height: 26px; border: 3px solid var(--border); border-top-color: var(--brand); border-radius: 50%; margin: 0 auto 10px; animation: reg-spin .8s linear infinite; }
@keyframes reg-spin { to { transform: rotate(360deg); } }
.reg-wizard .tip { display: flex; align-items: center; gap: 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 14px; }
.reg-wizard .tip .tIcon { width: 40px; height: 40px; border-radius: 10px; background: var(--brand-wash); color: var(--brand); display: grid; place-items: center; flex-shrink: 0; }
.reg-wizard .tip .tIcon svg { width: 20px; height: 20px; }
.reg-wizard .tip .tTitle { font-weight: 700; font-size: 15px; }
.reg-wizard .tip .tDesc { font-size: 13px; color: var(--subtext); line-height: 1.45; }
.reg-wizard .foot { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--surface); }
.reg-wizard .back { background: none; border: 0; color: var(--subtext); font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; padding: 12px; border-radius: 8px; }
.reg-wizard .back:hover { color: var(--text); }
.reg-wizard .next { flex: 1; background: var(--brand); color: #fff; border: 0; border-radius: var(--radius); padding: 15px; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; transition: filter .15s, opacity .15s; }
.reg-wizard .next:hover:not(:disabled) { filter: brightness(1.06); }
.reg-wizard .next:disabled { opacity: .4; cursor: not-allowed; }
.reg-wizard .pausebar { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px 16px; background: var(--surface); text-align: center; }
.reg-wizard .pauselink { background: none; border: 0; color: var(--brand); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; padding: 4px 2px; }
.reg-wizard .pauselink:hover { text-decoration: underline; text-underline-offset: 3px; }
.reg-wizard .done-screen { text-align: center; padding: 20px 0; }
.reg-wizard .done-badge { width: 84px; height: 84px; border-radius: 50%; margin: 10px auto 18px; background: var(--teal-soft); color: var(--teal); display: grid; place-items: center; animation: reg-pop .5s cubic-bezier(.2,.9,.3,1.2) both; }
.reg-wizard .done-badge svg { width: 46px; height: 46px; }
@keyframes reg-pop { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
`}</style>
);

export default RegPage;
