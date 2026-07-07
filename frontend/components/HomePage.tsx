import React from 'react';
import { Bot, MessageSquare, Users, Settings, LogOut, Shield, ArrowLeft } from 'lucide-react';
import { User } from '../types';
import { usePermission } from '../hooks/usePermission';
import DashboardStats from './DashboardStats';

interface HomePageProps {
  currentUser: User | null;
  onGoToBots: () => void;
  onGoToChats: () => void;
  onGoToContacts: () => void;
  onGoToSettings: () => void;
  onOpenAdminPanel?: () => void;
  onLogout: () => void;
}

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
    <div className="h-screen bg-slate-50 flex overflow-hidden" dir="rtl">

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

        {/* Actions */}
        <div className="flex flex-col gap-2 px-4 pt-5">
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors w-full"
            >
              <Shield size={15} />
              ניהול מערכת
            </button>
          )}
        </div>

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
  );
};

export default HomePage;

