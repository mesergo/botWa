import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, List, Users, Settings, UserCog, Home, MessageSquare, Send, Menu, X, LogOut, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type NavPage = 'bots' | 'sessions' | 'contacts' | 'groups'| 'send_messages' | 'sms_in' | 'settings' | 'users';

const NAV_PATHS: Record<NavPage, string> = {
  bots:     '/dashboard',
  sessions: '/sessions',
  contacts: '/contacts',
  groups:   '/groups',
  send_messages: '/send-messages',
  settings: '/settings',
  sms_in:   '/sms-in',
  users:    '/users',
};

interface AppNavCurrentUser {
  name?: string;
  email?: string;
  role?: string;
  account_type?: string;
  isImpersonating?: boolean;
}

interface AppNavProps {
  /** Explicit active page override — if omitted, derived from the current URL */
  activePage?: NavPage;
  /** Pass a handler to show the item; omit (undefined) to hide it */
  onBots?: () => void;
  onSessions?: () => void;
  onContacts?: () => void;
  onGroups?: () => void;
  onSendMessages?: () => void;
  onSmsIn?: () => void;
  onSettings?: () => void;
  onUsers?: () => void;
  /** Navigate back to the home / dashboard overview page */
  onGoHome?: () => void;
  /** Shown in the sidebar's profile card (logo/avatar/name/email/account badge), like HomePage's sidebar */
  currentUser?: AppNavCurrentUser | null;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  /** 'sidebar' = vertical panel (right side), 'tabs' = horizontal pill bar in navbar */
  mode?: 'sidebar' | 'tabs';
  /** Controls mobile drawer state externally (recommended with PageTopBar) */
  mobileMenuOpen?: boolean;
  /** Called whenever mobile drawer should open/close */
  onMobileMenuOpenChange?: (open: boolean) => void;
  /** Hide built-in mobile trigger when using a top-bar trigger */
  hideMobileTrigger?: boolean;
  /** Max width (px) considered mobile drawer mode */
  mobileBreakpoint?: number;
}

const NAV_ITEMS: { key: NavPage; labelKey: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'bots',     labelKey: 'pages.bots',         Icon: Bot },
  { key: 'sessions', labelKey: 'pages.sessions',     Icon: List },
  { key: 'contacts', labelKey: 'pages.contacts',     Icon: Users },
  { key: 'send_messages', labelKey: 'pages.sendMessages', Icon: Send },
  { key: 'sms_in',   labelKey: 'pages.smsIn',        Icon: MessageSquare },
  { key: 'settings', labelKey: 'pages.settings',     Icon: Settings },
  { key: 'users',    labelKey: 'pages.users',        Icon: UserCog },
];

const AppNav: React.FC<AppNavProps> = ({
  activePage: activePageProp,
  onBots,
  onSessions,
  onContacts,
  onGroups,
  onSendMessages,
  onSmsIn,
  onSettings,
  onUsers,
  onGoHome,
  currentUser,
  onLogout,
  onOpenAdminPanel,
  mode = 'sidebar',
  mobileMenuOpen,
  onMobileMenuOpenChange,
  hideMobileTrigger = false,
  mobileBreakpoint = 900,
}) => {
  const { t, i18n } = useTranslation('nav');
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileNav, setIsMobileNav] = useState<boolean>(() => window.innerWidth <= mobileBreakpoint);
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);

    const updateMobileState = (event: MediaQueryListEvent | MediaQueryList) => {
      const mobile = event.matches;
      setIsMobileNav(mobile);
      if (!mobile) {
        setInternalMenuOpen(false);
      }
    };

    updateMobileState(mediaQuery);

    const handleChange = (event: MediaQueryListEvent) => updateMobileState(event);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mobileBreakpoint]);

  useEffect(() => {
    if (isMobileNav) {
      if (mobileMenuOpen !== undefined) {
        onMobileMenuOpenChange?.(false);
      } else {
        setInternalMenuOpen(false);
      }
    }
  }, [location.pathname, isMobileNav, onMobileMenuOpenChange]);

  // Derive active page from URL, fall back to explicit prop
  const activeFromUrl = (Object.entries(NAV_PATHS) as [NavPage, string][])
    .find(([, path]) => location.pathname === path)?.[0];
  const activePage: NavPage = activeFromUrl ?? activePageProp ?? 'bots';

  const handlers: Partial<Record<NavPage, () => void>> = {
    bots: onBots,
    sessions: onSessions,
    contacts: onContacts,
    groups: onGroups,
    send_messages: onSendMessages,
    sms_in: onSmsIn,
    settings: onSettings,
    users: onUsers,
  };

  // Show an item if a handler was provided for it, or it is the active page
  const visibleItems = NAV_ITEMS.filter(({ key }) => handlers[key] !== undefined || key === activePage);

  const menuOpen = mobileMenuOpen ?? internalMenuOpen;
  const setMenuOpen = (open: boolean) => {
    if (mobileMenuOpen === undefined) {
      setInternalMenuOpen(open);
    }
    onMobileMenuOpenChange?.(open);
  };

  // Profile card data — mirrors HomePage's sidebar
  const initial = (currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase();
  const accountLabel = currentUser?.account_type === 'Trial' ? 'ניסיוני' : currentUser?.account_type ?? '';

  const renderProfileSection = () => (
    <>
      <div className="flex flex-col items-center pt-8 px-6 pb-6 border-b border-slate-100 flex-shrink-0">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md select-none mb-3">
          {initial}
        </div>
        <p className="text-slate-900 font-bold text-sm text-center leading-snug truncate max-w-full">
          {currentUser?.name ?? 'משתמש'}
        </p>
        {currentUser?.email && (
          <p className="text-slate-400 text-xs mt-1 text-center break-all leading-snug">
            {currentUser.email}
          </p>
        )}
        {accountLabel && (
          <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            currentUser?.account_type === 'Premium'
              ? 'bg-amber-50 text-amber-600 border-amber-100'
              : currentUser?.account_type === 'Trial'
              ? 'bg-orange-50 text-orange-600 border-orange-100'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            חשבון {accountLabel}
          </span>
        )}
      </div>
    </>
  );

  const renderAdminButton = () => (
    currentUser?.role === 'admin' && onOpenAdminPanel ? (
      <button
        onClick={onOpenAdminPanel}
        className="flex items-center gap-3 px-4 py-3.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-xl font-bold text-sm transition-all duration-200 w-full group"
      >
        <Shield size={20} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
        <span className="tracking-tight">ניהול מערכת</span>
      </button>
    ) : null
  );

  const renderLogoutButton = () => (
    onLogout ? (
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium w-full"
        >
          <LogOut size={15} />
          התנתק
        </button>
      </div>
    ) : null
  );

  const renderNavButtons = (iconSize: number, dense: boolean) => (
    <>
      {renderAdminButton()}
      {onGoHome && (
        <>
          <button
            onClick={onGoHome}
            className={`flex items-center gap-3 px-4 ${dense ? 'py-3' : 'py-3.5'} rounded-xl font-bold text-sm transition-all duration-200 w-full text-slate-500 hover:bg-slate-50 hover:text-slate-800`}
          >
            <Home size={iconSize} className="flex-shrink-0 text-slate-400" />
            <span className="tracking-tight">{t('pages.home')}</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
        </>
      )}

      {visibleItems.map(({ key, labelKey, Icon }) => {
        const isActive = key === activePage;
        return (
          <button
            key={key}
            onClick={() => {
              navigate(NAV_PATHS[key]);
              if (isMobileNav) {
                setMenuOpen(false);
              }
            }}
            disabled={isActive}
            className={`relative flex items-center gap-3 px-4 ${dense ? 'py-3' : 'py-3.5'} rounded-xl font-bold text-sm transition-all duration-200 w-full group overflow-hidden ${
              isActive
                ? 'cursor-default'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
            style={
              isActive
                ? {
                    background: 'linear-gradient(90deg, rgb(219 234 254) 0%, rgb(239 246 255) 100%)',
                    color: 'rgb(37 99 235)',
                  }
                : {}
            }
          >
            {isActive && (
              <span
                className="absolute start-0 top-2 bottom-2 w-1 rounded-e-full"
                style={{ backgroundColor: 'rgb(37 99 235)' }}
              />
            )}
            <Icon
              size={iconSize}
              className={`flex-shrink-0 transition-colors ${
                isActive
                  ? ''
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            <span className="tracking-tight">{t(labelKey)}</span>
          </button>
        );
      })}
    </>
  );

  if (isMobileNav) {
    return (
      <>
        {!hideMobileTrigger && (
          <div className="fixed z-40" style={{ top: '1.15rem', insetInlineStart: '-0.2rem' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t('mobileMenu.close') : t('mobileMenu.open')}
              aria-expanded={menuOpen}
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        )}

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 bg-slate-900/20 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <aside
              className="fixed start-0 top-20 bottom-0 w-64 bg-white border-e border-slate-100 flex flex-col py-4 px-3 gap-1 z-50 overflow-y-auto"
              style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.03)' }}
            >
              {renderProfileSection()}
              <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-3 pt-3">
                {renderNavButtons(20, false)}
              </nav>
              {renderLogoutButton()}
            </aside>
          </>
        )}
      </>
    );
  }

  if (mode === 'sidebar') {
    return (
      <aside
        className="w-64 bg-white border-e border-slate-100 flex flex-col py-4 px-3 gap-1 z-10 overflow-y-auto"
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.03)' }}
      >
        {renderProfileSection()}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-3 pt-3">
          {renderNavButtons(20, false)}
        </nav>
        {renderLogoutButton()}
      </aside>
    );
  }

  // tabs mode — horizontal pill bar. The surrounding top bar keeps a fixed `dir="ltr"` arrangement,
  // so the tab strip cannot inherit the page direction and states it explicitly instead.
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir={i18n.dir()}>
      {onGoHome && (
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all text-slate-500 hover:text-slate-700"
        >
          <Home size={16} />
          {t('pages.home')}
        </button>
      )}
      {visibleItems.map(({ key, labelKey, Icon }) => {
        const isActive = key === activePage;
        return (
          <button
            key={key}
            onClick={() => navigate(NAV_PATHS[key])}
            disabled={isActive}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm cursor-default'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
};

export default AppNav;
