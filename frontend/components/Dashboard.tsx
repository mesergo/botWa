import React, { useState, useEffect, useRef } from 'react';
import { Plus, Bot, ArrowLeft, Trash2, Calendar, LogOut, Shield, UserCog, Users, List, Settings, Save, User as UserIcon, Phone, Mail, Star, Copy, Check, Wifi, Gauge, MessageSquare, Globe, Layers, CheckCircle, Eye, EyeOff, X, Image as ImageIcon, Link as LinkIcon, Unlink, UserMinus, AlertTriangle, RefreshCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { BotFlow, User } from '../types';
import SubUsersTab from './SubUsersTab';
import BotSettingsModal from './BotSettingsModal';
import { usePermission } from '../hooks/usePermission';
import AppNav from './AppNav';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface DashboardProps {
  bots: BotFlow[];
  onEnterBot: (bot: BotFlow) => void;
  onCreateBot: (name: string) => void;
  onDeleteBot: (id: string) => void;
  onSetDefaultBot: (id: string) => void;
  onLogout: () => void;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean; availability_status?: 'available' | 'unavailable' | 'on_break' } | null;
  onOpenAdminPanel?: () => void;
  onStopImpersonation?: () => void;
  onOpenContacts?: () => void;
  onOpenSessions?: () => void;
  onOpenGroups?: () => void;
  onConnectFacebook?: (bot: BotFlow) => Promise<void>;
  onUpdateBotPublicId?: (id: string, publicId: string) => Promise<void>;
  onUpdateBotEndpoint?: (id: string, endpoint: string) => Promise<void>;
  onUpdateAvailability?: (status: 'available' | 'unavailable' | 'on_break') => Promise<void>;
  token?: string | null;
  initialTab?: 'bots' | 'settings' | 'users';
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  public_id: string;
  account_type: string;
  status: string;
  dialog360_bot_id: string;
  createdAt: string;
  trial_expires_at: string | null;
  custom_limits?: {
    max_bots: number | null;
    max_versions: number | null;
    version_price: number | null;
    bot_price: number | null;
    max_connected_numbers: number | null;
  };
  limits_in_effect?: {
    maxBots: number;
    maxVersions: number;
    versionPrice: number;
    botPrice: number;
    canPublish?: boolean;
    maxConnectedNumbers: number;
  };
  active_bots_count?: number;
  flows_count?: number;
}

const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// ── Rep availability status indicator (topbar) ───────────────────────────────
type AvailabilityStatus = 'available' | 'unavailable' | 'on_break';

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string; dot: string; text: string; bg: string }[] = [
  { value: 'available',   label: 'זמין',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  { value: 'on_break',    label: 'בהפסקה',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  { value: 'unavailable', label: 'לא זמין', dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100' },
];

const AvailabilityBadge: React.FC<{
  status: AvailabilityStatus;
  onChange: (s: AvailabilityStatus) => void | Promise<void>;
}> = ({ status, onChange }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = AVAILABILITY_OPTIONS.find(o => o.value === status) || AVAILABILITY_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (s: AvailabilityStatus) => {
    if (s === status) { setOpen(false); return; }
    setSaving(true);
    try {
      await onChange(s);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        title="שינוי סטטוס זמינות"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 ${current.bg} ${current.text} hover:shadow-sm transition-all disabled:opacity-60`}
      >
        <span className={`relative flex h-2.5 w-2.5`}>
          {status === 'available' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${current.dot}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${current.dot}`}></span>
        </span>
        <span>{current.label}</span>
      </button>
      {open && (
        <div className="absolute mt-2 right-0 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
          {AVAILABILITY_OPTIONS.map(opt => {
            const isActive = opt.value === status;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-right hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50' : ''}`}
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${opt.dot}`}></span>
                <span className="flex-1 text-slate-700">{opt.label}</span>
                {isActive && <Check size={14} className="text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ bots, onEnterBot, onCreateBot, onDeleteBot, onSetDefaultBot, onLogout, currentUser, onOpenAdminPanel, onStopImpersonation, onOpenContacts, onOpenSessions, onOpenGroups, onConnectFacebook, onUpdateBotPublicId, onUpdateBotEndpoint, onUpdateAvailability, token, initialTab }) => {
  const can = usePermission(currentUser as User | null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [facebookConfirmBot, setFacebookConfirmBot] = useState<BotFlow | null>(null);
  const [facebookSending, setFacebookSending] = useState(false);
  const [facebookDone, setFacebookDone] = useState(false);
  const [fbConnectBot, setFbConnectBot] = useState<BotFlow | null>(null);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbResult, setFbResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'bots' | 'settings' | 'users'>(() => {
    const requested = initialTab ?? 'bots';
    if (requested === 'bots' && !can('bots.view_tab')) {
      return can('settings.view') ? 'settings' : 'users';
    }
    return requested;
  });

  // Settings tab section
  type SettingsSection = 'profile' | 'account' | 'connection' | 'quota' | 'numbers' | 'templates' | 'removal';
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');

  // Settings tab state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Bot settings panel state
  const [settingsBot, setSettingsBot] = useState<BotFlow | null>(null);

  // WA templates state (Settings tab)
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<Record<string, boolean>>({});
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  // Connected WhatsApp numbers (Settings tab)
  interface ConnectedNumber {
    phone_number_id: string;
    waba_id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    whatsapp_status?: string;
    registered?: boolean;
    assigned_bot_id?: string | null;
    connected_at?: string;
  }
  const [connectedNumbers, setConnectedNumbers] = useState<ConnectedNumber[]>([]);
  const [cnLoading, setCnLoading] = useState(false);
  const [assigningPnid, setAssigningPnid] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});

  // Auto-removal-from-group config (per-user override of admin default)
  interface RemovalCfg { enabled: boolean; keywords_he: string[]; message_he: string; keywords_en: string[]; message_en: string; }
  const [removalEffective, setRemovalEffective] = useState<RemovalCfg | null>(null);
  const [removalGlobal, setRemovalGlobal] = useState<RemovalCfg | null>(null);
  const [removalDefaults, setRemovalDefaults] = useState<RemovalCfg | null>(null);
  const [removalCustomized, setRemovalCustomized] = useState(false);
  const [removalDraft, setRemovalDraft] = useState<RemovalCfg | null>(null);
  const [removalKwInputHe, setRemovalKwInputHe] = useState('');
  const [removalKwInputEn, setRemovalKwInputEn] = useState('');
  const [removalLoading, setRemovalLoading] = useState(false);
  const [removalSaving, setRemovalSaving] = useState(false);
  const [removalSaved, setRemovalSaved] = useState(false);
  const [removalConfirmOpen, setRemovalConfirmOpen] = useState<null | 'save' | 'revert'>(null);
  const [removalDisableConfirmOpen, setRemovalDisableConfirmOpen] = useState(false);

  const loadProfile = async () => {
    if (!token) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
        setEditName(data.name);
        setEditEmail(data.email);
        setEditPhone(data.phone || '');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const loadWaTemplates = async () => {
    if (!token) return;
    setWaTemplatesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setWaTemplates([]); return; }
      const data = await res.json();
      if (data.success && data.templates) {
        const list = Array.isArray(data.templates) ? data.templates
          : data.templates.data ? data.templates.data
          : data.templates.waba_templates ? data.templates.waba_templates
          : [];
        setWaTemplates(list);
        await fetchTemplateSettings();
      } else {
        setWaTemplates([]);
      }
    } catch { setWaTemplates([]); } finally { setWaTemplatesLoading(false); }
  };

  const fetchTemplateSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/dialog360-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.settings)) {
        const settingsMap: Record<string, boolean> = {};
        data.settings.forEach((s: any) => {
          if (s.templateName) {
            settingsMap[s.templateName] = s.showInChat ?? true;
          }
        });
        setTemplateSettings(settingsMap);
      }
    } catch (err) {
      console.error('Failed to fetch template settings:', err);
    }
  };

  const toggleShowInChat = async (template: any) => {
    if (!token) return;
    const currentValue = templateSettings[template.name] ?? true;
    const newValue = !currentValue;
    
    // Optimistic update
    setTemplateSettings(prev => ({ ...prev, [template.name]: newValue }));
    
    try {
      const res = await fetch(`${API_BASE}/dialog360-templates/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          templateName: template.name,
          templateId: template.id,
          showInChat: newValue,
          language: template.language,
          category: template.category,
          status: template.status
        }),
      });
      
      if (!res.ok) {
        // Revert on error
        setTemplateSettings(prev => ({ ...prev, [template.name]: currentValue }));
        console.error('Failed to toggle template setting');
      }
    } catch (err) {
      // Revert on error
      setTemplateSettings(prev => ({ ...prev, [template.name]: currentValue }));
      console.error('Error toggling template setting:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      if (!profile) {
        loadProfile();
      }
      if (!waTemplatesLoading) {
        loadWaTemplates();
      }
      loadConnectedNumbers();
      loadRemovalConfig();
    }
  }, [activeTab]);

  const loadConnectedNumbers = async () => {
    if (!token) return;
    setCnLoading(true);
    try {
      const res = await fetch(`${API_BASE}/whatsapp-registration/connected-numbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setConnectedNumbers([]); return; }
      const data = await res.json();
      const list = Array.isArray(data.connected_numbers) ? data.connected_numbers : [];
      setConnectedNumbers(list);
    } catch {
      setConnectedNumbers([]);
    } finally {
      setCnLoading(false);
    }
  };

  const handleAssignToBot = async (phone_number_id: string) => {
    const bot_id = assignSelection[phone_number_id];
    if (!token || !bot_id) return;
    setAssigningPnid(phone_number_id);
    try {
      const res = await fetch(`${API_BASE}/whatsapp-registration/assign-to-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone_number_id, bot_id }),
      });
      if (res.ok) await loadConnectedNumbers();
    } finally {
      setAssigningPnid(null);
    }
  };

  const handleUnassign = async (phone_number_id: string) => {
    if (!token) return;
    setAssigningPnid(phone_number_id);
    try {
      const res = await fetch(`${API_BASE}/whatsapp-registration/unassign-from-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone_number_id }),
      });
      if (res.ok) await loadConnectedNumbers();
    } finally {
      setAssigningPnid(null);
    }
  };

  const handleOpenFbOAuth = async (bot: BotFlow) => {
    if (!token) return;
    console.log(`[FB-OAuth] 🚀 Opening Facebook OAuth for bot: id=${bot.id} name=${bot.name}`);
    setFbConnecting(true);
    setFbResult(null);
    try {
      const stateRes = await fetch(`${API_BASE}/bots/${bot.id}/facebook-redirect-state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`[FB-OAuth] 🎟 facebook-redirect-state HTTP ${stateRes.status}`);
      if (!stateRes.ok) {
        console.warn('[FB-OAuth] ❌ Failed to get state token');
        setFbResult({ ok: false, message: 'שגיאה בקבלת קוד אבטחה. נסה שוב.' });
        setFbConnecting(false);
        return;
      }
      const { state } = await stateRes.json();
      console.log(`[FB-OAuth] ✅ state token received (${state?.length} chars)`);

      const redirectUri = `${window.location.origin}/api/bots/facebook-redirect`;
      console.log(`[FB-OAuth] 🔗 redirect_uri = ${redirectUri}`);
      openFbOAuthPopup(state, redirectUri);
    } catch (err: any) {
      setFbResult({ ok: false, message: err.message || 'שגיאה בפתיחת חיבור פייסבוק' });
      setFbConnecting(false);
    }
  };

  /** Open Facebook OAuth WITHOUT tying it to a specific bot.
   *  The number is saved tcted_numbers (unassigned) and can be
   *  assigned to a bot later via the dropdown in the Numbers section. */
  const handleOpenFbOAuthFree = async () => {
    if (!token) return;
    console.log('[FB-OAuth] 🚀 Opening Facebook OAuth in FREE mode (no bot)');
    setFbConnecting(true);
    setFbResult(null);
    try {
      const stateRes = await fetch(`${API_BASE}/bots/facebook-redirect-state-free`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`[FB-OAuth] 🎟 facebook-redirect-state-free HTTP ${stateRes.status}`);
      if (!stateRes.ok) {
        const errBody = await stateRes.json().catch(() => ({}));
        console.warn('[FB-OAuth] ❌ Failed to get free state token', errBody);
        setFbResult({ ok: false, message: errBody.error || 'שגיאה בקבלת קוד אבטחה. נסה שוב.' });
        setFbConnecting(false);
        return;
      }
      const { state } = await stateRes.json();
      console.log(`[FB-OAuth] ✅ free state token received (${state?.length} chars)`);

      const redirectUri = `${window.location.origin}/api/bots/facebook-redirect`;
      console.log(`[FB-OAuth] 🔗 redirect_uri = ${redirectUri}`);
      openFbOAuthPopup(state, redirectUri);
    } catch (err: any) {
      setFbResult({ ok: false, message: err.message || 'שגיאה בפתיחת חיבור פייסבוק' });
      setFbConnecting(false);
    }
  };

  /** Shared: build the Facebook URL, open the popup and listen for postMessage. */
  const openFbOAuthPopup = (state: string, redirectUri: string) => {
      const extrasObj = { featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3', version: 'v4' };
      const fbUrl =
        `https://www.facebook.com/v25.0/dialog/oauth` +
        `?display=popup` +
        `&client_id=717787580246105` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&config_id=333254912651363` +
        `&response_type=code` +
        `&fallback_redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&override_default_response_type=true` +
        `&state=${encodeURIComponent(state)}` +
        `&extras=${encodeURIComponent(JSON.stringify(extrasObj))}`;

      const w = 600; const h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      console.log(`[FB-OAuth] 🌐 Opening popup → ${fbUrl.replace(/&state=[^&]+/, '&state=***').replace(/&code=[^&]+/, '&code=***')}`);
      const popup = window.open(fbUrl, 'facebookOAuth',
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`);

      if (!popup) {
        setFbResult({ ok: false, message: 'הדפדפן חסם את החלונית הקופצת. אנא אפשר חלונות קופצים ונסה שוב.' });
        setFbConnecting(false);
        return;
      }
      popup.focus();

      let settled = false;
      const msgHandler = (e: MessageEvent) => {
        if (!e.data || e.data.event !== 'fb-redirect-done') return;
        settled = true;
        window.removeEventListener('message', msgHandler);
        clearInterval(closeTimer);

        console.group('[FB-OAuth] 📨 postMessage received from redirect_uri popup');
        console.log('full payload:', e.data);
        console.log('ok:', e.data.ok);
        console.log('message:', e.data.message);
        console.log('bot_id:', e.data.bot_id);
        console.log('free_mode:', e.data.free_mode);
        console.log('waba_id:', e.data.waba_id);
        console.log('wabaName:', e.data.wabaName);
        console.log('phone_number_id:', e.data.phone_number_id);
        console.log('display_phone_number:', e.data.display_phone_number);
        console.log('verified_name:', e.data.verified_name);
        console.log('quality_rating:', e.data.quality_rating);
        console.log('status:', e.data.status);
        console.log('code_verification_status:', e.data.code_verification_status);
        console.log('name_status:', e.data.name_status);
        console.log('messaging_limit_tier:', e.data.messaging_limit_tier);
        console.log('businessId:', e.data.businessId);
        console.log('registered:', e.data.registered);
        console.log('register_status_code:', e.data.register_status_code);
        console.log('register_error:', e.data.register_error);
        console.log('JSON.stringify(full):', JSON.stringify(e.data, null, 2));
        console.groupEnd();

        if (e.data.ok) {
          const num = e.data.display_phone_number || '-';
          const waba = e.data.wabaName ? ` (${e.data.wabaName})` : '';
          const freeNote = e.data.free_mode ? ' — ניתן לשייך לבוט בהגדרות → מספרים מחוברים' : '';
          console.log(`[FB-OAuth] ✅ Success — phone: ${num}${waba}${freeNote}`);
          setFbResult({ ok: true, message: `החיבור הושלם בהצלחה! מספר: ${num}${waba}${freeNote}` });
          setFbConnectBot(null);
          loadConnectedNumbers();
        } else {
          const raw = e.data.register_error || e.data.message || 'שגיאה לא ידועה';
          const errMsg = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
          console.warn('[FB-OAuth] ❌ Failed:', errMsg);
          setFbResult({ ok: false, message: `החיבור נכשל: ${errMsg}` });
        }
        setFbConnecting(false);
      };
      window.addEventListener('message', msgHandler);

      const closeTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(closeTimer);
          if (!settled) window.removeEventListener('message', msgHandler);
          setFbConnecting(false);
        }
      }, 500);
  };

  // ── Auto-removal-from-group (per-user) ────────────────────────────────
  const normalizeCfg = (c: any): RemovalCfg => ({
    enabled: c?.enabled !== false,
    keywords_he: Array.isArray(c?.keywords_he) ? c.keywords_he : [],
    message_he: typeof c?.message_he === 'string' ? c.message_he : '',
    keywords_en: Array.isArray(c?.keywords_en) ? c.keywords_en : [],
    message_en: typeof c?.message_en === 'string' ? c.message_en : ''
  });

  const loadRemovalConfig = async () => {
    if (!token) return;
    setRemovalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/removal-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const effective = normalizeCfg(data.config);
      const global = normalizeCfg(data.global);
      const defaults = normalizeCfg(data.defaults);
      setRemovalEffective(effective);
      setRemovalGlobal(global);
      setRemovalDefaults(defaults);
      setRemovalCustomized(!!data.customized);
      setRemovalDraft(effective);
    } finally {
      setRemovalLoading(false);
    }
  };

  const saveRemovalConfig = async () => {
    if (!token || !removalDraft) return;
    setRemovalSaving(true);
    setRemovalSaved(false);
    try {
      const res = await fetch(`${API_BASE}/auth/removal-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customized: true,
          enabled: removalDraft.enabled,
          keywords_he: removalDraft.keywords_he,
          message_he: removalDraft.message_he,
          keywords_en: removalDraft.keywords_en,
          message_en: removalDraft.message_en
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const effective = normalizeCfg(data.config);
      setRemovalEffective(effective);
      setRemovalCustomized(!!data.customized);
      setRemovalDraft(effective);
      setRemovalSaved(true);
      setTimeout(() => setRemovalSaved(false), 2500);
    } catch {
      alert('שגיאה בשמירת הגדרות ההסרה');
    } finally {
      setRemovalSaving(false);
      setRemovalConfirmOpen(null);
    }
  };

  const revertRemovalToGlobal = async () => {
    if (!token) return;
    setRemovalSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/removal-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customized: false }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const effective = normalizeCfg(data.config);
      setRemovalEffective(effective);
      setRemovalCustomized(!!data.customized);
      setRemovalDraft(effective);
      setRemovalSaved(true);
      setTimeout(() => setRemovalSaved(false), 2500);
    } catch {
      alert('שגיאה באיפוס ההגדרה');
    } finally {
      setRemovalSaving(false);
      setRemovalConfirmOpen(null);
    }
  };

  const addRemovalDraftKeywordHe = () => {
    const k = removalKwInputHe.trim();
    if (!k || !removalDraft) return;
    if (removalDraft.keywords_he.some(x => x.trim().toLowerCase() === k.toLowerCase())) {
      setRemovalKwInputHe('');
      return;
    }
    setRemovalDraft({ ...removalDraft, keywords_he: [...removalDraft.keywords_he, k] });
    setRemovalKwInputHe('');
  };

  const removeRemovalDraftKeywordHe = (idx: number) => {
    if (!removalDraft) return;
    setRemovalDraft({ ...removalDraft, keywords_he: removalDraft.keywords_he.filter((_, i) => i !== idx) });
  };

  const addRemovalDraftKeywordEn = () => {
    const k = removalKwInputEn.trim();
    if (!k || !removalDraft) return;
    if (removalDraft.keywords_en.some(x => x.trim().toLowerCase() === k.toLowerCase())) {
      setRemovalKwInputEn('');
      return;
    }
    setRemovalDraft({ ...removalDraft, keywords_en: [...removalDraft.keywords_en, k] });
    setRemovalKwInputEn('');
  };

  const removeRemovalDraftKeywordEn = (idx: number) => {
    if (!removalDraft) return;
    setRemovalDraft({ ...removalDraft, keywords_en: removalDraft.keywords_en.filter((_, i) => i !== idx) });
  };

  const isRep = currentUser?.role === 'rep' || currentUser?.role === 'rep_manager';
  const isCompanyManager = currentUser?.role === 'user';
  // can() already defined at the top of the component

  const handleSaveProfile = async () => {
    if (!token) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'שגיאה בשמירת הפרטים');
      } else {
        setProfile(data);
        setEditName(data.name);
        setEditEmail(data.email);
        setEditPhone(data.phone || '');
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch {
      setProfileError('שגיאה בחיבור לשרת');
    } finally {
      setProfileSaving(false);
    }
  };

  const copyPublicId = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.public_id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleCreate = () => {
    if (!newBotName.trim()) return;
    onCreateBot(newBotName);
    setNewBotName('');
    setIsModalOpen(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString('he-IL');
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toLocaleDateString('he-IL') : date.toLocaleDateString('he-IL');
  };

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden">
      {/* Impersonation Banner */}
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} />
      
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"><LogOut size={22} /></button>
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveTab('bots')} />
        </div>

        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
          )}
          {(currentUser?.role === 'rep' || currentUser?.role === 'rep_manager') && onUpdateAvailability && (
            <AvailabilityBadge
              status={(currentUser?.availability_status as AvailabilityStatus) || 'available'}
              onChange={onUpdateAvailability}
            />
          )}
          {currentUser?.role === 'admin' && !currentUser?.isImpersonating && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
            >
              <Shield size={18} />
              פאנל ניהול
            </button>
          )}
          <div className="relative">
            <div
              title={currentUser?.name || currentUser?.email || ''}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setActiveTab('bots')}
            >
              {(currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase()}
            </div>
            {(currentUser?.role === 'rep' || currentUser?.role === 'rep_manager') && (() => {
              const s = (currentUser?.availability_status as AvailabilityStatus) || 'available';
              const opt = AVAILABILITY_OPTIONS.find(o => o.value === s)!;
              return (
                <span
                  title={opt.label}
                  className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full ring-2 ring-white ${opt.dot}`}
                />
              );
            })()}
          </div>
        </div>
      </nav>

      {/* ── Main layout: sidebar + content ── */}
      <div className="flex-1 flex flex-row-reverse overflow-hidden">

        {/* ── Right Sidebar ── */}
        <AppNav
          mode="sidebar"
          activePage={activeTab}
          onBots={can('bots.view_tab') ? () => setActiveTab('bots') : undefined}
          onSessions={onOpenSessions && can('sessions.view') ? onOpenSessions : undefined}
          onContacts={onOpenContacts && can('contacts.view') ? onOpenContacts : undefined}
          onGroups={onOpenGroups && can('groups.view') ? onOpenGroups : undefined}
          onSettings={can('settings.view') ? () => setActiveTab('settings') : undefined}
          onUsers={can('users.view') ? () => setActiveTab('users') : undefined}
        />

        {/* ── Content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <div className="flex-1 flex overflow-hidden" dir="rtl">

          {/* ── Inner settings sidebar ── */}
          <aside className="w-56 bg-white border-l border-slate-100 flex flex-col py-6 px-3 gap-1 flex-shrink-0 overflow-y-auto">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 mb-2">הגדרות</p>
            {([
              { key: 'profile',    label: 'פרטים אישיים',     icon: <UserIcon size={16} /> },
              { key: 'account',    label: 'פרטי חשבון',        icon: <Shield size={16} /> },
              { key: 'connection', label: 'הגדרות חיבור',      icon: <Wifi size={16} /> },
              { key: 'quota',      label: 'מכסות אישיות',      icon: <Gauge size={16} /> },
              { key: 'numbers',    label: 'מספרים מחוברים',    icon: <Phone size={16} /> },
              { key: 'templates',  label: 'הודעות תבנית',      icon: <MessageSquare size={16} /> },
              { key: 'removal',    label: 'ניהול הסרה מקבוצה', icon: <UserMinus size={16} /> },
            ] as { key: SettingsSection; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setSettingsSection(key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all w-full text-right ${
                  settingsSection === key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </aside>

          {/* ── Settings content ── */}
          <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-2xl mx-auto">

            {profileLoading ? (
              <div className="text-center text-slate-400 py-20 font-bold">טוען פרטים...</div>
            ) : !profile ? (
              <div className="text-center text-slate-400 py-20 font-bold">לא ניתן לטעון פרטים. אנא נסה שוב.</div>
            ) : (
              <>

              {/* ── פרטים אישיים ── */}
              {settingsSection === 'profile' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <UserIcon size={14} /> פרטים אישיים
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">שם מלא</label>
                      <input
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right disabled:opacity-60 disabled:cursor-not-allowed"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        disabled={!can('settings.edit_profile')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">אימייל</label>
                      <input
                        type="email"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right disabled:opacity-60 disabled:cursor-not-allowed"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        dir="ltr"
                        disabled={!can('settings.edit_profile')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">טלפון</label>
                      <input
                        type="tel"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right disabled:opacity-60 disabled:cursor-not-allowed"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                        placeholder="05X-XXXXXXX"
                        disabled={!can('settings.edit_profile')}
                      />
                    </div>
                  </div>
                  {profileError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold text-right">{profileError}</div>
                  )}
                  {profileSuccess && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-600 text-sm font-bold text-right flex items-center gap-2">
                      <Check size={16} /> הפרטים נשמרו בהצלחה
                    </div>
                  )}
                  {can('settings.edit_profile') && (
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="mt-6 flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-95"
                    >
                      <Save size={18} />
                      {profileSaving ? 'שומר...' : 'שמור שינויים'}
                    </button>
                  )}
                </div>
              )}

              {/* ── פרטי חשבון ── */}
              {settingsSection === 'account' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Shield size={14} /> פרטי חשבון
                  </h2>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">מזהה ציבורי</span>
                      <div className="flex items-center gap-3">
                        <button onClick={copyPublicId} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="העתק מזהה">
                          {copiedId ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                        <span className="text-slate-800 font-mono text-sm bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 select-all">{profile.public_id}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">סוג חשבון</span>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        profile.account_type === 'Premium' ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : profile.account_type === 'Trial' ? 'bg-orange-50 text-orange-600 border-orange-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <Star size={12} className="fill-current" />
                        {profile.account_type === 'Trial' ? 'ניסיוני' : profile.account_type}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">סטטוס</span>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        profile.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${profile.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {profile.status === 'active' ? 'פעיל' : 'חסום'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">תפקיד</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.role === 'admin' ? 'מנהל' : 'משתמש'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">תאריך הצטרפות</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('he-IL') : '-'}</span>
                    </div>
                    {profile.trial_expires_at && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs font-bold text-slate-400">תפוגת תקופת ניסיון</span>
                        <span className="text-orange-600 font-bold text-sm">{new Date(profile.trial_expires_at).toLocaleDateString('he-IL')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── הגדרות חיבור ── */}
              {settingsSection === 'connection' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Wifi size={14} /> הגדרות חיבור
                  </h2>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">בוטים פעילים</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.active_bots_count ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">זרימות שיחה</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.flows_count ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── מכסות אישיות ── */}
              {settingsSection === 'quota' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Gauge size={14} /> מכסות אישיות
                  </h2>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">מקסימום מספרים מחוברים</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.limits_in_effect?.maxConnectedNumbers ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">מקסימום בוטים</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.limits_in_effect?.maxBots ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">מקסימום גרסאות</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.limits_in_effect?.maxVersions ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">עלות גרסה</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.limits_in_effect?.versionPrice != null ? `₪${profile.limits_in_effect.versionPrice}` : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">עלות בוט</span>
                      <span className="text-slate-700 font-bold text-sm">{profile.limits_in_effect?.botPrice != null ? `₪${profile.limits_in_effect.botPrice}` : '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {settingsSection === 'numbers' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Phone size={14} /> מספרים מחוברים
                  </h2>
                  {onConnectFacebook && (() => {
                    const maxNums = profile?.limits_in_effect?.maxConnectedNumbers ?? 1;
                    const atQuota = connectedNumbers.length >= maxNums;
                    return atQuota ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold max-w-xs text-right">
                        <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                        נגמרה המכסה ({connectedNumbers.length}/{maxNums}). להוספת מספר יש ליצור קשר עם המשרד לתשלום.
                      </div>
                    ) : (
                      <button
                        onClick={handleOpenFbOAuthFree}
                        disabled={fbConnecting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] text-white rounded-2xl font-bold text-sm hover:bg-[#166FE5] transition-all disabled:opacity-60 shadow-lg shadow-blue-600/20"
                      >
                        <FacebookIcon size={16} />
                        {fbConnecting ? 'מתחבר...' : 'הוסף מספר חדש'}
                      </button>
                    );
                  })()}
                </div>

                {fbConnectBot && (
                  <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FacebookIcon size={18} className="text-[#1877F2] shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">חיבור לפייסבוק עבור הבוט: <strong>{fbConnectBot.name}</strong></p>
                        <p className="text-xs text-slate-500 mt-0.5">לחץ על "הוסף מספר חדש" להמשך תהליך הרישום.</p>
                      </div>
                    </div>
                    <button onClick={() => { setFbConnectBot(null); setFbResult(null); }} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                )}

                {fbResult && (
                  <div className={`mb-5 p-4 rounded-2xl flex items-start gap-3 border ${fbResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="shrink-0 mt-0.5">{fbResult.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}</div>
                    <p className="text-sm font-bold flex-1">{fbResult.message}</p>
                    <button onClick={() => setFbResult(null)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"><X size={14} /></button>
                  </div>
                )}

                {cnLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
                  </div>
                ) : connectedNumbers.length === 0 ? (
                  <div className="text-center py-10 text-sm font-bold text-slate-400">
                    אין מספרים מחוברים עדיין. לאחר הפעלת מספר ושיוך לחשבון הוא יופיע כאן.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {connectedNumbers.map((n) => {
                      const assignedBot = n.assigned_bot_id ? bots.find(b => b.id === String(n.assigned_bot_id)) : null;
                      const isBusy = assigningPnid === n.phone_number_id;
                      return (
                        <div key={n.phone_number_id} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-[220px]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-base font-black text-slate-800" dir="ltr">
                                  {n.display_phone_number || n.phone_number_id}
                                </span>
                                {n.whatsapp_status && (
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                    n.whatsapp_status === 'CONNECTED' ? 'bg-emerald-500 text-white'
                                    : n.whatsapp_status === 'PENDING' ? 'bg-amber-500 text-white'
                                    : 'bg-slate-400 text-white'
                                  }`}>{n.whatsapp_status}</span>
                                )}
                                {n.registered && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500 text-white flex items-center gap-1">
                                    <CheckCircle size={10} /> פעיל
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-mono" dir="ltr">
                                <div>phone_number_id: {n.phone_number_id}</div>
                                {n.waba_id && <div>waba_id: {n.waba_id}</div>}
                                {n.verified_name && <div>name: {n.verified_name}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {assignedBot ? (
                                <>
                                  <span className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold">
                                    <LinkIcon size={12} /> משויך לבוט: {assignedBot.name}
                                  </span>
                                  <button
                                    onClick={() => handleUnassign(n.phone_number_id)}
                                    disabled={isBusy}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                                    title="בטל שיוך"
                                  >
                                    <Unlink size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <select
                                    value={assignSelection[n.phone_number_id] || ''}
                                    onChange={(e) => setAssignSelection(prev => ({ ...prev, [n.phone_number_id]: e.target.value }))}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                                  >
                                    <option value="">בחר בוט...</option>
                                    {bots.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAssignToBot(n.phone_number_id)}
                                    disabled={isBusy || !assignSelection[n.phone_number_id]}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
                                  >
                                    <LinkIcon size={12} /> {isBusy ? 'משייך...' : 'שייך לבוט'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}{/* end numbers */}

              {/* ── הודעות תבנית ── */}
              {settingsSection === 'templates' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <MessageSquare size={14} /> הודעות תבנית
                </h2>
                {waTemplatesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-3"></div>
                      <div className="text-sm font-bold">טוען הודעות תבנית...</div>
                    </div>
                  </div>
                ) : waTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">לא נמצאו הודעות תבנית</p>
                    <p className="text-xs text-slate-400 mt-1">ודא שהגדרת Bot ID בהגדרות החיבור</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {waTemplates.map((tmpl: any, idx: number) => {
                      const name = tmpl.name || tmpl.elementName || tmpl.template_name || `Template ${idx + 1}`;
                      const language = tmpl.language || '';
                      const status = tmpl.status || '';
                      const category = tmpl.category || '';
                      const components = tmpl.components || [];
                      const bodyComponent = components.find((c: any) => c.type === 'BODY');
                      const headerComponent = components.find((c: any) => c.type === 'HEADER');
                      const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
                      const bodyText = bodyComponent?.text || '';
                      const hasImage = headerComponent?.format === 'IMAGE';
                      const buttonCount = buttonsComponent?.buttons?.length || 0;
                      return (
                        <div 
                          key={tmpl.id || idx} 
                          className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all hover:border-sky-300 group cursor-pointer"
                          onClick={() => setPreviewTemplate(tmpl)}
                        >
                          <div className={`px-5 py-4 border-b border-slate-200 ${hasImage ? 'bg-sky-50' : 'bg-white'}`}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-sm font-black text-slate-800 truncate group-hover:text-sky-700 transition-colors flex-1">{name}</h3>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleShowInChat(tmpl);
                                    }}
                                    className={`shrink-0 p-1.5 rounded-lg transition-all ${
                                      (templateSettings[name] ?? true)
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                        : 'bg-slate-300 hover:bg-slate-400 text-slate-700'
                                    }`}
                                    title={(templateSettings[name] ?? true) ? 'מוצג בשיחות' : 'מוסתר בשיחות'}
                                  >
                                    {(templateSettings[name] ?? true) ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {language && (
                                    <span className="flex items-center gap-1 bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                      <Globe size={10} />{language.toUpperCase()}
                                    </span>
                                  )}
                                  {status && (
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                      status === 'APPROVED' ? 'bg-emerald-500 text-white'
                                      : status === 'PENDING' ? 'bg-amber-500 text-white'
                                      : 'bg-slate-400 text-white'
                                    }`}>
                                      {status === 'APPROVED' ? <CheckCircle size={9} /> : null}
                                      {status}
                                    </span>
                                  )}
                                  {category && (
                                    <span className="bg-sky-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">{category}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-5">
                            {bodyText ? (
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4 bg-white border border-slate-100 rounded-xl p-3">
                                {bodyText.substring(0, 200)}{bodyText.length > 200 ? '...' : ''}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 italic">אין תוכן</p>
                            )}
                            <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-bold">
                              <span className="flex items-center gap-1"><Layers size={11} />{components.length} רכיבים</span>
                              {buttonCount > 0 && <span>{buttonCount} כפתורים</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}{/* end templates */}

              {/* ── ניהול הסרה מקבוצה ── */}
              {settingsSection === 'removal' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                  <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <UserMinus size={18} className="text-rose-500" />
                      ניהול הסרה מקבוצה
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      כאשר נמען שולח אחת ממילות המפתח, המספר שלו מתווסף אוטומטית לרשימת ההסרה ונשלחת לו הודעת אישור.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
                      removalCustomized
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {removalCustomized ? 'הגדרה אישית פעילה' : 'משתמש בברירת המחדל המערכתית'}
                    </span>
                    {removalCustomized && (
                      <button
                        onClick={() => setRemovalConfirmOpen('revert')}
                        disabled={removalSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
                        title="חזרה לברירת המחדל של המערכת"
                      >
                        <RefreshCcw size={12} /> חזרה לברירת מחדל
                      </button>
                    )}
                    <button
                      onClick={() => setRemovalConfirmOpen('save')}
                      disabled={removalSaving || !removalDraft}
                      className="flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-60 active:scale-95"
                    >
                      <Save size={12} />
                      {removalSaving ? 'שומר…' : 'שמור הגדרה אישית'}
                    </button>
                  </div>
                </div>

                {removalLoading || !removalDraft ? (
                  <div className="text-center text-slate-400 py-10 font-bold">טוען הגדרות הסרה…</div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-amber-800 text-xs font-bold leading-relaxed">
                        שינוי ההגדרה דורס את ברירת המחדל הכללית. מילים שגויות עלולות למנוע הסרה אוטומטית של נמענים שביקשו זאת — באחריותך לוודא שהמילים מתאימות לכל הבוטים שלך.
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                      <div>
                        <div className="text-sm font-black text-slate-800">הסרה אוטומטית פעילה</div>
                        <div className="text-[11px] text-slate-500 font-medium">בעת ביטול — לא תתבצע הסרה אוטומטית בבוטים שלך, גם אם המילה הוגדרה.</div>
                      </div>
                      <button
                        onClick={() => {
                          if (removalDraft.enabled) {
                            setRemovalDisableConfirmOpen(true);
                          } else {
                            setRemovalDraft({ ...removalDraft, enabled: true });
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                          removalDraft.enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {removalDraft.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {removalDraft.enabled ? 'פעיל' : 'מושבת'}
                      </button>
                    </div>

                    {/* ── Hebrew block ── */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🇮🇱</span>
                        <span className="text-sm font-black text-blue-800">עברית</span>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-blue-500 uppercase tracking-wider mb-3">מילות מפתח להסרה בעברית</label>
                        <div className="flex gap-2 mb-3" dir="rtl">
                          <input
                            type="text"
                            value={removalKwInputHe}
                            onChange={e => setRemovalKwInputHe(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRemovalDraftKeywordHe(); } }}
                            placeholder="למשל: הסר, הסרה, תסיר"
                            className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all"
                          />
                          <button
                            onClick={addRemovalDraftKeywordHe}
                            className="flex items-center gap-2 px-5 py-3 bg-blue-700 text-white rounded-2xl font-bold text-sm hover:bg-blue-800 transition-all"
                          >
                            <Plus size={14} /> הוסף
                          </button>
                        </div>
                        {removalDraft.keywords_he.length === 0 ? (
                          <div className="text-center text-blue-300 text-sm py-6 bg-white rounded-2xl border border-dashed border-blue-200">
                            אין מילות מפתח בעברית.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {removalDraft.keywords_he.map((kw, idx) => (
                              <span key={`he-${kw}-${idx}`} className="inline-flex items-center gap-2 bg-white text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-sm font-bold">
                                <span dir="rtl">{kw}</span>
                                <button onClick={() => removeRemovalDraftKeywordHe(idx)} className="text-blue-300 hover:text-blue-700 transition-colors" title="הסר מילה"><X size={14} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        {removalGlobal && (
                          <p className="text-[11px] text-blue-400 font-medium mt-2">
                            ברירת מחדל: {removalGlobal.keywords_he.length} מילים בעברית{removalCustomized ? '' : ' — פעילה כרגע'}.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-black text-blue-500 uppercase tracking-wider mb-2">הודעת אישור לאחר ההסרה — עברית</label>
                        <textarea
                          value={removalDraft.message_he}
                          onChange={e => setRemovalDraft({ ...removalDraft, message_he: e.target.value })}
                          rows={2}
                          dir="rtl"
                          placeholder="הודעה שתישלח לנמען שכתב מילת מפתח עברית"
                          className="w-full px-5 py-3 bg-white border border-blue-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all resize-none"
                        />
                        {removalGlobal?.message_he && (
                          <p className="text-[11px] text-blue-400 font-medium mt-1">
                            ברירת מחדל: <span className="text-blue-500">"{removalGlobal.message_he}"</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ── English block ── */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🇺🇸</span>
                        <span className="text-sm font-black text-emerald-800">English</span>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-emerald-600 uppercase tracking-wider mb-3">English Removal Keywords</label>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={removalKwInputEn}
                            onChange={e => setRemovalKwInputEn(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRemovalDraftKeywordEn(); } }}
                            placeholder="e.g. stop, remove, unsubscribe"
                            className="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition-all"
                          />
                          <button
                            onClick={addRemovalDraftKeywordEn}
                            className="flex items-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-2xl font-bold text-sm hover:bg-emerald-800 transition-all"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                        {removalDraft.keywords_en.length === 0 ? (
                          <div className="text-center text-emerald-300 text-sm py-6 bg-white rounded-2xl border border-dashed border-emerald-200">
                            No English keywords defined.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {removalDraft.keywords_en.map((kw, idx) => (
                              <span key={`en-${kw}-${idx}`} className="inline-flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-sm font-bold">
                                <span>{kw}</span>
                                <button onClick={() => removeRemovalDraftKeywordEn(idx)} className="text-emerald-300 hover:text-emerald-700 transition-colors" title="Remove keyword"><X size={14} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        {removalGlobal && (
                          <p className="text-[11px] text-emerald-500 font-medium mt-2">
                            Default: {removalGlobal.keywords_en.length} English keywords{removalCustomized ? '' : ' — currently active'}.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Confirmation message after removal — English</label>
                        <textarea
                          value={removalDraft.message_en}
                          onChange={e => setRemovalDraft({ ...removalDraft, message_en: e.target.value })}
                          rows={2}
                          placeholder="Message sent to the contact after an English keyword match"
                          className="w-full px-5 py-3 bg-white border border-emerald-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition-all resize-none"
                        />
                        {removalGlobal?.message_en && (
                          <p className="text-[11px] text-emerald-500 font-medium mt-1">
                            Default: <span className="text-emerald-600">"{removalGlobal.message_en}"</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {removalSaved && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-bold flex items-center gap-2">
                        <CheckCircle size={16} /> ההגדרה האישית נשמרה
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}{/* end removal */}

              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bots Tab ── */}
      {activeTab === 'bots' && can('bots.view_tab') && (
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10 flex-row-reverse">
            <h1 className="text-3xl font-black text-slate-900">הבוטים שלי</h1>
            {can('bots.create') && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all scale-100 active:scale-95"
              >
                <Plus size={20} /> צור תזרים חדש
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div 
                key={bot.id}
                className={`bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between h-[280px] ${can('bots.edit') ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => can('bots.edit') && onEnterBot(bot)}
              >
                <div>
                  <div className="flex items-center justify-between mb-6 flex-row-reverse">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Bot size={28} />
                    </div>
                    <div className="flex items-center gap-2">
                      {can('bots.delete') && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteBot(bot.id); }}
                          className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      {can('bots.settings') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSettingsBot(bot); }}
                          className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                          title="הגדרות בוט"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 truncate">{bot.name}</h3>
                  <p className="text-slate-400 text-sm font-bold flex items-center justify-end gap-2 uppercase tracking-widest">
                    <span>{formatDate(bot.created_at)}</span>
                    <Calendar size={14} />
                  </p>
                  {bot.display_phone_number && (
                    <p className="text-slate-500 text-sm font-bold flex items-center justify-end gap-2 mt-1">
                      <span dir="ltr">{bot.display_phone_number}</span>
                      <span>בוט משויך למספר</span>
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-6">
                  <div></div>
                  {can('bots.edit') && (
                  <div className="flex items-center gap-2 text-blue-600 font-black text-sm group-hover:gap-4 transition-all">
                    <span>כניסה לעריכה</span>
                    <ArrowLeft size={18} />
                  </div>
                  )}
                </div>
              </div>
            ))}
            
            {bots.length === 0 && (
              <div className="col-span-full py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                <Bot size={64} strokeWidth={1} />
                <p className="text-xl font-bold">אין לך בוטים עדיין. בוא ניצור את הראשון!</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && can('users.view') && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-full mx-auto">
            <SubUsersTab token={token} currentUser={currentUser as User | null} />
          </div>
        </div>
      )}

        </div>{/* end content area */}
      </div>{/* end main layout */}

      {facebookConfirmBot && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 border border-slate-100" dir="rtl">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
              <FacebookIcon size={32} />
            </div>
            {facebookDone ? (
              <>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">החלונית נפתחה!</h3>
                <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                  המשך את תהליך החיבור בחלונית פייסבוק שנפתחה. אם החלונית לא נפתחה — אפשר את החלונות הקופצים בדפדפן ונסה שוב.
                </p>
                <button
                  onClick={() => setFacebookConfirmBot(null)}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                  סגור
                </button>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">חיבור לפייסבוק</h3>
                <p className="text-slate-400 text-sm mb-2 font-medium leading-relaxed">
                  האם ברצונך לחבר את הבוט <strong className="text-slate-700">{facebookConfirmBot.name}</strong> לפייסבוק?
                </p>
                <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                  לחיצה על &quot;אישור&quot; תפתח חלונית של פייסבוק להתחברות והרשאה. השלם/י את התהליך בתוך החלונית.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setFacebookConfirmBot(null)}
                    className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase hover:bg-slate-50"
                    disabled={facebookSending}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={async () => {
                      setFacebookDone(true);
                      handleOpenFbOAuth(facebookConfirmBot!);
                    }}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"
                    disabled={facebookSending}
                  >
                    {facebookSending ? 'פותח...' : 'אישור'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bot Settings Panel ── */}
      {settingsBot && (
        <BotSettingsModal
          bot={settingsBot}
          currentUser={currentUser}
          onClose={() => setSettingsBot(null)}
          onUpdateBotPublicId={onUpdateBotPublicId ? async (id, publicId) => {
            await onUpdateBotPublicId(id, publicId);
            setSettingsBot(prev => prev ? { ...prev, public_id: publicId } : null);
          } : undefined}
          onUpdateBotEndpoint={onUpdateBotEndpoint ? async (id, endpoint) => {
            await onUpdateBotEndpoint(id, endpoint);
            setSettingsBot(prev => prev ? { ...prev, endpoint } : null);
          } : undefined}
          onConnectFacebook={onConnectFacebook ? (_bot) => {
            setSettingsBot(null);
            setActiveTab('settings');
            setSettingsSection('numbers');
            setFbConnectBot(_bot);
            setFbResult(null);
          } : undefined}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><Plus size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">בוט חדש</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed text-right">הזן שם עבור תזרים הזרימה החדש שלך.</p>
            <div className="space-y-6">
              <input 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm font-bold text-right" 
                placeholder="שם הבוט (למשל: שירות לקוחות)..." 
                value={newBotName} 
                onChange={e => setNewBotName(e.target.value)} 
                autoFocus 
              />
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase hover:bg-slate-50">ביטול</button>
                <button onClick={handleCreate} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700">יצירה</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Preview Modal ── */}
      {previewTemplate && (() => {
        const components = previewTemplate.components || [];
        const headerComponent = components.find((c: any) => c.type === 'HEADER');
        const bodyComponent = components.find((c: any) => c.type === 'BODY');
        const footerComponent = components.find((c: any) => c.type === 'FOOTER');
        const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
        
        const templateName = previewTemplate.name || previewTemplate.elementName || previewTemplate.template_name || '';
        const hasImage = headerComponent?.format === 'IMAGE';
        const headerText = headerComponent?.type === 'HEADER' && headerComponent?.format === 'TEXT' ? headerComponent.text : '';
        const bodyText = bodyComponent?.text || '';
        const footerText = footerComponent?.text || '';
        const buttons = buttonsComponent?.buttons || [];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6" onClick={() => setPreviewTemplate(null)}>
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-auto max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageSquare size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{templateName}</h3>
                    <p className="text-emerald-100 text-xs font-medium">תצוגה מקדימה</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* WhatsApp-like Preview */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-white">
                <div className="max-w-md mx-auto">
                  {/* Message Bubble */}
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                    {/* Header Image or Text */}
                    {hasImage && (
                      <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 h-32 flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon size={32} className="text-slate-400 mx-auto mb-1" />
                          <p className="text-slate-500 text-xs font-medium">תמונת ברירת מחדל</p>
                        </div>
                      </div>
                    )}
                    {headerText && (
                      <div className="px-3 pt-3 pb-1">
                        <p className="text-slate-900 font-bold text-sm">{headerText}</p>
                      </div>
                    )}

                    {/* Body */}
                    {bodyText && (
                      <div className="px-3 py-2">
                        <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{bodyText}</p>
                      </div>
                    )}

                    {/* Footer */}
                    {footerText && (
                      <div className="px-3 pb-2">
                        <p className="text-slate-400 text-[10px]">{footerText}</p>
                      </div>
                    )}

                    {/* Buttons */}
                    {buttons.length > 0 && (
                      <div className="border-t border-slate-200">
                        {buttons.map((btn: any, idx: number) => (
                          <div
                            key={idx}
                            className={`px-3 py-2 text-center ${idx < buttons.length - 1 ? 'border-b border-slate-200' : ''}`}
                          >
                            <span className="text-sky-600 font-bold text-xs">
                              {btn.text || `כפתור ${idx + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Template Info */}
                  <div className="mt-3 px-2">
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      {previewTemplate.language && (
                        <span className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          <Globe size={10} />
                          {previewTemplate.language.toUpperCase()}
                        </span>
                      )}
                      {previewTemplate.category && (
                        <span className="bg-sky-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                          {previewTemplate.category}
                        </span>
                      )}
                      {previewTemplate.status && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                          previewTemplate.status === 'APPROVED' ? 'bg-emerald-500 text-white'
                          : previewTemplate.status === 'PENDING' ? 'bg-amber-500 text-white'
                          : 'bg-slate-400 text-white'
                        }`}>
                          {previewTemplate.status === 'APPROVED' && <CheckCircle size={10} />}
                          {previewTemplate.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Legal warning: disabling auto-removal ── */}
      {removalDisableConfirmOpen && removalDraft && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="text-right">
                <h4 className="text-lg font-black text-slate-900 mb-2">אזהרה חוקית — ביטול הסרה אוטומטית</h4>
                <p className="text-sm text-slate-700 font-bold leading-relaxed mb-2">
                  לפי חוק הספאם ותקנות הגנת הפרטיות, חובה לאפשר לנמענים להסיר את עצמם מרשימות תפוצה.
                </p>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  השבתת ההסרה האוטומטית פוטרת את המערכת מאחריות — האחריות לטיפול בבקשות הסרה עוברת אליך באופן מלא ואישי.
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-6 text-right">
              <p className="text-red-700 text-xs font-bold leading-relaxed">
                בלחיצה על &quot;אני מודע/ת ומקבל/ת אחריות&quot; אתה מאשר/ת שקראת את האזהרה לעיל ומקבל/ת על עצמך את מלוא האחריות החוקית לניהול בקשות הסרה.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRemovalDisableConfirmOpen(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all"
              >
                ביטול — השאר פעיל
              </button>
              <button
                onClick={() => {
                  setRemovalDraft({ ...removalDraft, enabled: false });
                  setRemovalDisableConfirmOpen(false);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-200"
              >
                אני מודע/ת ומקבל/ת אחריות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm removal-config change ── */}
      {removalConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="text-right">
                <h4 className="text-lg font-black text-slate-900 mb-1">
                  {removalConfirmOpen === 'save' ? 'לאשר שמירת הגדרת הסרה אישית?' : 'לחזור לברירת המחדל של המערכת?'}
                </h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  {removalConfirmOpen === 'save'
                    ? 'ההגדרה תדרוס את ברירת המחדל הכללית עבור כל הבוטים שלך. מילים חסרות עלולות למנוע הסרה אוטומטית של נמענים שביקשו זאת — באחריותך.'
                    : 'ההגדרה האישית שלך תוסר, וכל הבוטים שלך יחזרו להשתמש במילות המפתח ובהודעה שמוגדרות במערכת.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRemovalConfirmOpen(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold text-xs uppercase hover:bg-slate-50"
                disabled={removalSaving}
              >
                ביטול
              </button>
              <button
                onClick={() => { if (removalConfirmOpen === 'save') saveRemovalConfig(); else revertRemovalToGlobal(); }}
                disabled={removalSaving}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase hover:bg-rose-700 disabled:opacity-60"
              >
                {removalSaving ? 'שומר…' : 'אני מבין/ה, אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;