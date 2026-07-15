import React from 'react';
import { LogOut, Shield, MessageSquare } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import AppNav from './AppNav';
import SmsInApp from './sms-in/SmsInApp';
import { usePermission } from '../hooks/usePermission';

interface SmsInPageProps {
  token: string | null;
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    isImpersonating?: boolean;
  } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenSessions?: (phone?: string) => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
}

const SmsInPage: React.FC<SmsInPageProps> = ({
  token: _token,
  currentUser,
  onBack,
  onLogout,
  onOpenSessions,
  onOpenContacts,
  onOpenGroups,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSubUsers,
  onStopImpersonation,
}) => {
  const can = usePermission(currentUser as any);
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} />

      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0" dir="ltr">
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer" onClick={onBack} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg text-xs font-bold">
            <MessageSquare size={14} />
            <span>SMS נכנס</span>
          </div>
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name ?? currentUser.email}</span>
          )}
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button onClick={onOpenAdminPanel} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors">
              <Shield size={18} /> פאנל ניהול
            </button>
          )}
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
            onClick={onBack}
          >
            {firstName}
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden flex">
        <AppNav
          mode="sidebar"
          activePage="sms_in"
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
          onGroups={onOpenGroups}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />

        <div className="flex-1 overflow-hidden min-w-0">
          <SmsInApp
            embedded
            userEmail={currentUser?.email}
            userId={currentUser?.id}
            userName={currentUser?.name}
            isAdmin={currentUser?.role === 'admin' && !currentUser?.isImpersonating}
            token={_token}
          />
        </div>
      </div>
    </div>
  );
};

export default SmsInPage;
