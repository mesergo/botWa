import React, { useEffect, useState } from 'react';
import { UserCog, Repeat } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface SiblingAccount {
  id: string;
  name: string;
  account_type: string;
  role: string;
  created_at: string;
}

interface ImpersonationBannerProps {
  currentUser?: { name?: string; email?: string; isImpersonating?: boolean } | null;
  onStopImpersonation?: () => void;
  token?: string | null;
  onSwitchAccount?: (accountId: string) => void;
}

const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ currentUser, onStopImpersonation, token, onSwitchAccount }) => {
  const [siblingAccounts, setSiblingAccounts] = useState<SiblingAccount[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const isImpersonating = !!currentUser?.isImpersonating;

  useEffect(() => {
    if (!token || !currentUser || isImpersonating || !onSwitchAccount) {
      setSiblingAccounts([]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/auth/my-accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : { accounts: [] }))
      .then(data => { if (!cancelled) setSiblingAccounts(data.accounts || []); })
      .catch(() => { if (!cancelled) setSiblingAccounts([]); });
    return () => { cancelled = true; };
  }, [token, currentUser, isImpersonating, onSwitchAccount]);

  if (isImpersonating) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0" dir="rtl">
        {onStopImpersonation && (
          <button
            onClick={onStopImpersonation}
            className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors"
          >
            חזור למצב מנהל
          </button>
        )}
        <div className="flex items-center gap-3">
          <span className="font-bold">מצב התחזות - אתה רואה את המערכת כמשתמש: {currentUser?.name || currentUser?.email}</span>
          <UserCog className="w-5 h-5" />
        </div>
      </div>
    );
  }

  if (!onSwitchAccount || siblingAccounts.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0" dir="rtl">
      <div className="relative">
        <button
          onClick={() => setShowSwitcher(v => !v)}
          className="bg-white text-teal-600 px-4 py-2 rounded-lg font-bold hover:bg-teal-50 transition-colors"
        >
          החלף חשבון
        </button>
        {showSwitcher && (
          <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-2xl border border-slate-100 min-w-[220px] z-40 text-right overflow-hidden">
            {siblingAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setShowSwitcher(false); onSwitchAccount(acc.id); }}
                className="w-full px-4 py-3 text-slate-700 hover:bg-slate-50 flex flex-col items-end border-b border-slate-100 last:border-0 transition-colors"
              >
                <span className="font-bold">{acc.name}</span>
                <span className="text-xs text-slate-400">{acc.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold">מחובר : {currentUser?.name || currentUser?.email}</span>
        <Repeat className="w-5 h-5" />
      </div>
    </div>
  );
};

export default ImpersonationBanner;

