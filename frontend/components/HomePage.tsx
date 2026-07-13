import React from 'react';
import { Bot, MessageSquare, Users, Settings, LogOut, Shield, ArrowLeft, Inbox } from 'lucide-react';
import { User } from '../types';
import { usePermission } from '../hooks/usePermission';

interface HomePageProps {
  currentUser: User | null;
  onGoToBots: () => void;
  onGoToChats: () => void;
  onGoToContacts: () => void;
  onGoToSmsIn?: () => void;
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
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    accent: 'group-hover:border-blue-200',
    arrowColor: 'text-blue-400',
    badge: null,
  },
  {
    id: 'chats' as const,
    label: 'השיחות שלי',
    description: 'צפה ונהל שיחות פעילות',
    icon: MessageSquare,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accent: 'group-hover:border-emerald-200',
    arrowColor: 'text-emerald-400',
    badge: null,
  },
  {
    id: 'contacts' as const,
    label: 'אנשי קשר',
    description: 'נהל את רשימת אנשי הקשר',
    icon: Users,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    accent: 'group-hover:border-violet-200',
    arrowColor: 'text-violet-400',
    badge: null,
  },
  {
    id: 'sms_in' as const,
    label: 'SMS נכנס',
    description: 'הודעות SMS נכנסות וניתוב קווים',
    icon: Inbox,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    accent: 'group-hover:border-sky-200',
    arrowColor: 'text-sky-400',
    badge: null,
  },
  {
    id: 'settings' as const,
    label: 'הגדרות',
    description: 'הגדרות חשבון ופרופיל',
    icon: Settings,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    accent: 'group-hover:border-slate-300',
    arrowColor: 'text-slate-400',
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
}) => {
  const can = usePermission(currentUser);

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
    currentUser?.account_type === 'Trial' ? 'ניסיוני'
    : currentUser?.account_type ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">

      {/* ── Top Nav ── */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 md:px-12 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onLogout}
            title="התנתק"
            className="p-2.5 text-slate-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
          >
            <LogOut size={20} />
          </button>
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer hover:scale-105 transition-transform" onClick={onGoToBots} />
        </div>
        <div className="flex items-center gap-3">
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors border border-blue-100"
            >
              <Shield size={16} />
              ניהול
            </button>
          )}
          <div
            title={currentUser?.name || currentUser?.email || ''}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
            onClick={onGoToBots}
          >
            {initial}
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-24 pb-10">

        {/* Greeting */}
        <div className="text-center mb-10">
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">ברוך הבא</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {currentUser?.name ?? 'משתמש'}
          </h1>
          {accountLabel && (
            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold border ${
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

        {/* Tiles */}
        <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6">
          {visibleTiles.map(({ id, label, description, icon: Icon, iconBg, iconColor, accent, arrowColor }) => (
            <button
              key={id}
              onClick={() => handleTile(id)}
              className={`group bg-white border-2 border-slate-100 ${accent} rounded-[2rem] p-8 flex items-center gap-6 text-right shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-600/20`}
            >
              {/* Icon */}
              <div className={`w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                <Icon size={30} className={iconColor} strokeWidth={2} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 text-xl leading-tight">{label}</p>
                <p className="text-slate-400 text-sm font-medium mt-1.5 leading-snug">{description}</p>
              </div>

              {/* Arrow */}
              <ArrowLeft size={20} className={`${arrowColor} flex-shrink-0 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200`} />
            </button>
          ))}
        </div>

      </main>

    </div>
  );
};

export default HomePage;
