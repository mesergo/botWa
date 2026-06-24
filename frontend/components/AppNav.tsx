import React from 'react';
import { Bot, List, Users, Layers, Settings, UserCog } from 'lucide-react';

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
  /** 'sidebar' = vertical panel (right side), 'tabs' = horizontal pill bar in navbar */
  mode?: 'sidebar' | 'tabs';
}

const NAV_ITEMS: { key: NavPage; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: 'bots',     label: 'הבוטים שלי', Icon: Bot },
  { key: 'sessions', label: 'שיחות',       Icon: List },
  { key: 'contacts', label: 'אנשי קשר',   Icon: Users },
  { key: 'groups',   label: 'קבוצות',      Icon: Layers },
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
      <aside className="w-60 bg-white border-l border-slate-100 flex flex-col py-4 px-3 gap-1 shadow-sm z-10 overflow-y-auto" dir="rtl">
        {visibleItems.map(({ key, label, Icon }) => {
          const isActive = key === activePage;
          return (
            <button
              key={key}
              onClick={handlers[key]}
              disabled={isActive}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all w-full ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 cursor-default'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          );
        })}
      </aside>
    );
  }

  // tabs mode — horizontal pill bar
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir="rtl">
      {visibleItems.map(({ key, label, Icon }) => {
        const isActive = key === activePage;
        return (
          <button
            key={key}
            onClick={handlers[key]}
            disabled={isActive}
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
