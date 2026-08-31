import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '../../i18n';

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  scheduleDateTime: string;
  setScheduleDateTime: (v: string) => void;
  sending: boolean;
  onConfirm: (scheduledAtMs: number) => void;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({
  open, onClose, scheduleDateTime, setScheduleDateTime, sending, onConfirm,
}) => {
  const { t, i18n } = useTranslation('messages');
  if (!open) return null;

  const minDatetime = (() => {
    const now = new Date(Date.now() + 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  })();

  const handleConfirm = () => {
    if (!scheduleDateTime) return;
    const ms = new Date(scheduleDateTime).getTime();
    if (isNaN(ms) || ms <= Date.now()) {
      alert(t('schedule.futureValidation'));
      return;
    }
    onClose();
    onConfirm(ms);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">

        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar size={18} /> {t('schedule.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <label className="text-xs font-black text-slate-500 mb-2 block">{t('schedule.label')}</label>
          <input
            type="datetime-local"
            value={scheduleDateTime}
            onChange={e => setScheduleDateTime(e.target.value)}
            min={minDatetime}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600"
          />
          {scheduleDateTime && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {t('schedule.willSendAt', { date: new Date(scheduleDateTime).toLocaleString(getFormatLocale(i18n.resolvedLanguage)) })}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-sm"
          >
            {t('schedule.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!scheduleDateTime || sending}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            <Calendar size={15} /> {t('schedule.confirm')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ScheduleDialog;
