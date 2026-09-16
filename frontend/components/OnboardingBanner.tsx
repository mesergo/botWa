import React from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket } from 'lucide-react';

interface OnboardingBannerProps {
  currentUser?: { onboarding?: { completed?: boolean; current_step?: string } } | null;
}

// Points at the standalone /reg onboarding wizard (reg_mesergo), which resumes the
// caller at their saved step via GET /api/auth/onboarding (same-origin auth token).
const REG_URL = '/reg/';

const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ currentUser }) => {
  const { t } = useTranslation('nav');

  if (!currentUser?.onboarding || currentUser.onboarding.completed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-sky-500 text-white px-6 py-3 flex items-center justify-between z-30 flex-shrink-0">
      <a
        href={REG_URL}
        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
      >
        {t('onboarding.resumeButton')}
      </a>
      <div className="flex items-center gap-3">
        <span className="font-bold">{t('onboarding.banner')}</span>
        <Rocket className="w-5 h-5" />
      </div>
    </div>
  );
};

export default OnboardingBanner;
