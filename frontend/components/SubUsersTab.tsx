import React, { useState, useEffect } from 'react';
import { UserCog, Users, Plus, Trash2, Edit2, Check, X, Eye, EyeOff } from 'lucide-react';
import { usePermission } from '../hooks/usePermission';
import { User } from '../types';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface RepGroup {
  id: string;
  name: string;
}

interface SubUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'rep' | 'rep_manager';
  user_type_id?: string | null;
  status: string;
  createdAt: string;
  repGroupIds: string[];
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

const ROLE_LABELS: Record<string, string> = {
  rep_manager: 'מנהל משמרת',
  rep: 'נציג',
  user: 'משתמש'
};

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'rep' as 'rep' | 'rep_manager' | 'user', user_type_id: '', repGroupIds: [] as string[] };

const SubUsersTab: React.FC<SubUsersTabProps> = ({ token, currentUser }) => {
  const can = usePermission(currentUser ?? null);
  // Reps state
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Groups state
  const [groups, setGroups] = useState<RepGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [availableUserTypes, setAvailableUserTypes] = useState<AvailableUserType[]>([]);

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

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sub-users`, { headers });
      if (!res.ok) throw new Error('שגיאה בטעינת הנציגים');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.users || []);
      setUsers(list);
      setAvailableUserTypes(data.availableUserTypes || []);
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

  useEffect(() => {
    loadUsers();
    loadGroups();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    const firstType = availableUserTypes[0]?._id || '';
    const firstSystemRole = availableUserTypes[0]?.system_role || 'rep';
    setForm({ ...emptyForm, user_type_id: firstType, role: (firstSystemRole as any) || 'rep' });
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
      role: u.role as 'rep' | 'rep_manager' | 'user',
      user_type_id: u.user_type_id || '',
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
        user_type_id: form.user_type_id || null,
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
          {can('rep_groups.view') && (
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
          )}
        </div>
        {activeTab === 'reps' ? (
          can('users.add') && (
          <button
            onClick={openCreate}
            disabled={availableUserTypes.length === 0}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> הוסף נציג
          </button>
          )
        ) : (
          can('rep_groups.add') && (
          <button
            onClick={() => { setGroupFormError(null); setNewGroupName(''); setShowGroupModal(true); }}
            className="flex items-center gap-2 px-5 py-2 mb-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            <Plus size={16} /> הוסף קבוצה
          </button>
          )
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
                        <div className="flex items-center gap-2">
                          {can('users.edit') && (
                          <button
                            onClick={() => openEdit(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="עריכה"
                          >
                            <Edit2 size={16} />
                          </button>
                          )}
                          {can('users.delete') && (
                          <button
                            onClick={() => setDeletingId(u.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="מחיקה"
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
                  {can('rep_groups.delete') && (
                  <button
                    onClick={() => setDeletingGroupId(g.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="מחיקת קבוצה"
                  >
                    <Trash2 size={16} />
                  </button>
                  )}
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
                <label className="block text-sm font-bold text-slate-600 mb-1">סוג משתמש *</label>
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
