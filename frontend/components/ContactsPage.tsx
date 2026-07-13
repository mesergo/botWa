import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, Clock, MessageSquare, Search, Users, LogOut, List, Shield,
  Settings, UserCog, ExternalLink, Plus, Edit2, Trash2, Mail, X, Check, Bot,
  Upload, Download, Eye, ChevronRight, ChevronLeft, Layers, Sliders
} from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import AppNav from './AppNav';
import { usePermission } from '../hooks/usePermission';
import { useContactFields } from '../context/ContactFieldsContext';
import { ContactFieldDef } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactRecord {
  _id?: string;
  phone: string;
  full_name?: string;
  whatsapp_name?: string;
  email?: string;
  custom_field_values?: Record<string, unknown>;
}

interface SessionStats {
  phone: string;
  sessionCount: number;
  lastSeen: string | null;
  bots: { id: string; name: string }[];
  botPhones?: string[];
}

interface MergedContact extends ContactRecord {
  sessionCount: number;
  lastSeen: string | null;
  bots: { id: string; name: string }[];
  botPhones: string[];
  contactGroups: { _id: string; name: string }[];
}

interface ContactsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenSessions?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onGoHome?: () => void;
  initialPhone?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const EMPTY_FORM = { phone: '', full_name: '', whatsapp_name: '', email: '' };

// ─── GroupNameTags ───────────────────────────────────────────────────────────

const GroupNameTags: React.FC<{ groups: { _id: string; name: string }[] }> = ({ groups }) => {
  const [showPopover, setShowPopover] = React.useState(false);
  const MAX_VISIBLE = 2;

  if (!groups || groups.length === 0) {
    return <span className="text-slate-300 text-sm">—</span>;
  }

  const visible = groups.slice(0, MAX_VISIBLE);
  const hidden = groups.slice(MAX_VISIBLE);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(g => (
        <span key={g._id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold truncate max-w-[7rem]" title={g.name}>
          {g.name}
        </span>
      ))}
      {hidden.length > 0 && (
        <div className="relative"
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
        >
          <button
            className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
          >
            +{hidden.length}
          </button>
          {showPopover && (
            <div className="absolute bottom-full mb-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[10rem]">
              {hidden.map(g => (
                <span key={g._id} className="text-xs text-slate-700 font-semibold px-2 py-1 bg-slate-50 rounded-lg whitespace-nowrap">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── BotPhonesTags ────────────────────────────────────────────────────────────

const BotPhonesTags: React.FC<{ phones: string[] }> = ({ phones }) => {
  const [showPopover, setShowPopover] = React.useState(false);
  const MAX_VISIBLE = 2;

  if (!phones || phones.length === 0) {
    return <span className="text-slate-300 text-sm">—</span>;
  }

  const visible = phones.slice(0, MAX_VISIBLE);
  const hidden = phones.slice(MAX_VISIBLE);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(p => (
        <span key={p} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-bold truncate max-w-[7rem]" title={p}>
          {p}
        </span>
      ))}
      {hidden.length > 0 && (
        <div className="relative"
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
        >
          <button
            className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
            +{hidden.length}
          </button>
          {showPopover && (
            <div className="absolute bottom-full mb-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[10rem]">
              {hidden.map(p => (
                <span key={p} className="text-xs text-slate-700 font-semibold px-2 py-1 bg-slate-50 rounded-lg whitespace-nowrap">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const ContactsPage: React.FC<ContactsPageProps> = ({
  token, currentUser, onBack, onLogout, onOpenSessions, onOpenGroups,
  onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation, onGoHome, initialPhone,
}) => {
  const [contacts, setContacts] = useState<MergedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Inline delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail view
  const [detailContact, setDetailContact] = useState<MergedContact | null>(null);
  const [initialPhoneHandled, setInitialPhoneHandled] = useState(false);

  // Fields management modal
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);

  // Contact custom fields context
  const { fields: contactFieldDefs, reload: reloadFields } = useContactFields();

  // ── Auto-open detail for initialPhone ────────────────────────────────────
  useEffect(() => {
    if (initialPhone && !initialPhoneHandled) {
      setSearch(initialPhone);
    }
  }, [initialPhone, initialPhoneHandled]);

  useEffect(() => {
    if (initialPhone && !initialPhoneHandled && contacts.length > 0 && !loading) {
      const found = contacts.find(c => c.phone === initialPhone);
      if (found) {
        setDetailContact(found);
        setInitialPhoneHandled(true);
      }
    }
  }, [contacts, loading, initialPhone, initialPhoneHandled]);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { phone: string; error: string }[] } | null>(null);

  // Import → group assignment
  const [assignToGroups, setAssignToGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<{ _id: string; name: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const openImportModal = async () => {
    setAssignToGroups(false);
    setSelectedGroupIds([]);
    setImportModalOpen(true);
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAvailableGroups((data.groups ?? []).filter((g: { _id: string; name: string; is_blocklist?: boolean }) => !g.is_blocklist));
      }
    } catch { /* silent */ }
    finally { setLoadingGroups(false); }
  };

  const toggleGroupId = (id: string) => {
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ── Sample file download ──────────────────────────────────────────────────

  const downloadSample = () => {
    const customLabels = contactFieldDefs.map(f => f.label);
    const header = ['טלפון', 'שם מלא', 'שם וואטסאפ', 'מייל', ...customLabels].join(',');
    const customEmpty = customLabels.map(() => '').join(',');
    const customSep = customLabels.length > 0 ? ',' : '';
    const rows = [
      `972501234567,ישראל ישראלי,ישראל,israel@example.com${customSep}${customEmpty}`,
      `972529876543,שרה כהן,שרה' כהן,sarah@example.com${customSep}${customEmpty}`,
    ];
    const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM for Excel Hebrew support
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts-sample.csv';
    a.click(); 
    URL.revokeObjectURL(url);
  };

  // ── Import from Excel/CSV ─────────────────────────────────────────────────

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so same file can be chosen again
    e.target.value = '';
    setImportModalOpen(false);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (assignToGroups && selectedGroupIds.length > 0) {
        formData.append('groupIds', JSON.stringify(selectedGroupIds));
      }
      const res = await fetch(`${API_BASE}/contacts/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בייבוא');
      setImportResult(data);
      setPage(1);
      fetchData();
    } catch (err: unknown) {
      setImportResult({ imported: 0, skipped: 0, errors: [{ phone: '', error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }] });
    } finally {
      setImporting(false);
    }
  };

  // Debounce search → reset to page 1 on new query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const [recordsRes, statsRes, groupsMapRes] = await Promise.all([
        fetch(`${API_BASE}/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/sessions/contacts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/contacts/groups-map`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const recordsData = recordsRes.ok ? await recordsRes.json() : { contacts: [], total: 0, totalPages: 1 };
      const records: ContactRecord[] = recordsData.contacts ?? [];
      const stats: SessionStats[] = statsRes.ok ? await statsRes.json() : [];
      const groupsMap: Record<string, { _id: string; name: string }[]> = groupsMapRes.ok ? await groupsMapRes.json() : {};

      setTotal(recordsData.total ?? 0);
      setTotalPages(recordsData.totalPages ?? 1);

      // Enrich each paginated contact with its session stats and group membership
      const statsMap = new Map<string, SessionStats>(stats.map((s: SessionStats) => [s.phone, s]));
      const merged: MergedContact[] = records.map(r => {
        const s = statsMap.get(r.phone);
        return {
          ...r,
          full_name: r.full_name ?? '',
          whatsapp_name: r.whatsapp_name ?? '',
          email: r.email ?? '',
          custom_field_values: r.custom_field_values ?? {},
          sessionCount: s?.sessionCount ?? 0,
          lastSeen: s?.lastSeen ?? null,
          bots: s?.bots ?? [],
          botPhones: s?.botPhones ?? [],
          contactGroups: r._id ? (groupsMap[r._id] ?? []) : [],
        };
      });

      setContacts(merged);
    } catch (e) {
      console.error('Failed to load contacts', e);
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingContact(null);
    setForm({ ...EMPTY_FORM });
    setModalError('');
    setModalOpen(true);
  };

  const openEdit = (c: MergedContact) => {
    setEditingContact({ _id: c._id, phone: c.phone, full_name: c.full_name, whatsapp_name: c.whatsapp_name, email: c.email });
    setForm({ phone: c.phone, full_name: c.full_name ?? '', whatsapp_name: c.whatsapp_name ?? '', email: c.email ?? '' });
    setModalError('');
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setModalError(''); };

  const saveContact = async () => {
    if (!form.phone.trim()) { setModalError('מספר טלפון הוא שדה חובה'); return; }
    setSaving(true);
    setModalError('');
    try {
      let res: Response;
      if (editingContact?._id) {
        res = await fetch(`${API_BASE}/contacts/${editingContact._id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`${API_BASE}/contacts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        setModalError(err.error ?? 'שגיאה בשמירה');
        return;
      }
      closeModal();
      fetchData();
    } catch {
      setModalError('שגיאת רשת');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeletingId(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const can = usePermission(currentUser as any);
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() ?? currentUser?.email?.charAt(0)?.toUpperCase() ?? '?';
  const isSimulator = (phone: string) => phone === 'Simulated' || phone.toLowerCase() === 'simulator' || phone.toLowerCase() === 'simulated';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      <ImpersonationBanner currentUser={currentUser} onStopImpersonation={onStopImpersonation} />

      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0" dir="ltr">
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
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
          <div
            title={currentUser?.name ?? currentUser?.email ?? ''}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
            onClick={onBack}
          >
            {firstName}
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <AppNav
          mode="sidebar"
          activePage="contacts"
          onGoHome={onGoHome}
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onGroups={onOpenGroups}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />
        <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-7xl mx-auto">

          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">אנשי קשר</h1>
                <p className="text-slate-400 text-sm font-semibold mt-0.5">{total} איש קשר</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-72">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  className="w-full pr-11 pl-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-right font-medium"
                  placeholder="חיפוש לפי טלפון, שם, מייל..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Import from Excel */}
              {can('contacts.import_excel') && (
              <button
                onClick={openImportModal}
                disabled={importing}
                title="ייבוא אנשי קשר מאקסל / CSV"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60"
              >
                <Upload size={15} />
                {importing ? 'מייבא...' : 'ייבוא מאקסל'}
              </button>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
              />

              {/* Add contact button */}
              {can('contacts.add') && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-colors shadow-sm"
              >
                <Plus size={16} /> הוסף איש קשר
              </button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-300">
              <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
              <Users size={64} strokeWidth={1} />
              <p className="text-xl font-bold">
                {total === 0 ? 'עדיין אין אנשי קשר' : 'לא נמצאו תוצאות'}
              </p>
              {total === 0 && can('contacts.add') && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-colors mt-2"
                >
                  <Plus size={16} /> הוסף איש קשר ראשון
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
              {/* Build grid template dynamically */}
              {(() => {
                // When there are custom fields we switch to fixed rem widths so the grid
                // can overflow the container and the parent overflow-x-auto kicks in.
                // Without custom fields we use fr units to fill the available space.
                const hasCustomCols = contactFieldDefs.length > 0;
                let gridTemplateColumns: string;
                if (hasCustomCols) {
                  const fixedBase = '9rem 8.5rem 7.5rem 8.5rem 8.5rem 8.5rem 4rem 8rem';
                  const customCols = contactFieldDefs.map(() => '8rem').join(' ');
                  gridTemplateColumns = [fixedBase, customCols, '7rem'].join(' ');
                } else {
                  gridTemplateColumns = '1.6fr 1.5fr 1.3fr 1.4fr 1.4fr 1.4fr 0.65fr 1.3fr 7rem';
                }

                return (
                  <>
                    {/* Table header */}
                    <div
                      className="grid gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide"
                      style={{ gridTemplateColumns }}
                    >
                      <span>טלפון</span>
                      <span>שם מלא</span>
                      <span>שם וואטסאפ</span>
                      <span>כתובת מייל</span>
                      <span>שוחח עם</span>
                      <span>רשימות תפוצה</span>
                      <span className="text-center">שיחות</span>
                      <span>פעיל לאחרונה</span>
                      {contactFieldDefs.map(f => (
                        <span key={f._id} className="text-indigo-400 truncate" title={f.label}>{f.label}</span>
                      ))}
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setFieldsModalOpen(true)}
                          title="ניהול שדות"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm whitespace-nowrap"
                        >
                          <Sliders size={13} />
                          ניהול שדות
                        </button>
                      </div>
                    </div>

                    {contacts.map((contact, idx) => {
                      const sim = isSimulator(contact.phone);
                      return (
                        <div
                          key={contact.phone}
                          onClick={() => setDetailContact(contact)}
                          className={`grid gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors cursor-pointer ${idx !== contacts.length - 1 ? 'border-b border-slate-100' : ''}`}
                          style={{ gridTemplateColumns }}
                        >
                          {/* Phone */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${sim ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                              {sim ? <MessageSquare size={15} /> : <Phone size={15} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{sim ? 'סימולטור' : contact.phone}</p>
                              {sim && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">בדיקות</span>}
                            </div>
                          </div>

                          {/* Full name */}
                          <div className="text-sm font-semibold text-slate-700 truncate">
                            {contact.full_name || <span className="text-slate-300 font-normal">—</span>}
                          </div>

                          {/* WhatsApp name */}
                          <div className="text-sm font-semibold text-slate-700 truncate">
                            {contact.whatsapp_name || <span className="text-slate-300 font-normal">—</span>}
                          </div>

                          {/* Email */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {contact.email ? (
                              <>
                                <Mail size={12} className="text-slate-300 flex-shrink-0" />
                                <span className="text-sm text-slate-500 font-medium truncate">{contact.email}</span>
                              </>
                            ) : (
                              <span className="text-slate-300 text-sm">—</span>
                            )}
                          </div>

                          {/* Bot phones */}
                          <div className="flex items-center min-w-0" onClick={e => e.stopPropagation()}>
                            <BotPhonesTags phones={contact.botPhones ?? []} />
                          </div>

                          {/* Distribution groups */}
                          <div className="flex items-center min-w-0" onClick={e => e.stopPropagation()}>
                            <GroupNameTags groups={contact.contactGroups ?? []} />
                          </div>

                          {/* Session count */}
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-600">
                            {contact.sessionCount > 0
                              ? <><MessageSquare size={13} className="text-blue-400" />{contact.sessionCount}</>
                              : <span className="text-slate-300">0</span>
                            }
                          </div>

                          {/* Last seen */}
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 font-medium">
                            <Clock size={13} />
                            {formatDate(contact.lastSeen)}
                          </div>

                          {/* Custom field columns */}
                          {contactFieldDefs.map(f => (
                            <div key={f._id} className="text-sm font-semibold text-slate-700 truncate">
                              {contact.custom_field_values?.[f.key]
                                ? String(contact.custom_field_values[f.key])
                                : <span className="text-slate-300 font-normal">—</span>}
                            </div>
                          ))}

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {onOpenSessions && contact.sessionCount > 0 && (
                              <button
                                onClick={() => onOpenSessions(contact.phone)}
                                title="עבור לשיחות"
                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <ExternalLink size={14} />
                              </button>
                            )}
                            {can('contacts.edit') && (
                            <button
                              onClick={() => openEdit(contact)}
                              title="ערוך"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            )}
                            {can('contacts.delete') && contact._id && (
                              deletingId === contact._id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => confirmDelete(contact._id!)}
                                    title="אשר מחיקה"
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    title="ביטול"
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(contact._id!)}
                                  title="מחק"
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* Pagination bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs font-bold text-slate-400">
                    עמוד {page} מתוך {totalPages} &nbsp;·&nbsp; {total} איש קשר
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | '...')[]>((acc, p, i, arr) => {
                        if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-slate-300 text-xs font-bold">···</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                              page === p
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )
                    }
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>{/* end main layout */}

      {/* Import modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">ייבוא אנשי קשר</h2>
              <button onClick={() => setImportModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Download sample */}
              <div className="bg-slate-50 rounded-2xl px-5 py-4">
                <p className="text-sm font-bold text-slate-700 mb-1">רוצה לראות דוגמה?</p>
                <p className="text-xs text-slate-400 mb-3">הורד קובץ לדוגמה כדי לראות את פורמט הנתונים הנדרש</p>
                <button
                  onClick={downloadSample}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
                >
                  <Download size={15} /> הורד קובץ לדוגמה
                </button>
              </div>

              {/* Assign to groups */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={assignToGroups}
                    onChange={e => { setAssignToGroups(e.target.checked); if (!e.target.checked) setSelectedGroupIds([]); }}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-indigo-800">שייך לרשימת תפוצה</span>
                </label>
                {assignToGroups && (
                  <div className="flex flex-col gap-2">
                    {loadingGroups ? (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full" />
                      </div>
                    ) : availableGroups.length === 0 ? (
                      <p className="text-xs text-indigo-400 font-semibold px-1">אין רשימות תפוצה. צור קבוצה תחילה.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {availableGroups.map(g => (
                          <label key={g._id} className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(g._id)}
                              onChange={() => toggleGroupId(g._id)}
                              className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                            />
                            <span className="text-sm font-semibold text-indigo-800 truncate">{g.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || (assignToGroups && selectedGroupIds.length === 0 && availableGroups.length > 0)}
                title={assignToGroups && selectedGroupIds.length === 0 && availableGroups.length > 0 ? 'בחר לפחות רשימת תפוצה אחת' : undefined}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-colors disabled:opacity-60"
              >
                <Upload size={16} />
                {importing ? 'מייבא...' : 'בחר קובץ Excel / CSV לייבוא'}
              </button>

              <button
                onClick={() => setImportModalOpen(false)}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import result modal */}
      {importResult && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900">תוצאות ייבוא</h2>
              <button onClick={() => setImportResult(null)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-2xl px-5 py-3">
                <Check size={18} className="flex-shrink-0" />
                <span className="font-bold text-sm">יובאו בהצלחה: <span className="text-lg">{importResult.imported}</span> אנשי קשר</span>
              </div>
              {importResult.skipped > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 text-amber-700 rounded-2xl px-5 py-3">
                  <span className="font-bold text-sm">דולגו (ללא טלפון): <span className="text-lg">{importResult.skipped}</span></span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-2xl px-5 py-3">
                  <p className="text-red-600 font-bold text-sm mb-2">שגיאות ({importResult.errors.length}):</p>
                  <ul className="text-xs text-red-500 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>{e.phone ? `${e.phone}: ` : ''}{e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => setImportResult(null)}
                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                {editingContact?._id ? 'עריכת איש קשר' : 'הוספת איש קשר'}
              </h2>
              <button onClick={closeModal} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Phone */}
              <label className="flex flex-row items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-24 shrink-0 text-right">
                  מספר טלפון <span className="text-red-400">*</span>
                </span>
                <div className="relative flex-1">
                  <Phone size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="לדוגמה: 0501234567"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    disabled={!!editingContact?._id}
                  />
                </div>
              </label>

              {/* Full name */}
              <label className="flex flex-row items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-24 shrink-0 text-right">שם מלא</span>
                <input
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                  placeholder="שם פרטי ומשפחה"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </label>

              {/* WhatsApp name - show only when editing and value exists */}
              {editingContact?._id && form.whatsapp_name ? (
                <div className="flex flex-row items-center gap-3">
                  <span className="text-sm font-bold text-slate-600 w-24 shrink-0 text-right">שם מוואטסאפ</span>
                  <input
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    value={form.whatsapp_name}
                    readOnly
                    disabled
                  />
                </div>
              ) : null}

              {/* Email */}
              <label className="flex flex-row items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-24 shrink-0 text-right">כתובת מייל</span>
                <div className="relative flex-1">
                  <Mail size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="email"
                    className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </label>

              {modalError && (
                <p className="text-sm text-red-500 font-semibold bg-red-50 px-4 py-2 rounded-xl">{modalError}</p>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={saveContact}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors"
                >
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Contact Detail Modal */}
      {detailContact && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setDetailContact(null)}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]" dir="rtl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-10 pt-8 pb-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md select-none">
                  {(detailContact.full_name || detailContact.whatsapp_name || detailContact.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {detailContact.full_name || detailContact.whatsapp_name || detailContact.phone}
                  </h2>
                  <p className="text-sm text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                    <Phone size={13} />
                    {detailContact.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenSessions && detailContact.sessionCount > 0 && (
                  <button
                    onClick={() => { setDetailContact(null); onOpenSessions(detailContact.phone); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                    title="עבור לשיחות"
                  >
                    <MessageSquare size={15} />
                    שיחות
                  </button>
                )}
                {can('contacts.edit') && (
                <button
                  onClick={() => { setDetailContact(null); openEdit(detailContact); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold text-sm transition-colors border border-blue-200"
                  title="ערוך"
                >
                  <Edit2 size={15} />
                  ערוך
                </button>
                )}
                <button
                  onClick={() => setDetailContact(null)}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-10 py-7 flex flex-col gap-7 overflow-y-auto">

              {/* Stats bar */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">שיחות</span>
                  <div className="flex items-center gap-2 mt-1">
                    <MessageSquare size={18} className="text-blue-400" />
                    <span className="text-2xl font-black text-slate-800">{detailContact.sessionCount}</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">פעיל לאחרונה</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={16} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">{formatDate(detailContact.lastSeen)}</span>
                  </div>
                </div>
              </div>

              {/* Standard fields */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">פרטי בסיס</h3>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'שם מלא', value: detailContact.full_name },
                    { label: 'שם וואטסאפ', value: detailContact.whatsapp_name },
                    { label: 'כתובת מייל', value: detailContact.email },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className={`text-sm font-semibold ${value ? 'text-slate-800' : 'text-slate-300'}`}>{value || '—'}</span>
                      <span className="text-xs font-bold text-slate-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bot phones this contact interacted with */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-indigo-100 pb-2">טלפונים שהתכתבו עם איש קשר זה</h3>
                {detailContact.botPhones && detailContact.botPhones.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detailContact.botPhones.map(p => (
                      <span key={p} className="text-sm bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-full font-bold">
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-sm text-slate-300 font-semibold">—</span>
                  </div>
                )}
              </div>

              {/* Custom fields from bot flows */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-b border-blue-100 pb-2">פרטים שנשמרו מהשיחות</h3>
                {detailContact.custom_field_values && Object.keys(detailContact.custom_field_values).length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(detailContact.custom_field_values).map(([key, value]) => {
                      // Resolve display label: look up by slug key, fall back to raw key
                      const fieldDef = contactFieldDefs.find(f => f.key === key);
                      const displayLabel = fieldDef ? fieldDef.label : key;
                      return (
                        <div key={key} className="flex items-center justify-between px-5 py-3.5 bg-blue-50 rounded-2xl border border-blue-100">
                          <span className="text-sm font-bold text-slate-800">{String(value) || '—'}</span>
                          <span className="text-xs font-bold text-blue-400 capitalize">{displayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-300 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Eye size={32} strokeWidth={1.5} />
                    <p className="text-sm font-bold">אין פרטים שנשמרו מהשיחות עדיין</p>
                    <p className="text-xs text-slate-300">פרטים יופיעו כאן לאחר שיחות עם צומת "שמור בפרטי איש קשר"</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ─── Contact Fields Management Modal ───────────────────────────────── */}
      {fieldsModalOpen && (
        <ContactFieldsModal
          token={token}
          fields={contactFieldDefs}
          onClose={() => setFieldsModalOpen(false)}
          onChanged={reloadFields}
        />
      )}
    </div>
  );
};

// ─── ContactFieldsModal ───────────────────────────────────────────────────────

const BASE_FIELDS = [
  { label: 'טלפון' },
  { label: 'שם מלא' },
  { label: 'שם וואטסאפ' },
  { label: 'כתובת מייל' },
];

const ContactFieldsModal: React.FC<{
  token: string | null;
  fields: ContactFieldDef[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ token, fields, onClose, onChanged }) => {
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : `${window.location.origin}/api`;

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const handleAdd = async () => {
    if (!newLabel.trim()) { setAddError('שם השדה הוא שדה חובה'); return; }
    setSaving(true); setAddError('');
    try {
      const res = await fetch(`${apiBase}/contact-fields`, { method: 'POST', headers, body: JSON.stringify({ label: newLabel.trim() }) });
      if (!res.ok) { const e = await res.json(); setAddError(e.error ?? 'שגיאה'); return; }
      setNewLabel(''); setAdding(false); onChanged();
    } catch { setAddError('שגיאת רשת'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: string) => {
    if (!editLabel.trim()) return;
    setSaving(true);
    try {
      await fetch(`${apiBase}/contact-fields/${id}`, { method: 'PUT', headers, body: JSON.stringify({ label: editLabel.trim() }) });
      setEditingId(null); onChanged();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${apiBase}/contact-fields/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setDeletingId(null); onChanged();
    } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" dir="rtl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Sliders size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900">ניהול שדות</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-8 py-6 flex flex-col gap-6">

          {/* Base fields (read-only) */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">שדות בסיס (קבועים)</h3>
            {BASE_FIELDS.map(f => (
              <div key={f.label} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-semibold text-slate-500">{f.label}</span>
                <span className="text-xs text-slate-300 font-bold">קבוע</span>
              </div>
            ))}
          </div>

          {/* Custom fields */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">שדות מוגדרים אישית</h3>

            {fields.length === 0 && !adding && (
              <div className="py-6 text-center text-slate-300 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-bold">אין שדות מוגדרים עדיין</p>
                <p className="text-xs mt-1">לחץ על "הוסף שדה" כדי להתחיל</p>
              </div>
            )}

            {fields.map(f => (
              <div key={f._id} className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                {editingId === f._id ? (
                  <>
                    <input
                      autoFocus
                      className="flex-1 px-3 py-1.5 border border-indigo-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(f._id); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <button onClick={() => handleUpdate(f._id)} disabled={saving} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </>
                ) : deletingId === f._id ? (
                  <>
                    <span className="flex-1 text-sm font-semibold text-red-600">למחוק את "{f.label}"?</span>
                    <button onClick={() => handleDelete(f._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setDeletingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold text-indigo-800">{f.label}</span>
                    <button onClick={() => { setEditingId(f._id); setEditLabel(f.label); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeletingId(f._id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* Add new field */}
            {adding ? (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 px-4 py-2.5 border border-indigo-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="שם השדה (לדוגמה: סוג לקוח)"
                    value={newLabel}
                    onChange={e => { setNewLabel(e.target.value); setAddError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); } }}
                  />
                  <button onClick={handleAdd} disabled={saving} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60">
                    הוסף
                  </button>
                  <button onClick={() => { setAdding(false); setNewLabel(''); setAddError(''); }} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors">
                    ביטול
                  </button>
                </div>
                {addError && <p className="text-xs text-red-500 font-semibold px-1">{addError}</p>}
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl font-bold text-sm transition-colors mt-1"
              >
                <Plus size={15} /> הוסף שדה
              </button>
            )}
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;

