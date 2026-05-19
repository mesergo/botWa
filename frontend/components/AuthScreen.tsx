
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const GOOGLE_CLIENT_ID = '266548688904-n1qrelk64op0usdbf52ae2gupcjld0vv.apps.googleusercontent.com';

declare global {
  interface Window { google: any; }
}

interface AuthScreenProps {
  form: any;
  errors: Record<string, string>;
  onFormChange: (data: any) => void;
  onAuth: () => void;
  onGoogleLogin?: (credential: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ form, errors, onFormChange, onAuth, onGoogleLogin }) => {
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !onGoogleLogin) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => onGoogleLogin(response.credential),
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
  }, [onGoogleLogin]);

  return (
    <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center p-6 text-right">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
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
            />
            {errors.email && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.email}</p>}
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
          <button onClick={onAuth} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest hover:bg-blue-700 transition-all">כניסה</button>

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
    </div>
  );
};

export default AuthScreen;
