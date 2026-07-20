
import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const GOOGLE_CLIENT_ID = '266548688904-n1qrelk64op0usdbf52ae2gupcjld0vv.apps.googleusercontent.com';
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

declare global {
  interface Window { google: any; }
}

interface AccountOption {
  id: string;
  name: string;
  account_type: string;
  role: string;
  created_at: string;
}

interface AuthScreenProps {
  form: any;
  errors: Record<string, string>;
  onFormChange: (data: any) => void;
  onAuth: () => void;
  onGoogleLogin?: (credential: string, accountId?: string) => void;
  // Set when a direct login (password, or Google One Tap / auto-select) reveals that
  // several accounts share the same credentials — shows a friendly picker instead of
  // a hard error.
  pendingAccounts?: AccountOption[];
  // Which login path triggered the picker above. When 'google', the regular password
  // login button is disabled — the picker's own confirm button completes the login
  // directly (via onConfirmGoogleAccount) instead of requiring the Google button again.
  pendingAccountsSource?: 'google' | 'password' | null;
  // Completes a Google login using the previously-obtained credential together with the
  // chosen accountId. Only relevant when pendingAccountsSource === 'google'.
  onConfirmGoogleAccount?: (accountId: string) => void | Promise<void>;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ form, errors, onFormChange, onAuth, onGoogleLogin, pendingAccounts, pendingAccountsSource, onConfirmGoogleAccount }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [accountsForEmail, setAccountsForEmail] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pickerDismissed, setPickerDismissed] = useState(false);
  const [confirmingAccount, setConfirmingAccount] = useState(false);

  const hasPendingAccounts = !!pendingAccounts && pendingAccounts.length > 0;
  const regularLoginDisabled = hasPendingAccounts && pendingAccountsSource === 'google';
  // A forced picker (from a direct login attempt) takes priority over the passive
  // email-blur picker so the user isn't shown two different lists at once.
  const displayAccounts = hasPendingAccounts ? pendingAccounts! : accountsForEmail;
  const showAccountModal = displayAccounts.length > 1 && !pickerDismissed;

  // Re-open the modal whenever a new set of accounts shows up (new email lookup or a
  // fresh forced picker), so it doesn't stay hidden after a previous dismissal.
  useEffect(() => {
    if (displayAccounts.length > 1) setPickerDismissed(false);
  }, [displayAccounts.length, pendingAccountsSource, form.email]);

  // Read ?name= param from URL — set by invitation links
  const invitedByName = (() => {
    try {
      return new URLSearchParams(window.location.search).get('name') || '';
    } catch {
      return '';
    }
  })();

  const onGoogleLoginRef = useRef(onGoogleLogin);
  useEffect(() => {
    onGoogleLoginRef.current = onGoogleLogin;
  }, [onGoogleLogin]);

  const selectedAccountIdRef = useRef<string | undefined>(form.accountId);
  useEffect(() => {
    selectedAccountIdRef.current = form.accountId;
  }, [form.accountId]);

  // Fetch existing accounts for the typed email — triggered on email field blur.
  // Read-only picker: shows only existing accounts, no "create new" option here.
  const handleEmailBlur = async () => {
    const email = (form.email || '').trim();
    if (!email || !email.includes('@')) {
      setAccountsForEmail([]);
      return;
    }
    setLoadingAccounts(true);
    try {
      const res = await fetch(`${API_BASE}/auth/accounts-for-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      const accounts: AccountOption[] = data.accounts || [];
      if (accounts.length > 1) {
        setAccountsForEmail(accounts);
        // Default to the first account if none selected yet
        if (!form.accountId) {
          onFormChange({ ...form, accountId: accounts[0].id });
        }
      } else {
        setAccountsForEmail([]);
        if (form.accountId) onFormChange({ ...form, accountId: undefined });
      }
    } catch {
      setAccountsForEmail([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !onGoogleLoginRef.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google || !onGoogleLoginRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => onGoogleLoginRef.current!(response.credential, selectedAccountIdRef.current),
      });
      const btn = document.getElementById('google-login-btn');
      if (btn) {
        window.google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          width: 320,
          locale: 'he',
        });
      }
    };

    if (window.google) {
      init();
    } else {
      const scriptEl = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');
      if (scriptEl) scriptEl.addEventListener('load', init);
    }

    return () => {
      cancelled = true;
      const scriptEl = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');
      if (scriptEl) scriptEl.removeEventListener('load', init);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center p-6 text-right">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        {invitedByName && (
          <div className="mb-6 px-5 py-4 bg-blue-50 border border-blue-200 rounded-2xl text-center">
            <p className="text-blue-700 font-bold text-base">
              הוזמנת לחברת &ldquo;{invitedByName}&rdquo;
            </p>
          </div>
        )}
        <div className="flex justify-center mb-10">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-24 w-auto transition-transform duration-300 hover:scale-105" />
        </div>
        <div className="space-y-4 text-right">
          <div className="w-full">
            <input 
              className={`w-full px-6 py-4 bg-slate-50 border ${errors.email || errors.general ? 'border-red-500 bg-red-50/30' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium`} 
              placeholder="אימייל" 
              value={form.email} 
              onChange={e => onFormChange({...form, email: e.target.value})} 
              onBlur={handleEmailBlur}
            />
            {errors.email && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.email}</p>}
            {displayAccounts.length > 1 && (
              <button
                type="button"
                onClick={() => setPickerDismissed(false)}
                className="mt-2 w-full flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-right hover:bg-blue-100 transition-colors"
              >
                <span className="text-blue-600 text-xs font-bold underline">שינוי</span>
                <span className="text-blue-700 text-sm font-bold">
                  {form.accountId
                    ? `חשבון נבחר: ${displayAccounts.find(a => a.id === form.accountId)?.name || ''}`
                    : 'למייל זה משויכים מספר חשבונות - יש לבחור חשבון'}
                </span>
              </button>
            )}
          </div>
          <div className="w-full">
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                className={`w-full px-6 py-4 bg-slate-50 border ${errors.password || errors.general ? 'border-red-500 bg-red-50/30' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium pr-6 pl-12`} 
                placeholder="סיסמה" 
                value={form.password} 
                onChange={e => onFormChange({...form, password: e.target.value})} 
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.password}</p>}
          </div>
          {errors.general && (
            <div className="w-full bg-red-50 border border-red-300 rounded-2xl px-5 py-3 text-right">
              <p className="text-red-600 text-sm font-bold">{errors.general}</p>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none justify-end">
            <span className="text-sm text-slate-500">זכור אותי במחשב זה</span>
            <input
              type="checkbox"
              checked={!!form.rememberMe}
              onChange={e => onFormChange({ ...form, rememberMe: e.target.checked })}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
          </label>
          <button
            onClick={onAuth}
            disabled={regularLoginDisabled}
            title={regularLoginDisabled ? 'יש לבחור חשבון ולאשר בחלונית שנפתחה' : undefined}
            className={`w-full py-5 rounded-2xl font-bold shadow-lg uppercase tracking-widest transition-all ${
              regularLoginDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700'
            }`}
          >
            כניסה
          </button>

          {onGoogleLogin && (
            <>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">או</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div id="google-login-btn" className="flex justify-center mt-2" />
            </>
          )}

          <p className="text-center text-sm text-slate-500 mt-2">
            אין לך חשבון?{' '}
            <a
              href="?register=1"
              className="text-blue-600 font-bold hover:underline"
            >
              הירשם כאן
            </a>
          </p>
        </div>
      </div>

      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 text-right">
            <p className="text-slate-800 font-bold text-lg mb-1">למייל זה משויכים מספר חשבונות</p>
            <p className="text-slate-500 text-sm mb-4">
              {regularLoginDisabled
                ? 'יש לבחור חשבון וללחוץ על אישור כדי להיכנס.'
                : 'יש לבחור חשבון ולאחר מכן לנסות שוב להתחבר.'}
            </p>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 mb-5 max-h-80 overflow-y-auto">
              {displayAccounts.map(acc => (
                <label
                  key={acc.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="accountId"
                    className="accent-blue-600 w-4 h-4"
                    checked={form.accountId === acc.id}
                    onChange={() => onFormChange({ ...form, accountId: acc.id })}
                  />
                  <div className="flex-1 text-right">
                    <span className="font-bold text-slate-700 text-sm">{acc.name}</span>
                    <span className="text-xs text-slate-400 mr-2">({acc.role})</span>
                  </div>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                if (regularLoginDisabled && onConfirmGoogleAccount) {
                  // Google flow: complete the login directly using the credential
                  // obtained earlier — no need to click the Google button again.
                  setConfirmingAccount(true);
                  try {
                    await onConfirmGoogleAccount(form.accountId);
                  } finally {
                    setConfirmingAccount(false);
                  }
                } else {
                  setPickerDismissed(true);
                }
              }}
              disabled={!form.accountId || confirmingAccount}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {confirmingAccount ? 'מתחבר...' : 'אישור'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthScreen;
