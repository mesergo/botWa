import React from 'react';
import { UserCog } from 'lucide-react';

interface ImpersonationBannerProps {
  currentUser?: { name?: string; email?: string; isImpersonating?: boolean } | null;
  onStopImpersonation?: () => void;
}

const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ currentUser, onStopImpersonation }) => {
  if (!currentUser?.isImpersonating) return null;

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0" dir="rtl">
      {onStopImpersonation && (
        <button
          onClick={onStopImpersonation}
          className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition-colors"
        >
          חזור למצב מנהל
        </button>
      )}
      <div className="flex items-center gap-3">
        <span className="font-bold">מצב התחזות - אתה רואה את המערכת כמשתמש: {currentUser.name || currentUser.email}</span>
        <UserCog className="w-5 h-5" />
      </div>
    </div>
  );
};

export default ImpersonationBanner;
