import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone, Search, Users, LogOut, List, Shield, Settings, UserCog, Plus,
  Edit2, Trash2, X, Check, Bot, Send, UserPlus, UserMinus, Ban, Layers,
  ChevronRight, ChevronLeft, ArrowRight, MessageSquare, FileText, History,
  Calendar, Eye, AlertTriangle, CheckCircle2, Clock, Paperclip, Image as ImageIcon, Video, File as FileLucide
} from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { FileUploader } from './FileUploader';
import { usePermission } from '../hooks/usePermission';
import AppNav from './AppNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupSummary {
  _id: string;
  name: string;
  is_blocklist: boolean;
  contact_count: number; 
}

interface ContactRecord {
  _id: string;
  phone: string;
  full_name?: string;
  whatsapp_name?: string;
  email?: string;
}

interface GroupDetail {
  _id: string;
  name: string;
  is_blocklist: boolean;
  contacts: ContactRecord[];
  phones: string[];
}

interface GroupsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenSessions?: (phone?: string) => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

// ─── Component ────────────────────────────────────────────────────────────────

const GroupsPage: React.FC<GroupsPageProps> = ({
  token, currentUser, onBack, onLogout, onOpenContacts, onOpenSessions,
  onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation,
}) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create/rename
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add members modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [allContacts, setAllContacts] = useState<ContactRecord[]>([]);
  const [allContactsLoading, setAllContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [manualPhones, setManualPhones] = useState('');
  const [addingMembers, setAddingMembers] = useState(false);

  // Send message modal
  const [sendOpen, setSendOpen] = useState(false);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);

  // Background broadcast progress / toast
  const [activeBroadcast, setActiveBroadcast] = useState<{
    id: string;
    total: number;
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    groupName: string;
  } | null>(null);
  const [completionToast, setCompletionToast] = useState<{
    sent: number; failed: number; skipped: number; total: number; groupName: string;
  } | null>(null);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateParams, setTemplateParams] = useState<any>({});

  // Free-form media attachment (when not using a template)
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaFilename, setMediaFilename] = useState<string>('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Broadcast history
  const [activeTab, setActiveTab] = useState<'members' | 'history' | 'removals'>('members');
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any | null>(null);

  // Remove-member confirmation + removals report
  const [removeTarget, setRemoveTarget] = useState<ContactRecord | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removals, setRemovals] = useState<any[]>([]);
  const [removalsLoading, setRemovalsLoading] = useState(false);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ── Fetch groups list ────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setGroups(data.groups || []);
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // ── Fetch detail for a group ─────────────────────────────────────────────
  const fetchGroupDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/groups/${id}`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setSelectedGroup(data);
    } catch (e) {
      console.error('Failed to load group detail', e);
    } finally {
      setLoadingDetail(false);
    }
  }, [authHeader]);

  // ── Create group ─────────────────────────────────────────────────────────
  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewGroupName('');
        fetchGroups();
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Rename group ────────────────────────────────────────────────────────
  const startRename = (g: GroupSummary) => {
    setRenamingId(g._id);
    setRenameValue(g.name);
  };
  const saveRename = async () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      const res = await fetch(`${API_BASE}/groups/${renamingId}`, {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setRenamingId(null);
        fetchGroups();
        if (selectedGroup?._id === renamingId) {
          setSelectedGroup({ ...selectedGroup, name });
        }
      }
    } catch (e) { console.error(e); }
  };

  // ── Delete group ────────────────────────────────────────────────────────
  const deleteGroup = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/groups/${id}`, { method: 'DELETE', headers: authHeader });
      if (res.ok) {
        setDeletingId(null);
        if (selectedGroup?._id === id) setSelectedGroup(null);
        fetchGroups();
      }
    } catch (e) { console.error(e); }
  };

  // ── Load contacts for add-members modal ─────────────────────────────────
  const openAddMembers = async () => {
    if (!selectedGroup) return;
    setAddModalOpen(true);
    setSelectedContactIds(new Set());
    setManualPhones('');
    setContactSearch('');
    setAllContactsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contacts?page=1&limit=100`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setAllContacts(data.contacts || []);
    } finally {
      setAllContactsLoading(false);
    }
  };

  const filteredAddable = useMemo(() => {
    const memberIds = new Set((selectedGroup?.contacts || []).map(c => c._id));
    const q = contactSearch.trim().toLowerCase();
    return allContacts.filter(c => {
      if (memberIds.has(c._id)) return false;
      if (!q) return true;
      return (
        c.phone.toLowerCase().includes(q) ||
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.whatsapp_name || '').toLowerCase().includes(q)
      );
    });
  }, [allContacts, contactSearch, selectedGroup]);

  const toggleContactSelected = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submitAddMembers = async () => {
    if (!selectedGroup) return;
    const ids = Array.from(selectedContactIds);
    const phones = manualPhones
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (ids.length === 0 && phones.length === 0) {
      setAddModalOpen(false);
      return;
    }
    setAddingMembers(true);
    try {
      const res = await fetch(`${API_BASE}/groups/${selectedGroup._id}/members`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_ids: ids, phones }),
      });
      if (res.ok) {
        setAddModalOpen(false);
        await fetchGroupDetail(selectedGroup._id);
        fetchGroups();
      }
    } finally {
      setAddingMembers(false);
    }
  };

  // ── Remove member ───────────────────────────────────────────────────────
  const openRemoveMember = (contact: ContactRecord) => {
    setRemoveTarget(contact);
    setRemoveReason('');
  };
  const closeRemoveMember = () => {
    if (removing) return;
    setRemoveTarget(null);
    setRemoveReason('');
  };
  const confirmRemoveMember = async () => {
    if (!selectedGroup || !removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`${API_BASE}/groups/${selectedGroup._id}/members/${removeTarget._id}`, {
        method: 'DELETE',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: removeReason.trim() }),
      });
      if (res.ok) {
        setRemoveTarget(null);
        setRemoveReason('');
        await fetchGroupDetail(selectedGroup._id);
        fetchGroups();
        if (activeTab === 'removals') fetchRemovals();
      }
    } catch (e) { console.error(e); }
    finally { setRemoving(false); }
  };

  // ── Removals report ─────────────────────────────────────────────────────
  const fetchRemovals = useCallback(async () => {
    if (!selectedGroup) return;
    setRemovalsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups/removals/log?group_id=${selectedGroup._id}`, { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setRemovals(data.items || []);
      }
    } catch (e) { console.error(e); }
    finally { setRemovalsLoading(false); }
  }, [selectedGroup, authHeader]);

  // ── Send broadcast (enqueues; processes in background) ─────────────────
  const submitSend = async () => {
    if (!selectedGroup) return;
    const message = sendText.trim();
    const usingTemplate = !!selectedTemplate;
    const usingMedia = !!(mediaType && mediaUrl);
    if (!usingTemplate && !usingMedia && !message) return;
    setSending(true);
    setSendResult(null);
    try {
      const body: any = { message };
      if (usingTemplate) {
        body.isTemplate = true;
        body.templateData = {
          id: selectedTemplate.id,
          name: selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name,
          language: selectedTemplate.language || 'he',
          components: selectedTemplate.components || [],
          params: templateParams,
        };
      } else if (usingMedia) {
        body.media = { type: mediaType, url: mediaUrl, filename: mediaFilename || undefined };
      }
      const res = await fetch(`${API_BASE}/groups/${selectedGroup._id}/send`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.broadcast_id) {
        // Track in background, close modal, show floating progress toast
        setActiveBroadcast({
          id: data.broadcast_id,
          total: data.total || selectedGroup.contacts.length,
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          status: 'queued',
          groupName: selectedGroup.name,
        });
        setSendOpen(false);
        setSendText('');
        setSelectedTemplate(null);
        setTemplateParams({});
        setMediaType(null);
        setMediaUrl('');
        setMediaFilename('');
      } else {
        alert(data.error || 'שגיאה בשליחה');
      }
    } catch (e) {
      alert('שגיאת רשת');
    } finally {
      setSending(false);
    }
  };

  // Poll active broadcast every 2 seconds until completed/failed
  useEffect(() => {
    if (!activeBroadcast || activeBroadcast.status === 'completed' || activeBroadcast.status === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/groups/broadcasts/${activeBroadcast.id}`, { headers: authHeader });
        if (!res.ok) return;
        const data = await res.json();
        setActiveBroadcast(prev => prev ? {
          ...prev,
          processed: data.processed ?? prev.processed,
          sent: data.sent ?? prev.sent,
          failed: data.failed ?? prev.failed,
          skipped: data.skipped ?? prev.skipped,
          status: data.status || prev.status,
        } : null);
        if (data.status === 'completed' || data.status === 'failed') {
          setCompletionToast({
            sent: data.sent || 0,
            failed: data.failed || 0,
            skipped: data.skipped || 0,
            total: data.total || 0,
            groupName: activeBroadcast.groupName,
          });
          // refresh history list if user is viewing it
          if (activeTab === 'history' && selectedGroup?._id === data.group_id) {
            fetchBroadcasts();
          }
        }
      } catch (e) {
        console.error('Poll broadcast failed', e);
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBroadcast?.id, activeBroadcast?.status, authHeader, activeTab, selectedGroup?._id]);

  // Auto-dismiss the completion toast after 8 seconds
  useEffect(() => {
    if (!completionToast) return;
    const t = setTimeout(() => { setCompletionToast(null); setActiveBroadcast(null); }, 8000);
    return () => clearTimeout(t);
  }, [completionToast]);

  // ── Templates ───────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/templates`, { headers: authHeader });
      if (!res.ok) { setTemplates([]); return; }
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

  // ── Broadcast history ───────────────────────────────────────────────────
  const fetchBroadcasts = useCallback(async () => {
    if (!selectedGroup || !token) return;
    setBroadcastsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups/broadcasts?group_id=${selectedGroup._id}&limit=100`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setBroadcasts(data.broadcasts || []);
    } catch (e) {
      console.error('Failed to load broadcasts', e);
    } finally {
      setBroadcastsLoading(false);
    }
  }, [selectedGroup, token, authHeader]);

  const fetchBroadcastDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/groups/broadcasts/${id}`, { headers: authHeader });
      const data = await res.json();
      if (res.ok) setSelectedBroadcast(data);
    } catch (e) { console.error(e); }
  };

  // Reset to members tab when switching group; auto-load history when tab=history
  useEffect(() => {
    setActiveTab('members');
    setBroadcasts([]);
    setSelectedBroadcast(null);
  }, [selectedGroup?._id]);

  useEffect(() => {
    if (activeTab === 'history' && selectedGroup) fetchBroadcasts();
    if (activeTab === 'removals' && selectedGroup) fetchRemovals();
  }, [activeTab, selectedGroup, fetchBroadcasts, fetchRemovals]);

  const openSendModal = () => {
    setSendOpen(true);
    setSendResult(null);
    setSelectedTemplate(null);
    setTemplateParams({});
    setSendText('');
    if (templates.length === 0) fetchTemplates();
  };

  // ── Render helpers ──────────────────────────────────────────────────────
  const can = usePermission(currentUser as any);
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';
  const blocklist = groups.find(g => g.is_blocklist);
  const regularGroups = groups.filter(g => !g.is_blocklist);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} />

      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0" dir="ltr">
        <div className="flex items-center gap-4">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer" onClick={onBack} />
        </div>

<div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name ?? currentUser.email}</span>
          )}
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button onClick={onOpenAdminPanel} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors">
              <Shield size={18} /> פאנל ניהול
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none">
            {firstName}
          </div>
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* ── App nav sidebar ── */}
        <AppNav
          mode="sidebar"
          activePage="groups"
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />
        {/* Sidebar — list of groups */}
        <aside className="w-96 border-l border-slate-100 bg-white flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">רשימות תפוצה</h2>
                <p className="text-xs font-semibold text-slate-400">{regularGroups.length} רשימות</p>
              </div>
            </div>

            {/* Create new */}
            {can('groups.create') && (
            <div className="flex items-center gap-2">
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
                placeholder="שם רשימה חדשה..."
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-500 transition-all"
              />
              <button
                onClick={createGroup}
                disabled={creating || !newGroupName.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                title="צור קבוצה"
              >
                <Plus size={18} />
              </button>
            </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-300">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full" />
              </div>
            ) : (
              <>
                {/* Blocklist always at the top */}
                {blocklist && (
                  <button
                    onClick={() => fetchGroupDetail(blocklist._id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-2xl transition-all border ${
                      selectedGroup?._id === blocklist._id
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-red-100 hover:bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                        <Ban size={17} />
                      </div>
                      <div className="text-right min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{blocklist.name}</p>
                        <p className="text-xs font-semibold text-red-500">לא מקבלים הודעות מאף קבוצה</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-red-500 flex-shrink-0">{blocklist.contact_count}</span>
                  </button>
                )}

                {regularGroups.length === 0 ? (
                  <div className="text-center py-10 text-slate-300">
                    <Layers size={48} strokeWidth={1} className="mx-auto mb-3" />
                    <p className="text-sm font-bold">אין רשימות תפוצה עדיין</p>
                  </div>
                ) : (
                  regularGroups.map(g => (
                    <div
                      key={g._id}
                      onClick={() => fetchGroupDetail(g._id)}
                      className={`group flex items-center justify-between gap-3 px-4 py-3 mb-2 rounded-2xl cursor-pointer transition-all border ${
                        selectedGroup?._id === g._id
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Users size={17} />
                        </div>
                        <div className="text-right min-w-0 flex-1">
                          {renamingId === g._id ? (
                            <input
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              autoFocus
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded-lg outline-none"
                            />
                          ) : (
                            <>
                              <p className="text-sm font-bold text-slate-900 truncate">{g.name}</p>
                              <p className="text-xs font-semibold text-slate-400">{g.contact_count} אנשי קשר</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {renamingId === g._id ? (
                          <>
                            <button onClick={saveRename} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setRenamingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                          </>
                        ) : deletingId === g._id ? (
                          <>
                            <button onClick={() => deleteGroup(g._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setDeletingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startRename(g)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Edit2 size={14} /></button>
                            <button onClick={() => setDeletingId(g._id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main panel — selected group */}
        <main className="flex-1 overflow-y-auto p-8">
          {!selectedGroup ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Layers size={72} strokeWidth={1} />
              <p className="text-xl font-bold mt-4">בחר רשימת תפוצה</p>
              <p className="text-sm font-semibold mt-1">או צור רשימה חדשה</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedGroup.is_blocklist ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {selectedGroup.is_blocklist ? <Ban size={26} /> : <Users size={26} />}
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900">{selectedGroup.name}</h1>
                    <p className="text-slate-400 text-sm font-semibold mt-0.5">
                      {selectedGroup.contacts.length} אנשי קשר
                      {selectedGroup.is_blocklist && ' · לא מקבלים שום הודעה מקבוצות תפוצה'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {can('groups.add_contact') && (
                  <button
                    onClick={openAddMembers}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-colors"
                  >
                    <UserPlus size={16} /> הוסף אנשי קשר
                  </button>
                  )}
                  {!selectedGroup.is_blocklist && can('groups.send_message') && (
                    <button
                      onClick={openSendModal}
                      disabled={selectedGroup.contacts.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      <Send size={16} /> שלח הודעה לקבוצה
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                    activeTab === 'members' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users size={16} /> אנשי קשר
                </button>
                {!selectedGroup.is_blocklist && (
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                      activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <History size={16} /> דוח שליחות
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('removals')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                    activeTab === 'removals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Trash2 size={16} /> דוח מחיקות
                </button>
              </div>

              {/* Members table */}
              {activeTab === 'members' && (loadingDetail ? (
                <div className="flex items-center justify-center py-24 text-slate-300">
                  <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
                </div>
              ) : selectedGroup.contacts.length === 0 ? (
                <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                  <Users size={64} strokeWidth={1} />
                  <p className="text-xl font-bold">אין אנשי קשר בקבוצה זו</p>
                  {can('groups.add_contact') && (
                  <button
                    onClick={openAddMembers}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-colors mt-2"
                  >
                    <UserPlus size={16} /> הוסף אנשי קשר ראשונים
                  </button>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-[1.6fr_1.5fr_1.3fr_1.6fr_5rem] gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                    <span>טלפון</span>
                    <span>שם מלא</span>
                    <span>שם וואטסאפ</span>
                    <span>מייל</span>
                    <span></span>
                  </div>
                  {selectedGroup.contacts.map((c, idx) => (
                    <div key={c._id} className={`grid grid-cols-[1.6fr_1.5fr_1.3fr_1.6fr_5rem] gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors ${idx !== selectedGroup.contacts.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                          <Phone size={15} />
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">{c.phone}</p>
                      </div>
                      <div className="text-sm font-semibold text-slate-700 truncate">
                        {c.full_name || <span className="text-slate-300 font-normal">—</span>}
                      </div>
                      <div className="text-sm font-semibold text-slate-700 truncate">
                        {c.whatsapp_name || <span className="text-slate-300 font-normal">—</span>}
                      </div>
                      <div className="text-sm text-slate-500 font-medium truncate">
                        {c.email || <span className="text-slate-300">—</span>}
                      </div>
                      <div className="flex items-center justify-end">
                        {can('groups.remove_contact') && (
                        <button
                          onClick={() => openRemoveMember(c)}
                          title="הסר מהקבוצה"
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <UserMinus size={16} />
                        </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* History tab */}
              {activeTab === 'history' && !selectedGroup.is_blocklist && (
                broadcastsLoading ? (
                  <div className="flex items-center justify-center py-24 text-slate-300">
                    <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
                  </div>
                ) : broadcasts.length === 0 ? (
                  <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                    <History size={64} strokeWidth={1} />
                    <p className="text-xl font-bold">טרם נשלחו הודעות לקבוצה זו</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-[10rem_1fr_5rem_5rem_5rem_5rem_3rem] gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                      <span>תאריך</span>
                      <span>תוכן</span>
                      <span>סה"כ</span>
                      <span>נשלחו</span>
                      <span>נכשלו</span>
                      <span>דולגו</span>
                      <span></span>
                    </div>
                    {broadcasts.map((b, idx) => (
                      <div
                        key={b._id}
                        onClick={() => fetchBroadcastDetail(b._id)}
                        className={`grid grid-cols-[10rem_1fr_5rem_5rem_5rem_5rem_3rem] gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors cursor-pointer ${idx !== broadcasts.length - 1 ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Calendar size={13} className="text-slate-400" />
                          {new Date(b.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <div className="min-w-0">
                          {b.is_template ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-black">תבנית</span>
                              <span className="text-sm font-bold text-slate-800 truncate">{b.template_name}</span>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 truncate" title={b.message}>{b.message}</p>
                          )}
                        </div>
                        <span className="text-sm font-black text-slate-700">{b.total}</span>
                        <span className="text-sm font-black text-green-600">{b.sent}</span>
                        <span className="text-sm font-black text-red-500">{b.failed}</span>
                        <span className="text-sm font-black text-amber-500">{b.skipped}</span>
                        <Eye size={16} className="text-slate-300" />
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Removals tab */}
              {activeTab === 'removals' && (
                removalsLoading ? (
                  <div className="flex items-center justify-center py-24 text-slate-300">
                    <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
                  </div>
                ) : removals.length === 0 ? (
                  <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                    <Trash2 size={64} strokeWidth={1} />
                    <p className="text-xl font-bold">לא בוצעו מחיקות בקבוצה זו</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-[10rem_1.4fr_1.4fr_2fr_1fr] gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                      <span>תאריך</span>
                      <span>טלפון</span>
                      <span>שם</span>
                      <span>סיבת הסרה</span>
                      <span>בוצע ע"י</span>
                    </div>
                    {removals.map((r, idx) => (
                      <div
                        key={r._id}
                        className={`grid grid-cols-[10rem_1.4fr_1.4fr_2fr_1fr] gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors ${idx !== removals.length - 1 ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Calendar size={13} className="text-slate-400" />
                          {new Date(r.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">{r.phone || <span className="text-slate-300 font-normal">—</span>}</p>
                        <p className="text-sm font-semibold text-slate-700 truncate">{r.full_name || r.whatsapp_name || <span className="text-slate-300 font-normal">—</span>}</p>
                        <p className="text-sm text-slate-600 truncate" title={r.reason}>{r.reason || <span className="text-slate-300">ללא סיבה</span>}</p>
                        <p className="text-xs font-semibold text-slate-400 truncate">{r.removed_by || '—'}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add Members modal */}
      {addModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">הוסף אנשי קשר ל-{selectedGroup.name}</h2>
              <button onClick={() => setAddModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Search existing contacts */}
              <div className="relative mb-4">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="חפש איש קשר קיים..."
                  className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600"
                />
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-72 overflow-y-auto mb-4">
                {allContactsLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-300">
                    <div className="animate-spin w-7 h-7 border-4 border-slate-200 border-t-blue-500 rounded-full" />
                  </div>
                ) : filteredAddable.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm font-semibold">אין אנשי קשר זמינים להוספה</div>
                ) : (
                  filteredAddable.map(c => {
                    const checked = selectedContactIds.has(c._id);
                    return (
                      <label
                        key={c._id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${checked ? 'bg-blue-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleContactSelected(c._id)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{c.full_name || c.phone}</p>
                          <p className="text-xs text-slate-400 font-semibold truncate">{c.phone}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Manual phones */}
              <div>
                <label className="text-xs font-black text-slate-500 mb-2 block">או הוסף מספרי טלפון ידנית (מופרדים בפסיק או שורה חדשה):</label>
                <textarea
                  value={manualPhones}
                  onChange={e => setManualPhones(e.target.value)}
                  placeholder="0501234567, 0529876543"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 resize-none"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-5 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-sm"
              >ביטול</button>
              <button
                onClick={submitAddMembers}
                disabled={addingMembers || (selectedContactIds.size === 0 && !manualPhones.trim())}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {addingMembers ? 'מוסיף...' : 'הוסף'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send broadcast modal */}
      {sendOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">שלח הודעה ל-{selectedGroup.name}</h2>
              <button onClick={() => setSendOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-sm font-semibold text-slate-500 mb-4">
                ההודעה תישלח אל {selectedGroup.contacts.length} אנשי קשר. אנשי קשר שנמצאים ברשימת ההסרה יסוננו אוטומטית.
              </p>

              {/* Template chooser */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-500">הודעת תבנית (אופציונלי):</label>
                  {selectedTemplate && (
                    <button
                      onClick={() => { setSelectedTemplate(null); setTemplateParams({}); }}
                      className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"
                    >
                      <X size={12} /> בטל תבנית
                    </button>
                  )}
                </div>

                {selectedTemplate ? (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={16} className="text-purple-600" />
                      <span className="text-sm font-black text-purple-900">
                        {selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name}
                      </span>
                      <span className="text-xs font-bold text-purple-500">({selectedTemplate.language || 'he'})</span>
                    </div>
                    {/* Body preview */}
                    {(selectedTemplate.components || []).map((comp: any, i: number) => (
                      <div key={i} className="text-xs text-slate-600 mb-1">
                        {comp.type === 'BODY' && comp.text && <span className="whitespace-pre-wrap">{comp.text}</span>}
                      </div>
                    ))}

                    {/* Header media URL input */}
                    {templateParams.header && (
                      <div className="mt-3">
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          כתובת {templateParams.header.type === 'image' ? 'תמונה' : templateParams.header.type === 'video' ? 'וידאו' : 'מסמך'} (URL):
                        </label>
                        <input
                          value={templateParams.header.url}
                          onChange={e => setTemplateParams((p: any) => ({ ...p, header: { ...p.header, url: e.target.value } }))}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-500"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {/* Body params */}
                    {Array.isArray(templateParams.body) && templateParams.body.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-bold text-slate-500 block">פרמטרים:</label>
                        {templateParams.body.map((val: string, i: number) => (
                          <input
                            key={i}
                            value={val}
                            onChange={e => setTemplateParams((p: any) => {
                              const body = [...(p.body || [])];
                              body[i] = e.target.value;
                              return { ...p, body };
                            })}
                            placeholder={`{{${i + 1}}}`}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-500"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowTemplatePicker(true); if (templates.length === 0) fetchTemplates(); }}
                    className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-200 text-purple-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileText size={16} /> בחר תבנית הודעה
                  </button>
                )}
              </div>

              {!selectedTemplate && (
                <div>
                  <label className="text-xs font-black text-slate-500 mb-2 block">או הקלד הודעת טקסט חופשית:</label>
                  <textarea
                    value={sendText}
                    onChange={e => setSendText(e.target.value)}
                    rows={6}
                    placeholder={mediaType ? 'כיתוב למדיה (אופציונלי)...' : 'הקלד את ההודעה כאן...'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-green-600/10 focus:border-green-600 resize-none"
                  />

                  {/* Media attachment */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-slate-500">צירוף מדיה (אופציונלי):</label>
                      {(mediaType || mediaUrl) && (
                        <button
                          onClick={() => { setMediaType(null); setMediaUrl(''); setMediaFilename(''); }}
                          className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"
                        >
                          <X size={12} /> הסר מדיה
                        </button>
                      )}
                    </div>

                    {!mediaType ? (
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setMediaType('image')}
                          className="flex flex-col items-center gap-1 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl text-blue-700 font-bold text-xs transition-colors"
                        >
                          <ImageIcon size={18} /> תמונה
                        </button>
                        <button
                          onClick={() => setMediaType('video')}
                          className="flex flex-col items-center gap-1 p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-rose-700 font-bold text-xs transition-colors"
                        >
                          <Video size={18} /> וידאו
                        </button>
                        <button
                          onClick={() => setMediaType('document')}
                          className="flex flex-col items-center gap-1 p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl text-amber-700 font-bold text-xs transition-colors"
                        >
                          <FileLucide size={18} /> מסמך
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex items-center gap-2 mb-3 text-xs font-black text-slate-600">
                          <Paperclip size={14} />
                          {mediaType === 'image' ? 'העלה תמונה' : mediaType === 'video' ? 'העלה וידאו' : 'העלה מסמך'}
                        </div>
                        <FileUploader
                          value={mediaUrl}
                          onChange={(url) => {
                            setMediaUrl(url);
                            try {
                              const name = decodeURIComponent(url.split('/').pop() || '');
                              setMediaFilename(name);
                            } catch { setMediaFilename(''); }
                          }}
                          accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'}
                          mediaType={mediaType}
                          label={mediaType === 'image' ? 'תמונה' : mediaType === 'video' ? 'וידאו' : 'מסמך'}
                          token={token || ''}
                        />
                        {mediaUrl && (
                          <p className="mt-2 text-xs font-bold text-green-600 break-all">✓ {mediaFilename || mediaUrl}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sendResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-sm">
                  <p className="font-black text-green-800 mb-1">השליחה הושלמה</p>
                  <p className="font-semibold text-slate-600">
                    נשלחו: {sendResult.sent} · נכשלו: {sendResult.failed} · דולגו: {sendResult.skipped} · סה"כ: {sendResult.total}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => setSendOpen(false)}
                className="px-5 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-sm"
              >סגור</button>
              <button
                onClick={submitSend}
                disabled={sending || (!selectedTemplate && !mediaUrl && !sendText.trim())}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
              >
                <Send size={15} />
                {sending ? 'מתחיל שליחה...' : 'שלח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">בחר תבנית</h2>
              <button onClick={() => setShowTemplatePicker(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="relative mb-4">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="חפש תבנית..."
                  className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-purple-600/10 focus:border-purple-600"
                />
              </div>

              {templatesLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-purple-500 rounded-full" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-semibold">לא נמצאו תבניות</div>
              ) : (
                <div className="space-y-2">
                  {templates
                    .filter((t: any) => {
                      const q = templateSearch.trim().toLowerCase();
                      if (!q) return true;
                      const name = (t.name || t.elementName || t.template_name || '').toLowerCase();
                      return name.includes(q);
                    })
                    .map((t: any, i: number) => {
                      const name = t.name || t.elementName || t.template_name || `template_${i}`;
                      const body = (t.components || []).find((c: any) => c.type === 'BODY');
                      return (
                        <button
                          key={`${name}-${i}`}
                          onClick={() => pickTemplate(t)}
                          className="w-full text-right p-4 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-2xl transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={14} className="text-purple-500" />
                            <span className="text-sm font-black text-slate-900">{name}</span>
                            <span className="text-xs font-bold text-slate-400">({t.language || 'he'})</span>
                            {t.status && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                t.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>{t.status}</span>
                            )}
                          </div>
                          {body?.text && (
                            <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">{body.text}</p>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast detail modal */}
      {selectedBroadcast && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900">פרטי שליחה</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  {new Date(selectedBroadcast.createdAt).toLocaleString('he-IL')}
                </p>
              </div>
              <button onClick={() => setSelectedBroadcast(null)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-400 mb-1">סה"כ</p>
                  <p className="text-2xl font-black text-slate-900">{selectedBroadcast.total}</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-green-500 mb-1">נשלחו</p>
                  <p className="text-2xl font-black text-green-700">{selectedBroadcast.sent}</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-red-500 mb-1">נכשלו</p>
                  <p className="text-2xl font-black text-red-700">{selectedBroadcast.failed}</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-amber-500 mb-1">דולגו</p>
                  <p className="text-2xl font-black text-amber-700">{selectedBroadcast.skipped}</p>
                </div>
              </div>

              {/* Content */}
              <div className="mb-6">
                <p className="text-xs font-black text-slate-500 mb-2">תוכן ההודעה:</p>
                {selectedBroadcast.is_template ? (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={16} className="text-purple-600" />
                      <span className="text-sm font-black text-purple-900">{selectedBroadcast.template_name}</span>
                      <span className="text-xs font-bold text-purple-500">({selectedBroadcast.template_language || 'he'})</span>
                    </div>
                    {selectedBroadcast.template_data?.params?.body?.length > 0 && (
                      <div className="text-xs text-slate-600">
                        <p className="font-bold mb-1">פרמטרים:</p>
                        <ul className="list-disc pr-4">
                          {selectedBroadcast.template_data.params.body.map((p: string, i: number) => (
                            <li key={i}>{`{{${i + 1}}}: ${p || '—'}`}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedBroadcast.template_data?.params?.header?.url && (
                      <p className="text-xs text-slate-600 mt-2 break-all">
                        <span className="font-bold">מדיה:</span> {selectedBroadcast.template_data.params.header.url}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedBroadcast.message}
                  </div>
                )}
              </div>

              {/* Recipients */}
              {selectedBroadcast.recipients?.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-500 mb-2">נמענים ({selectedBroadcast.recipients.length}):</p>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {selectedBroadcast.recipients.map((r: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${i !== selectedBroadcast.recipients.length - 1 ? 'border-b border-slate-50' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {r.status === 'sent' && <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />}
                          {r.status === 'failed' && <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />}
                          {r.status === 'skipped' && <Clock size={15} className="text-amber-500 flex-shrink-0" />}
                          <span className="font-bold text-slate-700 truncate">{r.name || r.phone}</span>
                          {r.name && <span className="text-slate-400 text-xs" dir="ltr">{r.phone}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.reason === 'blocklist' && <span className="text-xs font-bold text-amber-600">ברשימת הסרה</span>}
                          {r.reason === 'invalid_phone' && <span className="text-xs font-bold text-slate-400">טלפון לא תקין</span>}
                          {r.error && <span className="text-xs text-red-500 truncate max-w-xs" title={r.error}>{r.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Floating progress toast — running broadcast */}
      {/* Remove member confirmation */}
      {removeTarget && selectedGroup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black text-slate-900">האם אתה בטוח שברצונך להסיר?</h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1 truncate">
                    {removeTarget.full_name || removeTarget.whatsapp_name || removeTarget.phone}
                    {selectedGroup.is_blocklist ? ' מרשימת ההסרה' : ` מהקבוצה "${selectedGroup.name}"`}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {selectedGroup.is_blocklist ? (
                <>
                  <label className="text-xs font-black text-slate-500 mb-2 block">
                    סיבת ההסרה <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={removeReason}
                    onChange={e => setRemoveReason(e.target.value)}
                    placeholder="הסבר קצר על סיבת ההסרה..."
                    rows={3}
                    autoFocus
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-400 resize-none"
                  />
                  {!removeReason.trim() && (
                    <p className="text-xs font-bold text-red-500 mt-2">יש להזין סיבת הסרה לפני אישור</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600 font-semibold">
                  פעולה זו תסיר את איש הקשר מהקבוצה. ניתן להוסיף אותו שוב בכל עת.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button
                onClick={closeRemoveMember}
                disabled={removing}
                className="px-5 py-2.5 text-slate-500 hover:text-slate-700 rounded-xl font-bold text-sm disabled:opacity-50"
              >ביטול</button>
              <button
                onClick={confirmRemoveMember}
                disabled={removing || (selectedGroup.is_blocklist && !removeReason.trim())}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {removing ? 'מסיר...' : 'הסר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeBroadcast && !completionToast && (
        <div className="fixed bottom-6 left-6 z-[70] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80" dir="rtl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Send size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">שולח ל-{activeBroadcast.groupName}</p>
              <p className="text-xs font-bold text-slate-400">
                {activeBroadcast.status === 'queued' ? 'בהמתנה...' : `${activeBroadcast.processed} מתוך ${activeBroadcast.total}`}
              </p>
            </div>
            <div className="animate-spin w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full flex-shrink-0" />
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

      {/* Completion toast */}
      {completionToast && (
        <div className="fixed bottom-6 left-6 z-[70] bg-white border border-green-200 shadow-2xl rounded-2xl p-4 w-80" dir="rtl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900">השליחה ל-{completionToast.groupName} הושלמה</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                נשלחו בהצלחה: <span className="text-green-600 font-black">{completionToast.sent}</span>
                {completionToast.failed > 0 && <> · נכשלו: <span className="text-red-500 font-black">{completionToast.failed}</span></>}
                {completionToast.skipped > 0 && <> · דולגו: <span className="text-amber-500 font-black">{completionToast.skipped}</span></>}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-0.5">סה"כ {completionToast.total} אנשי קשר</p>
            </div>
            <button
              onClick={() => { setCompletionToast(null); setActiveBroadcast(null); }}
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

export default GroupsPage;
