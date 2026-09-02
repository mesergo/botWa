import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import MigrationNoticeBanner from './MigrationNoticeBanner';
import AppNav from './AppNav';
import PageTopBar from './PageTopBar';
import SmsInApp from './sms-in/SmsInApp';
import { usePermission } from '../hooks/usePermission';
import { useTranslation } from 'react-i18next';

interface SmsInPageProps {
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
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onSwitchAccount?: (accountId: string) => void;
}

const SmsInPage: React.FC<SmsInPageProps> = ({
  token: _token,
  currentUser,
  onBack,
  onLogout,
  onOpenSessions,
  onOpenContacts,
  onOpenGroups,
  onOpenSendMessages,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSubUsers,
  onStopImpersonation,
  onSwitchAccount,
}) => {
  const { t } = useTranslation('smsIn');
  const can = usePermission(currentUser as any);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-start overflow-hidden">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} token={_token} onSwitchAccount={onSwitchAccount} />
      <MigrationNoticeBanner />

      <PageTopBar
        token={_token}
        currentUser={currentUser}
        onBack={onBack}
        onLogout={onLogout}
        onOpenAdminPanel={onOpenAdminPanel}
        sidebarHandlesProfile
        showMobileNavToggle
        mobileNavOpen={mobileNavOpen}
        onMobileNavToggle={() => setMobileNavOpen((prev) => !prev)}
        badge={{ label: t('page.badge'), icon: <MessageSquare size={14} />, className: 'bg-sky-50 text-sky-700' }}
      />

      <div className="flex-1 overflow-hidden flex">
        <AppNav
          mode="sidebar"
          activePage="sms_in"
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
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />

        <div className="flex-1 overflow-hidden min-w-0">
          <SmsInApp
            embedded
            userEmail={currentUser?.email}
            userId={currentUser?.id}
            userName={currentUser?.name}
            // Admin user accounts see only lines assigned to them.
            // Full inbox lives in פאנל ניהול.
            isAdmin={false}
            token={_token}
          />
        </div>
      </div>
    </div>
  );
};

export default SmsInPage;
