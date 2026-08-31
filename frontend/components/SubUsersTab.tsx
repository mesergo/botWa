import React, { useState, useEffect, useRef } from 'react';
import { UserCog, Users, Plus, Trash2, Edit2, Check, X, Settings, Clock, MessageSquare, Copy, Send, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '../hooks/usePermission';
import { User } from '../types';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface WorkingHoursDay {
  enabled: boolean;
  from: string; // "HH:mm"
  to: string;   // "HH:mm"
}

interface WorkingHours {
  enabled: boolean;
  days: WorkingHoursDay[]; // 7 entries, index 0=Sunday .. 6=Saturday
}

interface RepGroup {
  id: string;
  name: string;
  openingMessage?: string;
  closingMessage?: string;
  unavailableMessage?: string;
  workingHours?: WorkingHours;
}

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

const emptyWorkingHours = (): WorkingHours => ({
  enabled: false,
  days: Array.from({ length: 7 }, () => ({ enabled: false, from: '09:00', to: '17:00' })),
});

const emptyGroupSettings = (id = '', name = ''): RepGroup => ({
  id,
  name,
  openingMessage: '',
  closingMessage: '',
  unavailableMessage: '',
  workingHours: emptyWorkingHours(),
});

interface BotOption {
  id: string;
  name: string;
  display_phone_number?: string;
}

interface SubUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'rep' | 'rep_manager';
  user_type_id?: string | null;
  status: string;
  availability_status?: 'available' | 'unavailable' | 'on_break';
  invite_status?: 'pending' | 'accepted' | 'expired' | 'cancelled' | null;
  invite_sent_at?: string | null;
  registration_completed_at?: string | null;
  registration_completed?: boolean;
  createdAt: string;
  repGroupIds: string[];
  allowedBotIds: string[];
}

interface AvailableUserType {
  _id: string;
  name: string;
  system_role: string | null;
}

interface SubUsersTabProps {
  token?: string | null;
  currentUser?: User | null;
}

const AVAILABILITY_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  available:   { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  on_break:    { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  unavailable: { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100' },
};

  // Reps state 
const emptyForm = { name: '', email: '', role: 'rep' as 'rep' | 'rep_manager' | 'user', user_type_id: '', repGroupIds: [] as string[], allowedBotIds: [] as string[] };

const SubUsersTab: React.FC<SubUsersTabProps> = ({ token, currentUser }) => {
  const { t } = useTranslation('users');
  const can = usePermission(currentUser ?? null);

  const displayRole = (role: string) => {
    const key = `roles.${role}`;
    const translated = t(key);
    return translated === key ? role : translated;
  };
  // Reps state
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Groups state 
  const [groups, setGroups] = useState<RepGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [availableUserTypes, setAvailableUserTypes] = useState<AvailableUserType[]>([]);

  // Available bots for restriction selection
  const [availableBots, setAvailableBots] = useState<BotOption[]>([]);

  // Sub-tab navigation
  const [activeTab, setActiveTab] = useState<'reps' | 'groups'>('reps');

  // Form state
  const [showRepModal, setShowRepModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [duplicateEmailInfo, setDuplicateEmailInfo] = useState<{ count: number; accounts: any[] } | null>(null);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteActionMessage, setInviteActionMessage] = useState<string | null>(null);
  const [inviteActionLoadingByUserId, setInviteActionLoadingByUserId] = useState<Record<string, boolean>>({});
  const inviteCopiedTimeoutRef = useRef<number | null>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);

  // Group delete state
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);

  // Group settings modal state
  const [settingsGroup, setSettingsGroup] = useState<RepGroup | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Expanded rep list per group
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupExpanded = (id: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const REPS_PREVIEW = 3;

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sub-users`, { headers });
      if (!res.ok) throw new Error(t('errors.loadReps'));
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || []);
      setUsers(list);
      setAvailableUserTypes(data.availableUserTypes || []);
    } catch (e: any) {
      setError(e.message || t('errors.unexpected'));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rep-groups`, { headers });
      if (!res.ok) throw new Error(t('errors.loadGroups'));
      const data = await res.json();
      setGroups(data);
    } catch {
      // Silent failure — groups are secondary
    } finally {
      setGroupsLoading(false);
    }
  };

  // Silent refresh — used for periodic polling so the spinner doesn't flicker.
  const refreshUsersSilently = async () => {
    try {
      const res = await fetch(`${API_BASE}/sub-users`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || []);
      setUsers(list);
    } catch {
      // ignore — next poll will retry
    }
  };

  const loadBots = async () => {
    try {
      const res = await fetch(`${API_BASE}/bots`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const list: BotOption[] = (Array.isArray(data) ? data : (data.bots || [])).map((b: any) => ({ id: b._id || b.id, name: b.name, display_phone_number: b.display_phone_number || '' }));
      setAvailableBots(list);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadUsers();
    loadGroups();
    loadBots();
  }, []);

  useEffect(() => {
    return () => {
      if (inviteCopiedTimeoutRef.current) {
        window.clearTimeout(inviteCopiedTimeoutRef.current);
      }
    };
  }, []);

  // Live-update reps availability while the "reps" tab is visible.
  // Polls every 8s and immediately on window focus / tab visibility.
  useEffect(() => {
    if (activeTab !== 'reps') return;
    const interval = setInterval(refreshUsersSilently, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUsersSilently(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshUsersSilently);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshUsersSilently);
    };
  }, [activeTab, token]);

  const openCreate = () => {
    setEditingId(null);
    const firstType = availableUserTypes[0]?._id || '';
    const firstSystemRole = availableUserTypes[0]?.system_role || 'rep';
    setForm({ ...emptyForm, user_type_id: firstType, role: (firstSystemRole as any) || 'rep' });
    setFormError(null);
    setDuplicateEmailInfo(null);
    setShowRepModal(true);
  };

  const openEdit = (u: SubUser) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role as 'rep' | 'rep_manager' | 'user',
      user_type_id: u.user_type_id || '',
      repGroupIds: u.role === 'rep' ? (u.repGroupIds || []) : [],
      allowedBotIds: u.role === 'rep' ? (u.allowedBotIds || []) : [],
    });
    setFormError(null);
    setDuplicateEmailInfo(null);
    setShowRepModal(true);
  };

  const closeForm = () => {
    setShowRepModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setDuplicateEmailInfo(null);
  };

  const isRegisteredUser = (u: SubUser) => !!(u.registration_completed || u.registration_completed_at || u.invite_status === 'accepted');

  const setInviteRowLoading = (userId: string, loading: boolean) => {
    setInviteActionLoadingByUserId(prev => ({ ...prev, [userId]: loading }));
  };

  const getInviteLinkForUser = async (userId: string, sendEmail: boolean): Promise<string> => {
    const res = await fetch(`${API_BASE}/sub-users/${userId}/resend-invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sendEmail }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('errors.createInviteLink'));
    if (!data.inviteLink) throw new Error(t('errors.noInviteLink'));
    await loadUsers();
    return data.inviteLink;
  };

  const handleResendInvite = async (u: SubUser) => {
    setInviteActionMessage(null);
    setInviteRowLoading(u.id, true);
    try {
      await getInviteLinkForUser(u.id, true);
      setInviteActionMessage(t('subUsers.inviteResent', { email: u.email }));
    } catch (e: any) {
      setError(e.message || t('errors.resendInvite'));
    } finally {
      setInviteRowLoading(u.id, false);
    }
  };

  const handleCopyInviteLink = async (u: SubUser) => {
    setInviteActionMessage(null);
    setInviteRowLoading(u.id, true);
    try {
      const inviteLink = await getInviteLinkForUser(u.id, false);
      await navigator.clipboard.writeText(inviteLink);
      setInviteActionMessage(t('subUsers.inviteCopied', { email: u.email }));
    } catch (e: any) {
      setError(e.message || t('errors.copyInviteLink'));
    } finally {
      setInviteRowLoading(u.id, false);
    }
  };

  const handleSave = async (allowDuplicateEmail: boolean = false) => {
    if (!form.name.trim() || !form.email.trim() || !form.user_type_id) {
      setFormError(t('errors.requiredRepFields'));
      return;
    }
    if (!allowDuplicateEmail) setDuplicateEmailInfo(null);
    setFormSaving(true);
    setFormError(null);
    try {
      const body: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        user_type_id: form.user_type_id || null,
      };
      if (form.role === 'rep') body.rep_group_ids = form.repGroupIds;
      if (form.role === 'rep') body.allowed_bot_ids = form.allowedBotIds;
      body.allowDuplicateEmail = allowDuplicateEmail;

      const url = editingId ? `${API_BASE}/sub-users/${editingId}` : `${API_BASE}/sub-users`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 409 && data.emailExists) {
        setDuplicateEmailInfo({ count: data.count, accounts: data.accounts || [] });
        return;
      }
      if (!res.ok) throw new Error(data.error || t('errors.save'));
      await loadUsers();
      if (!editingId && data.inviteLink) {
        setInviteSuccessLink(data.inviteLink);
        setInviteLinkCopied(false);
      }
      closeForm();
    } catch (e: any) {
      setFormError(e.message || t('errors.unexpected'));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sub-users/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('errors.delete'));
      }
      setDeletingId(null);
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      setGroupFormError(t('errors.groupNameRequired'));
      return;
    }
    setGroupSaving(true);
    setGroupFormError(null);
    try {
      const res = await fetch(`${API_BASE}/rep-groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('errors.createGroup'));
      setNewGroupName('');
      setShowGroupModal(false);
      await loadGroups();
    } catch (e: any) {
      setGroupFormError(e.message || t('errors.unexpected'));
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setDeleteGroupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rep-groups/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('errors.deleteGroup'));
      }
      setDeletingGroupId(null);
      // Refresh both since deleting a group removes it from assigned reps too
      await Promise.all([loadGroups(), loadUsers()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteGroupLoading(false);
    }
  };

  const openGroupSettings = (g: RepGroup) => {
    setSettingsError(null);
    setSettingsGroup({
      id: g.id,
      name: g.name,
      openingMessage: g.openingMessage || '',
      closingMessage: g.closingMessage || '',
      unavailableMessage: g.unavailableMessage || '',
      workingHours: g.workingHours && Array.isArray(g.workingHours.days) && g.workingHours.days.length === 7
        ? {
            enabled: !!g.workingHours.enabled,
            days: g.workingHours.days.map(d => ({
              enabled: !!d.enabled,
              from: d.from || '09:00',
              to: d.to || '17:00',
            })),
          }
        : emptyWorkingHours(),
    });
  };

  const updateSettings = (patch: Partial<RepGroup>) => {
    setSettingsGroup(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const updateWorkingDay = (index: number, patch: Partial<WorkingHoursDay>) => {
    setSettingsGroup(prev => {
      if (!prev) return prev;
      const wh = prev.workingHours || emptyWorkingHours();
      const days = wh.days.map((d, i) => (i === index ? { ...d, ...patch } : d));
      return { ...prev, workingHours: { ...wh, days } };
    });
  };

  const handleSaveSettings = async () => {
    if (!settingsGroup) return;
    if (!settingsGroup.name.trim()) {
      setSettingsError(t('errors.groupNameRequired'));
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const res = await fetch(`${API_BASE}/rep-groups/${settingsGroup.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: settingsGroup.name.trim(),
          openingMessage: settingsGroup.openingMessage || '',
          closingMessage: settingsGroup.closingMessage || '',
          unavailableMessage: settingsGroup.unavailableMessage || '',
          workingHours: settingsGroup.workingHours || emptyWorkingHours(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('errors.saveSettings'));
      setSettingsGroup(null);
      await loadGroups();
    } catch (e: any) {
      setSettingsError(e.message || t('errors.unexpected'));
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div>
      {/* Title — fixed position, not affected by which tab is active */}
      <h1 className="text-3xl font-black text-slate-900 mb-6">{t('subUsers.title')}</h1>

      {/* Tab bar + action button */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-8">
        <div className="flex">
          <button
            onClick={() => setActiveTab('reps')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'reps'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t('subUsers.tabs.reps')}
          </button>
          {can('rep_groups.view') && (
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'groups'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t('subUsers.tabs.groups')}
          </button>
          )}
        </div>
        {activeTab === 'reps' ? (
          can('users.add') && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> {t('subUsers.addRep')}
          </button>
          )
        ) : (
          can('rep_groups.add') && (
          <button
            onClick={() => { setGroupFormError(null); setNewGroupName(''); setShowGroupModal(true); }}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> {t('subUsers.addGroup')}
          </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl font-bold text-sm">{error}</div>
      )}

      {inviteActionMessage && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-sm">{inviteActionMessage}</div>
      )}

      {/* ── REPS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'reps' && (
        <>
          {/* Users table */}
          {loading ? (
            <div className="text-center text-slate-400 py-20 font-bold">{t('subUsers.loadingReps')}</div>
          ) : users.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
              <UserCog size={64} strokeWidth={1} />
              <p className="text-xl font-bold">{t('subUsers.emptyReps')}</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                    <th className="px-6 py-4 text-start">{t('subUsers.table.name')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.email')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.phone')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.type')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.registrationStatus')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.groups')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.allowedNumbers')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.availability')}</th>
                    <th className="px-6 py-4 text-start">{t('subUsers.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-slate-600 font-bold" dir="ltr">{u.email}</td>
                      <td className="px-6 py-4 text-slate-600 font-bold" dir="ltr">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const typeName = availableUserTypes.find(ut => ut._id === u.user_type_id)?.name;
                          const label = typeName || displayRole(u.role);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-black ${
                              u.role === 'rep_manager'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const registered = isRegisteredUser(u);
                          if (registered) {
                            return (
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                                {t('subUsers.registration.active')}
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700">
                              <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                              {t('subUsers.registration.pending')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const resolved = (u.repGroupIds || []).map(gid => groups.find(gr => gr.id === gid)).filter(Boolean) as RepGroup[];
                          if (resolved.length === 0) return <span className="text-slate-400 text-xs">—</span>;
                          const PREVIEW = 2;
                          const visible = resolved.slice(0, PREVIEW);
                          const hidden = resolved.slice(PREVIEW);
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {visible.map(g => (
                                <span key={g.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold whitespace-nowrap">{g.name}</span>
                              ))}
                              {hidden.length > 0 && (
                                <span
                                  className="relative group px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold cursor-default select-none"
                                  title={hidden.map(g => g.name).join('، ')}
                                >
                                  +{hidden.length}
                                  <span className="absolute bottom-full start-0 mb-2 hidden group-hover:flex flex-col gap-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 min-w-max">
                                    {hidden.map(g => (
                                      <span key={g.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold whitespace-nowrap">{g.name}</span>
                                    ))}
                                  </span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const resolved = (u.allowedBotIds || []).map(bid => availableBots.find(b => b.id === bid)).filter(Boolean) as BotOption[];
                          if (resolved.length === 0) return <span className="text-slate-400 text-xs">{t('subUsers.allNumbers')}</span>;
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {resolved.map(b => (
                                <span key={b.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold whitespace-nowrap" title={b.name}>
                                  {b.display_phone_number || b.name}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const meta = AVAILABILITY_STYLES[u.availability_status || 'available'] || AVAILABILITY_STYLES.available;
                          return (
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black ${meta.bg} ${meta.text}`}>
                              <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`}></span>
                              {t(`availability.${u.availability_status || 'available'}`, { defaultValue: u.availability_status || 'available' })}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {!isRegisteredUser(u) && can('users.edit') && (
                            <>
                              <button
                                onClick={() => handleResendInvite(u)}
                                disabled={!!inviteActionLoadingByUserId[u.id]}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all disabled:opacity-40"
                                title={t('subUsers.titles.resendInvite')}
                              >
                                <Send size={16} />
                              </button>
                              <button
                                onClick={() => handleCopyInviteLink(u)}
                                disabled={!!inviteActionLoadingByUserId[u.id]}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-40"
                                title={t('subUsers.titles.copyInviteLink')}
                              >
                                <LinkIcon size={16} />
                              </button>
                            </>
                          )}
                          {can('users.edit') && (
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title={t('subUsers.titles.edit')}
                          >
                            <Edit2 size={16} />
                          </button>
                          )}
                          {can('users.delete') && (
                          <button
                            onClick={() => setDeletingId(u.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title={t('subUsers.titles.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── GROUPS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <>
          {/* Groups list */}
          {groupsLoading ? (
            <div className="text-center text-slate-400 py-20 font-bold">{t('subUsers.loadingGroups')}</div>
          ) : groups.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
              <Users size={64} strokeWidth={1} />
              <p className="text-xl font-bold">{t('subUsers.emptyGroups')}</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
              {groups.map((g, i) => {
                const groupReps = users.filter(u => u.repGroupIds?.includes(g.id));
                return (
                  <div
                    key={g.id}
                    className={`flex items-start justify-between px-6 py-4 ${
                      i < groups.length - 1 ? 'border-b border-slate-50' : ''
                    } hover:bg-slate-50 transition-colors`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{g.name}</span>
                        {groupReps.length > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">{groupReps.length}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {groupReps.length === 0 ? (
                          <span className="text-xs text-slate-400">{t('subUsers.noAssignedReps')}</span>
                        ) : (
                          <>
                            {(expandedGroups.has(g.id) ? groupReps : groupReps.slice(0, REPS_PREVIEW)).map(u => (
                              <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${(AVAILABILITY_STYLES[u.availability_status || 'available'] || AVAILABILITY_STYLES.available).dot}`}></span>
                                {u.name}
                              </span>
                            ))}
                            {groupReps.length > REPS_PREVIEW && (
                              <button
                                onClick={() => toggleGroupExpanded(g.id)}
                                className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors"
                              >
                                {expandedGroups.has(g.id) ? t('subUsers.showLess') : t('subUsers.moreReps', { count: groupReps.length - REPS_PREVIEW })}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ms-4">
                      <button
                        onClick={() => openGroupSettings(g)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title={t('subUsers.titles.groupSettings')}
                      >
                        <Settings size={16} />
                      </button>
                      {can('rep_groups.delete') && (
                      <button
                        onClick={() => setDeletingGroupId(g.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title={t('subUsers.titles.deleteGroup')}
                      >
                        <Trash2 size={16} />
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── REP MODAL (Add / Edit) ────────────────────────────────────── */}
      {showRepModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl p-8 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                {editingId ? t('subUsers.modal.editRep') : t('subUsers.modal.addRep')}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            {availableUserTypes.length === 0 && (
              <div className="mb-4 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold">
                {t('subUsers.modal.noUserTypes')}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.modal.fullName')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder={t('subUsers.modal.fullNamePlaceholder')}
                />
              </div>
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.modal.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setDuplicateEmailInfo(null); }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="name@company.com"
                  dir="ltr"
                />
              </div>
              {/* Role */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.modal.userType')}</label>
                <select
                  value={form.user_type_id}
                  onChange={e => {
                    const selectedId = e.target.value;
                    const selectedType = availableUserTypes.find(t => t._id === selectedId);
                    const newRole = (selectedType?.system_role || 'rep') as 'rep' | 'rep_manager' | 'user';
                    setForm(f => ({
                      ...f,
                      user_type_id: selectedId,
                      role: newRole,
                      repGroupIds: newRole === 'rep' ? f.repGroupIds : [],
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white"
                >
                  {availableUserTypes.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {/* Group assignment chips (rep only) */}
              {form.role === 'rep' && groups.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2">{t('subUsers.modal.assignGroups')}</label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(g => {
                      const selected = form.repGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() =>
                            setForm(f => ({
                              ...f,
                              repGroupIds: selected
                                ? f.repGroupIds.filter(id => id !== g.id)
                                : [...f.repGroupIds, g.id],
                            }))
                          }
                          className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
                            selected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                          }`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Bot restriction chips (rep only) — show by phone number, only connected bots */}
              {form.role === 'rep' && availableBots.filter(b => b.display_phone_number).length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.modal.restrictNumbers')}</label>
                  <p className="text-xs text-slate-400 mb-2">{t('subUsers.modal.restrictNumbersHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    {availableBots.filter(b => b.display_phone_number).map(b => {
                      const selected = form.allowedBotIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          title={b.name}
                          onClick={() =>
                            setForm(f => ({
                              ...f,
                              allowedBotIds: selected
                                ? f.allowedBotIds.filter(id => id !== b.id)
                                : [...f.allowedBotIds, b.id],
                            }))
                          }
                          className={`flex flex-col items-center px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${
                            selected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                          }`}
                        >
                          <span className="font-black text-base leading-tight">{b.display_phone_number}</span>
                          <span className={`text-xs font-semibold mt-0.5 ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-bold">{formError}</div>
            )}

            {duplicateEmailInfo && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-start space-y-3">
                <p className="text-sm font-bold text-amber-800">
                  {t('subUsers.duplicateEmail.message', {
                    count: duplicateEmailInfo.count,
                    question: editingId ? t('subUsers.duplicateEmail.saveQuestion') : t('subUsers.duplicateEmail.createQuestion'),
                  })}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={formSaving}
                    className="text-sm font-bold bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {editingId ? t('subUsers.duplicateEmail.saveAnyway') : t('subUsers.duplicateEmail.createAnyway')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateEmailInfo(null)}
                    className="text-sm font-bold bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    {t('subUsers.modal.cancel')}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 flex-row-reverse">
              <button
                onClick={() => handleSave()}
                disabled={formSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                <Check size={16} /> {formSaving ? (editingId ? t('subUsers.modal.saving') : t('subUsers.modal.sendingInvite')) : (editingId ? t('subUsers.modal.save') : t('subUsers.modal.sendInvite'))}
              </button>
              <button
                onClick={closeForm}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <X size={16} /> {t('subUsers.modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite success modal */}
      {inviteSuccessLink && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-l from-blue-50 via-white to-blue-50 border-b border-slate-100">
              <h3 className="text-2xl font-black text-slate-900 mb-1">{t('subUsers.inviteSuccess.title')}</h3>
            </div>

            <div className="px-8 py-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 font-bold leading-6">
                {t('subUsers.inviteSuccess.body')}
              </div>
              <p className="text-sm text-slate-600 font-bold mb-2">{t('subUsers.inviteSuccess.linkLabel')}</p>
              <div className="relative" dir="ltr">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 pr-12 py-3 text-xs text-slate-700 break-all leading-6">
                  {inviteSuccessLink}
                </div>
                <button
                  type="button"
                  aria-label={t('subUsers.inviteSuccess.copyAria')}
                  title={t('subUsers.inviteSuccess.copyTitle')}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteSuccessLink);
                      setInviteLinkCopied(true);
                      if (inviteCopiedTimeoutRef.current) {
                        window.clearTimeout(inviteCopiedTimeoutRef.current);
                      }
                      inviteCopiedTimeoutRef.current = window.setTimeout(() => {
                        setInviteLinkCopied(false);
                        inviteCopiedTimeoutRef.current = null;
                      }, 3000);
                    } catch {
                      // ignore clipboard failures
                    }
                  }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-0 shadow-none transition-colors ${inviteLinkCopied ? 'text-emerald-600' : 'text-slate-400 hover:text-blue-600'}`}
                >
                  {inviteLinkCopied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className="px-8 pb-7 w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setInviteSuccessLink(null);
                  setInviteLinkCopied(false);
                  if (inviteCopiedTimeoutRef.current) {
                    window.clearTimeout(inviteCopiedTimeoutRef.current);
                    inviteCopiedTimeoutRef.current = null;
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                {t('subUsers.inviteSuccess.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GROUP MODAL (Add) ─────────────────────────────────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">{t('subUsers.groupModal.title')}</h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.groupModal.name')}</label>
              <input
                type="text"
                value={newGroupName}
                onChange={e => { setNewGroupName(e.target.value); setGroupFormError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                placeholder={t('subUsers.groupModal.namePlaceholder')}
                autoFocus
              />
            </div>
            {groupFormError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-bold">{groupFormError}</div>
            )}
            <div className="flex items-center gap-3 mt-6 flex-row-reverse">
              <button
                onClick={handleAddGroup}
                disabled={groupSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                <Check size={16} /> {groupSaving ? t('subUsers.modal.saving') : t('subUsers.groupModal.add')}
              </button>
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <X size={16} /> {t('subUsers.modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete rep confirmation dialog */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-10 border border-slate-100 text-start">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">{t('subUsers.deleteRep.title')}</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              {t('subUsers.deleteRep.body')}
            </p>
            <div className="flex items-center gap-3 flex-row-reverse">
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {deleteLoading ? t('subUsers.deleteRep.deleting') : t('subUsers.deleteRep.delete')}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                {t('subUsers.modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GROUP SETTINGS MODAL ───────────────────────────────────────── */}
      {settingsGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-8 pb-4 sticky top-0 bg-white border-b border-slate-100 rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{t('subUsers.settings.title')}</h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">{settingsGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsGroup(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Group name */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">{t('subUsers.settings.groupName')}</label>
                <input
                  type="text"
                  value={settingsGroup.name}
                  onChange={e => updateSettings({ name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              {/* Opening message */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-1">
                  <MessageSquare size={14} /> {t('subUsers.settings.openingMessage')}
                </label>
                <p className="text-xs text-slate-400 mb-2">{t('subUsers.settings.openingHint')}</p>
                <textarea
                  value={settingsGroup.openingMessage || ''}
                  onChange={e => updateSettings({ openingMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder={t('subUsers.settings.openingPlaceholder')}
                />
              </div>

              {/* Closing message */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-1">
                  <MessageSquare size={14} /> {t('subUsers.settings.closingMessage')}
                </label>
                <p className="text-xs text-slate-400 mb-2">{t('subUsers.settings.closingHint')}</p>
                <textarea
                  value={settingsGroup.closingMessage || ''}
                  onChange={e => updateSettings({ closingMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder={t('subUsers.settings.closingPlaceholder')}
                />
              </div>

              {/* Unavailable message */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-1">
                  <MessageSquare size={14} /> {t('subUsers.settings.unavailableMessage')}
                </label>
                <p className="text-xs text-slate-400 mb-2">{t('subUsers.settings.unavailableHint')}</p>
                <textarea
                  value={settingsGroup.unavailableMessage || ''}
                  onChange={e => updateSettings({ unavailableMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder={t('subUsers.settings.unavailablePlaceholder')}
                />
              </div>

              {/* Working hours */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <Clock size={14} /> {t('subUsers.settings.workingHours')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-500">
                      {settingsGroup.workingHours?.enabled ? t('subUsers.settings.enabled') : t('subUsers.settings.disabled')}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!settingsGroup.workingHours?.enabled}
                      onChange={e => updateSettings({
                        workingHours: {
                          ...(settingsGroup.workingHours || emptyWorkingHours()),
                          enabled: e.target.checked,
                        },
                      })}
                    />
                    <span className="w-10 h-6 bg-slate-200 rounded-full relative transition-colors peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:start-[1.125rem]"></span>
                  </label>
                </div>
                <p className="text-xs text-slate-400 mb-3">{t('subUsers.settings.workingHoursHint')}</p>

                <div className={`border border-slate-200 rounded-2xl divide-y divide-slate-100 ${settingsGroup.workingHours?.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                  {(settingsGroup.workingHours?.days || emptyWorkingHours().days).map((d, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none w-24">
                        <input
                          type="checkbox"
                          checked={d.enabled}
                          onChange={e => updateWorkingDay(i, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm font-bold text-slate-700">{t(`subUsers.days.${i}`)}</span>
                      </label>
                      <div className={`flex items-center gap-2 flex-1 ${d.enabled ? '' : 'opacity-40'}`}>
                        <span className="text-xs font-bold text-slate-400">{t('subUsers.settings.from')}</span>
                        <input
                          type="time"
                          value={d.from}
                          disabled={!d.enabled}
                          onChange={e => updateWorkingDay(i, { from: e.target.value })}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                          dir="ltr"
                        />
                        <span className="text-xs font-bold text-slate-400">{t('subUsers.settings.until')}</span>
                        <input
                          type="time"
                          value={d.to}
                          disabled={!d.enabled}
                          onChange={e => updateWorkingDay(i, { to: e.target.value })}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {settingsError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm font-bold">{settingsError}</div>
              )}
            </div>

            <div className="flex items-center gap-3 p-8 pt-0 flex-row-reverse">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                <Check size={16} /> {settingsSaving ? 'שומר...' : 'שמור הגדרות'}
              </button>
              <button
                onClick={() => setSettingsGroup(null)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <X size={16} /> ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete group confirmation dialog */}
      {deletingGroupId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-10 border border-slate-100 text-start">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">מחיקת קבוצה</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              האם אתה בטוח? מחיקת הקבוצה תסיר אותה גם מכל הנציגים המשויכים אליה.
            </p>
            <div className="flex items-center gap-3 flex-row-reverse">
              <button
                onClick={() => handleDeleteGroup(deletingGroupId)}
                disabled={deleteGroupLoading}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {deleteGroupLoading ? 'מוחק...' : 'מחק'}
              </button>
              <button
                onClick={() => setDeletingGroupId(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubUsersTab;
