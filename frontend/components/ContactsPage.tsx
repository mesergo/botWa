import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, Clock, MessageSquare, Search, Users, User, List,
  Settings, UserCog, ExternalLink, Plus, Edit2, Trash2, Mail, X, Check, Bot,
  Upload, Eye, ChevronRight, ChevronLeft, Layers, Sliders
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ImpersonationBanner from './ImpersonationBanner';
import PageTopBar from './PageTopBar';
import AppNav from './AppNav';
import GroupsPage from './GroupsPage';
import ImportContactsModal from './ImportContactsModal';
import { usePermission } from '../hooks/usePermission';
import { useContactFields } from '../context/ContactFieldsContext';
import { ContactFieldDef } from '../types';
import { getFormatLocale } from '../i18n';

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
  onOpenSendMessages?: () => void;
  onOpenSmsIn?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onSwitchAccount?: (accountId: string) => void;
  onGoHome?: () => void;
  initialPhone?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const EMPTY_FORM = { phone: '', full_name: '', whatsapp_name: '', email: '', custom_field_values: {} as Record<string, string> };

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
            <div className="absolute bottom-full mb-1 end-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[10rem]">
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
            <div className="absolute bottom-full mb-1 end-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 min-w-[10rem]">
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
  token, currentUser, onBack, onLogout, onOpenSessions, onOpenGroups, onOpenSendMessages,onOpenSmsIn,
  onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation, onSwitchAccount, onGoHome, initialPhone,
}) => {
  const { t, i18n } = useTranslation('contacts');
  const [contacts, setContacts] = useState<MergedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Main tab — switch between contacts table and distribution lists (groups)
  const [activeMainTab, setActiveMainTab] = useState<'contacts' | 'groups'>('contacts');

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
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Import/Add/Edit → distribution-list assignment
  const [availableGroups, setAvailableGroups] = useState<{ _id: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [contactGroupIds, setContactGroupIds] = useState<string[]>([]);

  const loadAvailableGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAvailableGroups((data.groups ?? []).filter((g: { _id: string; name: string; is_blocklist?: boolean }) => !g.is_blocklist));
      }
    } catch { /* silent */ }
    finally { setLoadingGroups(false); }
  }, [token]);

  const openImportModal = async () => {
    setImportModalOpen(true);
    loadAvailableGroups();
  };

  const toggleContactGroupId = (id: string) => {
    setContactGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
    setContactGroupIds([]);
    setModalError('');
    setModalOpen(true);
    loadAvailableGroups();
  };

  const openEdit = (c: MergedContact) => {
    setEditingContact({ _id: c._id, phone: c.phone, full_name: c.full_name, whatsapp_name: c.whatsapp_name, email: c.email });
    const existingCv = c.custom_field_values ?? {};
    // Migrate: for each known field def, resolve value from either _id key (bot-flow) or slug key (legacy manual edit)
    const handledKeys = new Set<string>();
    const cvByFieldId: Record<string, string> = {};
    contactFieldDefs.forEach(fd => {
      cvByFieldId[fd._id] = String((existingCv as Record<string, unknown>)[fd._id] ?? (existingCv as Record<string, unknown>)[fd.key] ?? '');
      handledKeys.add(fd._id);
      handledKeys.add(fd.key);
    });
    // Preserve unrecognized keys (e.g. legacy bot variable names)
    Object.entries(existingCv).forEach(([k, v]) => {
      if (!handledKeys.has(k)) cvByFieldId[k] = String(v ?? '');
    });
    setForm({
      phone: c.phone,
      full_name: c.full_name ?? '',
      whatsapp_name: c.whatsapp_name ?? '',
      email: c.email ?? '',
      custom_field_values: cvByFieldId,
    });
    setContactGroupIds((c.contactGroups ?? []).map(g => g._id));
    setModalError('');
    setModalOpen(true);
    loadAvailableGroups();
  };


  const closeModal = () => { setModalOpen(false); setModalError(''); };

  const saveContact = async () => {
    if (!form.phone.trim()) { setModalError('מספר טלפון הוא שדה חובה'); return; }
    setSaving(true);
    setModalError('');
    try {
      const payload = { ...form, groupIds: contactGroupIds };
      let res: Response;
      if (editingContact?._id) {
        res = await fetch(`${API_BASE}/contacts/${editingContact._id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/contacts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isRtl = i18n.dir() === 'rtl';
  // Pagination arrows point along the reading direction: "previous" is toward the inline start.
  const PrevPageIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextPageIcon = isRtl ? ChevronLeft : ChevronRight;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-start overflow-hidden">
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
      />

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <AppNav
          mode="sidebar"
          activePage="contacts"
          hideMobileTrigger
          mobileMenuOpen={mobileNavOpen}
          onMobileMenuOpenChange={setMobileNavOpen}
          onGoHome={onGoHome}
          onBots={can('bots.view_tab') ? onBack : undefined}
          onSessions={onOpenSessions ? () => onOpenSessions() : undefined}
          onSmsIn={onOpenSmsIn}
          onSendMessages={onOpenSendMessages}
          onSettings={onOpenSettings}
          onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 flex-shrink-0 ${activeMainTab === 'contacts' ? 'pb-6' : 'pb-0'}`}>
        <div className="max-w-7xl mx-auto">

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 mb-5 w-full sm:w-fit overflow-x-auto">
            <button
              onClick={() => setActiveMainTab('contacts')}
              className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap min-w-[8.5rem] ${
                activeMainTab === 'contacts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users size={14} /> אנשי קשר
            </button>
            <button
              onClick={() => setActiveMainTab('groups')}
              className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap min-w-[8.5rem] ${
                activeMainTab === 'groups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers size={14} /> רשימות תפוצה
            </button>
          </div>

          {/* Page header */}
          {activeMainTab === 'contacts' && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-2">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users size={26} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">אנשי קשר</h1>
                <p className="text-slate-400 text-sm font-semibold mt-0.5">{total} איש קשר</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-72 lg:w-80">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  className="w-full ps-11 pe-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-start font-medium"
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
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60"
              >
                <Upload size={15} />
                {importing ? 'מייבא...' : 'ייבוא מאקסל'}
              </button>
              )}

              {/* Add contact button */}
              {can('contacts.add') && (
              <button
                onClick={openAdd}
                className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-colors shadow-sm"
              >
                <Plus size={16} /> הוסף איש קשר
              </button>
              )}
            </div>
          </div>
          )}

        </div>
        </div>

        {activeMainTab === 'contacts' ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10">
        <div className="max-w-7xl mx-auto">

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-300">
              <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-16 sm:py-24 bg-white border-2 border-dashed border-slate-200 rounded-3xl sm:rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300 px-4">
              <Users size={56} strokeWidth={1} />
              <p className="text-lg sm:text-xl font-bold text-center">
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
            <>
              {/* Mobile cards */}
              <div className="lg:hidden space-y-3">
                {contacts.map(contact => {
                  const sim = isSimulator(contact.phone);
                  const customFieldRows = contactFieldDefs
                    .map(fd => {
                      const cv = contact.custom_field_values as Record<string, unknown> | undefined;
                      const val = cv?.[fd._id!] ?? cv?.[fd.key];
                      const text = val == null ? '' : String(val).trim();
                      return text ? { key: fd._id, label: fd.label, value: text } : null;
                    })
                    .filter((row): row is { key: string; label: string; value: string } => row !== null);

                  const botPhonesLabel = (contact.botPhones ?? []).length === 0
                    ? '—'
                    : `${(contact.botPhones ?? []).slice(0, 2).join(', ')}${(contact.botPhones ?? []).length > 2 ? ` +${(contact.botPhones ?? []).length - 2}` : ''}`;

                  const groupsLabel = (contact.contactGroups ?? []).length === 0
                    ? '—'
                    : `${(contact.contactGroups ?? []).slice(0, 2).map(g => g.name).join(', ')}${(contact.contactGroups ?? []).length > 2 ? ` +${(contact.contactGroups ?? []).length - 2}` : ''}`;

                  return (
                    <div
                      key={`mobile-${contact.phone}`}
                      onClick={() => setDetailContact(contact)}
                      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sim ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                            {sim ? <MessageSquare size={16} /> : <Phone size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{sim ? 'סימולטור' : contact.phone}</p>
                            {(contact.full_name || contact.whatsapp_name) && (
                              <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">{contact.full_name || contact.whatsapp_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {onOpenSessions && contact.sessionCount > 0 && (
                            <button
                              onClick={() => onOpenSessions(contact.phone)}
                              title="עבור לשיחות"
                              className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ExternalLink size={15} />
                            </button>
                          )}
                          {can('contacts.edit') && (
                            <button
                              onClick={() => openEdit(contact)}
                              title="ערוך"
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={15} />
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
                                  <Check size={15} />
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  title="ביטול"
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(contact._id!)}
                                title="מחק"
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">שם וואטסאפ</p>
                          <p className={`font-bold truncate ${contact.whatsapp_name ? 'text-slate-700' : 'text-slate-300'}`}>
                            {contact.whatsapp_name || '—'}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">כתובת מייל</p>
                          <p className={`font-bold truncate ${contact.email ? 'text-slate-700' : 'text-slate-300'}`}>
                            {contact.email || '—'}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">שוחח עם</p>
                          <p className={`font-bold truncate ${botPhonesLabel !== '—' ? 'text-slate-700' : 'text-slate-300'}`} title={botPhonesLabel}>
                            {botPhonesLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">רשימות תפוצה</p>
                          <p className={`font-bold truncate ${groupsLabel !== '—' ? 'text-slate-700' : 'text-slate-300'}`} title={groupsLabel}>
                            {groupsLabel}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">שיחות</p>
                          <p className="text-slate-700 font-bold">{contact.sessionCount}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 min-w-0">
                          <p className="text-slate-400 font-bold mb-1">פעיל לאחרונה</p>
                          <p className="text-slate-700 font-bold truncate">{formatDate(contact.lastSeen)}</p>
                        </div>
                      </div>

                      {customFieldRows.length > 0 && (
                        <div className="mt-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                          <p className="text-[11px] text-indigo-400 font-bold">שדות מותאמים אישית</p>
                          <div className="flex flex-col gap-1.5">
                            {customFieldRows.map(row => {
                              return (
                                <div key={`mobile-custom-${contact.phone}-${row.key}`} className="flex items-center justify-between gap-3">
                                  <span className="text-[11px] text-indigo-500 font-bold">{row.label}</span>
                                  <span className="text-xs font-semibold text-slate-700">
                                    {row.value}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => setFieldsModalOpen(true)}
                  title="ניהול שדות"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-colors shadow-sm"
                >
                  <Sliders size={14} />
                  ניהול שדות
                </button>
              </div>

              <div className="hidden lg:block bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
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
                          {contactFieldDefs.map(f => {
                            const cv = contact.custom_field_values as Record<string, unknown> | undefined;
                            const val = cv?.[f._id!] ?? cv?.[f.key];
                            return (
                              <div key={f._id} className="text-sm font-semibold text-slate-700 truncate">
                                {val
                                  ? String(val)
                                  : <span className="text-slate-300 font-normal">—</span>}
                              </div>
                            );
                          })}

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
                <div className="hidden lg:flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs font-bold text-slate-400">
                    עמוד {page} מתוך {totalPages} &nbsp;·&nbsp; {total} איש קשר
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <PrevPageIcon size={16} />
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
                      <NextPageIcon size={16} />
                    </button>
                  </div>
                </div>
              )}
              </div>

              {totalPages > 1 && (
                <div className="lg:hidden mt-3 flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    הקודם
                  </button>
                  <span className="text-xs font-bold text-slate-400 text-center">עמוד {page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    הבא
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        </div>
        ) : (
        <div className="flex-1 overflow-hidden">
          <GroupsPage
            embedded
            token={token}
            currentUser={currentUser}
            onBack={onBack}
            onLogout={onLogout}
            onOpenSessions={onOpenSessions}
            onOpenSmsIn={onOpenSmsIn}
            onOpenAdminPanel={onOpenAdminPanel}
            onOpenSettings={onOpenSettings}
            onOpenSubUsers={onOpenSubUsers}
            onStopImpersonation={onStopImpersonation}
            onSwitchAccount={onSwitchAccount}
            onGoHome={onGoHome}
          />
        </div>
        )}
        </div>
      </div>{/* end main layout */}

      {/* Import modal */}
      {importModalOpen && (
        <ImportContactsModal
          token={token}
          groups={availableGroups}
          groupsLoading={loadingGroups}
          onClose={() => setImportModalOpen(false)}
          onImported={() => { setPage(1); fetchData(); }}
          onImportingChange={setImporting}
        />
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">
                {editingContact?._id ? 'עריכת איש קשר' : 'הוספת איש קשר'}
              </h2>
              <button onClick={closeModal} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Phone */}
              <div className="relative">
                <Phone size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  className="w-full ps-10 pe-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="מספר טלפון *"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  disabled={!!editingContact?._id}
                />
              </div>

              {/* Full name */}
              <div className="relative">
                <User size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  className="w-full ps-10 pe-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                  placeholder="שם מלא"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>

              {/* WhatsApp name — read-only */}
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="currentColor" className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300 w-[15px] h-[15px]">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <input
                  className="w-full ps-10 pe-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 transition-all"
                  placeholder="שם מוואטסאפ"
                  value={form.whatsapp_name}
                  disabled
                />
              </div>

              {/* Email */}
              <div className="relative">
                <Mail size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type="email"
                  className="w-full ps-10 pe-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                  placeholder="כתובת מייל"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              {/* Custom fields */}
              {contactFieldDefs.map(fd => (
                <input
                  key={fd._id}
                  className="w-full px-4 py-2.5 border border-indigo-100 bg-indigo-50/40 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-400 transition-all"
                  placeholder={fd.label}
                  value={form.custom_field_values?.[fd._id] ?? ''}
                  onChange={e => setForm(f => ({ ...f, custom_field_values: { ...f.custom_field_values, [fd._id]: e.target.value } }))}
                />
              ))}

              {/* Distribution lists (groups) */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-indigo-500" />
                  <span className="text-sm font-bold text-indigo-800">רשימות תפוצה</span>
                </div>
                {loadingGroups ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full" />
                  </div>
                ) : availableGroups.length === 0 ? (
                  <p className="text-xs text-indigo-400 font-semibold px-1">אין רשימות תפוצה. צור קבוצה תחילה.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto ps-1">
                    {availableGroups.map(g => (
                      <label key={g._id} className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={contactGroupIds.includes(g._id)}
                          onChange={() => toggleContactGroupId(g._id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-sm font-semibold text-indigo-800 truncate">{g.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {modalError && (
                <p className="text-sm text-red-500 font-semibold bg-red-50 px-4 py-2 rounded-xl">{modalError}</p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-2">
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setDetailContact(null)}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-10 pt-6 sm:pt-8 pb-5 sm:pb-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md select-none flex-shrink-0">
                  {(detailContact.full_name || detailContact.whatsapp_name || detailContact.phone).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                    {detailContact.full_name || detailContact.whatsapp_name || detailContact.phone}
                  </h2>
                  <p className="text-sm text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5 truncate">
                    <Phone size={13} />
                    {detailContact.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-2">
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
            <div className="px-4 sm:px-10 py-5 sm:py-7 flex flex-col gap-6 sm:gap-7 overflow-y-auto">

              {/* Stats bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      // Resolve display label: look up by _id or slug key, fall back to raw key
                      const fieldDef = contactFieldDefs.find(f => f._id === key || f.key === key);
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 pt-6 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 flex-shrink-0">
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

        <div className="overflow-y-auto px-5 sm:px-8 py-5 sm:py-6 flex flex-col gap-6">

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

        <div className="px-5 sm:px-8 py-4 sm:py-5 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;

