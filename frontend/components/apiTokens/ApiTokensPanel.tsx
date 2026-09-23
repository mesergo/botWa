import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Copy, Check, Trash2, Plus } from 'lucide-react';
import { getFormatLocale } from '../../i18n';

interface ApiTokenItem {
  id: string;
  name: string;
  token: string;
  expires_at: string | null;
  is_expired: boolean;
  created_at: string;
}

interface ApiTokensPanelProps {
  token?: string | null; // JWT for Authorization header
  apiBase: string;
}

const ApiTokensPanel: React.FC<ApiTokensPanelProps> = ({ token, apiBase }) => {
  const { t, i18n } = useTranslation('dashboard');
  const dateLocale = getFormatLocale(i18n.resolvedLanguage);
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        const res = await fetch(`${apiBase}/api-tokens`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!cancelled) setTokens(data.tokens || []);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiBase, token]);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${apiBase}/api-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          expires_at: expiresAt || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || t('settings.apiTokens.createError'));
        return;
      }
      setTokens(prev => [data.token, ...prev]);
      setName('');
      setExpiresAt('');
    } catch {
      setCreateError(t('settings.apiTokens.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('settings.apiTokens.confirmDelete'))) return;
    try {
      const res = await fetch(`${apiBase}/api-tokens/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      setTokens(prev => prev.filter(item => item.id !== id));
    } catch {
      // network hiccup — list stays as-is, user can retry the delete
    }
  };

  const handleCopy = async (item: ApiTokenItem) => {
    try {
      await navigator.clipboard.writeText(item.token);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
        <KeyRound size={14} /> {t('settings.apiTokens.heading')}
      </h2>
      <p className="text-sm text-slate-500 font-bold mb-6">{t('settings.apiTokens.description')}</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-400 mb-2">{t('settings.apiTokens.nameLabel')}</label>
          <input
            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-start"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('settings.apiTokens.namePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2">{t('settings.apiTokens.expiresLabel')}</label>
          <input
            type="date"
            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} />
            {creating ? t('settings.apiTokens.creating') : t('settings.apiTokens.create')}
          </button>
        </div>
      </div>

      {createError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold text-start">{createError}</div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-10 font-bold">{t('settings.apiTokens.loading')}</div>
      ) : loadError ? (
        <div className="text-center text-slate-400 py-10 font-bold">{t('settings.apiTokens.loadError')}</div>
      ) : tokens.length === 0 ? (
        <div className="text-center text-slate-400 py-10 font-bold">{t('settings.apiTokens.empty')}</div>
      ) : (
        <div className="space-y-3">
          {tokens.map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-slate-700 truncate">{item.name}</span>
                  {item.is_expired && (
                    <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-0.5">{t('settings.apiTokens.expired')}</span>
                  )}
                </div>
                <div className="font-mono text-xs text-slate-500 truncate select-all" dir="ltr">{item.token}</div>
                <div className="text-[11px] text-slate-400 font-bold mt-1">
                  {t('settings.apiTokens.createdAt')}: {new Date(item.created_at).toLocaleDateString(dateLocale)}
                  {' · '}
                  {item.expires_at
                    ? `${t('settings.apiTokens.expiresLabel')}: ${new Date(item.expires_at).toLocaleDateString(dateLocale)}`
                    : t('settings.apiTokens.noExpiry')}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleCopy(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title={t('settings.apiTokens.copy')}>
                  {copiedId === item.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title={t('settings.apiTokens.delete')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApiTokensPanel;
