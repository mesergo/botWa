import React, { useState, useEffect, useRef } from 'react';
import { Phone, Clock, MessageSquare, Search, Bot, Users, LogOut, List } from 'lucide-react';

interface Contact {
  phone: string;
  sessionCount: number;
  lastSeen: string | null;
  bots: { id: string; name: string }[];
}

interface ContactsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenSessions?: () => void;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const ContactsPage: React.FC<ContactsPageProps> = ({ token, currentUser, onBack, onLogout, onOpenSessions }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    const fetchContacts = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/sessions/contacts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setContacts(data);
        }
      } catch (e) {
        console.error('Failed to load contacts', e);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [token]);

  const filteredContacts = contacts.filter(c =>
    c.phone.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'לא ידוע';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'לא ידוע';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  const isSimulator = (phone: string) =>
    phone === 'Simulated' || phone === 'simulator' || phone.toLowerCase() === 'simulated';

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
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <Users size={16} className="text-blue-500 flex-shrink-0" />
                  אנשי קשר
                </button>
                {onOpenSessions && (
                  <button
                    onClick={() => { setProfileMenuOpen(false); onOpenSessions(); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <List size={16} className="text-indigo-500 flex-shrink-0" />
                    שיחות שלי
                  </button>
                )}
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
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">אנשי קשר</h1>
                <p className="text-slate-400 text-sm font-semibold mt-0.5">
                  {contacts.length} איש קשר
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              className="w-full pr-14 pl-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-right font-medium"
              placeholder="חיפוש לפי מספר טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Contacts list */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-300">
              <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-24 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
              <Users size={64} strokeWidth={1} />
              <p className="text-xl font-bold">
                {contacts.length === 0 ? 'עדיין אין אנשי קשר. התחל שיחה בסימולטור!' : 'לא נמצאו תוצאות'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredContacts.map(contact => {
                const sim = isSimulator(contact.phone);
                return (
                  <div
                    key={contact.phone}
                    className="bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-4 flex-row-reverse">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${sim ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                        {sim ? <MessageSquare size={22} /> : <Phone size={22} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-slate-900 truncate">
                          {sim ? 'סימולטור' : contact.phone}
                        </p>
                        {sim && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                            בדיקות
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-slate-500 font-semibold flex-row-reverse">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-blue-400" />
                        {contact.sessionCount} שיחות
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" />
                        {formatDate(contact.lastSeen)}
                      </span>
                    </div>

                    {/* Bots used */}
                    {contact.bots.length > 0 && (
                      <div className="flex flex-wrap gap-2 flex-row-reverse">
                        {contact.bots.map(bot => (
                          <span
                            key={bot.id}
                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-600"
                          >
                            <Bot size={12} />
                            {bot.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;
