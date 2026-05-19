import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Trash2, Edit2, Check, X, Eye, EyeOff } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface SubUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'rep' | 'rep_bot';
  status: string;
  createdAt: string;
}

interface SubUsersTabProps {
  token?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  rep_bot: 'נציג מורשה עריכה',
  rep: 'נציג לא מורשה',
};

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'rep' as 'rep' | 'rep_bot' };

const SubUsersTab: React.FC<SubUsersTabProps> = ({ token }) => {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (u: SubUser) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone, role: u.role });
    setFormError(null);
    setShowPassword(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
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

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black text-slate-900">ניהול נציגים</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
        >
          <Plus size={20} /> הוסף נציג
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl font-bold text-sm">{error}</div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mb-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm p-8">
          <h2 className="text-xl font-black text-slate-900 mb-6">
            {editingId ? 'עריכת נציג' : 'הוספת נציג חדש'}
          </h2>
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
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'rep' | 'rep_bot' }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 bg-white"
              >
                <option value="rep_bot">נציג מורשה עריכה — גישה לבוטים + שיחות</option>
                <option value="rep">נציג לא מורשה — גישה לשיחות בלבד</option>
              </select>
            </div>
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
      )}

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
                      u.role === 'rep_bot'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
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

      {/* Delete confirmation dialog */}
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
    </div>
  );
};

export default SubUsersTab;
