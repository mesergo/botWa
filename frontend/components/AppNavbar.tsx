import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, List, Users, Settings, UserCog, Shield, LogOut } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';

export type NavTab = 'bots' | 'sessions' | 'contacts' | 'settings' | 'users';

interface AppNavbarProps {
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  activeTab: NavTab;
  onLogout: () => void;
  onNavigateBots?: () => void;
  onNavigateSessions?: () => void;
  onNavigateContacts?: () => void;
  onNavigateSettings?: () => void;
  onNavigateSubUsers?: () => void;
  onOpenAdminPanel?: () => void;
  onLogoClick?: () => void;
}

const AppNavbar: React.FC<AppNavbarProps> = ({
  currentUser,
  activeTab,
  onLogout,
  onNavigateBots,
  onNavigateSessions,
  onNavigateContacts,
  onNavigateSettings,
  onNavigateSubUsers,
  onOpenAdminPanel,
  onLogoClick,
}) => {
  const { t } = useTranslation('nav');
  const isRep = currentUser?.role === 'rep';
  const firstName = (currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase();

  const tabBtn = (tab: NavTab, icon: React.ReactNode, label: string, onClick?: () => void) => (
    <button
      key={tab}
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
        activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon} {label}
    </button>
  );

  const showSessions = !!onNavigateSessions || activeTab === 'sessions';
  const showContacts = !!onNavigateContacts || activeTab === 'contacts';
  const showSettings = !!onNavigateSettings || activeTab === 'settings';
  const showSubUsers = !!onNavigateSubUsers || activeTab === 'users';

  return (
    <nav
      className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0"
      dir="ltr"
    >
      {/* Logo */}
      <div className="flex items-center gap-4">
        <img
          src="/images/mesergo-logo.png"
          alt="Logo"
          className={`h-10 w-auto${onLogoClick ? ' cursor-pointer' : ''}`}
          onClick={onLogoClick}
        />
      </div>

      {/* Navigation tabs — hidden for pure rep users */}
      {!isRep && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir="rtl">
          {tabBtn('bots', <Bot size={16} />, t('pages.bots'), onNavigateBots)}
          {showSessions && tabBtn('sessions', <List size={16} />, t('pages.sessions'), onNavigateSessions)}
          {showContacts && tabBtn('contacts', <Users size={16} />, t('pages.contacts'), onNavigateContacts)}
          {showSettings && tabBtn('settings', <Settings size={16} />, t('pages.settings'), onNavigateSettings)}
          {showSubUsers && tabBtn('users', <UserCog size={16} />, t('pages.users'), onNavigateSubUsers)}
        </div>
      )}

      {/* Right side: greeting + admin button + avatar + logout */}
      <div className="flex items-center gap-4">
        {currentUser && (
          <span className="text-sm font-bold text-slate-600">{t('topBar.greeting', { name: currentUser.name || currentUser.email })}</span>
        )}
        <LanguageSwitcher variant="bar" />
        {currentUser?.role === 'admin' && !currentUser?.isImpersonating && onOpenAdminPanel && (
          <button
            onClick={onOpenAdminPanel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
          >
            <Shield size={18} />
            {t('pages.adminPanel')}
          </button>
        )}
        <div
          title={currentUser?.name || currentUser?.email || ''}
          onClick={onNavigateSettings}
          className={`w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none${onNavigateSettings ? ' cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        >
          {firstName}
        </div>
        <button
          onClick={onLogout}
          className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
        >
          <LogOut size={22} />
        </button>
      </div>
    </nav>
  );
};

export default AppNavbar;
