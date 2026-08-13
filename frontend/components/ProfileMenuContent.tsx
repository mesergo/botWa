import React, { useEffect, useRef, useState } from 'react';
import { Edit2, LogOut, User as UserIcon, Mail, Phone, Star } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface ProfileDetails {
  name: string;
  email: string;
  phone: string;
  account_type: string;
}

interface ProfileMenuContentProps {
  token: string | null;
  currentUser?: { name?: string; email?: string } | null;
  onLogout: () => void;
  /** Rendered between the profile details and the logout button (e.g. sibling account switcher). */
  children?: React.ReactNode;
}

const accountTypeLabel = (type?: string) => {
  if (type === 'Trial') return 'ניסיוני';
  if (type === 'Premium') return 'פרימיום';
  if (type === 'Basic') return 'בסיסי';
  return type || '-';
};

/** Shared content for the profile dropdown: full name, email, phone (editable) and subscription type,
 *  followed by optional extra content (e.g. account switcher) and a logout button. */
const ProfileMenuContent: React.FC<ProfileMenuContentProps> = ({ token, currentUser, onLogout, children }) => {
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setProfile({ name: data.name || '', email: data.email || '', phone: data.phone || '', account_type: data.account_type || '' });
        setPhoneValue(data.phone || '');
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSavePhone = async () => {
    if (cancellingRef.current) { cancellingRef.current = false; return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הטלפון');
      setProfile(prev => (prev ? { ...prev, phone: data.phone || '' } : prev));
      setEditingPhone(false);
    } catch (e: any) {
      setError(e.message || 'שגיאה בשמירת הטלפון');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.name || currentUser?.name || currentUser?.email || '';
  const displayEmail = profile?.email || currentUser?.email || '';
  const avatarInitial = (displayName || displayEmail || '?').charAt(0).toUpperCase();

  return (
    <div dir="rtl">
      <div className="flex justify-center pt-2 pb-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none ring-2 ring-blue-100">
          {avatarInitial}
        </div>
      </div>
      <div className="px-4 py-2 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span title="שם מלא" className="text-slate-400 flex-shrink-0"><UserIcon size={14} /></span>
          <span className="text-xs font-bold text-slate-700 truncate">{displayName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span title="אימייל" className="text-slate-400 flex-shrink-0"><Mail size={14} /></span>
          <span className="text-xs font-bold text-slate-700 truncate" dir="ltr">{displayEmail}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span title="טלפון" className="text-slate-400 flex-shrink-0"><Phone size={14} /></span>
          {!editingPhone ? (
            <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
              <span className="text-xs font-bold text-slate-700 truncate">{loading ? '...' : (profile?.phone || 'לא הוגדר')}</span>
              <button
                type="button"
                onClick={() => { setPhoneValue(profile?.phone || ''); setEditingPhone(true); setError(null); }}
                className="p-1 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                title="עדכון מספר טלפון"
              >
                <Edit2 size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="tel"
                value={phoneValue}
                onChange={e => setPhoneValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSavePhone();
                  else if (e.key === 'Escape') { cancellingRef.current = true; setEditingPhone(false); setError(null); setPhoneValue(profile?.phone || ''); }
                }}
                onBlur={handleSavePhone}
                dir="ltr"
                autoFocus
                disabled={saving}
                className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:opacity-60"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span title="סוג מנוי" className="text-slate-400 flex-shrink-0"><Star size={14} /></span>
          <span className="text-xs font-bold text-slate-700 truncate">{loading ? '...' : accountTypeLabel(profile?.account_type)}</span>
        </div>
        {error && <p className="text-[11px] font-bold text-red-500 text-right">{error}</p>}
      </div>
      {children}
      <div className="my-1 border-t border-slate-100" />
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-right"
      >
        <LogOut size={16} />
        <span>יציאה</span>
      </button>
    </div>
  );
};

export default ProfileMenuContent;
