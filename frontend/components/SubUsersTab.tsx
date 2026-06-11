import React, { useState, useEffect } from 'react';
import { UserCog, Users, Plus, Trash2, Edit2, Check, X, Eye, EyeOff, Settings, Clock, MessageSquare } from 'lucide-react';

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

const DAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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

interface SubUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'rep' | 'rep_manager';
  status: string;
  availability_status?: 'available' | 'unavailable' | 'on_break';
  createdAt: string;
  repGroupIds: string[];
}

interface SubUsersTabProps {
  token?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  rep_manager: 'מנהל משמרת',
  rep: 'נציג',
};

const AVAILABILITY_LABELS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  available:   { label: 'זמין',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  on_break:    { label: 'בהפסקה',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  unavailable: { label: 'לא זמין', dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100' },
};

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'rep' as 'rep' | 'rep_manager', repGroupIds: [] as string[] };

const SubUsersTab: React.FC<SubUsersTabProps> = ({ token }) => {
  // Reps state 
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Groups state 
  const [groups, setGroups] = useState<RepGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Sub-tab navigation
  const [activeTab, setActiveTab] = useState<'reps' | 'groups'>('reps');

  // Form state
  const [showRepModal, setShowRepModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sub-users`, { headers });
      if (!res.ok) throw new Error('שגיאה בטעינת הנציגים');
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message || 'שגיאה לא צפויה');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rep-groups`, { headers });
      if (!res.ok) throw new Error('שגיאה בטעינת הקבוצות');
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
      setUsers(data);
    } catch {
      // ignore — next poll will retry
    }
  };

  useEffect(() => {
    loadUsers();
    loadGroups();
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
    setForm(emptyForm);
    setFormError(null);
    setShowPassword(false);
    setShowRepModal(true);
  };

  const openEdit = (u: SubUser) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone,
      role: u.role as 'rep' | 'rep_manager',
      repGroupIds: u.role === 'rep' ? (u.repGroupIds || []) : [],
    });
    setFormError(null);
    setShowPassword(false);
    setShowRepModal(true);
  };

  const closeForm = () => {
    setShowRepModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('שם ואימייל הם שדות חובה');
      return;
    }
    if (!editingId && !form.password.trim()) {
      setFormError('סיסמה היא שדה חובה בעת יצירת נציג');
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const body: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
      };
      if (form.password.trim()) body.password = form.password.trim();
      if (form.role === 'rep') body.rep_group_ids = form.repGroupIds;

      const url = editingId ? `${API_BASE}/sub-users/${editingId}` : `${API_BASE}/sub-users`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      await loadUsers();
      closeForm();
    } catch (e: any) {
      setFormError(e.message || 'שגיאה לא צפויה');
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
        throw new Error(data.error || 'שגיאה במחיקה');
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
      setGroupFormError('שם הקבוצה הוא שדה חובה');
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
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת הקבוצה');
      setNewGroupName('');
      setShowGroupModal(false);
      await loadGroups();
    } catch (e: any) {
      setGroupFormError(e.message || 'שגיאה לא צפויה');
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
        throw new Error(data.error || 'שגיאה במחיקת הקבוצה');
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
      setSettingsError('שם הקבוצה הוא שדה חובה');
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
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת ההגדרות');
      setSettingsGroup(null);
      await loadGroups();
    } catch (e: any) {
      setSettingsError(e.message || 'שגיאה לא צפויה');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div dir="rtl">
      {/* Title — fixed position, not affected by which tab is active */}
      <h1 className="text-3xl font-black text-slate-900 mb-6">ניהול נציגים</h1>

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
            נציגים
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'groups'
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            קבוצות נציגים
          </button>
        </div>
        {activeTab === 'reps' ? (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> הוסף נציג
          </button>
        ) : (
          <button
            onClick={() => { setGroupFormError(null); setNewGroupName(''); setShowGroupModal(true); }}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> הוסף קבוצה
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl font-bold text-sm">{error}</div>
      )}

      {/* ── REPS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'reps' && (
        <>
          {/* Users table */}
          {loading ? (
            <div className="text-center text-slate-400 py-20 font-bold">טוען נציגים...</div>
          ) : users.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
              <UserCog size={64} strokeWidth={1} />
              <p className="text-xl font-bold">אין נציגים עדיין. הוסף את הראשון!</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                    <th className="px-6 py-4 text-right">שם</th>
                    <th className="px-6 py-4 text-right">אימייל</th>
                    <th className="px-6 py-4 text-right">טלפון</th>
                    <th className="px-6 py-4 text-right">סוג</th>
                    <th className="px-6 py-4 text-right">זמינות</th>
                    <th className="px-6 py-4 text-right">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-slate-600 font-bold" dir="ltr">{u.email}</td>
                      <td className="px-6 py-4 text-slate-600 font-bold" dir="ltr">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                          u.role === 'rep_manager'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const meta = AVAILABILITY_LABELS[u.availability_status || 'available'];
                          return (
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black ${meta.bg} ${meta.text}`}>
                              <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`}></span>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="עריכה"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingId(u.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="מחיקה"
                          >
                            <Trash2 size={16} />
                          </button>
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
            <div className="text-center text-slate-400 py-20 font-bold">טוען קבוצות...</div>
          ) : groups.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
              <Users size={64} strokeWidth={1} />
              <p className="text-xl font-bold">אין קבוצות נציגים עדיין. צור את הראשונה!</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
              {groups.map((g, i) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i < groups.length - 1 ? 'border-b border-slate-50' : ''
                  } hover:bg-slate-50 transition-colors`}
                >
                  <span className="font-bold text-slate-900">{g.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openGroupSettings(g)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="הגדרות כלליות"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => setDeletingGroupId(g.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="מחיקת קבוצה"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── REP MODAL (Add / Edit) ────────────────────────────────────── */}
      {showRepModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl p-8 border border-slate-100" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                {editingId ? 'עריכת נציג' : 'הוספת נציג חדש'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="ישראל ישראלי"
                />
              </div>
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">אימייל *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="name@company.com"
                  dir="ltr"
                />
              </div>
              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  סיסמה {editingId ? '(השאר ריק לאי-שינוי)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 pl-12"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">טלפון נייד</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                  placeholder="050-1234567"
                  dir="ltr"
                />
              </div>
              {/* Role */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-600 mb-1">סוג נציג *</label>
                <select
                  value={form.role}
                  onChange={e => {
                    const newRole = e.target.value as 'rep' | 'rep_manager';
                    setForm(f => ({
                      ...f,
                      role: newRole,
                      repGroupIds: newRole === 'rep_manager' ? [] : f.repGroupIds,
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white"
                >
                  <option value="rep_manager">מנהל משמרת — גישה לבוטים + שיחות</option>
                  <option value="rep">נציג — גישה לשיחות בלבד</option>
                </select>
              </div>
              {/* Group assignment chips (rep only) */}
              {form.role === 'rep' && groups.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-600 mb-2">שיוך לקבוצות נציגים</label>
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
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-bold">{formError}</div>
            )}

            <div className="flex items-center gap-3 mt-6 flex-row-reverse">
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                <Check size={16} /> {formSaving ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={closeForm}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <X size={16} /> ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GROUP MODAL (Add) ─────────────────────────────────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 border border-slate-100" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">הוספת קבוצה חדשה</h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">שם הקבוצה *</label>
              <input
                type="text"
                value={newGroupName}
                onChange={e => { setNewGroupName(e.target.value); setGroupFormError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                placeholder="לדוגמה: צוות בוקר"
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
                <Check size={16} /> {groupSaving ? 'שומר...' : 'הוסף'}
              </button>
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <X size={16} /> ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete rep confirmation dialog */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-10 border border-slate-100 text-right" dir="rtl">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">מחיקת נציג</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              האם אתה בטוח? פעולה זו לא ניתנת לביטול. הנציג לא יוכל עוד להתחבר למערכת.
            </p>
            <div className="flex items-center gap-3 flex-row-reverse">
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {deleteLoading ? 'מוחק...' : 'מחק'}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GROUP SETTINGS MODAL ───────────────────────────────────────── */}
      {settingsGroup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between p-8 pb-4 sticky top-0 bg-white border-b border-slate-100 rounded-t-[2rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">הגדרות כלליות</h2>
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
                <label className="block text-sm font-bold text-slate-600 mb-1">שם הקבוצה *</label>
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
                  <MessageSquare size={14} /> הודעת פתיחה
                </label>
                <p className="text-xs text-slate-400 mb-2">תישלח ללקוח כשהשיחה מועברת לנציג מהקבוצה.</p>
                <textarea
                  value={settingsGroup.openingMessage || ''}
                  onChange={e => updateSettings({ openingMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder="לדוגמה: שלום, פנייתך התקבלה — נציג יחזור אליך בקרוב."
                />
              </div>

              {/* Closing message */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-1">
                  <MessageSquare size={14} /> הודעת סיום
                </label>
                <p className="text-xs text-slate-400 mb-2">תישלח ללקוח כשהנציג מסיים את השיחה.</p>
                <textarea
                  value={settingsGroup.closingMessage || ''}
                  onChange={e => updateSettings({ closingMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder="לדוגמה: תודה שפנית אלינו. נשמח לעמוד לרשותך גם בעתיד."
                />
              </div>

              {/* Unavailable message */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-1">
                  <MessageSquare size={14} /> הודעה כשאף נציג לא זמין
                </label>
                <p className="text-xs text-slate-400 mb-2">תישלח ללקוח אם השיחה הגיעה מחוץ לשעות העבודה, או כשאין נציג זמין מהקבוצה.</p>
                <textarea
                  value={settingsGroup.unavailableMessage || ''}
                  onChange={e => updateSettings({ unavailableMessage: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 resize-none"
                  placeholder="לדוגמה: כרגע אין נציג זמין. נחזור אליך בשעות הפעילות."
                />
              </div>

              {/* Working hours */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <Clock size={14} /> שעות עבודה
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-bold text-slate-500">
                      {settingsGroup.workingHours?.enabled ? 'פעיל' : 'כבוי'}
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
                    <span className="w-10 h-6 bg-slate-200 rounded-full relative transition-colors peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:right-[1.125rem]"></span>
                  </label>
                </div>
                <p className="text-xs text-slate-400 mb-3">כאשר השעות פעילות — שיחות שמגיעות מחוץ לשעות יזכו בהודעת "כשאין נציג זמין".</p>

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
                        <span className="text-sm font-bold text-slate-700">{DAY_LABELS[i]}</span>
                      </label>
                      <div className={`flex items-center gap-2 flex-1 ${d.enabled ? '' : 'opacity-40'}`}>
                        <span className="text-xs font-bold text-slate-400">מ-</span>
                        <input
                          type="time"
                          value={d.from}
                          disabled={!d.enabled}
                          onChange={e => updateWorkingDay(i, { from: e.target.value })}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-500"
                          dir="ltr"
                        />
                        <span className="text-xs font-bold text-slate-400">עד</span>
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
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-10 border border-slate-100 text-right" dir="rtl">
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
