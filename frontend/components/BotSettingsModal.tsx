import React, { useEffect, useState } from 'react';
import { X, Settings, Copy, Check } from 'lucide-react';
import { BotFlow } from '../types';

const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

interface BotSettingsModalProps {
  bot: BotFlow;
  currentUser?: { role?: string; isImpersonating?: boolean; permissions?: { bots?: { publish?: boolean } } } | null;
  onClose: () => void;
  onUpdateBotPublicId?: (id: string, publicId: string) => Promise<void>;
  onConnectFacebook?: (bot: BotFlow) => void;
}

const BotSettingsModal: React.FC<BotSettingsModalProps> = ({
  bot,
  currentUser,
  onClose,
  onUpdateBotPublicId,
  onConnectFacebook,
}) => {
  const [editBotPublicId, setEditBotPublicId] = useState(bot.public_id);
  const [savingBotPublicId, setSavingBotPublicId] = useState(false);
  const [copiedBotPublicId, setCopiedBotPublicId] = useState(false);
  const [botPublicIdError, setBotPublicIdError] = useState<string | null>(null);
  const [botPublicIdSuccess, setBotPublicIdSuccess] = useState(false);

  useEffect(() => {
    setEditBotPublicId(bot.public_id);
    setBotPublicIdError(null);
    setBotPublicIdSuccess(false);
  }, [bot.id, bot.public_id]);

  const handleSave = async () => {
    if (!onUpdateBotPublicId) return;
    setSavingBotPublicId(true);
    setBotPublicIdError(null);
    setBotPublicIdSuccess(false);
    try {
      await onUpdateBotPublicId(bot.id, editBotPublicId);
      setBotPublicIdSuccess(true);
      setTimeout(() => setBotPublicIdSuccess(false), 3000);
    } catch (err: any) {
      setBotPublicIdError(err.message || 'שגיאה בשמירה');
    } finally {
      setSavingBotPublicId(false);
    }
  };

  const canShowFacebook = !!onConnectFacebook;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Settings size={18} className="text-slate-400" />
            הגדרות בוט — {bot.name}
          </h3>
        </div>

        <div className="p-8 space-y-8">
          {/* Public ID */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Copy size={12} /> מזהה ציבורי (API Token)
            </h4>
            <div className="flex gap-2">
              {onUpdateBotPublicId && (
                <button
                  onClick={handleSave}
                  disabled={savingBotPublicId || !editBotPublicId.trim() || editBotPublicId.trim() === bot.public_id}
                  className="px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 shrink-0"
                >
                  {savingBotPublicId ? 'שומר...' : 'שמור'}
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(editBotPublicId).then(() => {
                    setCopiedBotPublicId(true);
                    setTimeout(() => setCopiedBotPublicId(false), 2000);
                  });
                }}
                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-2xl transition-colors shrink-0"
                title="העתק"
              >
                {copiedBotPublicId ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
              <input
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                value={editBotPublicId}
                onChange={e => setEditBotPublicId(e.target.value)}
                readOnly={!onUpdateBotPublicId}
                dir="ltr"
              />
            </div>
            {botPublicIdError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-600 text-sm font-bold">
                {botPublicIdError}
              </div>
            )}
            {botPublicIdSuccess && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-emerald-600 text-sm font-bold flex items-center gap-2">
                <Check size={14} /> המזהה עודכן בהצלחה
              </div>
            )}
          </div>

          {canShowFacebook && (
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FacebookIcon size={12} /> חיבור לפייסבוק
              </h4>
              <button
                onClick={() => {
                  onConnectFacebook?.(bot);
                  onClose();
                }}
                className="flex items-center gap-3 px-6 py-3 bg-[#1877F2] text-white rounded-2xl font-bold text-sm hover:bg-[#166FE5] transition-all"
              >
                <FacebookIcon size={18} />
                חבר לפייסבוק
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BotSettingsModal;
