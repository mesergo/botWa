import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Shield, AlertCircle } from 'lucide-react';
import { UserType, UserTypePermissions } from '../types';

interface Props {
  token: string;
  apiBase: string;
}

const PERMISSION_GROUPS: Array<{
  key: keyof UserTypePermissions;
  label: string;
  actions: Array<{ key: string; label: string }>;
}> = [
  {
    key: 'bots',
    label: 'בוטים',
    actions: [
      { key: 'view_tab',  label: 'הצגת לשונית' },
      { key: 'create',    label: 'יצירת בוט' },
      { key: 'edit',      label: 'עריכת בוט' },
      { key: 'delete',    label: 'מחיקת בוט' },
      { key: 'settings',  label: 'כפתור הגדרות' },
      { key: 'publish',   label: 'פרסום / חיבור לפייסבוק' },
    ]
  },
  {
    key: 'sessions',
    label: 'שיחות',
    actions: [
      { key: 'view',                label: 'הצגה' },
      { key: 'add',                 label: 'הוספת שיחה' },
      { key: 'view_all',            label: 'הצגת כל השיחות' },
      { key: 'view_assigned_only',  label: 'הצגת שיחות משויכות בלבד' },
      { key: 'templates_as_rep',    label: 'הצגה ושליחת תבניות כנציג' },
      { key: 'templates_as_manager',label: 'הצגה ושליחת תבניות כמנהל משמרת' },
    ]
  },
  {
    key: 'contacts',
    label: 'אנשי קשר',
    actions: [
      { key: 'view',         label: 'הצגה' },
      { key: 'add',          label: 'הוספה' },
      { key: 'edit',         label: 'עריכה' },
      { key: 'delete',       label: 'מחיקה' },
      { key: 'import_excel', label: 'יבוא מאקסל' },
    ]
  },
  {
    key: 'groups',
    label: 'קבוצות',
    actions: [
      { key: 'view',           label: 'הצגה' },
      { key: 'create',         label: 'יצירת קבוצה' },
      { key: 'add_contact',    label: 'הוספת איש קשר' },
      { key: 'send_message',   label: 'שליחת הודעה לקבוצה' },
      { key: 'remove_contact', label: 'הסרת איש קשר' },
    ]
  },
  {
    key: 'settings',
    label: 'הגדרות',
    actions: [
      { key: 'view',         label: 'הצגה' },
      { key: 'edit_profile', label: 'עדכון פרטים אישיים' },
    ]
  },
  {
    key: 'users',
    label: 'משתמשים',
    actions: [
      { key: 'view',   label: 'הצגה' },
      { key: 'add',    label: 'הוספה' },
      { key: 'edit',   label: 'עדכון' },
      { key: 'delete', label: 'מחיקה' },
    ]
  },
  {
    key: 'rep_groups',
    label: 'קבוצות נציגים',
    actions: [
      { key: 'view',   label: 'הצגה' },
      { key: 'add',    label: 'הוספה' },
      { key: 'delete', label: 'מחיקה' },
    ]
  },
];

const emptyPermissions = (): UserTypePermissions => ({
  bots:     { view_tab: false, create: false, edit: false, delete: false, settings: false, publish: false },
  sessions: { view: false, add: false, view_all: false, view_assigned_only: false, templates_as_rep: false, templates_as_manager: false },
  contacts: { view: false, add: false, edit: false, delete: false, import_excel: false },
  groups:   { view: false, create: false, add_contact: false, send_message: false, remove_contact: false },
  settings: { view: false, edit_profile: false },
  users:    { view: false, add: false, edit: false, delete: false },
  rep_groups: { view: false, add: false, delete: false },
});

const UserTypesManager: React.FC<Props> = ({ token, apiBase }) => {
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New type form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCanAddUsers, setNewCanAddUsers] = useState(false);
  const [newShowInUsersTab, setNewShowInUsersTab] = useState(true);
  const [newAllowedTypeIds, setNewAllowedTypeIds] = useState<string[]>([]);
  const [newPermissions, setNewPermissions] = useState<UserTypePermissions>(emptyPermissions());
  const [creating, setCreating] = useState(false);

  // Local draft permissions per type (for editing)
  const [drafts, setDrafts] = useState<Record<string, {
    can_add_users: boolean;
    show_in_users_tab: boolean;
    allowed_user_type_ids: string[];
    permissions: UserTypePermissions;
  }>>({});

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/admin/user-types`, { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUserTypes(d.userTypes);
      const initial: typeof drafts = {};
      d.userTypes.forEach((t: UserType) => {
        initial[t._id] = {
          can_add_users: t.can_add_users,
          show_in_users_tab: t.show_in_users_tab !== false,
          allowed_user_type_ids: (t.allowed_user_type_ids || []).map(x => x._id),
          permissions: t.permissions
        };
      });
      setDrafts(initial);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePerm = (typeId: string, section: keyof UserTypePermissions, action: string) => {
    setDrafts(prev => {
      const draft = prev[typeId];
      if (!draft) return prev;
      return {
        ...prev,
        [typeId]: {
          ...draft,
          permissions: {
            ...draft.permissions,
            [section]: {
              ...(draft.permissions[section] as any),
              [action]: !(draft.permissions[section] as any)[action]
            }
          }
        }
      };
    });
  };

  const toggleNewPerm = (section: keyof UserTypePermissions, action: string) => {
    setNewPermissions(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [action]: !(prev[section] as any)[action]
      }
    }));
  };

  const save = async (id: string) => {
    setSaving(id);
    try {
      const draft = drafts[id];
      const r = await fetch(`${apiBase}/admin/user-types/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(draft)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUserTypes(prev => prev.map(t => t._id === id ? d.userType : t));
    } catch (e: any) {
      alert('שגיאה בשמירה: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const deleteType = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק סוג משתמש זה?')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`${apiBase}/admin/user-types/${id}`, { method: 'DELETE', headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUserTypes(prev => prev.filter(t => t._id !== id));
    } catch (e: any) {
      alert('שגיאה במחיקה: ' + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const createType = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${apiBase}/admin/user-types`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newName.trim(),
          can_add_users: newCanAddUsers,
          show_in_users_tab: newShowInUsersTab,
          allowed_user_type_ids: newAllowedTypeIds,
          permissions: newPermissions
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUserTypes(prev => [...prev, d.userType]);
      setDrafts(prev => ({
        ...prev,
        [d.userType._id]: {
          can_add_users: d.userType.can_add_users,
          show_in_users_tab: d.userType.show_in_users_tab !== false,
          allowed_user_type_ids: (d.userType.allowed_user_type_ids || []).map((x: any) => x._id),
          permissions: d.userType.permissions
        }
      }));
      setNewName('');
      setNewCanAddUsers(false);
      setNewShowInUsersTab(true);
      setNewAllowedTypeIds([]);
      setNewPermissions(emptyPermissions());
      setShowNewForm(false);
    } catch (e: any) {
      alert('שגיאה ביצירה: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const PermissionsGrid: React.FC<{
    permissions: UserTypePermissions;
    onToggle: (section: keyof UserTypePermissions, action: string) => void;
    readonlyName?: boolean;
  }> = ({ permissions, onToggle }) => (
    <div className="space-y-4 mt-4">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.key} className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">{group.label}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.actions.map(action => {
              const checked = !!(permissions as any)[group.key]?.[action.key];
              return (
                <label
                  key={action.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all text-sm font-medium ${
                    checked
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={checked}
                    onChange={() => onToggle(group.key, action.key)}
                  />
                  {action.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 text-red-600 py-10 justify-center">
      <AlertCircle className="w-5 h-5" />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800">סוגי משתמשים</h2>
          <p className="text-sm text-slate-500">הגדרת הרשאות לכל סוג משתמש במערכת</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          הוסף סוג משתמש
        </button>
      </div>

      {/* New type form */}
      {showNewForm && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-slate-800 mb-4">➕ סוג משתמש חדש</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="שם הסוג (למשל: נציג בכיר)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 whitespace-nowrap bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={newCanAddUsers}
                onChange={e => setNewCanAddUsers(e.target.checked)}
              />
              יכול להוסיף משתמשים
            </label>
          </div>
          {newCanAddUsers && (
            <div className="mb-4">
              <p className="text-xs font-black text-slate-500 mb-2">אילו סוגים המשתמש הזה יוכל להוסיף?</p>
              <div className="flex flex-wrap gap-2">
                {userTypes.map(t => {
                  const selected = newAllowedTypeIds.includes(t._id);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => setNewAllowedTypeIds(prev => selected ? prev.filter(id => id !== t._id) : [...prev, t._id])}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <PermissionsGrid permissions={newPermissions} onToggle={toggleNewPerm} />
          <div className="flex gap-3 mt-5">
            <button
              onClick={createType}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              שמור
            </button>
            <button
              onClick={() => {
                setShowNewForm(false);
                setNewName('');
                setNewCanAddUsers(false);
                setNewShowInUsersTab(true);
                setNewAllowedTypeIds([]);
                setNewPermissions(emptyPermissions());
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Existing types */}
      {userTypes.map(ut => {
        const draft = drafts[ut._id];
        const isExpanded = expandedId === ut._id;
        if (!draft) return null;
        return (
          <div
            key={ut._id}
            className={`bg-white rounded-2xl border transition-all shadow-sm ${isExpanded ? 'border-blue-200' : 'border-slate-200'}`}
          >
            {/* Row header */}
            <div className="flex items-center justify-between p-4">
              <button
                className="flex items-center gap-3 flex-1 text-right"
                onClick={() => setExpandedId(isExpanded ? null : ut._id)}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ut.is_seeded ? 'bg-violet-100' : 'bg-blue-100'}`}>
                  <Shield className={`w-5 h-5 ${ut.is_seeded ? 'text-violet-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{ut.name}</span>
                    {ut.is_seeded && (
                      <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">מובנה</span>
                    )}
                    {draft.can_add_users && (
                      <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">יכול להוסיף משתמשים</span>
                    )}
                  </div>
                  {ut.system_role && (
                    <span className="text-xs text-slate-400">{ut.system_role}</span>
                  )}
                </div>
                <div className="mr-auto">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              <div className="flex items-center gap-2 mr-3">
                {isExpanded && (
                  <button
                    onClick={() => save(ut._id)}
                    disabled={saving === ut._id}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving === ut._id
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Save className="w-3.5 h-3.5" />}
                    שמור
                  </button>
                )}
                {!ut.is_seeded && (
                  <button
                    onClick={() => deleteType(ut._id)}
                    disabled={deletingId === ut._id}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-4 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={draft.can_add_users}
                    onChange={e => setDrafts(prev => ({
                      ...prev,
                      [ut._id]: { ...prev[ut._id], can_add_users: e.target.checked }
                    }))}
                  />
                  יכול להוסיף משתמשים
                </label>
                {draft.can_add_users && (
                  <div className="mb-4">
                    <p className="text-xs font-black text-slate-500 mb-2">אילו סוגים המשתמש הזה יוכל להוסיף?</p>
                    <div className="flex flex-wrap gap-2">
                      {userTypes.map(t => {
                        const selected = draft.allowed_user_type_ids.includes(t._id);
                        return (
                          <button
                            key={t._id}
                            type="button"
                            onClick={() => setDrafts(prev => ({
                              ...prev,
                              [ut._id]: {
                                ...prev[ut._id],
                                allowed_user_type_ids: selected
                                  ? prev[ut._id].allowed_user_type_ids.filter(id => id !== t._id)
                                  : [...prev[ut._id].allowed_user_type_ids, t._id]
                              }
                            }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <PermissionsGrid
                  permissions={draft.permissions}
                  onToggle={(section, action) => togglePerm(ut._id, section, action)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UserTypesManager;
