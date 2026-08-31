import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, MessageSquare, Users, Settings, LogOut, Shield, ArrowLeft, ArrowRight, LayoutDashboard, Inbox } from 'lucide-react';
import { User } from '../types';
import { usePermission } from '../hooks/usePermission';
import { getFormatLocale } from '../i18n';
import DashboardStats from './DashboardStats';
import ImpersonationBanner from './ImpersonationBanner';
import LanguageSwitcher from './LanguageSwitcher';

interface HomePageProps {
  currentUser: User | null;
  onGoToBots: () => void;
  onGoToChats: () => void;
  onGoToContacts: () => void;
  onGoToSmsIn?: () => void;
  onGoToSettings: () => void;
  onOpenAdminPanel?: () => void;
  onLogout: () => void;
  onStopImpersonation?: () => void;
  onSwitchAccount?: (accountId: string) => void;
  token?: string | null;
}

// Sidebar nav items definition
type NavId = 'home' | 'bots' | 'chats' | 'sms_in' | 'contacts' | 'settings';

interface SideNavItem {
  id: NavId;
  labelKey: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  color: string;
  permission?: string;
  adminOnly?: boolean;
}

const SIDE_NAV: SideNavItem[] = [
  { id: 'home',     labelKey: 'pages.overview',     Icon: LayoutDashboard, color: 'text-blue-600' },
  { id: 'bots',     labelKey: 'pages.bots',         Icon: Bot,             color: 'text-blue-600',    permission: 'bots.view_tab' },
  { id: 'chats',    labelKey: 'pages.sessions',     Icon: MessageSquare,   color: 'text-emerald-600', permission: 'sessions.view' },
  { id: 'sms_in',   labelKey: 'pages.smsIn',        Icon: Inbox,           color: 'text-sky-600',     permission: 'sms_in.view' },
  { id: 'contacts', labelKey: 'pages.contacts',     Icon: Users,           color: 'text-violet-600',  permission: 'contacts.view' },
  { id: 'settings', labelKey: 'pages.settings',     Icon: Settings,        color: 'text-slate-500',   permission: 'settings.view' },
];

const tiles = [
  {
    id: 'bots' as const,
    tileKey: 'bots',
    icon: Bot,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'hover:border-blue-200',
    badge: null,
  },
  {
    id: 'chats' as const,
    tileKey: 'chats',
    icon: MessageSquare,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'hover:border-emerald-200',
    badge: null,
  },
  {
    id: 'contacts' as const,
    tileKey: 'contacts',
    icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'hover:border-violet-200',
    badge: null,
  },
  {
    id: 'sms_in' as const,
    tileKey: 'smsIn',
    icon: Inbox,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    accent: 'group-hover:border-sky-200',
    arrowColor: 'text-sky-400',
    badge: null,
  },
  {
    id: 'settings' as const,
    tileKey: 'settings',
    icon: Settings,
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'hover:border-slate-300',
    badge: null,
  },
];

const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  onGoToBots,
  onGoToChats,
  onGoToContacts,
  onGoToSmsIn,
  onGoToSettings,
  onOpenAdminPanel,
  onLogout,
  onStopImpersonation,
  onSwitchAccount,
  token,
}) => {
  const { t, i18n } = useTranslation('nav');
  const can = usePermission(currentUser);
  const isRtl = i18n.dir() === 'rtl';
  // Tile "enter" affordance points along the reading direction: left in Hebrew, right in English.
  const TileArrow = isRtl ? ArrowLeft : ArrowRight;

  const getNavHandler = (id: NavId) => {
    if (id === 'bots') return onGoToBots;
    if (id === 'chats') return onGoToChats;
    if (id === 'sms_in') return onGoToSmsIn;
    if (id === 'contacts') return onGoToContacts;
    if (id === 'settings') return onGoToSettings;
    return undefined;
  };

  const mobileNavItems = SIDE_NAV.filter(({ id, permission }) => {
    if (id === 'home') return false;
    if (id === 'sms_in' && !onGoToSmsIn) return false;
    return !permission || can(permission as any);
  });

  const visibleTiles = tiles.filter(({ id }) => {
    if (id === 'bots')     return can('bots.view_tab');
    if (id === 'chats')    return can('sessions.view');
    if (id === 'contacts') return can('contacts.view');
    if (id === 'sms_in')   return can('sms_in.view') && !!onGoToSmsIn;
    if (id === 'settings') return can('settings.view');
    return true;
  });

  const handleTile = (id: typeof tiles[number]['id']) => {
    if (id === 'bots') onGoToBots();
    else if (id === 'chats') onGoToChats();
    else if (id === 'contacts') onGoToContacts();
    else if (id === 'sms_in') onGoToSmsIn?.();
    else if (id === 'settings') onGoToSettings();
  };

  const initial = (currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase();
  const accountLabel =
    currentUser?.account_type === 'Trial' ? t('profile.accountType.Trial')
    : currentUser?.account_type ?? '';

  const today = new Date().toLocaleDateString(getFormatLocale(i18n.resolvedLanguage), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-y-auto lg:overflow-hidden">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} token={token} onSwitchAccount={onSwitchAccount} />

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-64 bg-white border-e border-slate-100 flex-col flex-shrink-0">

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <img
            src="/images/mesergo-logo.png"
            alt="Logo"
            className="h-8 w-auto cursor-pointer"
            onClick={onGoToBots}
          />
        </div>

        {/* Profile */}
        <div className="flex flex-col items-center pt-10 px-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md select-none mb-4">
            {initial}
          </div>
          <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">{t('home.welcome')}</p>
          <p className="text-slate-900 font-bold text-lg text-center leading-snug">
            {currentUser?.name ?? t('home.defaultUser')}
          </p>
          {currentUser?.email && (
            <p className="text-slate-400 text-xs mt-1 text-center break-all leading-snug">
              {currentUser.email}
            </p>
          )}
          {accountLabel && (
            <span className={`inline-block mt-3 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              currentUser?.account_type === 'Premium'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : currentUser?.account_type === 'Trial'
                ? 'bg-orange-50 text-orange-600 border-orange-100'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {t('home.accountBadge', { type: accountLabel })}
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3 pt-5">
          <p className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t('home.menu')}</p>
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-xl font-semibold text-sm transition-all duration-200 w-full group"
            >
              <Shield size={18} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
              <span className="tracking-tight">{t('pages.systemAdmin')}</span>
            </button>
          )}
          {SIDE_NAV.filter(({ permission }) => !permission || can(permission as any)).map(({ id, labelKey, Icon }) => {
            const isActive = id === 'home';
            const handler = getNavHandler(id);
            return (
              <button
                key={id}
                onClick={handler}
                disabled={isActive}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 w-full group overflow-hidden ${
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
                  size={18}
                  className={`flex-shrink-0 transition-colors ${isActive ? '' : 'text-slate-400 group-hover:text-slate-600'}`}
                />
                <span className="tracking-tight">{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mt-auto px-1 pb-6">
          <div className="px-3">
            <button
              onClick={onLogout}
              className="flex items-center gap-2.5 px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium w-full"
            >
              <LogOut size={15} />
              {t('home.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 overflow-visible lg:overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">

          {/* Mobile top area */}
          <div className="lg:hidden mb-6 space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <img
                  src="/images/mesergo-logo.png"
                  alt="Logo"
                  className="h-7 w-auto cursor-pointer"
                  onClick={onGoToBots}
                />
                <div className="flex items-center gap-2">
                  <LanguageSwitcher variant="bar" />
                  <button
                    onClick={onLogout}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut size={14} />
                    {t('home.logout')}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm select-none">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-900 font-bold text-sm truncate">{currentUser?.name ?? t('home.defaultUser')}</p>
                  {currentUser?.email && (
                    <p className="text-slate-400 text-xs truncate mt-0.5">{currentUser.email}</p>
                  )}
                </div>
                {currentUser?.role === 'admin' && onOpenAdminPanel && (
                  <button
                    onClick={onOpenAdminPanel}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                    aria-label={t('pages.systemAdmin')}
                  >
                    <Shield size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                {mobileNavItems.map(({ id, labelKey, Icon }) => (
                  <button
                    key={id}
                    onClick={getNavHandler(id)}
                    className="inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <Icon size={14} className="text-slate-400" />
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Page header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('home.title')}</h1>
              <p className="text-slate-400 text-sm mt-1">{today}</p>
            </div>
            <LanguageSwitcher variant="bar" />
          </div>

          {/* Stats */}
          <DashboardStats />

          {/* Nav tiles */}
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">{t('home.quickNav')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {visibleTiles.map(({ id, tileKey, icon: Icon, color, bg, border }) => (
              <button
                key={id}
                onClick={() => handleTile(id)}
                className={`group bg-white border border-slate-100 ${border || ''} rounded-2xl p-5 sm:p-7 flex items-center gap-4 sm:gap-6 text-start shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 ${bg || 'bg-slate-100'} rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                  <Icon size={24} className={color || 'text-slate-600'} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base sm:text-lg leading-snug">{t(`home.tiles.${tileKey}.label`)}</p>
                  <p className="text-slate-400 text-sm font-medium mt-1 leading-snug">{t(`home.tiles.${tileKey}.description`)}</p>
                </div>
                <TileArrow size={18} className={`hidden sm:block text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ${isRtl ? '-translate-x-1' : 'translate-x-1'}`} />
              </button>
            ))}
          </div>

        </div>
      </main>

      </div>
    </div>
  );
};

export default HomePage;

