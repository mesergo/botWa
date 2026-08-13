import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { usePermission } from '../hooks/usePermission';
import AppNav from './AppNav';
import PageTopBar from './PageTopBar';
import { useContactFields } from '../context/ContactFieldsContext';
import AudiencePanel from './send-messages/AudiencePanel';
import ComposerPanel from './send-messages/ComposerPanel';
import BroadcastsView from './send-messages/BroadcastsView';
import TemplatePickerModal from './send-messages/TemplatePickerModal';
import ScheduleDialog from './send-messages/ScheduleDialog';

interface ContactRecord {
  _id: string;
  phone: string;
  full_name?: string;
  whatsapp_name?: string;
  email?: string;
}

interface GroupSummary {
  _id: string;
  name: string;
  is_blocklist: boolean;
  contact_count: number;
}

interface SendBot { id: string; name: string; display_phone_number: string; endpoint: string; }

type AudienceTab = 'contacts' | 'groups' | 'phones';

interface ActiveBroadcast {
  id: string;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  status: 'queued' | 'scheduled' | 'running' | 'completed' | 'failed';
  queuedBehind: boolean;
  queuePosition: number;
}

interface BroadcastCompletionToast {
  id: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  status: 'completed' | 'failed';
}

interface SendMessagesPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenSessions?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenSmsIn?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onSwitchAccount?: (accountId: string) => void;
  onGoHome?: () => void;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const SendMessagesPage: React.FC<SendMessagesPageProps> = ({
  token, currentUser, onBack, onLogout, onOpenContacts, onOpenSessions, onOpenGroups, onOpenSmsIn,
  onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation, onSwitchAccount, onGoHome,
}) => {
  const can = usePermission(currentUser as any);
  const { fields: contactFields } = useContactFields();
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [audienceTab, setAudienceTab] = useState<AudienceTab>('contacts');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [manualPhonesText, setManualPhonesText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [showSelectedContactsOnly, setShowSelectedContactsOnly] = useState(false);
  const [showSelectedGroupsOnly, setShowSelectedGroupsOnly] = useState(false);

  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [pageView, setPageView] = useState<'send' | 'broadcasts'>('send');
  const [allBroadcasts, setAllBroadcasts] = useState<any[]>([]);
  const [allBroadcastsLoading, setAllBroadcastsLoading] = useState(false);
  const [allBroadcastsGroupFilter, setAllBroadcastsGroupFilter] = useState('');
  const [selectedBroadcast, setSelectedBroadcast] = useState<any | null>(null);

  const [messageText, setMessageText] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateParams, setTemplateParams] = useState<any>({});

  const [sendBots, setSendBots] = useState<SendBot[]>([]);
  const [sendBotsLoading, setSendBotsLoading] = useState(false);
  const [selectedSendBotId, setSelectedSendBotId] = useState('');

  const [sending, setSending] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcast | null>(null);
  const [completionToast, setCompletionToast] = useState<BroadcastCompletionToast | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!token) return;
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setGroups((data.groups || []).filter((g: GroupSummary) => !g.is_blocklist));
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setGroupsLoading(false);
    }
  }, [token, authHeader]);

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    setContactsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contacts?page=1&limit=100`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setContacts(data.contacts || []);
    } catch (e) {
      console.error('Failed to load contacts', e);
    } finally {
      setContactsLoading(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    fetchGroups();
    fetchContacts();
  }, [fetchGroups, fetchContacts]);

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/templates`, { headers: authHeader });
      if (!res.ok) {
        setTemplates([]);
        return;
      }
      const data = await res.json();
      if (data.success && data.templates) {
        const list = Array.isArray(data.templates) ? data.templates :
          (data.templates.data ? data.templates.data :
          (data.templates.waba_templates ? data.templates.waba_templates : []));
        setTemplates(list);
      } else {
        setTemplates([]);
      }
    } catch (e) {
      console.error('Failed to fetch templates', e);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [token, authHeader]);

  const initTemplateParams = (template: any) => {
    const params: any = {};
    if (template.components && Array.isArray(template.components)) {
      template.components.forEach((comp: any) => {
        if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          params.header = { type: comp.format.toLowerCase(), url: '' };
        }
        if (comp.type === 'BODY' && comp.text) {
          const matches = comp.text.match(/\{\{\d+\}\}/g);
          if (matches) params.body = matches.map(() => '');
        }
      });
    }
    return params;
  };

  const pickTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplateParams(initTemplateParams(template));
    setShowTemplatePicker(false);
  };

  useEffect(() => {
    if (!token) return;
    setSendBotsLoading(true);
    fetch(`${API_BASE}/bots`, { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then((bots: any[]) => {
        const eligible = (Array.isArray(bots) ? bots : []).filter((b: any) => b.endpoint && b.display_phone_number);
        setSendBots(eligible);
        if (eligible.length === 1) setSelectedSendBotId(eligible[0].id);
      })
      .catch(() => setSendBots([]))
      .finally(() => setSendBotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const manualPhonesList = useMemo(() => (
    manualPhonesText.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean)
  ), [manualPhonesText]);

  useEffect(() => {
    if (!token) return;
    if (selectedContactIds.size === 0 && selectedGroupIds.size === 0 && manualPhonesList.length === 0) {
      setPreviewTotal(null);
      return;
    }
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/groups/broadcast-custom/preview`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_ids: Array.from(selectedContactIds),
            group_ids: Array.from(selectedGroupIds),
            phones: manualPhonesList,
          }),
        });
        const data = await res.json();
        if (res.ok) setPreviewTotal(data.total ?? 0);
      } catch (e) {
        console.error('Failed to preview audience', e);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [selectedContactIds, selectedGroupIds, manualPhonesList, authHeader, token]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return contacts.filter(c => {
      if (showSelectedContactsOnly && !selectedContactIds.has(c._id)) return false;
      if (!q) return true;
      return c.phone.toLowerCase().includes(q) ||
             (c.full_name || '').toLowerCase().includes(q) ||
             (c.whatsapp_name || '').toLowerCase().includes(q);
    });
  }, [contacts, contactSearch, showSelectedContactsOnly, selectedContactIds]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return groups.filter(g => {
      if (showSelectedGroupsOnly && !selectedGroupIds.has(g._id)) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    });
  }, [groups, groupSearch, showSelectedGroupsOnly, selectedGroupIds]);

  const toggleContact = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllContacts = () => {
    const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.has(c._id));
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      filteredContacts.forEach(c => allSelected ? next.delete(c._id) : next.add(c._id));
      return next;
    });
  };

  const toggleAllGroups = () => {
    const allSelected = filteredGroups.length > 0 && filteredGroups.every(g => selectedGroupIds.has(g._id));
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      filteredGroups.forEach(g => allSelected ? next.delete(g._id) : next.add(g._id));
      return next;
    });
  };

  const canSubmit = !!(selectedTemplate || mediaUrl || messageText.trim())
    && (selectedContactIds.size > 0 || selectedGroupIds.size > 0 || manualPhonesList.length > 0)
    && !(sendBots.length > 1 && !selectedSendBotId);

  const submitSend = async (scheduledAtMs?: number) => {
    if (!canSubmit) return;
    setSending(true);
    try {
      const body: any = {
        message: messageText.trim(),
        contact_ids: Array.from(selectedContactIds),
        group_ids: Array.from(selectedGroupIds),
        phones: manualPhonesList,
      };
      if (selectedSendBotId) body.bot_id = selectedSendBotId;
      if (scheduledAtMs) body.scheduled_at = scheduledAtMs;

      if (selectedTemplate) {
        body.isTemplate = true;
        body.templateData = {
          id: selectedTemplate.id,
          name: selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name,
          language: selectedTemplate.language || 'he',
          components: selectedTemplate.components || [],
          params: templateParams,
        };
      } else if (mediaType && mediaUrl) {
        body.media = { type: mediaType, url: mediaUrl, filename: mediaFilename || undefined };
      }

      const res = await fetch(`${API_BASE}/groups/broadcast-custom`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.broadcast_id) {
        setActiveBroadcast({
          id: data.broadcast_id,
          total: data.total || 0,
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          status: data.status || 'queued',
          queuedBehind: data.queued_behind || false,
          queuePosition: data.queue_position || 0,
        });

        setMessageText('');
        setSelectedTemplate(null);
        setTemplateParams({});
        setMediaType(null);
        setMediaUrl('');
        setMediaFilename('');
        setSelectedContactIds(new Set());
        setSelectedGroupIds(new Set());
        setManualPhonesText('');
      } else {
        alert(data.error || 'שגיאה בשליחה');
      }
    } catch (e: any) {
      alert(`שגיאת רשת: ${e?.message || String(e)}`);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!activeBroadcast || activeBroadcast.status === 'completed' || activeBroadcast.status === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/groups/broadcasts/${activeBroadcast.id}`, { headers: authHeader });
        if (!res.ok) return;
        const data = await res.json();
        setActiveBroadcast(prev => {
          if (!prev || prev.id !== data._id) return prev;

          const nextStatus = (data.status || prev.status) as ActiveBroadcast['status'];
          const next: ActiveBroadcast = {
            ...prev,
            processed: data.processed ?? prev.processed,
            sent: data.sent ?? prev.sent,
            failed: data.failed ?? prev.failed,
            skipped: data.skipped ?? prev.skipped,
            status: nextStatus,
            queuedBehind: data.status === 'running' ? false : prev.queuedBehind,
            queuePosition: data.status === 'running' ? 0 : prev.queuePosition,
          };

          if (nextStatus === 'completed' || nextStatus === 'failed') {
            setCompletionToast({
              id: next.id,
              sent: next.sent,
              failed: next.failed,
              skipped: next.skipped,
              total: data.total ?? next.total,
              status: nextStatus,
            });
          }

          return next;
        });
      } catch (e) {
        console.error('Poll broadcast failed', e);
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBroadcast?.id, activeBroadcast?.status, authHeader]);

  useEffect(() => {
    if (!completionToast) return;
    const t = setTimeout(() => {
      setCompletionToast(null);
      setActiveBroadcast(prev => (prev?.id === completionToast.id ? null : prev));
    }, 8000);
    return () => clearTimeout(t);
  }, [completionToast]);

  const loadAllBroadcasts = useCallback(async () => {
    setAllBroadcastsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups/broadcasts?limit=500`, { headers: authHeader });
      const data = await res.json();
      setAllBroadcasts(res.ok ? (data.broadcasts || []) : []);
    } catch (e) {
      console.error('Failed to load broadcasts', e);
      setAllBroadcasts([]);
    } finally {
      setAllBroadcastsLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (pageView === 'broadcasts') {
      loadAllBroadcasts();
    }
  }, [pageView, loadAllBroadcasts]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t: any) =>
      (t.name || t.elementName || t.template_name || '').toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  const templateHeaderComponent = (selectedTemplate?.components || []).find((c: any) => c.type === 'HEADER');
  const templateSampleUrl: string | undefined =
    templateHeaderComponent?.example?.header_url?.[0] ||
    templateHeaderComponent?.example?.header_url ||
    (Array.isArray(templateHeaderComponent?.example?.header_handle)
      ? templateHeaderComponent.example.header_handle[0]
      : undefined) ||
    templateHeaderComponent?.example?.header_handle ||
    undefined;

  const openScheduleDialog = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setScheduleDateTime(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setScheduleDialogOpen(true);
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} token={token} onSwitchAccount={onSwitchAccount} />

      <PageTopBar
        token={token}
        currentUser={currentUser}
        onBack={onBack}
        onLogout={onLogout}
        onOpenAdminPanel={onOpenAdminPanel}
        showMobileNavToggle
        mobileNavOpen={mobileNavOpen}
        onMobileNavToggle={() => setMobileNavOpen((prev) => !prev)}
        badge={{ label: 'שליחת הודעות', icon: <Send size={14} />, className: 'bg-green-50 text-green-700' }}
      />

      <div className="flex-1 flex overflow-hidden">
        <AppNav
          mode="sidebar"
          activePage="send_messages"
          hideMobileTrigger
          mobileMenuOpen={mobileNavOpen}
          onMobileMenuOpenChange={setMobileNavOpen}
          onGoHome={onGoHome}
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
          onGroups={onOpenGroups}
          onSmsIn={onOpenSmsIn}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <Send size={18} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900">שליחת הודעות</h1>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">שילוב אנשי קשר, קבוצות ומספרים למשלוח אחד — ללא כפילויות</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPageView('send')}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${pageView === 'send' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >שליחת הודעות</button>
                  <button
                    onClick={() => setPageView('broadcasts')}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${pageView === 'broadcasts' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >שליחות מרוכזות</button>
                </div>
              </div>
            </div>

            {pageView === 'broadcasts' ? (
              <BroadcastsView
                allBroadcastsLoading={allBroadcastsLoading}
                allBroadcasts={allBroadcasts}
                allBroadcastsGroupFilter={allBroadcastsGroupFilter}
                setAllBroadcastsGroupFilter={setAllBroadcastsGroupFilter}
                groups={groups}
                selectedBroadcast={selectedBroadcast}
                setSelectedBroadcast={setSelectedBroadcast}
                loadAllBroadcasts={loadAllBroadcasts}
                authHeader={authHeader}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                <AudiencePanel
                  contacts={contacts}
                  contactsLoading={contactsLoading}
                  filteredContacts={filteredContacts}
                  selectedContactIds={selectedContactIds}
                  toggleContact={toggleContact}
                  toggleAllContacts={toggleAllContacts}
                  contactSearch={contactSearch}
                  setContactSearch={setContactSearch}
                  showSelectedContactsOnly={showSelectedContactsOnly}
                  setShowSelectedContactsOnly={setShowSelectedContactsOnly}
                  groups={groups}
                  groupsLoading={groupsLoading}
                  filteredGroups={filteredGroups}
                  selectedGroupIds={selectedGroupIds}
                  toggleGroup={toggleGroup}
                  toggleAllGroups={toggleAllGroups}
                  groupSearch={groupSearch}
                  setGroupSearch={setGroupSearch}
                  showSelectedGroupsOnly={showSelectedGroupsOnly}
                  setShowSelectedGroupsOnly={setShowSelectedGroupsOnly}
                  manualPhonesText={manualPhonesText}
                  setManualPhonesText={setManualPhonesText}
                  manualPhonesList={manualPhonesList}
                  audienceTab={audienceTab}
                  setAudienceTab={setAudienceTab}
                  previewLoading={previewLoading}
                  previewTotal={previewTotal}
                />
                <ComposerPanel
                  sendBotsLoading={sendBotsLoading}
                  sendBots={sendBots}
                  selectedSendBotId={selectedSendBotId}
                  setSelectedSendBotId={setSelectedSendBotId}
                  selectedTemplate={selectedTemplate}
                  setSelectedTemplate={setSelectedTemplate}
                  templateParams={templateParams}
                  setTemplateParams={setTemplateParams}
                  templateSampleUrl={templateSampleUrl}
                  templates={templates}
                  fetchTemplates={fetchTemplates}
                  setShowTemplatePicker={setShowTemplatePicker}
                  contactFields={contactFields}
                  agentName={currentUser?.name}
                  messageText={messageText}
                  setMessageText={setMessageText}
                  mediaType={mediaType}
                  setMediaType={setMediaType}
                  mediaUrl={mediaUrl}
                  setMediaUrl={setMediaUrl}
                  mediaFilename={mediaFilename}
                  setMediaFilename={setMediaFilename}
                  token={token}
                  sending={sending}
                  canSubmit={canSubmit}
                  onSendNow={() => submitSend()}
                  onOpenSchedule={openScheduleDialog}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      <TemplatePickerModal
        show={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        templateSearch={templateSearch}
        setTemplateSearch={setTemplateSearch}
        templatesLoading={templatesLoading}
        filteredTemplates={filteredTemplates}
        onPickTemplate={pickTemplate}
      />

      <ScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        scheduleDateTime={scheduleDateTime}
        setScheduleDateTime={setScheduleDateTime}
        sending={sending}
        onConfirm={ms => submitSend(ms)}
      />

      {activeBroadcast && activeBroadcast.status !== 'completed' && activeBroadcast.status !== 'failed' && (
        <div
          className="fixed left-6 z-[70] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80"
          style={{ bottom: '1.5rem' }}
          dir="rtl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Send size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-900 text-sm truncate">שולח הודעה</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
                {activeBroadcast.status === 'scheduled' && 'ההודעה תוזמנה לשליחה'}
                {activeBroadcast.status === 'queued' && (activeBroadcast.queuedBehind ? `ממתין בתור (מיקום ${activeBroadcast.queuePosition})...` : 'מתחיל שליחה...')}
                {activeBroadcast.status === 'running' && `${activeBroadcast.processed}/${activeBroadcast.total} עובדו`}
              </p>
            </div>
            {(activeBroadcast.status === 'scheduled' || activeBroadcast.status === 'queued') ? (
              <Clock size={18} className="text-blue-500 flex-shrink-0" />
            ) : (
              <div className="animate-spin w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full flex-shrink-0" />
            )}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${activeBroadcast.total > 0 ? (activeBroadcast.processed / activeBroadcast.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs font-bold">
            <span className="text-green-600">✓ {activeBroadcast.sent}</span>
            <span className="text-red-500">✗ {activeBroadcast.failed}</span>
            <span className="text-amber-500">⊘ {activeBroadcast.skipped}</span>
          </div>
        </div>
      )}

      {completionToast && (
        <div
          className={`fixed left-6 z-[70] shadow-2xl rounded-2xl p-4 w-80 bg-white ${
            completionToast.status === 'completed' ? 'border border-green-200' : 'border border-red-200'
          }`}
          style={{ bottom: '1.5rem' }}
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              completionToast.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {completionToast.status === 'completed' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-slate-900 text-sm">{completionToast.status === 'completed' ? 'השליחה הסתיימה' : 'השליחה נכשלה'}</h4>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                נשלחו {completionToast.sent} · נכשלו {completionToast.failed} · דולגו {completionToast.skipped}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-1">סה"כ {completionToast.total} נמענים</p>
            </div>
            <button
              onClick={() => {
                setCompletionToast(null);
                setActiveBroadcast(prev => (prev?.id === completionToast.id ? null : prev));
              }}
              className="p-1 text-slate-300 hover:text-slate-600 rounded-lg flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendMessagesPage;
