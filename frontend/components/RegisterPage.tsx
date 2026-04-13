import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Building2, Clock, ShieldCheck } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

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
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,15}$/;

const RegisterPage: React.FC = () => {
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
        account_type: 'Trial',
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-12 text-center border border-slate-100">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">ההרשמה הושלמה!</h2>
          <p className="text-slate-500 mb-6">
            חשבון חדש נוצר עבור
            <br />
            <span className="font-semibold text-slate-900">{registeredEmail}</span>
          </p>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-right">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-700 uppercase tracking-wider font-black">חשבון ניסיוני</span>
            </div>
            <ul className="text-sm text-amber-800 space-y-1 font-medium">
              <li>• בוט אחד בלבד</li>
              <li>• תוקף חשבון: 30 יום</li>
              <li>• גישה לסימולטור בלבד (ללא פרסום)</li>
            </ul>
          </div>

          <a
            href="/"
            className="block w-full bg-slate-900 text-white py-4 rounded-xl font-medium shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all"
          >
            מעבר לכניסה למערכת
          </a>
        </div>
      </div>
    );
  }

  // ── Registration layout ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6" dir="rtl">
      
      <div className="w-full max-w-4xl mx-auto space-y-12">
        {/* Header / Logo Section */}
        <div className="text-center space-y-4">
          <img
            className="mx-auto h-12 w-auto"
            src="/images/mesergo-logo.png"
            alt="MeserGo"
          />
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            הצטרפות למערכת
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            מלא את הפרטים הבאים כדי לפתוח חשבון חדש ולהתחיל לנהל את הבוטים שלך בצורה חכמה.
          </p>
          {/* Trial account notice */}
          <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3 mt-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-right">
              <p className="text-sm font-black text-amber-800">חשבון ניסיוני חינמי — 30 יום</p>
              <p className="text-xs text-amber-600 font-medium">בוט אחד · סימולטור בלבד · ללא פרסום</p>
            </div>
          </div>
        </div>

        {/* Form Section - Clean & Flat */}
        <form onSubmit={handleSubmit} noValidate className="w-full">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            
            {/* Column 1 */}
            <div className="space-y-8">
                {/* Company */}
                <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">שם העסק</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-0 flex items-center pointer-events-none">
                     <Building2 className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={form.company}
                    onBlur={() => handleBlur('company')}
                    onChange={(e) => handleChange('company', e.target.value)}
                    className={`block w-full pr-8 pl-0 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.company && errors.company 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="שם החברה בע״מ"
                  />
                  {touched.company && errors.company && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{errors.company}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">כתובת אימייל</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-0 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onBlur={() => handleBlur('email')}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`block w-full pr-8 pl-8 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.email && errors.email 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="name@company.com"
                  />
                  <div className="absolute inset-y-0 left-0 pl-0 flex items-center">
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
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-8">
              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-900">טלפון נייד</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-0 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    value={form.phone}
                    onBlur={() => handleBlur('phone')}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={`block w-full pr-8 pl-0 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
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
                <label className="text-base font-bold text-slate-900">סיסמה</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-0 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onBlur={() => handleBlur('password')}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className={`block w-full pr-8 pl-10 py-3 bg-transparent border-b-2 outline-none transition-all placeholder:text-slate-300 font-medium text-lg ${
                      touched.password && errors.password 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-600'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 left-0 pl-0 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
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
                      { label: '6+ תווים', ok: form.password.length >= 6 },
                      { label: 'אות באנגלית', ok: /[A-Za-z]/.test(form.password) },
                      { label: 'ספרה', ok: /[0-9]/.test(form.password) },
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

          {/* Submit Button */}
          <div className="mt-12 max-w-sm mx-auto">
            <button
              type="submit"
              disabled={isSubmitting || emailChecking}
              className="w-full bg-blue-600 text-white py-5 rounded-full font-bold text-xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  יוצר חשבון...
                </>
              ) : (
                'צור חשבון חדש'
              )}
            </button>

            <p className="text-center mt-6 text-sm text-slate-500">
              כבר יש לך חשבון?{' '}
              <a href="/" className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors">
                התחבר כאן
              </a>
            </p>
          </div>
        </form>
        
        {/* Footer info */}
        <div className="pt-8 border-t border-slate-100 text-center">
           <p className="text-slate-400 text-xs">
            &copy; {new Date().getFullYear()} MeserGo. מערכת מאובטחת ע״י הצפנה מתקדמת.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
