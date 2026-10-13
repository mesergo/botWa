import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle, WifiOff, CalendarClock, AlertTriangle } from 'lucide-react';

interface DailySummarySettings {
  enabled: boolean;
  days: number[]; // 0=Sunday
  hour: number;   // 0-23, Israel time
}

interface NotificationAlertsPanelProps {
  token?: string | null; // JWT for Authorization header
  apiBase: string;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const NotificationAlertsPanel: React.FC<NotificationAlertsPanelProps> = ({ token, apiBase }) => {
  const { t } = useTranslation('dashboard');
  const dayNames = t('settings.notifications.dayNames', { returnObjects: true }) as string[];
  const [email, setEmail] = useState('');
  const [offlineEmail, setOfflineEmail] = useState(false);
  const [daily, setDaily] = useState<DailySummarySettings>({ enabled: false, days: [0, 1, 2, 3, 4], hour: 20 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyResponse = (data: any) => {
    setEmail(data.email || '');
    setOfflineEmail(Boolean(data.offlineEmail));
    if (data.dailySummary) setDaily(data.dailySummary);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch(`${apiBase}/push-notifications/alert-settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) applyResponse(data);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiBase, token]);

  const toggleDay = (day: number) => {
    setSaved(false);
    setDaily(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day].sort()
    }));
  };

  const noDays = daily.enabled && daily.days.length === 0;

  const handleSave = async () => {
    if (saving || noDays) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch(`${apiBase}/push-notifications/alert-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offlineEmail, dailySummary: daily })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || t('settings.notifications.saveError'));
        return;
      }
      applyResponse(data);
      setSaved(true);
    } catch {
      setSaveError(t('settings.notifications.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const checkboxClass = 'mt-1 w-5 h-5 accent-blue-600 cursor-pointer flex-shrink-0';

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
        <Bell size={14} /> {t('settings.notifications.heading')}
      </h2>

      {loading ? (
        <div className="text-center text-slate-400 py-10 font-bold">{t('settings.loading')}</div>
      ) : loadError ? (
        <div className="text-center text-slate-400 py-10 font-bold">{t('settings.notifications.loadError')}</div>
      ) : (
        <>
          <p className="text-sm text-slate-500 font-bold mb-2">{t('settings.notifications.intro')}</p>
          {email ? (
            <p className="text-xs text-slate-400 font-bold mb-6">{t('settings.notifications.sentTo', { email })}</p>
          ) : (
            <div className="mb-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm font-bold text-start">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {t('settings.notifications.noEmail')}
            </div>
          )}

          <div className="space-y-4">
            {/* Offline alert */}
            <label className="flex items-start gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 cursor-pointer">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={offlineEmail}
                onChange={e => { setOfflineEmail(e.target.checked); setSaved(false); }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-slate-700 mb-1">
                  <WifiOff size={16} className="text-blue-600" /> {t('settings.notifications.offlineTitle')}
                </div>
                <p className="text-xs text-slate-500 font-bold leading-relaxed">{t('settings.notifications.offlineDesc')}</p>
              </div>
            </label>

            {/* Daily summary */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4">
              <label className="flex items-start gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={daily.enabled}
                  onChange={e => { setDaily(prev => ({ ...prev, enabled: e.target.checked })); setSaved(false); }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-700 mb-1">
                    <CalendarClock size={16} className="text-blue-600" /> {t('settings.notifications.dailyTitle')}
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed">{t('settings.notifications.dailyDesc')}</p>
                </div>
              </label>

              {daily.enabled && (
                <div className="mt-4 ps-9 flex flex-col sm:flex-row gap-5">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 mb-2">{t('settings.notifications.days')}</span>
                    <div className="flex flex-wrap gap-2">
                      {dayNames.map((label, day) => {
                        const active = daily.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`min-w-[44px] px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {noDays && (
                      <p className="text-xs text-red-600 font-bold mt-2">{t('settings.notifications.noDays')}</p>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 mb-2">{t('settings.notifications.hour')}</span>
                    <select
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      value={daily.hour}
                      onChange={e => { setDaily(prev => ({ ...prev, hour: Number(e.target.value) })); setSaved(false); }}
                      dir="ltr"
                    >
                      {HOURS.map(h => (
                        <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold text-start">{saveError}</div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving || noDays}
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-95"
            >
              {saving ? t('settings.notifications.saving') : t('settings.notifications.save')}
            </button>
            {saved && (
              <span className="flex items-center gap-2 text-green-600 text-sm font-bold">
                <CheckCircle size={16} /> {t('settings.notifications.saved')}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationAlertsPanel;
