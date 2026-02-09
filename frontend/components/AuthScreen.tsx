
import React from 'react';

interface AuthScreenProps {
  mode: 'login' | 'register';
  form: any;
  errors: Record<string, string>;
  onFormChange: (data: any) => void;
  onAuth: () => void;
  onSwitchMode: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ mode, form, errors, onFormChange, onAuth, onSwitchMode }) => {
  return (
    <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center p-6 text-right">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        <div className="flex justify-center mb-10">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-24 w-auto transition-transform duration-300 hover:scale-105" />
        </div>
        <div className="space-y-4 text-right">
          {mode === 'register' && (
            <div className="w-full">
              <input 
                className={`w-full px-6 py-4 bg-slate-50 border ${errors.name ? 'border-red-500 bg-red-50/30' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium`} 
                placeholder="שם מלא" 
                value={form.name} 
                onChange={e => onFormChange({...form, name: e.target.value})} 
              />
              {errors.name && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.name}</p>}
            </div>
          )}
          <div className="w-full">
            <input 
              className={`w-full px-6 py-4 bg-slate-50 border ${errors.email ? 'border-red-500 bg-red-50/30' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium`} 
              placeholder="אימייל" 
              value={form.email} 
              onChange={e => onFormChange({...form, email: e.target.value})} 
            />
            {errors.email && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.email}</p>}
          </div>
          <div className="w-full">
            <input 
              type="password" 
              className={`w-full px-6 py-4 bg-slate-50 border ${errors.password ? 'border-red-500 bg-red-50/30' : 'border-slate-200'} rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 text-right transition-all font-medium`} 
              placeholder="סיסמה" 
              value={form.password} 
              onChange={e => onFormChange({...form, password: e.target.value})} 
            />
            {errors.password && <p className="text-red-500 text-[11px] mt-1 mr-2 text-right font-bold">{errors.password}</p>}
          </div>
          <button onClick={onAuth} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest hover:bg-blue-700 transition-all">{mode === 'login' ? 'כניסה' : 'הרשמה'}</button>
          <button onClick={onSwitchMode} className="w-full text-slate-400 text-sm font-bold hover:text-blue-600 transition-colors">{mode === 'login' ? "אין לך חשבון? צור אחד" : "כבר רשום? התחבר"}</button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
