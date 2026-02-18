import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Building2, Zap, Star } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface RegisterForm {
  company: string;
  phone: string;
  email: string;
  password: string;
  accountType: 'Basic' | 'Premium';
}

interface FieldErrors {
  company?: string;
  phone?: string;
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,15}$/;

const ACCOUNT_PLANS = [
  {
    id: 'Basic' as const,
    label: 'Basic',
    icon: <Zap className="w-5 h-5" />,
    color: 'blue',
    price: 'חינם / בסיסי',
    features: ['עד 3 בוטים', 'עד 5 גרסאות לבוט', 'תמיכה בסיסית', 'ממשק ניהול מלא'],
    missing: ['ללא תמיכה מועדפת', 'ללא גרסאות ארכיון'],
  },
  {
    id: 'Premium' as const,
    label: 'Premium',
    icon: <Star className="w-5 h-5" />,
    color: 'amber',
    price: 'תוכנית מתקדמת',
    features: ['בוטים ללא הגבלה', 'גרסאות ללא הגבלה', 'ארכיון גרסאות', 'תמיכה מועדפת', 'כל אפשרויות ה-Basic'],
    missing: [],
  },
];

const RegisterPage: React.FC = () => {
  const [form, setForm] = useState<RegisterForm>({
    company: '',
    phone: '',
    email: '',
    password: '',
    accountType: 'Basic',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterForm, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Allow body scrolling while this page is mounted
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const validateField = useCallback(
    (field: keyof RegisterForm, value: string): string => {
      switch (field) {
        case 'company':
          if (!value.trim()) return 'שדה חובה';
          if (value.trim().length < 2) return 'שם חברה חייב להכיל לפחות 2 תווים';
          return '';
        case 'phone':
          if (!value.trim()) return 'שדה חובה';
          if (!PHONE_REGEX.test(value.trim())) return 'מספר טלפון אינו תקין';
          return '';
        case 'email':
          if (!value.trim()) return 'שדה חובה';
          if (!EMAIL_REGEX.test(value.trim())) return 'כתובת אימייל אינה תקינה';
          return '';
        case 'password':
          if (!value) return 'שדה חובה';
          if (value.length < 6) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
          if (!/[A-Za-z]/.test(value)) return 'הסיסמה חייבת להכיל לפחות אות אחת';
          if (!/[0-9]/.test(value)) return 'הסיסמה חייבת להכיל לפחות ספרה אחת';
          return '';
        default:
          return '';
      }
    },
    []
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
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleBlur = async (field: keyof RegisterForm) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, form[field] as string);
    setErrors((prev) => ({ ...prev, [field]: err }));

    if (field === 'email' && !err && form.email.trim()) {
      setEmailChecking(true);
      try {
        const res = await fetch(
          `${API_BASE}/auth/check-email?email=${encodeURIComponent(form.email.trim())}`
        );
        const data = await res.json();
        if (data.exists) {
          setErrors((prev) => ({ ...prev, email: 'כתובת אימייל זו כבר רשומה במערכת' }));
        }
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
      const emailRes = await fetch(
        `${API_BASE}/auth/check-email?email=${encodeURIComponent(form.email.trim())}`
      );
      const emailData = await emailRes.json();
      if (emailData.exists) {
        setErrors({ email: 'כתובת אימייל זו כבר רשומה במערכת' });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        name: form.company.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        account_type: form.accountType,
      };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setRegisteredEmail(form.email.trim());
        setSubmitted(true);
      } else {
        setErrors({ general: data.error || 'אירעה שגיאה בעת ההרשמה, נסה שנית' });
      }
    } catch {
      setErrors({ general: 'אין חיבור לשרת. אנא נסה שנית מאוחר יותר.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-12 text-center border border-slate-100">
          <div className="flex justify-center mb-8">
            <img src="/images/mesergo-logo.png" alt="Logo" className="h-20 w-auto" />
          </div>
          <div className="flex justify-center mb-6">
            <CheckCircle className="w-20 h-20 text-green-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">ההרשמה הושלמה בהצלחה!</h2>
          <p className="text-slate-500 mb-2">חשבון נוצר עבור כתובת האימייל:</p>
          <p className="text-blue-600 font-bold text-lg mb-4">{registeredEmail}</p>
          <p className="text-slate-400 text-xs mb-8">
            סוג חשבון: <span className="font-bold text-slate-600">{form.accountType}</span>
          </p>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            מעכשיו תוכל להתחבר למערכת עם כתובת האימייל והסיסמה שבחרת.
            <br />
            בכל שאלה ניתן לפנות לצוות החברה.
          </p>
          <a
            href="/"
            className="inline-block w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            מעבר לכניסה למערכת
          </a>
        </div>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <div className="bg-slate-100 min-h-screen py-10 px-4" dir="rtl">
      <div className="w-full max-w-lg mx-auto space-y-6">

        {/* Header card */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-10 text-center">
          <div className="flex justify-center mb-6">
            <img src="/images/mesergo-logo.png" alt="Logo" className="h-20 w-auto" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">טופס הצטרפות למערכת</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            ברוכים הבאים! קיבלתם קישור זה מצוות החברה.
            <br />
            אנא מלאו את הפרטים הבאים ליצירת חשבונכם האישי.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 space-y-5">

            {/* Company */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                שם החברה / עסק <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Building2 className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type="text"
                  value={form.company}
                  onBlur={() => handleBlur('company')}
                  onChange={(e) => handleChange('company', e.target.value)}
                  placeholder="שם החברה או העסק"
                  className={`w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal ${
                    touched.company && errors.company ? 'border-red-400 bg-red-50/30'
                    : touched.company && !errors.company ? 'border-green-400 bg-green-50/20'
                    : 'border-slate-200'
                  }`}
                />
              </div>
              {touched.company && errors.company && (
                <p className="flex items-center gap-1 text-red-500 text-[11px] mt-1.5 mr-1 font-bold">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.company}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                מספר טלפון <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Phone className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type="tel"
                  value={form.phone}
                  onBlur={() => handleBlur('phone')}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="050-0000000"
                  className={`w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal ${
                    touched.phone && errors.phone ? 'border-red-400 bg-red-50/30'
                    : touched.phone && !errors.phone ? 'border-green-400 bg-green-50/20'
                    : 'border-slate-200'
                  }`}
                />
              </div>
              {touched.phone && errors.phone && (
                <p className="flex items-center gap-1 text-red-500 text-[11px] mt-1.5 mr-1 font-bold">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.phone}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                כתובת אימייל <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type="email"
                  value={form.email}
                  onBlur={() => handleBlur('email')}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="your@email.com"
                  className={`w-full pr-12 pl-10 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal ${
                    touched.email && errors.email ? 'border-red-400 bg-red-50/30'
                    : touched.email && !errors.email ? 'border-green-400 bg-green-50/20'
                    : 'border-slate-200'
                  }`}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2">
                  {emailChecking ? (
                    <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  ) : touched.email && !errors.email ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : null}
                </span>
              </div>
              {touched.email && errors.email && (
                <p className="flex items-center gap-1 text-red-500 text-[11px] mt-1.5 mr-1 font-bold">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                סיסמה <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onBlur={() => handleBlur('password')}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="לפחות 6 תווים + מספר"
                  className={`w-full pr-12 pl-12 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal ${
                    touched.password && errors.password ? 'border-red-400 bg-red-50/30'
                    : touched.password && !errors.password ? 'border-green-400 bg-green-50/20'
                    : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {touched.password && errors.password && (
                <p className="flex items-center gap-1 text-red-500 text-[11px] mt-1.5 mr-1 font-bold">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.password}
                </p>
              )}
              {form.password && (
                <div className="mt-2 flex gap-1.5">
                  {[
                    { label: '6+ תווים', ok: form.password.length >= 6 },
                    { label: 'אות', ok: /[A-Za-z]/.test(form.password) },
                    { label: 'ספרה', ok: /[0-9]/.test(form.password) },
                  ].map(({ label, ok }) => (
                    <span key={label} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ok ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Account type */}
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-3">
                סוג חשבון <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ACCOUNT_PLANS.map((plan) => {
                  const selected = form.accountType === plan.id;
                  const isBlue = plan.color === 'blue';
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, accountType: plan.id }))}
                      className={`relative rounded-2xl border-2 p-4 text-right transition-all ${
                        selected
                          ? isBlue
                            ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                            : 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {selected && (
                        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isBlue ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          נבחר ✓
                        </span>
                      )}
                      <div className={`flex items-center gap-2 mb-3 ${
                        selected ? (isBlue ? 'text-blue-600' : 'text-amber-600') : 'text-slate-500'
                      }`}>
                        {plan.icon}
                        <span className="font-extrabold text-base">{plan.label}</span>
                      </div>
                      <p className={`text-xs font-bold mb-3 ${
                        selected ? (isBlue ? 'text-blue-500' : 'text-amber-500') : 'text-slate-400'
                      }`}>
                        {plan.price}
                      </p>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5 text-green-500" />
                            {f}
                          </li>
                        ))}
                        {plan.missing.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                            <span className="w-3 h-3 flex-shrink-0 mt-0.5 text-center leading-none">✕</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General error */}
            {errors.general && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errors.general}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || emailChecking}
              className="w-full mt-2 bg-blue-600 text-white py-5 rounded-2xl font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  מבצע הרשמה...
                </>
              ) : (
                'הרשמה ויצירת חשבון'
              )}
            </button>

            <p className="text-center text-slate-400 text-xs">
              כבר יש לך חשבון?{' '}
              <a href="/" className="text-blue-600 font-bold hover:underline">כניסה למערכת</a>
            </p>
          </div>
        </form>

        <p className="text-center text-slate-400 text-xs pb-4">
          לכל שאלה ניתן לפנות לצוות החברה
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
