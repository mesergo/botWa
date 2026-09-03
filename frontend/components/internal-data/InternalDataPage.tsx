import React, { useState } from 'react';
import { Database } from 'lucide-react';
import ImpersonationBanner from '../ImpersonationBanner';
import MigrationNoticeBanner from '../MigrationNoticeBanner';
import AppNav from '../AppNav';
import PageTopBar from '../PageTopBar';
import InternalDataApp from './InternalDataApp';
import { usePermission } from '../../hooks/usePermission';

interface InternalDataPageProps {
  token: string | null;
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    isImpersonating?: boolean;
  } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenSessions?: (phone?: string) => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenSendMessages?: () => void;
  onOpenSmsIn?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onSwitchAccount?: (accountId: string) => void;
}

const InternalDataPage: React.FC<InternalDataPageProps> = ({
  token,
  currentUser,
  onBack,
  onLogout,
  onOpenSessions,
  onOpenContacts,
  onOpenGroups,
  onOpenSendMessages,
  onOpenSmsIn,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSubUsers,
  onStopImpersonation,
  onSwitchAccount,
}) => {
  const can = usePermission(currentUser as any);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} token={token} onSwitchAccount={onSwitchAccount} />
      <MigrationNoticeBanner />

      <PageTopBar
        token={token}
        currentUser={currentUser}
        onBack={onBack}
        onLogout={onLogout}
        onOpenAdminPanel={onOpenAdminPanel}
        sidebarHandlesProfile
        showMobileNavToggle
        mobileNavOpen={mobileNavOpen}
        onMobileNavToggle={() => setMobileNavOpen((prev) => !prev)}
        badge={{ label: 'ניהול דטה פנימי', icon: <Database size={14} />, className: 'bg-amber-50 text-amber-700' }}
      />

      <div className="flex-1 overflow-hidden flex">
        <AppNav
          mode="sidebar"
          activePage="internal_data"
          hideMobileTrigger
          mobileMenuOpen={mobileNavOpen}
          onMobileMenuOpenChange={setMobileNavOpen}
          onGoHome={onBack}
          currentUser={currentUser as any}
          onLogout={onLogout}
          onOpenAdminPanel={onOpenAdminPanel}
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
          onGroups={onOpenGroups}
          onSendMessages={onOpenSendMessages}
          onSmsIn={onOpenSmsIn && can('sms_in.view') ? onOpenSmsIn : undefined}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />

        <div className="flex-1 overflow-hidden min-w-0">
          <InternalDataApp token={token} />
        </div>
      </div>
    </div>
  );
};

export default InternalDataPage;
