import React, { useEffect, useState } from 'react';
import { LogOut, Shield, Menu, X } from 'lucide-react';

interface CurrentUserLike {
  name?: string;
  email?: string;
  role?: string;
  isImpersonating?: boolean;
} 

interface PageTopBarProps {
  currentUser?: CurrentUserLike | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  rightSlot?: React.ReactNode;
  badge?: {
    label: string;
    icon?: React.ReactNode;
    className?: string;
  }; 
  showMobileNavToggle?: boolean;
  mobileNavOpen?: boolean;
  onMobileNavToggle?: () => void;
  compact?: boolean;
  hideAvatar?: boolean;
}

interface MobileNavToggleProps {
  open: boolean;
  onToggle?: () => void;
}

export const MobileNavToggle: React.FC<MobileNavToggleProps> = ({ open, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={open ? 'סגור תפריט ניווט' : 'פתח תפריט ניווט'}
    aria-expanded={open}
    className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white text-slate-700 hover:bg-slate-50 transition-colors"
      style={{ marginRight: '-0.35rem' }}
  >
    {open ? (
      <X size={24} strokeWidth={2.5} />
    ) : (
      <Menu size={24} strokeWidth={2.5} className="scale-x-110" />
    )}
  </button>
);

const PageTopBar: React.FC<PageTopBarProps> = ({
  currentUser,
  onBack,
  onLogout,
  onOpenAdminPanel,
  rightSlot,
  badge,
  showMobileNavToggle = false,
  mobileNavOpen = false,
  onMobileNavToggle,
  compact = false,
  hideAvatar = false,
}) => {
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 900);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileWrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileWrapperRef.current && !profileWrapperRef.current.contains(e.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const update = (event: MediaQueryListEvent | MediaQueryList) => setIsMobile(event.matches);

    update(mediaQuery);
    const handleChange = (event: MediaQueryListEvent) => update(event);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <nav className={`${compact ? 'h-14' : 'h-20'} bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-10 z-20 flex-shrink-0`} dir="ltr">
      <div className="flex items-center gap-4">
        <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
          <LogOut size={22} />
        </button>
        <img src="/images/mesergo-logo.png" alt="Logo" className={`${compact ? 'h-8' : 'h-10'} w-auto cursor-pointer`} onClick={onBack} />
      </div>

      <div className="flex items-center gap-4">
        {badge && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${badge.className ?? ''}`}>
            {badge.icon}
            <span>{badge.label}</span>
          </div>
        )}
        {rightSlot}
        {currentUser?.role === 'admin' && onOpenAdminPanel && (
          <button onClick={onOpenAdminPanel} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors">
            <Shield size={18} /> פאנל ניהול
          </button>
        )}
        {!hideAvatar && (
          <div className="relative" ref={profileWrapperRef}>
            <button
              type="button"
              title={currentUser?.name ?? currentUser?.email ?? ''}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setProfileMenuOpen(v => !v)}
            >
              {firstName}
            </button>
            {profileMenuOpen && (
              <div dir="rtl" className="absolute top-full mt-2 left-0 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                <p className="px-4 py-1.5 text-sm font-bold text-slate-700 truncate">{currentUser?.name ?? currentUser?.email ?? ''}</p>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => { setProfileMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-right"
                >
                  <LogOut size={16} />
                  <span>יציאה</span>
                </button>
              </div>
            )}
          </div>
        )}
        {showMobileNavToggle && isMobile && (
          <MobileNavToggle open={mobileNavOpen} onToggle={onMobileNavToggle} />
        )}
      </div>
    </nav>
  );
};

export default PageTopBar;
