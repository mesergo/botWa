import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Shield, Menu, X } from 'lucide-react';
import ProfileMenuContent from './ProfileMenuContent';
import AnchoredDropdown from './AnchoredDropdown';
import LanguageSwitcher from './LanguageSwitcher';

interface CurrentUserLike {
  name?: string;
  email?: string;
  role?: string;
  isImpersonating?: boolean;
} 

interface PageTopBarProps {
  token?: string | null;
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
  /** Hide the logo, logout button and admin-panel button — use when the page's AppNav sidebar already renders them. */
  sidebarHandlesProfile?: boolean;
}

interface MobileNavToggleProps {
  open: boolean;
  onToggle?: () => void;
}

export const MobileNavToggle: React.FC<MobileNavToggleProps> = ({ open, onToggle }) => {
  const { t } = useTranslation('nav');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? t('mobileMenu.close') : t('mobileMenu.open')}
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
};

const PageTopBar: React.FC<PageTopBarProps> = ({
  token,
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
  sidebarHandlesProfile = false,
}) => {
  const { t } = useTranslation('nav');
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 900);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileWrapperRef = React.useRef<HTMLDivElement>(null);

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
        {!sidebarHandlesProfile && (
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
        )}
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
        <LanguageSwitcher variant="bar" />
        {currentUser?.role === 'admin' && onOpenAdminPanel && (
          <button onClick={onOpenAdminPanel} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors">
            <Shield size={18} /> {t('pages.adminPanel')}
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
            <AnchoredDropdown anchorRef={profileWrapperRef} open={profileMenuOpen} onClose={() => setProfileMenuOpen(false)} align="right">
              <ProfileMenuContent
                token={token ?? null}
                currentUser={currentUser}
                onLogout={() => { setProfileMenuOpen(false); onLogout(); }}
              />
            </AnchoredDropdown>
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
