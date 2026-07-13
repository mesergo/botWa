import React from 'react';
import { Bot, MessageSquare, Users, Settings, LogOut, Shield, ArrowLeft, LayoutDashboard, Layers } from 'lucide-react';
import { User } from '../types';
import { usePermission } from '../hooks/usePermission';
import DashboardStats from './DashboardStats';
import ImpersonationBanner from './ImpersonationBanner';

interface HomePageProps {
  currentUser: User | null;
  onGoToBots: () => void;
  onGoToChats: () => void;
  onGoToContacts: () => void;
  onGoToSettings: () => void;
  onOpenAdminPanel?: () => void;
  onLogout: () => void;
  onStopImpersonation?: () => void;
}

// Sidebar nav items definition
type NavId = 'home' | 'bots' | 'chats' | 'contacts' | 'settings';

interface SideNavItem {
  id: NavId;
  label: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  color: string;
  permission?: string;
  adminOnly?: boolean;
}

const SIDE_NAV: SideNavItem[] = [
  { id: 'home',     label: 'סקירה כללית',  Icon: LayoutDashboard, color: 'text-blue-600' },
  { id: 'bots',     label: 'הבוטים שלי',   Icon: Bot,             color: 'text-blue-600',    permission: 'bots.view_tab' },
  { id: 'chats',    label: 'שיחות',         Icon: MessageSquare,   color: 'text-emerald-600', permission: 'sessions.view' },
  { id: 'contacts', label: 'אנשי קשר',     Icon: Users,           color: 'text-violet-600',  permission: 'contacts.view' },
  { id: 'settings', label: 'הגדרות',        Icon: Settings,        color: 'text-slate-500',   permission: 'settings.view' },
];

const tiles = [
  {
    id: 'bots' as const,
    label: 'הבוטים שלי',
    description: 'נהל, ערוך וצור בוטים חדשים',
    icon: Bot,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'hover:border-blue-200',
    badge: null,
  },
  {
    id: 'chats' as const,
    label: 'השיחות שלי',
    description: 'צפה ונהל שיחות פעילות',
    icon: MessageSquare,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'hover:border-emerald-200',
    badge: null,
  },
  {
    id: 'contacts' as const,
    label: 'אנשי קשר',
    description: 'נהל את רשימת אנשי הקשר',
    icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'hover:border-violet-200',
    badge: null,
  },
  {
    id: 'settings' as const,
    label: 'הגדרות',
    description: 'הגדרות חשבון ופרופיל',
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
  onGoToSettings,
  onOpenAdminPanel,
  onLogout,
  onStopImpersonation,
}) => {
  const can = usePermission(currentUser);

  const visibleTiles = tiles.filter(({ id }) => {
    if (id === 'bots')     return can('bots.view_tab');
    if (id === 'chats')    return can('sessions.view');
    if (id === 'contacts') return can('contacts.view');
    if (id === 'settings') return can('settings.view');
    return true;
  });

  const handleTile = (id: typeof tiles[number]['id']) => {
    if (id === 'bots') onGoToBots();
    else if (id === 'chats') onGoToChats();
    else if (id === 'contacts') onGoToContacts();
    else if (id === 'settings') onGoToSettings();
  };

  const initial = (currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase();
  const accountLabel =
    currentUser?.account_type === 'Trial' ? 'ניסיוני'
    : currentUser?.account_type ?? '';

  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} />

      <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-l border-slate-100 flex flex-col flex-shrink-0">

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
          <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">ברוך הבא</p>
          <p className="text-slate-900 font-bold text-lg text-center leading-snug">
            {currentUser?.name ?? 'משתמש'}
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
              חשבון {accountLabel}
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-3 pt-5">
          <p className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">תפריט</p>
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-800 rounded-xl font-semibold text-sm transition-all duration-200 w-full group"
            >
              <Shield size={18} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600" />
              <span className="tracking-tight">ניהול מערכת</span>
            </button>
          )}
          {SIDE_NAV.filter(({ permission }) => !permission || can(permission as any)).map(({ id, label, Icon }) => {
            const isActive = id === 'home';
            const handler =
              id === 'bots'     ? onGoToBots
              : id === 'chats'    ? onGoToChats
              : id === 'contacts' ? onGoToContacts
              : id === 'settings' ? onGoToSettings
              : undefined;
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
                    className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full"
                    style={{ backgroundColor: 'rgb(37 99 235)' }}
                  />
                )}
                <Icon
                  size={18}
                  className={`flex-shrink-0 transition-colors ${isActive ? '' : 'text-slate-400 group-hover:text-slate-600'}`}
                />
                <span className="tracking-tight">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="mt-auto px-4 pb-6">
          <button
            onClick={onLogout}
            className="flex items-center gap-2.5 px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium w-full"
          >
            <LogOut size={15} />
            התנתק
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-2 py-10">

          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">לוח בקרה</h1>
            <p className="text-slate-400 text-sm mt-1">{today}</p>
          </div>

          {/* Stats */}
          <DashboardStats />

          {/* Nav tiles */}
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">ניווט מהיר</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {visibleTiles.map(({ id, label, description, icon: Icon, color, bg, border }) => (
              <button
                key={id}
                onClick={() => handleTile(id)}
                className={`group bg-white border border-slate-100 ${border} rounded-2xl p-7 flex items-center gap-6 text-right shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              >
                <div className={`w-16 h-16 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                  <Icon size={28} className={color} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-lg leading-snug">{label}</p>
                  <p className="text-slate-400 text-sm font-medium mt-1 leading-snug">{description}</p>
                </div>
                <ArrowLeft size={18} className="text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
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

