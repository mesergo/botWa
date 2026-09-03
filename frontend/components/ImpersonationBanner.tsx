import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCog, Repeat } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

export interface SiblingAccount {
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
  /** When true, suppress the "switch account" banner (e.g. it's rendered elsewhere, like a profile menu). Impersonation banner is unaffected. */
  hideAccountSwitcher?: boolean;
  /** Called whenever the list of sibling accounts (same email) is fetched/updated. */
  onAccountsChange?: (accounts: SiblingAccount[]) => void;
}

const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ currentUser, onStopImpersonation, token, onSwitchAccount, hideAccountSwitcher, onAccountsChange }) => {
  const { t } = useTranslation('nav');
  const [siblingAccounts, setSiblingAccounts] = useState<SiblingAccount[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const isImpersonating = !!currentUser?.isImpersonating;

  useEffect(() => {
    if (!token || !currentUser || isImpersonating || !onSwitchAccount) {
      setSiblingAccounts([]);
      onAccountsChange?.([]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/auth/my-accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : { accounts: [] }))
      .then(data => { if (!cancelled) { setSiblingAccounts(data.accounts || []); onAccountsChange?.(data.accounts || []); } })
      .catch(() => { if (!cancelled) { setSiblingAccounts([]); onAccountsChange?.([]); } });
    return () => { cancelled = true; };
  }, [token, currentUser, isImpersonating, onSwitchAccount]);

  if (isImpersonating) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0">
        {onStopImpersonation && (
          <button
            onClick={onStopImpersonation}
            className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors"
          >
            {t('impersonation.exit')}
          </button>
        )}
        <div className="flex items-center gap-3">
          <span className="font-bold">{t('impersonation.banner', { name: currentUser?.name || currentUser?.email })}</span>
          <UserCog className="w-5 h-5" />
        </div>
      </div>
    );
  }

  if (!onSwitchAccount || siblingAccounts.length === 0 || hideAccountSwitcher) return null;

  return (
    <div className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0">
      <div className="relative">
        <button
          onClick={() => setShowSwitcher(v => !v)}
          className="bg-white text-teal-600 px-4 py-2 rounded-lg font-bold hover:bg-teal-50 transition-colors"
        >
          {t('impersonation.switchAccount')}
        </button>
        {showSwitcher && (
          <div className="absolute top-full mt-2 start-0 bg-white rounded-xl shadow-2xl border border-slate-100 min-w-[220px] z-40 text-start overflow-hidden">
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
        <span className="font-bold">{t('impersonation.connectedAs', { name: currentUser?.name || currentUser?.email })}</span>
        <Repeat className="w-5 h-5" />
      </div>
    </div>
  );
};

export default ImpersonationBanner;

