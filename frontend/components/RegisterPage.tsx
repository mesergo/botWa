import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Building2, Clock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { translateAuthApiError } from '../i18n/authErrors';

declare global {
  interface Window { google: any; }
}

const GOOGLE_CLIENT_ID = '266548688904-n1qrelk64op0usdbf52ae2gupcjld0vv.apps.googleusercontent.com';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const persistRegisteredAuth = (token: string, user: any) => {
  // Registration defaults to session-only auth to reduce persistence risk on shared devices.
  localStorage.removeItem('flowbot_token');
  localStorage.removeItem('flowbot_user');
  sessionStorage.setItem('flowbot_token', token);
  sessionStorage.setItem('flowbot_user', JSON.stringify(user));
  window.dispatchEvent(new Event('flowbot-auth-change'));
};

interface RegisterForm {
  company: string;
  phone: string;
  email: string;
  password: string;
}

interface FieldErrors {
  company?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmLogin?: string;
  general?: string;
}

interface InvitePrefill {
  email: string;
  name: string;
  inviterName: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,15}$/;

const RegisterPage: React.FC = () => {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('inviteToken') || '', []);
  const inviteMode = !!inviteToken;

  const [form, setForm] = useState<RegisterForm>({
    company: '',
    phone: '',
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterForm, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [invitePrefill, setInvitePrefill] = useState<InvitePrefill | null>(null);
  const [inviteLoading, setInviteLoading] = useState(inviteMode);
  const [inviteRequiresLoginConfirmation, setInviteRequiresLoginConfirmation] = useState(false);
  const [confirmInviteLogin, setConfirmInviteLogin] = useState(false);
  // Non-blocking duplicate-email confirm choice: "create another account with this email" vs "go to login"
  const [duplicateEmailChoice, setDuplicateEmailChoice] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  // Allow body scrolling while this page is mounted
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!inviteMode) return;
    let isCancelled = false;

    const verifyInvite = async () => {
      setInviteLoading(true);
      setErrors({});
      try {
        const res = await fetch(`${API_BASE}/auth/invite/verify?inviteToken=${encodeURIComponent(inviteToken)}`);
        const data = await res.json();
        if (!res.ok) {
          setErrors({ general: translateAuthApiError(data.error, 'errors.invalidInvite') });
          return;
        }
        if (isCancelled) return;
        setInvitePrefill({
          email: data.email || '',
          name: data.name || '',
          inviterName: data.inviterName || ''
        });
        setInviteRequiresLoginConfirmation(!!data.requiresLoginConfirmation);
        setForm((prev) => ({
          ...prev,
          company: data.name || prev.company,
          email: data.email || prev.email,
        }));
      } catch {
        if (!isCancelled) setErrors({ general: t('errors.networkRetry', { ns: 'common' }) });
      } finally {
        if (!isCancelled) setInviteLoading(false);
      }
    };

    verifyInvite();
    return () => { isCancelled = true; };
  }, [inviteMode, inviteToken, t]);

  const handleGoogleSignIn = useCallback(async (credential: string) => {
    if (inviteMode && inviteRequiresLoginConfirmation && !confirmInviteLogin) {
      setErrors((prev) => ({
        ...prev,
        confirmLogin: t('validation.confirmGoogleInvite', { ns: 'auth' }),
      }));
      return;
    }
    setIsSubmitting(true);
    try {
      const endpoint = inviteMode ? `${API_BASE}/auth/invite/google` : `${API_BASE}/auth/google`;
      const payload = inviteMode
        ? { credential, inviteToken, confirmLogin: confirmInviteLogin }
        : { credential };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        persistRegisteredAuth(data.token, data.user);
        setRegisteredEmail((data.user?.email || form.email || invitePrefill?.email || '').trim());
        setSubmitted(true);
      } else {
        setErrors({ general: translateAuthApiError(data.error, 'errors.googleLogin') });
      }
    } catch {
      setErrors({ general: t('errors.networkRetry', { ns: 'common' }) });
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteMode, inviteToken, form.email, invitePrefill?.email, inviteRequiresLoginConfirmation, confirmInviteLogin, t]);

  const handleGoogleSignInRef = useRef(handleGoogleSignIn);
  useEffect(() => {
    handleGoogleSignInRef.current = handleGoogleSignIn;
  }, [handleGoogleSignIn]);

  const googleInitializedRef = useRef(false);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google) return;
      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => handleGoogleSignInRef.current(response.credential),
        });
        googleInitializedRef.current = true;
      }
      const btn = document.getElementById('google-signin-btn');
      if (btn) {
        btn.innerHTML = '';
        window.google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          width: 320,
          locale: i18n.resolvedLanguage === 'en' ? 'en' : 'he',
          text: 'signup_with',
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
  }, [i18n.resolvedLanguage]);

  const validateField = useCallback(
    (field: keyof RegisterForm, value: string): string => {
      switch (field) {
        case 'company':
          if (!value.trim()) return t('validation.required', { ns: 'auth' });
          if (value.trim().length < 2) return t('validation.companyMinLength', { ns: 'auth' });
          return '';
        case 'phone':
          if (!value.trim()) return t('validation.required', { ns: 'auth' });
          if (!PHONE_REGEX.test(value.trim())) return t('validation.invalidPhone', { ns: 'auth' });
          return '';
        case 'email':
          if (!value.trim()) return t('validation.required', { ns: 'auth' });
          if (!EMAIL_REGEX.test(value.trim())) return t('validation.invalidEmail', { ns: 'auth' });
          return '';
        case 'password':
          if (!value) return t('validation.required', { ns: 'auth' });
          if (value.length < 6) return t('validation.passwordMinLength', { ns: 'auth' });
          if (!/[A-Za-z]/.test(value)) return t('validation.passwordLetter', { ns: 'auth' });
          if (!/[0-9]/.test(value)) return t('validation.passwordDigit', { ns: 'auth' });
          return '';
        default:
          return '';
      }
    },
    [t]
  );

  const validateAll = useCallback(
    (currentForm: RegisterForm): FieldErrors => {
      const errs: FieldErrors = {};
      (['company', 'phone', 'email', 'password'] as (keyof RegisterForm)[]).forEach((field) => {
        const err = validateField(field, currentForm[field] as string);
        if (err) errs[field as keyof FieldErrors] = err;
      });
      return errs;
    },
    [validateField]
  );

  const handleChange = (field: keyof RegisterForm, value: string) => {
    if (inviteMode && (field === 'company' || field === 'email')) return;
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
    if (field === 'email') {
      setDuplicateEmailChoice(false);
      setConfirmedDuplicate(false);
    }
  };

  const handleBlur = async (field: keyof RegisterForm) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, form[field] as string);
    setErrors((prev) => ({ ...prev, [field]: err }));

    if (!inviteMode && field === 'email' && !err && form.email.trim()) {
      setEmailChecking(true);
      try {
        const res = await fetch(
          `${API_BASE}/auth/check-email?email=${encodeURIComponent(form.email.trim())}`
        );
        const data = await res.json();
        // Non-blocking: existing email just surfaces the "create another account?" choice
        setDuplicateEmailChoice(!!data.exists && !confirmedDuplicate);
      } catch {
        // silent
      } finally {
        setEmailChecking(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched: Partial<Record<keyof RegisterForm, boolean>> = {
      company: true, phone: true, email: true, password: true,
    };
    setTouched(allTouched);

    const errs = validateAll(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      let res: Response;
      if (inviteMode) {
        if (inviteRequiresLoginConfirmation && !confirmInviteLogin) {
          setErrors((prev) => ({
            ...prev,
            confirmLogin: t('validation.confirmInvite', { ns: 'auth' }),
          }));
          setIsSubmitting(false);
          return;
        }
        const payload = {
          inviteToken,
          name: invitePrefill?.name || form.company.trim(),
          email: invitePrefill?.email || form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          confirmLogin: confirmInviteLogin,
        };
        res = await fetch(`${API_BASE}/auth/invite/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const emailRes = await fetch(
          `${API_BASE}/auth/check-email?email=${encodeURIComponent(form.email.trim())}`
        );
        const emailData = await emailRes.json();
        if (emailData.exists && !confirmedDuplicate) {
          setDuplicateEmailChoice(true);
          setIsSubmitting(false);
          return;
        }

        const payload = {
          name: form.company.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          account_type: 'Trial',
        };

        res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (res.ok && data.token) {
        persistRegisteredAuth(data.token, data.user);
        setRegisteredEmail((invitePrefill?.email || form.email).trim());
        setSubmitted(true);
      } else {
        setErrors({ general: translateAuthApiError(data.error, 'errors.registration') });
      }
    } catch {
      setErrors({ general: t('errors.networkRetry', { ns: 'common' }) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <LanguageSwitcher />
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-12 text-center border border-slate-100">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            {t(inviteMode ? 'register.success.inviteTitle' : 'register.success.title', { ns: 'auth' })}
          </h2>
          <p className="text-slate-500 mb-6">
            {t('register.success.accountCreated', { ns: 'auth' })}
            <br />
            <span className="font-semibold text-slate-900">{registeredEmail}</span>
          </p>
          
          {!inviteMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-start">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-700 uppercase tracking-wider font-black">{t('register.success.trialAccount', { ns: 'auth' })}</span>
            </div>
            <ul className="text-sm text-amber-800 space-y-1 font-medium">
              <li>• {t('register.success.oneBot', { ns: 'auth' })}</li>
              <li>• {t('register.success.validity', { ns: 'auth' })}</li>
              <li>• {t('register.success.simulatorOnly', { ns: 'auth' })}</li>
            </ul>
          </div>
          )}

          <a
            href="/"
            className="block w-full bg-slate-900 text-white py-4 rounded-xl font-medium shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all"
          >
            {t('register.success.enterSystem', { ns: 'auth' })}
          </a>
        </div>
      </div>
    );
  }

  if (inviteMode && inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <LanguageSwitcher />
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-10 text-center border border-slate-100">
          <p className="text-slate-700 font-bold">{t('register.verifyingInvite', { ns: 'auth' })}</p>
        </div>
      </div>
    );
  }

  // ── Registration layout ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <LanguageSwitcher />
      
      <div className="w-full max-w-4xl mx-auto space-y-12">
        {/* Header / Logo Section */}
        <div className="text-center space-y-4">
          <img
            className="mx-auto h-12 w-auto"
            src="/images/mesergo-logo.png"
            alt="MeserGo"
          />
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            {t(inviteMode ? 'register.inviteHeading' : 'register.heading', { ns: 'auth' })}
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            {inviteMode
              ? t('register.inviteDescription', { ns: 'auth' })
              : t('register.description', { ns: 'auth' })}
          </p>
          {inviteMode && invitePrefill && (
            <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-3 mt-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm font-black text-blue-800">
                {t('register.invitedBy', {
                  name: invitePrefill.inviterName || t('register.systemManager', { ns: 'auth' }),
                  ns: 'auth',
                })}
              </p>
            </div>
          )}
          {/* Trial account notice */}
          {!inviteMode && (
          <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3 mt-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-start">
              <p className="text-sm font-black text-amber-800">{t('register.trialTitle', { ns: 'auth' })}</p>
              <p className="text-xs text-amber-600 font-medium">{t('register.trialSummary', { ns: 'auth' })}</p>
            </div>
          </div>
          )}
        </div>

        {/* Form Section - Clean & Flat */}
        <form onSubmit={handleSubmit} noValidate className="w-full">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            
            {/* Column 1 */}
            <div className="space-y-8">
                {/* Company */}
                <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">
                  {t(inviteMode ? 'register.fullName' : 'register.businessName', { ns: 'auth' })}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 start-0 ps-0 flex items-center pointer-events-none">
                     <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={form.company}
                    onBlur={() => handleBlur('company')}
                    onChange={(e) => handleChange('company', e.target.value)}
                    disabled={inviteMode}
                    className={`block w-full ps-8 pe-0 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.company && errors.company 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder={t(inviteMode ? 'register.fullName' : 'register.companyPlaceholder', { ns: 'auth' })}
                  />
                  {touched.company && errors.company && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{errors.company}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">{t('register.email', { ns: 'auth' })}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 start-0 ps-0 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onBlur={() => handleBlur('email')}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={inviteMode}
                    className={`block w-full ps-8 pe-8 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.email && errors.email 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="name@company.com"
                  />
                  <div className="absolute inset-y-0 end-0 pe-0 flex items-center">
                      {emailChecking ? (
                      <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : touched.email && !errors.email ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : null}
                  </div>
                </div>
                {touched.email && errors.email && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.email}</p>
                )}
                {!inviteMode && duplicateEmailChoice && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-start space-y-3">
                    <p className="text-sm font-bold text-amber-800">
                      {t('register.duplicateEmailQuestion', { ns: 'auth' })}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => { setConfirmedDuplicate(true); setDuplicateEmailChoice(false); }}
                        className="text-sm font-bold bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        {t('register.createAnother', { ns: 'auth' })}
                      </button>
                      <a
                        href="/"
                        className="text-sm font-bold bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        {t('register.goToLogin', { ns: 'auth' })}
                      </a>
                    </div>
                  </div>
                )}
                {!inviteMode && confirmedDuplicate && !duplicateEmailChoice && (
                  <p className="text-amber-700 text-sm mt-2 font-bold">
                    {t('register.duplicateConfirmed', { ns: 'auth' })}
                  </p>
                )}
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-8">
              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">{t('register.mobilePhone', { ns: 'auth' })}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 start-0 ps-0 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    value={form.phone}
                    onBlur={() => handleBlur('phone')}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={`block w-full ps-8 pe-0 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.phone && errors.phone 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="050-0000000"
                  />
                  {touched.phone && errors.phone && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">{t('register.password', { ns: 'auth' })}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 start-0 ps-0 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onBlur={() => handleBlur('password')}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className={`block w-full ps-8 pe-10 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.password && errors.password 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 end-0 pe-0 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Indicators */}
                {form.password && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {[
                      { label: t('register.passwordRequirements.length', { ns: 'auth' }), ok: form.password.length >= 6 },
                      { label: t('register.passwordRequirements.letter', { ns: 'auth' }), ok: /[A-Za-z]/.test(form.password) },
                      { label: t('register.passwordRequirements.digit', { ns: 'auth' }), ok: /[0-9]/.test(form.password) },
                    ].map(({ label, ok }) => (
                        <span key={label} className={`text-xs font-semibold transition-colors ${
                          ok ? 'text-green-600' : 'text-slate-300'
                        }`}>
                          {ok ? '✓' : '•'} {label}
                        </span>
                    ))}
                  </div>
                )}

                {touched.password && errors.password && (
                  <p className="text-red-500 text-sm mt-1 font-medium">{errors.password}</p>
                )}
              </div>
            </div>
          </div>

          {/* General Error */}
          {errors.general && (
            <div className="mt-8 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-red-100 max-w-xl mx-auto">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {errors.general}
            </div>
          )}

          {inviteMode && inviteRequiresLoginConfirmation && (
            <div className="mt-8 max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-start space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmInviteLogin}
                  onChange={(e) => {
                    setConfirmInviteLogin(e.target.checked);
                    setErrors((prev) => ({ ...prev, confirmLogin: '' }));
                  }}
                  className="w-4 h-4 mt-0.5 accent-blue-600 cursor-pointer flex-shrink-0"
                />
                <span className="text-sm font-bold text-slate-700">
                  {t('register.confirmInviteLogin', { ns: 'auth' })}
                </span>
              </label>
              {errors.confirmLogin && (
                <p className="text-xs text-red-600 font-bold">{errors.confirmLogin}</p>
              )}
            </div>
          )}

          {/* Google Sign-In */}
          <div className="mt-12 max-w-sm mx-auto space-y-4">
            {GOOGLE_CLIENT_ID ? (
              <>
                <div id="google-signin-btn" className="flex justify-center" />
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">{t('register.manualRegistration', { ns: 'auth' })}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </>
            ) : null}
          </div>

          {/* Submit Button */}
          <div className="mt-4 max-w-sm mx-auto">
            <button
              type="submit"
              disabled={isSubmitting || emailChecking || (inviteMode && !invitePrefill)}
              className="w-full bg-blue-600 text-white py-5 rounded-full font-bold text-xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {t('register.creating', { ns: 'auth' })}
                </>
              ) : (
                t(inviteMode ? 'register.completeInvite' : 'register.createAccount', { ns: 'auth' })
              )}
            </button>

            <p className="text-center mt-6 text-sm text-slate-500">
              {t('register.alreadyHaveAccount', { ns: 'auth' })}{' '}
              <a href="/" className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors">
                {t('register.loginHere', { ns: 'auth' })}
              </a>
            </p>
          </div>
        </form>
        
        {/* Footer info */}
        <div className="pt-8 border-t border-slate-100 text-center">
           <p className="text-slate-400 text-xs">
            &copy; {new Date().getFullYear()} MeserGo. {t('register.secureFooter', { ns: 'auth' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
