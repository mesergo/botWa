import React, { useState, useEffect, useRef } from 'react';
import { Clock, MessageSquare, Search, Bot, LogOut, ChevronDown, ChevronUp, User, Phone, List, Users } from 'lucide-react';

interface Session {
  id: string;
  phone: string;
  widget_id: string;
  bot_name: string;
  user_name?: string;
  created_at: string | null;
  parameters: Record<string, any>;
  process_history: any[];
}

interface PaginatedResponse {
  sessions: Session[];
  total: number;
  page: number;
  totalPages: number;
}

interface SessionsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenContacts?: () => void;
  ownOnly?: boolean;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const SessionsPage: React.FC<SessionsPageProps> = ({ token, currentUser, onBack, onLogout, onOpenContacts, ownOnly }) => {
  const isAdmin = currentUser?.role === 'admin';
  const showAll = isAdmin && !ownOnly;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSessions = async (p = 1, q = '') => {
    if (!token) return;
    setLoading(true);
    try {
      if (showAll) {
        const params = new URLSearchParams({ page: String(p), search: q });
        const res = await fetch(`${API_BASE}/sessions/all-sessions?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data: PaginatedResponse = await res.json();
          setSessions(data.sessions);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setPage(data.page);
        }
      } else {
        const res = await fetch(`${API_BASE}/sessions/my-sessions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data: Session[] = await res.json();
          setSessions(data);
          setTotal(data.length);
          setTotalPages(1);
          setPage(1);
        }
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(1, search);
  }, [token]);

  // Debounced search for admin
  useEffect(() => {
    if (!showAll) return;
    const timer = setTimeout(() => fetchSessions(1, search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredSessions = showAll
    ? sessions
    : sessions.filter(s =>
        s.phone.toLowerCase().includes(search.toLowerCase()) ||
        s.bot_name.toLowerCase().includes(search.toLowerCase())
      );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'לא ידוע';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'לא ידוע';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isSimulator = (phone: string) =>
    phone === 'Simulated' || phone === 'simulator' || phone.toLowerCase() === 'simulated';

  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer" onClick={onBack} />
        </div>
        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
          )}
          {/* User Avatar - dropdown menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(v => !v)}
              title="תפריט פרופיל"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm hover:scale-110 transition-transform shadow-md select-none"
            >
              {firstName}
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-12 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 min-w-[180px] overflow-hidden" dir="rtl">
                {onOpenContacts && (
                  <button
                    onClick={() => { setProfileMenuOpen(false); onOpenContacts(); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Users size={16} className="text-blue-500 flex-shrink-0" />
                    אנשי קשר
                  </button>
                )}
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <List size={16} className="text-indigo-500 flex-shrink-0" />
                  שיחות שלי
                </button>
              </div>
            )}
          </div>
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                <List size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">שיחות</h1>
                <p className="text-slate-400 text-sm font-semibold mt-0.5">
                  {total} שיחות{showAll ? ' (כלל המשתמשים)' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              className="w-full pr-14 pl-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all text-right font-medium"
              placeholder={showAll ? 'חיפוש לפי טלפון, שם בוט או משתמש...' : 'חיפוש לפי טלפון או שם בוט...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sessions list */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-300">
              <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
              <MessageSquare size={64} strokeWidth={1} />
              <p className="text-xl font-bold">
                {sessions.length === 0 ? 'עדיין אין שיחות.' : 'לא נמצאו תוצאות'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredSessions.map(session => {
                const sim = isSimulator(session.phone);
                const isExpanded = expandedId === session.id;
                const hasParams = Object.keys(session.parameters || {}).length > 0;

                return (
                  <div
                    key={session.id}
                    className="bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md hover:border-sky-100 transition-all overflow-hidden"
                  >
                    {/* Main row */}
                    <div className="p-6 flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${sim ? 'bg-blue-50 text-blue-400' : 'bg-sky-50 text-sky-500'}`}>
                        {sim ? <MessageSquare size={20} /> : <Phone size={20} />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-black text-slate-900 truncate">
                            {sim ? 'סימולטור' : session.phone}
                          </p>
                          {sim && (
                            <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold">
                              בדיקות
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 font-semibold flex-wrap">
                          <span className="flex items-center gap-1">
                            <Bot size={12} className="text-sky-400" />
                            {session.bot_name}
                          </span>
                          {showAll && session.user_name && (
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-slate-400" />
                              {session.user_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Expand button */}
                      {hasParams && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : session.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          פרמטרים
                        </button>
                      )}
                    </div>

                    {/* Expanded parameters */}
                    {isExpanded && hasParams && (
                      <div className="border-t border-slate-100 px-6 pb-5 pt-4 bg-slate-50">
                        <p className="text-xs font-black text-slate-500 mb-3 uppercase tracking-widest">פרמטרי שיחה</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(session.parameters).map(([key, val]) => (
                            <div key={key} className="bg-white border border-slate-200 rounded-xl p-3">
                              <p className="text-xs text-slate-400 font-bold mb-1">{key}</p>
                              <p className="text-sm font-black text-slate-800 break-all">{String(val)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination (admin only) */}
          {showAll && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => fetchSessions(page - 1, search)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                הקודם
              </button>
              <span className="text-sm font-bold text-slate-500">
                עמוד {page} מתוך {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchSessions(page + 1, search)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                הבא
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionsPage;
