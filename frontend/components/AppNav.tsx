import React from 'react';
import { Bot, List, Users, Layers, Settings, UserCog, Home } from 'lucide-react';

export type NavPage = 'bots' | 'sessions' | 'contacts' | 'groups' | 'settings' | 'users';

interface AppNavProps {
  /** The currently active page — shown highlighted, button disabled */
  activePage: NavPage;
  /** Pass a handler to show the item; omit (undefined) to hide it */
  onBots?: () => void;
  onSessions?: () => void;
  onContacts?: () => void;
  onGroups?: () => void;
  onSettings?: () => void;
  onUsers?: () => void;
  /** Navigate back to the home / dashboard overview page */
  onGoHome?: () => void;
  /** 'sidebar' = vertical panel (right side), 'tabs' = horizontal pill bar in navbar */
  mode?: 'sidebar' | 'tabs';
}

const NAV_ITEMS: { key: NavPage; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'bots',     label: 'הבוטים שלי', Icon: Bot },
  { key: 'sessions', label: 'שיחות',       Icon: List },
  { key: 'contacts', label: 'אנשי קשר',   Icon: Users },
  { key: 'groups',   label: 'רשימות תפוצה', Icon: Layers },
  { key: 'settings', label: 'הגדרות',      Icon: Settings },
  { key: 'users',    label: 'משתמשים',     Icon: UserCog },
];

const AppNav: React.FC<AppNavProps> = ({
  activePage,
  onBots,
  onSessions,
  onContacts,
  onGroups,
  onSettings,
  onUsers,
  onGoHome,
  mode = 'sidebar',
}) => {
  const handlers: Partial<Record<NavPage, () => void>> = {
    bots: onBots,
    sessions: onSessions,
    contacts: onContacts,
    groups: onGroups,
    settings: onSettings,
    users: onUsers,
  };

  // Show an item if a handler was provided for it, or it is the active page
  const visibleItems = NAV_ITEMS.filter(({ key }) => handlers[key] !== undefined || key === activePage);

  if (mode === 'sidebar') {
    return (
      <aside
        className="w-64 bg-white border-l border-slate-100 flex flex-col py-4 px-3 gap-1 z-10 overflow-y-auto"
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.03)' }}
        dir="rtl"
      >
        {onGoHome && (
          <>
            <button
              onClick={onGoHome}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 w-full text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            >
              <Home size={20} className="flex-shrink-0 text-slate-400" />
              <span className="tracking-tight">דף הבית</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
          </>
        )}
        {visibleItems.map(({ key, label, Icon }) => {
          const isActive = key === activePage;
          return (
            <button
              key={key}
              onClick={handlers[key]}
              disabled={isActive && !handlers[key]}
              className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 w-full group overflow-hidden ${
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
                size={20}
                className={`flex-shrink-0 transition-colors ${
                  isActive
                    ? ''
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span className="tracking-tight">{label}</span>
            </button>
          );
        })}
      </aside>
    );
  }

  // tabs mode — horizontal pill bar
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir="rtl">
      {onGoHome && (
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all text-slate-500 hover:text-slate-700"
        >
          <Home size={16} />
          דף הבית
        </button>
      )}
      {visibleItems.map(({ key, label, Icon }) => {
        const isActive = key === activePage;
        return (
          <button
            key={key}
            onClick={handlers[key]}
            disabled={isActive && !handlers[key]}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm cursor-default'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default AppNav;
