import React, { useState, useEffect } from 'react';
import { Plus, Bot, ArrowLeft, Trash2, Calendar, LogOut, Shield, UserCog, Users, List, Settings, Save, User as UserIcon, Phone, Mail, Star, Copy, Check, Wifi, Gauge, MessageSquare, Globe, Layers, CheckCircle, Eye, EyeOff, X, Image as ImageIcon } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { BotFlow } from '../types';
import SubUsersTab from './SubUsersTab';

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
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  onOpenAdminPanel?: () => void;
  onStopImpersonation?: () => void;
  onOpenContacts?: () => void;
  onOpenSessions?: () => void;
  onConnectFacebook?: (bot: BotFlow) => Promise<void>;
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
  };
  limits_in_effect?: {
    maxBots: number;
    maxVersions: number;
    versionPrice: number;
    botPrice: number;
    canPublish?: boolean;
  };
  active_bots_count?: number;
  flows_count?: number;
}

const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const Dashboard: React.FC<DashboardProps> = ({ bots, onEnterBot, onCreateBot, onDeleteBot, onSetDefaultBot, onLogout, currentUser, onOpenAdminPanel, onStopImpersonation, onOpenContacts, onOpenSessions, onConnectFacebook, token, initialTab }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [facebookConfirmBot, setFacebookConfirmBot] = useState<BotFlow | null>(null);
  const [facebookSending, setFacebookSending] = useState(false);
  const [facebookDone, setFacebookDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'bots' | 'settings' | 'users'>(initialTab ?? 'bots');

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

  // WA templates state (Settings tab)
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<Record<string, boolean>>({});
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

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
    }
  }, [activeTab]);

  const isRep = currentUser?.role === 'rep' || currentUser?.role === 'rep_bot';
  const isCompanyManager = currentUser?.role === 'user';

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
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto" />
        </div>
        {/* ── Navigation tabs ── */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir="rtl">
          <button
            onClick={() => setActiveTab('bots')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'bots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Bot size={16} /> הבוטים שלי
          </button>
          {onOpenSessions && (
            <button
              onClick={onOpenSessions}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <List size={16} /> שיחות
            </button>
          )}
          {onOpenContacts && !isRep && (
            <button
              onClick={onOpenContacts}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <Users size={16} /> אנשי קשר
            </button>
          )}
          {!isRep && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings size={16} /> הגדרות
            </button>
          )}
          {isCompanyManager && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserCog size={16} /> משתמשים
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
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
          <div
            title={currentUser?.name || currentUser?.email || ''}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none"
          >
            {(currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase()}
          </div>
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"><LogOut size={22} /></button>
        </div>
      </nav>

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-black text-slate-900 mb-10 text-right">הגדרות</h1>

            {profileLoading ? (
              <div className="text-center text-slate-400 py-20 font-bold">טוען פרטים...</div>
            ) : profile ? (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">

                {/* Editable personal details */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <UserIcon size={14} /> פרטים אישיים
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">שם מלא</label>
                      <input
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">אימייל</label>
                      <input
                        type="email"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">טלפון</label>
                      <input
                        type="tel"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-right"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                        placeholder="05X-XXXXXXX"
                      />
                    </div>
                  </div>

                  {profileError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-bold text-right">
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-600 text-sm font-bold text-right flex items-center gap-2">
                      <Check size={16} /> הפרטים נשמרו בהצלחה
                    </div>
                  )}

                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="mt-6 flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-60 active:scale-95"
                  >
                    <Save size={18} />
                    {profileSaving ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </div>

                {/* Read-only account details */}
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
                        <span className={`w-1.5 h-1.5 rounded-full ${ profile.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
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

                    {profile.dialog360_bot_id && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs font-bold text-slate-400">Bot ID (WhatsApp)</span>
                        <span className="text-slate-800 font-mono text-sm bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 select-all">{profile.dialog360_bot_id}</span>
                      </div>
                    )}

                  </div>
                </div>

                {/* Connection Settings */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Wifi size={14} /> הגדרות חיבור
                  </h2>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">Bot ID</span>
                      <span className="text-slate-800 font-mono text-sm bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 select-all">{profile.dialog360_bot_id || '-'}</span>
                    </div>
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

                {/* Personal Quota */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Gauge size={14} /> מכסה אישיות
                  </h2>
                  <div className="space-y-5">
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

              </div>

              {/* ── WA Message Templates ── */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mt-2">
                <h2 dir="rtl" className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
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

            </>
            ) : (
              <div className="text-center text-slate-400 py-20 font-bold">לא ניתן לטעון פרטים. אנא נסה שוב.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Bots Tab ── */}
      {activeTab === 'bots' && (
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10 flex-row-reverse">
            <h1 className="text-3xl font-black text-slate-900">הבוטים שלי</h1>
            {!isRep && (
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
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between h-[280px]"
                onClick={() => onEnterBot(bot)}
              >
                <div>
                  <div className="flex items-center justify-between mb-6 flex-row-reverse">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Bot size={28} />
                    </div>
                    <div className="flex items-center gap-2">
                      {bot.is_default && (
                        <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold">
                          ברירת מחדל
                        </div>
                      )}
                      {!isRep && !bot.is_default && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSetDefaultBot(bot.id); }}
                          className="px-3 py-1 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all text-xs font-bold"
                          title="הגדר כברירת מחדל"
                        >
                          הגדר כברירת מחדל
                        </button>
                      )}
                      {onConnectFacebook && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFacebookConfirmBot(bot); setFacebookDone(false); }}
                          className="p-2 text-slate-200 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="חיבור לפייסבוק"
                        >
                          <FacebookIcon size={18} />
                        </button>
                      )}
                      {!isRep && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteBot(bot.id); }}
                        className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 truncate">{bot.name}</h3>
                  <p className="text-slate-400 text-sm font-bold flex items-center justify-end gap-2 uppercase tracking-widest">
                    <span>{formatDate(bot.created_at)}</span>
                    <Calendar size={14} />
                  </p>
                </div>
                
                <div className="flex items-center justify-end gap-2 text-blue-600 font-black text-sm group-hover:gap-4 transition-all mt-6">
                  <span>כניסה לעריכה</span>
                  <ArrowLeft size={18} />
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
      {activeTab === 'users' && isCompanyManager && (
        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-5xl mx-auto">
            <SubUsersTab token={token} />
          </div>
        </div>
      )}

      {facebookConfirmBot && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 border border-slate-100" dir="rtl">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
              <FacebookIcon size={32} />
            </div>
            {facebookDone ? (
              <>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">הבקשה נשלחה!</h3>
                <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">הצוות שלנו יצור איתך קשר בקרוב לחיבור לפייסבוק.</p>
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
                  הצוות שלנו יקבל את הפרטים שלך ויצור איתך קשר.
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
                      if (!onConnectFacebook) return;
                      setFacebookSending(true);
                      try {
                        await onConnectFacebook(facebookConfirmBot);
                        setFacebookDone(true);
                      } catch {
                        alert('שגיאה בשליחת הבקשה. אנא נסה שוב.');
                      } finally {
                        setFacebookSending(false);
                      }
                    }}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"
                    disabled={facebookSending}
                  >
                    {facebookSending ? 'שולח...' : 'אישור'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
    </div>
  );
};

export default Dashboard;