import React, { useState, useEffect } from 'react';
import { 
  Users, UserCog, LogOut, ArrowLeft, AlertCircle, Shield, Activity, 
  Search, Trash2, Edit2, Ban, CheckCircle, BarChart2, Settings, 
  FileText, Save, Plus, Eye, EyeOff, Bot, ChevronRight, LayoutDashboard,
  CreditCard, MoreVertical, X, Star, Globe, Lock, Copy, List, Phone, Clock,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, XCircle
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  public_id: string;
  account_type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    bots: number;
    flows: number;
  };
  custom_limits?: {
    max_bots: number | null;
    max_versions: number | null;
    version_price: number | null;
    bot_price: number | null;
  };
  limits_in_effect?: {
    maxBots: number;
    maxVersions: number;
    versionPrice: number;
    botPrice: number;
  };
}

interface Template {
  _id: string;
  template_id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  type: 'public' | 'public_paid' | 'admin';
  price?: number;
  createdAt: string;
}

interface SystemStats {
  totalUsers: number;
  totalBots: number;
  usersGrowth: {
    today: number;
    week: number;
    month: number;
  };
}

interface AdminPanelProps {
  token: string;
  currentUser: any;
  onBack: () => void;
  onImpersonate: (userData: any, impersonationToken: string) => void;
  onEditTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
}

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : `${window.location.origin}/api`;

const AdminPanel: React.FC<AdminPanelProps> = ({ token, currentUser, onBack, onImpersonate, onEditTemplate, onCreateTemplate }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'templates' | 'settings' | 'sessions'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New State for Templates & Settings
  const [templates, setTemplates] = useState<Template[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  // Forms state
  const [newTemplateData, setNewTemplateData] = useState({ name: '', description: '', botId: '' });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [availableBots, setAvailableBots] = useState<any[]>([]); // For "Create from Bot"

  // New: Create choice modal
  const [isCreateChoiceModalOpen, setIsCreateChoiceModalOpen] = useState(false);
  const [allSystemBots, setAllSystemBots] = useState<any[]>([]);
  const [createFromBotStep, setCreateFromBotStep] = useState<'choice' | 'pick-bot' | 'name'>('choice');
  const [selectedSystemBot, setSelectedSystemBot] = useState<any>(null);
  const [newAdminTplName, setNewAdminTplName] = useState('');
  const [newAdminTplDesc, setNewAdminTplDesc] = useState('');
  const [creatingAdminTpl, setCreatingAdminTpl] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsSearch, setSessionsSearch] = useState('');
  const [sessionsSearchInput, setSessionsSearchInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    fetchStats();
    if (activeTab === 'users') fetchAllUsers();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') fetchSystemConfig();
    if (activeTab === 'sessions') fetchAllSessions(1, sessionsSearch);
  }, [activeTab]);

  // Refetch when page changes
  useEffect(() => {
    if (activeTab === 'sessions') fetchAllSessions(sessionsPage, sessionsSearch);
  }, [sessionsPage]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const toggleSessionActive = async (sessionId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, is_active: data.is_active } : s
        ));
      }
    } catch (err) {
      console.error('Failed to toggle session active state', err);
    }
  };

  const fetchAllSessions = async (page = 1, search = '') => {
    try {
      setSessionsLoading(true);
      const params = new URLSearchParams({ page: String(page), search });
      const response = await fetch(`${API_BASE}/sessions/all-sessions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        setSessionsTotalPages(data.totalPages);
        setSessionsTotal(data.total);
        setSessionsPage(data.page);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setSelectedUser(data.user);
      setEditForm({});
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      // Clean up empty strings or nulls for limits
      const limits: any = editForm.custom_limits || {};
      const cleanLimits = {
        max_bots: limits.max_bots === '' ? null : limits.max_bots,
        max_versions: limits.max_versions === '' ? null : limits.max_versions,
        version_price: limits.version_price === '' ? null : limits.version_price,
        bot_price: limits.bot_price === '' ? null : limits.bot_price
      };

      const payload = {
        ...editForm,
        custom_limits: cleanLimits
      };

      const response = await fetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Update failed');
      
      const data = await response.json();
      setSelectedUser(data.user);
      setIsEditing(false);
      fetchAllUsers(); // Refresh list
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק משתמש זה לצמיתות? פעולה זו תמחק גם את כל הבוטים שלו!')) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      setSelectedUser(null);
      fetchAllUsers();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  /** New Methods for Tabs */

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
      
      try {
        const botRes = await fetch(`${API_BASE}/bots`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        if (botRes.ok) setAvailableBots(await botRes.json());
      } catch (e) { console.error('Error fetching bots for dropdown', e); }

    } catch (err) {
      console.error(err);
    }
  };

  const fetchSystemConfig = async () => {
    setLoadingConfig(true);
    try {
      const response = await fetch(`${API_BASE}/admin/settings/limits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      // Ensure Trial plan exists in config (merge defaults if missing)
      const defaultTrial = { maxBots: 1, maxVersions: 0, versionPrice: 0, botPrice: 0, canPublish: false, trialDays: 30 };
      setSystemConfig({ Trial: defaultTrial, ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const updateSystemConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/settings/limits`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ config: systemConfig })
      });
      if (!response.ok) throw new Error('Failed to update settings');
      alert('הגדרות עודכנו בהצלחה!');
    } catch (err) {
      alert('שגיאה בעדכון הגדרות');
    }
  };

  const createTemplateFromBot = async () => {
    if (!newTemplateData.botId) return;
    try {
      const response = await fetch(`${API_BASE}/templates/from-bot`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(newTemplateData)
      });
      if (!response.ok) throw new Error('Failed to create template');
      fetchTemplates();
      setIsTemplateModalOpen(false);
      setNewTemplateData({ name: '', description: '', botId: '' });
      alert('תבנית נוצרה בהצלחה!');
    } catch (err) {
      alert('שגיאה ביצירת תבנית');
    }
  };

  const fetchAllSystemBots = async () => {
    try {
      const res = await fetch(`${API_BASE}/templates/admin/all-bots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAllSystemBots(await res.json());
    } catch (e) { console.error(e); }
  };

  const createAdminTemplateFromBot = async () => {
    if (!selectedSystemBot || !newAdminTplName.trim()) return;
    setCreatingAdminTpl(true);
    try {
      const res = await fetch(`${API_BASE}/templates/from-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ botId: selectedSystemBot.id, name: newAdminTplName, description: newAdminTplDesc })
      });
      if (!res.ok) throw new Error('Failed');
      await fetchTemplates();
      setIsCreateChoiceModalOpen(false);
      setCreateFromBotStep('choice');
      setSelectedSystemBot(null);
      setNewAdminTplName('');
      setNewAdminTplDesc('');
      alert('תבנית מנהל נוצרה בהצלחה!');
    } catch (e) {
      alert('שגיאה ביצירת תבנית');
    } finally {
      setCreatingAdminTpl(false);
    }
  };
  
  const deleteTemplate = async (id: string) => {
    if (!window.confirm('האם למחוק תבנית זו?')) return;
    try {
      await fetch(`${API_BASE}/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const cycleTemplateType = async (template: any) => {
    const typeOrder: Array<'public' | 'public_paid' | 'admin'> = ['public', 'public_paid', 'admin'];
    const currentType = template.type || (template.isPublic ? 'public' : 'admin');
    const nextIndex = (typeOrder.indexOf(currentType) + 1) % typeOrder.length;
    const nextType = typeOrder[nextIndex];
    try {
        await fetch(`${API_BASE}/templates/${template._id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: nextType })
        });
        fetchTemplates();
    } catch (err) {
        console.error(err);
    }
  };

  const toggleTemplateVisibility = async (template: any) => {
    try {
        await fetch(`${API_BASE}/templates/${template._id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ isPublic: !template.isPublic })
        });
        fetchTemplates();
    } catch (err) {
        console.error(err);
    }
  };

  // Helper to update config state
  const handleConfigChange = (plan: string, field: string, value: string) => {
    setSystemConfig((prev: any) => ({
      ...prev,
      [plan]: {
        ...prev[plan],
        [field]: Number(value)
      }
    }));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery));
      
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'admin') return matchesSearch && user.role === 'admin';
    if (filterType === 'trial') return matchesSearch && user.account_type === 'Trial';
    if (filterType === 'premium') return matchesSearch && user.account_type === 'Premium';
    if (filterType === 'inactive') return matchesSearch && user.status !== 'active';
    
    return matchesSearch;
  });

  // Render Component
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-in { animation: slideInRight 0.4s ease-out forwards; }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        
        .sidebar-link-active {
          background: linear-gradient(90deg, #E0F2FE 0%, #F0F9FF 100%);
          color: #0284C7;
          position: relative;
        }
        .sidebar-link-active::before {
          content: '';
          position: absolute;
          right: 0;
          top: 0.5rem;
          bottom: 0.5rem;
          width: 4px;
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
          background-color: #0284C7;
        }
      `}</style>
      
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-white flex flex-col z-30 border-l border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-10">
           <div 
             className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
             onClick={onBack}
           >
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto" />
        </div>
          </div>
          
          <nav className="space-y-1.5">
            {[
                          { id: 'dashboard', label: 'סקירה כללית', icon: LayoutDashboard },
              { id: 'users', label: 'ניהול משתמשים', icon: Users },
              { id: 'sessions', label: 'סשנים', icon: List },
              { id: 'templates', label: 'מאגר תבניות', icon: FileText },
              { id: 'settings', label: 'הגדרות מערכת', icon: Settings },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group relative overflow-hidden ${
                  activeTab === item.id 
                    ? 'sidebar-link-active' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <item.icon size={20} className={`transition-colors flex-shrink-0 ${activeTab === item.id ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="tracking-tight">{item.label}</span>
                {activeTab === item.id && <ChevronRight size={16} className="mr-auto opacity-50 text-sky-400" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-50">
           <button 
             onClick={onBack}
             className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all duration-200 text-sm font-bold border border-slate-200 hover:border-slate-300"
           >
             <ArrowLeft size={18} />
             חזרה למערכת
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC]">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none z-0"></div>
        
        {/* Top Header */}
        <header className="h-24 px-10 flex items-center justify-between z-10 sticky top-0 bg-[#F8FAFC]/80 backdrop-blur-md">
          <div className="animate-slide-in">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && 'לוח בקרה'}
              {activeTab === 'users' && 'ניהול משתמשים'}
              {activeTab === 'sessions' && 'כל הסשנים'}
              {activeTab === 'templates' && 'ניהול תבניות'}
              {activeTab === 'settings' && 'הגדרות מערכת'}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {activeTab === 'dashboard' && 'סקירה מקיפה על נתוני וביצועי המערכת'}
              {activeTab === 'users' && 'צפייה, עריכה וניהול הרשאות משתמשים מתקדם'}
              {activeTab === 'sessions' && 'צפייה בכל הסשנים של כל המשתמשים במערכת'}
              {activeTab === 'templates' && 'ניהול ותחזוקת מאגר התבניות הגלובלי'}
              {activeTab === 'settings' && 'הגדרת מגבלות, מחירים ופרמטרים למערכת'}
            </p>
          </div>

        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto px-10 pb-10 pt-2 z-10">
          
          {error && (
            <div className="bg-red-50 border-r-4 border-red-500 p-4 mb-8 rounded-xl shadow-sm flex items-center gap-4 animate-fade-in group hover:bg-red-100/50 transition-colors">
              <div className="p-2 bg-red-100 rounded-full text-red-600 group-hover:bg-red-200 transition-colors"><AlertCircle className="w-5 h-5" /></div>
              <p className="text-red-700 font-bold">{error}</p>
              <button onClick={() => setError(null)} className="mr-auto p-2 hover:bg-red-200 rounded-full text-red-400 hover:text-red-700 transition-all"><X size={18} /></button>
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="space-y-4 animate-fade-in-up" dir="rtl">
              {/* Search bar with submit */}
              <form
                className="relative max-w-md mb-6 flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  setSessionsSearch(sessionsSearchInput);
                  fetchAllSessions(1, sessionsSearchInput);
                }}
              >
                <div className="relative flex-1">
                  <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    value={sessionsSearchInput}
                    onChange={e => setSessionsSearchInput(e.target.value)}
                    placeholder="חיפוש לפי טלפון, בוט או משתמש..."
                    className="w-full pr-10 pl-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
                    dir="rtl"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-3 bg-blue-50 text-blue-500 rounded-xl text-sm font-bold hover:bg-blue-100 hover:text-blue-600 transition-colors flex-shrink-0 border border-blue-100"
                >
                  חפש
                </button>
              </form>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-24 text-slate-400 font-bold">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent ml-3" />
                  טוען סשנים...
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-4">
                  <List size={64} strokeWidth={1} />
                  <p className="text-xl font-bold">לא נמצאו סשנים</p>
                </div>
              ) : (
                <>
                  {/* Counter */}
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    {sessionsTotal} סשנים · עמוד {sessionsPage} מתוך {sessionsTotalPages}
                  </p>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_140px_90px_40px] gap-4 px-5 py-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <span>טלפון</span><span>משתמש</span><span>בוט</span><span>תאריך</span><span>סטטוס</span><span></span>
                  </div>

                  {/* Rows */}
                  {sessions.map(session => {
                    const isExpanded = expandedSessionId === session.id;
                    const paramEntries = Object.entries(session.parameters || {}).filter(([, v]) => v !== null && v !== '' && v !== undefined);
                    const formatD = (d: string | null) => {
                      if (!d) return 'לא ידוע';
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return 'לא ידוע';
                      return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    };
                    return (
                      <div key={session.id} className={`border rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden ${session.is_active ? 'bg-white border-slate-100' : 'bg-slate-50/80 border-slate-200'}`}>
                        <div
                          className="grid grid-cols-[1fr_1fr_1fr_140px_90px_40px] gap-4 px-5 py-4 cursor-pointer items-center"
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-300 flex-shrink-0" />
                            <span className="font-bold text-slate-700 text-sm truncate" dir="ltr">{session.phone}</span>
                          </div>
                          <div className="text-sm font-bold text-indigo-600 truncate">{session.user_name || 'לא ידוע'}</div>
                          <div className="flex items-center gap-2">
                            <Bot size={13} className="text-blue-400 flex-shrink-0" />
                            <span className="text-sm font-bold text-slate-600 truncate">{session.bot_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={12} className="flex-shrink-0" />
                            <span className="text-xs font-bold">{formatD(session.created_at)}</span>
                          </div>
                          {/* Status toggle – stops row expand on click */}
                          <div className="flex items-center" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => toggleSessionActive(session.id, session.is_active)}
                              title={session.is_active ? 'לחץ להשבית' : 'לחץ להפעיל'}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                                session.is_active
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                              }`}
                            >
                              {session.is_active
                                ? <><ToggleRight size={14} /><span>פעיל</span></>
                                : <><ToggleLeft size={14} /><span>כבוי</span></>}
                            </button>
                          </div>
                          <div className="flex items-center justify-center text-slate-300">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-slate-50 px-5 py-4 bg-slate-50/50">
                            {paramEntries.length > 0 ? (
                              <>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">פרמטרים שנאספו</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {paramEntries.map(([key, value]) => (
                                    <div key={key} className="bg-white border border-slate-100 rounded-xl p-3">
                                      <p className="text-xs font-black text-slate-400 mb-1">{key}</p>
                                      <p className="text-sm font-bold text-slate-700 truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-slate-400 font-bold">אין פרמטרים שנאספו בסשן זה</p>
                            )}
                            {session.process_history?.length > 0 && (
                              <p className="text-xs font-bold text-slate-400 mt-3">שלבים שבוצעו: <span className="text-blue-500">{session.process_history.length}</span></p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Pagination */}
                  {sessionsTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 pt-4">
                      <button
                        onClick={() => { setSessionsPage(p => Math.max(1, p - 1)); }}
                        disabled={sessionsPage <= 1 || sessionsLoading}
                        className="px-2.5 py-1 text-slate-400 rounded-lg text-xs font-bold hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        ‹ הקודם
                      </button>

                      {Array.from({ length: sessionsTotalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === sessionsTotalPages || Math.abs(p - sessionsPage) <= 2)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === '...' ? (
                            <span key={`dot-${idx}`} className="px-1 text-slate-300 text-xs">…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => { setSessionsPage(item as number); }}
                              disabled={sessionsLoading}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                sessionsPage === item
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}

                      <button
                        onClick={() => { setSessionsPage(p => Math.min(sessionsTotalPages, p + 1)); }}
                        disabled={sessionsPage >= sessionsTotalPages || sessionsLoading}
                        className="px-2.5 py-1 text-slate-400 rounded-lg text-xs font-bold hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        הבא ›
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-10 animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'סה"כ משתמשים', value: stats.totalUsers, icon: Users, color: 'sky', bg: 'bg-sky-500' },
                  { label: 'בוטים פעילים', value: stats.totalBots, icon: Activity, color: 'blue', bg: 'bg-blue-500' },
                  { label: 'מצטרפים היום', value: stats.usersGrowth.today, icon: BarChart2, color: 'emerald', bg: 'bg-emerald-500' },
                  { label: 'מצטרפים החודש', value: stats.usersGrowth.month, icon: BarChart2, color: 'violet', bg: 'bg-violet-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 hover:shadow-lg hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-4 rounded-2xl bg-opacity-10 text-${stat.color}-600 ${stat.bg.replace('bg-', 'bg-')} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
                        <stat.icon size={26} className={`text-${stat.color}-600`} />
                      </div>
                    
                    </div>
                    <div>
                      <h3 className="text-4xl font-black text-slate-800 mb-1">{stat.value}</h3>
                      <p className="text-slate-400 text-sm font-bold">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[160px] flex md:flex-row flex-col items-center">
                <div className="flex-1 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">ברוכים הבאים למרכז השליטה</h3>
                    <p className="text-slate-500 text-sm max-w-xl">
                      כאן תוכלו לנהל את המערכת.
                    </p>
                  </div>
                  <div className="flex gap-3 mt-4 md:mt-0">
                    <button 
                      onClick={() => setActiveTab('users')}
                      className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2 group whitespace-nowrap"
                    >
                      ניהול משתמשים <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setActiveTab('templates')}
                      className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      ספריית תבניות
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)] animate-fade-in-up">
              {/* Users List */}
              <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 space-y-4 bg-white z-10">
                  <div className="relative group">
                    <Search className="absolute right-3.5 top-3 text-slate-400 w-4 h-4 group-focus-within:text-sky-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="חיפוש משתמשים..."
                      className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl group-focus-within:bg-white focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-medium text-slate-700 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-lg overflow-x-auto no-scrollbar scroll-smooth">
                    {[
                      { id: 'all', label: 'הכל' },
                      { id: 'admin', label: 'מנהלים' },
                      { id: 'trial', label: 'ניסיון' },
                      { id: 'premium', label: 'פרימיום' },
                      { id: 'inactive', label: 'חסומים' }
                    ].map(f => (
                      <button 
                        key={f.id}
                        onClick={() => setFilterType(f.id)} 
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all duration-200 ${filterType === f.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                  {filteredUsers.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3"><Search size={20} className="opacity-40" /></div>
                        <p className="font-medium text-sm">לא נמצאו משתמשים</p>
                        <button onClick={() => {setSearchQuery(''); setFilterType('all');}} className="text-xs text-sky-600 font-bold mt-1 hover:underline">נקה סינון</button>
                     </div>
                  ) : (
                    filteredUsers.map(user => (
                      <div 
                        key={user.id}
                        onClick={() => fetchUserDetails(user.id)}
                        className={`group p-3 rounded-xl cursor-pointer transition-all border relative overflow-hidden ${
                          selectedUser?.id === user.id 
                            ? 'bg-white border-sky-500 shadow-lg shadow-sky-100/50 z-10 ring-1 ring-sky-500/10' 
                            : 'bg-white border-transparent hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                       {selectedUser?.id === user.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500"></div>}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                             <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${selectedUser?.id === user.id ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                                {user.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className={`font-bold text-sm leading-tight mb-0.5 ${selectedUser?.id === user.id ? 'text-sky-900' : 'text-slate-800'}`}>{user.name}</h3>
                                <p className="text-[11px] text-slate-500 font-medium">{user.email}</p>
                             </div>
                          </div>
                          {user.role === 'admin' && <div className="bg-sky-50 p-1 rounded text-sky-600" title="מנהל"><Shield size={12} fill="currentColor" className="opacity-40" /> </div>}
                        </div>
                        <div className="flex items-center justify-between mt-2 pl-2">
                          <div className="flex gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {user.status === 'active' ? 'פעיל' : 'חסום'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              user.account_type === 'Premium' ? 'bg-amber-50 text-amber-600 border-amber-100'
                              : user.account_type === 'Trial' ? 'bg-orange-50 text-orange-600 border-orange-100'
                              : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                {user.account_type === 'Trial' ? 'ניסיוני' : user.account_type}
                            </span>
                          </div>
                          <ChevronRight size={14} className={`transition-transform duration-300 ${selectedUser?.id === user.id ? 'text-sky-500 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* User Details Panel */}
              <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative transition-all h-full overflow-hidden">
                {selectedUser ? (
                  <div className="flex flex-col h-full bg-slate-50/30 animate-fade-in">
                    {/* Header - Spacious & Clean */}
                    <div className="bg-white border-b border-slate-100 px-8 py-6 sticky top-0 z-20 flex justify-between items-center shadow-sm shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center text-3xl font-black text-sky-700 shrink-0 shadow-sm border border-sky-200">
                                {selectedUser.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 leading-tight mb-1">{selectedUser.name}</h2>
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                    <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-mono tracking-tight text-slate-600">{selectedUser.public_id}</span>
                                    <span className="text-slate-300">•</span>
                                    <span>הצטרף ב-{new Date(selectedUser.createdAt).toLocaleDateString('he-IL')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                           {!isEditing ? (
                                <>
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const response = await fetch(`${API_BASE}/admin/impersonate/${selectedUser.id}`, {
                                                    method: 'POST',
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                const data = await response.json();
                                                onImpersonate(data.user, data.token);
                                            } catch (e) { console.error(e); }
                                        }}
                                        className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-sky-100 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                                    >
                                        <UserCog size={18} /> כניסה למשתמש
                                    </button>
                                    <button 
                                        onClick={() => { setIsEditing(true); setEditForm(selectedUser); }}
                                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 hover:shadow-sm"
                                    >
                                        <Edit2 size={18} /> עריכה
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleUpdateUser} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-100 flex items-center gap-2 hover:-translate-y-0.5"><CheckCircle size={18} /> שמור שינויים</button>
                                    <button onClick={() => setIsEditing(false)} className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50">ביטול</button>
                                </>
                            )}
                            <button onClick={() => handleDeleteUser(selectedUser.id)} className="bg-white hover:bg-rose-50 text-rose-600 p-2.5 rounded-xl transition-colors border border-slate-200 hover:border-rose-200" title="מחק משתמש"><Trash2 size={20} /></button>
                        </div>
                    </div>

                    {/* Content - Spacious Grid Layout */}
                    <div className="flex-1 overflow-y-auto p-8 content-start h-full"> 
                      <div className="grid grid-cols-12 gap-6 auto-rows-min h-full">
                        
                        {/* Personal Details - Main Card */}
                        <div className="col-span-12 md:col-span-7 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                <Users size={16} className="text-slate-400" /> פרטים אישיים
                            </h3>
                            <div className="space-y-6">
                                {[{l:'שם מלא', k:'name'}, {l:'אימייל', k:'email'}, {l:'טלפון', k:'phone'}].map(f => (
                                    <div key={f.k} className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-400">{f.l}</label>
                                        {isEditing ? (
                                            <input 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all" 
                                                value={(editForm[f.k as keyof Pick<User, 'name' | 'email' | 'phone'>] as string) || ''} 
                                                onChange={e => setEditForm(prev => ({...prev, [f.k]: e.target.value}))} 
                                            />
                                        ) : ( 
                                            <div className="text-slate-800 font-medium text-lg truncate select-all px-2" title={(selectedUser[f.k as keyof Pick<User, 'name' | 'email' | 'phone'>] as string)}>
                                                {(selectedUser[f.k as keyof Pick<User, 'name' | 'email' | 'phone'>] as string) || '-'}
                                            </div> 
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Right Column Layout */}
                        <div className="col-span-12 md:col-span-5 space-y-6 flex flex-col h-full">
                             {/* Stats - Hero Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-sky-50 to-white p-6 rounded-2xl border border-sky-100 flex flex-col items-center justify-center text-center shadow-sm">
                                    <div className="text-xs font-bold text-sky-500 uppercase tracking-wide mb-2">בוטים פעילים</div>
                                    <div className="text-4xl font-black text-sky-700">{selectedUser.stats?.bots || 0}</div>
                                </div>
                                <div className="bg-gradient-to-br from-sky-50 to-white p-6 rounded-2xl border border-sky-100 flex flex-col items-center justify-center text-center shadow-sm">
                                    <div className="text-xs font-bold text-sky-500 uppercase tracking-wide mb-2">זרימות שיחה</div>
                                    <div className="text-4xl font-black text-sky-700">{selectedUser.stats?.flows || 0}</div>
                                </div>
                            </div>

                            {/* Settings & Security - Adjusted Card */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                    <Shield size={16} className="text-slate-400" /> הגדרות חשבון
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2">סטטוס משתמש</label>
                                        {isEditing ? (
                                            <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer" value={editForm.status || 'active'} onChange={e => setEditForm(prev => ({...prev, status: e.target.value}))}>
                                                <option value="active">פעיל</option>
                                                <option value="inactive">חסום</option>
                                            </select>
                                        ) : (
                                            <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold w-full border ${selectedUser.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                <div className={`w-2 h-2 rounded-full ${selectedUser.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                {selectedUser.status === 'active' ? 'חשבון פעיל' : 'חשבון חסום'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2">סוג מנוי</label>
                                        {isEditing ? (
                                            <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer" value={editForm.account_type || 'Basic'} onChange={e => setEditForm(prev => ({...prev, account_type: e.target.value}))}>
                                                <option value="Trial">Trial (ניסיוני)</option>
                                                <option value="Basic">Basic (בסיסי)</option>
                                                <option value="Premium">Premium (מתקדם)</option>
                                            </select>
                                        ) : (
                                            <div className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-slate-800 font-bold text-sm flex justify-between items-center">
                                                {selectedUser.account_type}
                                                <Star size={16} className="text-amber-400 fill-amber-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Custom Limits - Full Width */}
                        {(isEditing || selectedUser.custom_limits) && (
                            <div className={`col-span-12 p-8 rounded-3xl border transition-all ${isEditing ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                                 <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                                        <Settings size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-amber-900">הגדרות מכסה אישיות</h3>
                                        <p className="text-sm text-amber-800/60 font-medium">הגדרות אלו גוברות על הגדרות ברירת המחדל של המערכת</p>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                      {[
                                        { k: 'max_bots', label: 'Max Bots', ph: 3 },
                                        { k: 'max_versions', label: 'Max Versions', ph: 5 },
                                        { k: 'version_price', label: 'Version Cost', ph: 5 },
                                        { k: 'bot_price', label: 'Bot Cost', ph: 30 },
                                      ].map(field => (
                                        <div key={field.k} className="bg-white/60 rounded-2xl border border-amber-100/50 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all">
                                          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-wider">{field.label}</span>
                                          {isEditing ? (
                                            <input 
                                              type="number"
                                              className="w-full p-2 text-2xl border border-amber-200 rounded-xl bg-white font-black outline-none focus:ring-2 focus:ring-amber-300 transition-all text-center text-amber-800"
                                              placeholder={String(field.ph)}
                                              value={editForm.custom_limits?.[field.k as keyof typeof editForm.custom_limits] ?? ''}
                                              onChange={e => setEditForm(prev => ({
                                                ...prev, 
                                                custom_limits: { ...prev.custom_limits, [field.k]: e.target.value } 
                                              } as any))}
                                            />
                                          ) : (
                                            <span className="text-3xl font-black text-amber-800 tracking-tight">
                                                {selectedUser.custom_limits?.[field.k as keyof typeof editForm.custom_limits] ?? <span className="text-sm opacity-30 font-bold">AUTO</span>}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                 </div>
                            </div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/30">
                     <div className="w-32 h-32 bg-white rounded-full mb-6 flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 animate-pulse">
                        <UserCog size={48} className="text-slate-300" strokeWidth={1.5} />
                     </div>
                     <h3 className="text-xl font-black text-slate-700 mb-2">בחר משתמש לניהול</h3>
                     <p className="max-w-xs mx-auto text-sm text-slate-500 font-medium">לצפייה בפרטים, עריכת הגדרות וניהול הרשאות, יש לבחור משתמש מהרשימה.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === 'templates' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200">
                 <button 
                   onClick={() => { setIsCreateChoiceModalOpen(true); setCreateFromBotStep('choice'); fetchAllSystemBots(); }}
                   className="bg-sky-600 text-white px-5 py-2.5 rounded-lg border border-sky-700 hover:bg-sky-700 font-bold shadow-sm transition-all flex items-center gap-2"
                 >
                   <Plus size={18} />
                   <span>צור תבנית חדשה</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(tpl => {
                  const tplType = tpl.type || (tpl.isPublic ? 'public' : 'admin');
                  const typeConfig = {
                    public: { label: 'ציבורי', icon: Globe, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    public_paid: { label: 'בתשלום', icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    admin: { label: 'מנהל', icon: Shield, color: 'text-violet-600 bg-violet-50 border-violet-200' }
                  }[tplType] || { label: 'ציבורי', icon: Globe, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
                  const TypeIcon = typeConfig.icon;
                  return (
                  <div key={tpl._id} className="group bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all duration-200 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        <FileText size={20} />
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
                         {/* Cycle type button */}
                         <button onClick={() => cycleTemplateType(tpl)} className={`p-2 rounded-lg transition-colors border ${typeConfig.color}`} title="שנה סוג">
                            <TypeIcon size={14} />
                         </button>
                         <button onClick={() => onEditTemplate(tpl._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="ערוך">
                            <Edit2 size={16} />
                         </button>
                         <button onClick={() => deleteTemplate(tpl._id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="מחק">
                            <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="mb-auto">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                         <h3 className="font-bold text-base text-slate-800">{tpl.name}</h3>
                         <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeConfig.color}`}>
                           <TypeIcon size={10} />
                           {typeConfig.label}
                         </span>
                         {tplType === 'public_paid' && tpl.price && (
                           <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{tpl.price}₪</span>
                         )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
                        {tpl.description || 'ללא תיאור'}
                      </p>
                    </div>

                    <div className="border-t border-slate-50 pt-3 mt-2 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                      <span>{new Date(tpl.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono opacity-70">ID: {tpl.template_id}</span>
                    </div>
                  </div>
                  );
                })}

                {templates.length === 0 && (
                  <div className="col-span-full py-24 text-center text-slate-300 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-6">
                      <FileText size={64} className="opacity-30 text-slate-400" strokeWidth={1} />
                    </div>
                    <h3 className="text-xl font-black text-slate-600 mb-1">הספרייה ריקה כרגע</h3>
                    <p className="text-sm max-w-xs mx-auto mb-6 text-slate-400 font-medium">יצירת תבניות עוזרת למשתמשים שלך להבין את הערך של המערכת מהר יותר.</p>
                    <button onClick={() => { setIsCreateChoiceModalOpen(true); setCreateFromBotStep('choice'); fetchAllSystemBots(); }} className="text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
                      <Plus size={16} /> צור תבנית ראשונה
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && systemConfig && (
            <div className="space-y-6 animate-fade-in-up max-w-6xl mx-auto">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-20">
                 <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">הגדרות ומחירים</h2>
                   <p className="text-slate-500 mt-1 font-medium text-sm">
                     שינויים גלובליים ישפיעו על כל המשתמשים (למעט חריגים).
                   </p>
                 </div>
                 <button 
                   onClick={updateSystemConfig}
                   className="flex items-center gap-2 bg-sky-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 hover:-translate-y-1 active:scale-95 duration-200 text-sm"
                 >
                   <Save size={18} />
                   שמור הגדרות
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {(['Trial', 'Basic', 'Premium'] as const).map(plan => (
                   <div key={plan} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                     {/* Header */}
                     <div className={`p-6 border-b border-slate-100 relative overflow-hidden ${
                       plan === 'Premium' ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                       : plan === 'Trial' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                       : 'bg-slate-50 text-slate-800'}`}>
                        {(plan === 'Premium' || plan === 'Trial') && (
                            <div className="absolute top-0 right-0 w-full h-full opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                        )}
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mb-2 shadow-sm ${
                          plan === 'Premium' ? 'bg-white/20 text-white backdrop-blur-md'
                          : plan === 'Trial' ? 'bg-white/20 text-white backdrop-blur-md'
                          : 'bg-white text-slate-600 border border-slate-200'}`}>
                          {plan.toUpperCase()}
                        </span>
                        <h3 className="text-2xl font-black mb-1">{plan === 'Basic' ? 'בסיסי' : plan === 'Premium' ? 'פרימיום' : 'ניסיוני'}</h3>
                        <p className={`text-xs font-medium opacity-80 ${plan === 'Premium' ? 'text-sky-100' : plan === 'Trial' ? 'text-orange-100' : 'text-slate-500'}`}>
                            {plan === 'Basic' ? 'הגדרות ברירת מחדל למשתמשים החדשים' : plan === 'Premium' ? 'הגדרות למשתמשים משדרגים בתוכנית מלאה' : 'חשבון ניסיוני בתוקף 30 יום'}
                        </p>
                     </div>
                     
                     <div className="p-6 space-y-6">
                       <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Bot size={14} /> מגבלות ומשאבים
                         </h4>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-1">מקסימום בוטים</label>
                             <input 
                                type="number" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-center focus:ring-2 focus:ring-sky-200 focus:border-sky-500 outline-none transition-all text-slate-800"
                                value={systemConfig[plan]?.maxBots ?? 0}
                                onChange={e => handleConfigChange(plan, 'maxBots', e.target.value)}
                              />
                           </div>
                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-1">גרסאות לבוט</label>
                             <input 
                                type="number" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-center focus:ring-2 focus:ring-sky-200 focus:border-sky-500 outline-none transition-all text-slate-800"
                                value={systemConfig[plan]?.maxVersions ?? 0}
                                onChange={e => handleConfigChange(plan, 'maxVersions', e.target.value)}
                              />
                           </div>
                         </div>
                         {plan === 'Trial' && (
                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-1">תוקף ניסיון (בימים)</label>
                             <input 
                                type="number" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-center focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none transition-all text-slate-800"
                                value={systemConfig[plan]?.trialDays ?? 30}
                                onChange={e => handleConfigChange(plan, 'trialDays', e.target.value)}
                              />
                           </div>
                         )}
                       </div>

                       {plan !== 'Trial' && (
                       <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <CreditCard size={14} /> תמחור הרחבות (בש"ח)
                         </h4>
                         <div className="space-y-3">
                           <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                             <label className="text-xs font-bold text-slate-600">מחיר לבוט נוסף</label>
                             <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold text-xs">₪</span>
                                <input 
                                  type="number" 
                                  className="w-20 p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-center focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                  value={systemConfig[plan]?.botPrice ?? 0}
                                  onChange={e => handleConfigChange(plan, 'botPrice', e.target.value)}
                                />
                             </div>
                           </div>
                           <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                             <label className="text-xs font-bold text-slate-600">מחיר לגרסה נוספת</label>
                             <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold text-xs">₪</span>
                                <input 
                                  type="number" 
                                  className="w-20 p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-center focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                  value={systemConfig[plan]?.versionPrice ?? 0}
                                  onChange={e => handleConfigChange(plan, 'versionPrice', e.target.value)}
                                />
                             </div>
                           </div>
                         </div>
                       </div>
                       )}
                       {plan === 'Trial' && (
                         <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                           <p className="text-xs font-bold text-amber-700 text-right">חשבון ניסיוני: גישה לסימולטור בלבד, ללא פרסום וללא גרסאות. לאחר התוקף הבוט ייחסם.</p>
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {/* Modal: Create Template Choice */}
          {isCreateChoiceModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-fade-in-up border border-white/50">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">יצירת תבנית חדשה</h3>
                  <button onClick={() => { setIsCreateChoiceModalOpen(false); setCreateFromBotStep('choice'); setSelectedSystemBot(null); setNewAdminTplName(''); setNewAdminTplDesc(''); }} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>

                {createFromBotStep === 'choice' && (
                  <div className="space-y-4">
                    <p className="text-slate-500 text-sm mb-6">בחר כיצד ליצור את התבנית החדשה:</p>
                    <button
                      onClick={() => { setIsCreateChoiceModalOpen(false); onCreateTemplate(); }}
                      className="w-full flex items-center gap-5 p-5 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-400 rounded-2xl transition-all text-right group"
                    >
                      <div className="w-12 h-12 bg-white text-slate-400 group-hover:bg-sky-600 group-hover:text-white rounded-2xl flex items-center justify-center flex-shrink-0 transition-all border border-slate-200 shadow-sm">
                        <Plus size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 mb-1">תבנית ריקה</h4>
                        <p className="text-xs text-slate-500 font-medium">בנה תבנית חדשה מאפס בעורך הוויזואלי</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setCreateFromBotStep('pick-bot')}
                      className="w-full flex items-center gap-5 p-5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-400 rounded-2xl transition-all text-right group"
                    >
                      <div className="w-12 h-12 bg-white text-slate-400 group-hover:bg-violet-600 group-hover:text-white rounded-2xl flex items-center justify-center flex-shrink-0 transition-all border border-slate-200 shadow-sm">
                        <Copy size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 mb-1">מבוט קיים במערכת</h4>
                        <p className="text-xs text-slate-500 font-medium">בחר בוט ממאגר המערכת ויצור ממנו תבנית מנהל</p>
                      </div>
                    </button>
                  </div>
                )}

                {createFromBotStep === 'pick-bot' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => setCreateFromBotStep('choice')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={18} /></button>
                      <p className="text-slate-600 font-bold text-sm">בחר בוט מהמערכת</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {allSystemBots.length === 0 ? (
                        <p className="text-center text-slate-400 py-8 text-sm">אין בוטים במערכת</p>
                      ) : (
                        allSystemBots.map(bot => (
                          <div
                            key={bot.id}
                            onClick={() => { setSelectedSystemBot(bot); setNewAdminTplName(`תבנית מ-${bot.name}`); setCreateFromBotStep('name'); }}
                            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-xl cursor-pointer transition-all group"
                          >
                            <div className="w-10 h-10 bg-white text-slate-400 group-hover:bg-violet-600 group-hover:text-white rounded-xl flex items-center justify-center border border-slate-200 transition-all">
                              <Bot size={18} />
                            </div>
                            <div className="flex-1 text-right">
                              <p className="font-bold text-slate-800 text-sm">{bot.name}</p>
                              <p className="text-xs text-slate-400">ID: {bot.id.slice(-6)}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {createFromBotStep === 'name' && selectedSystemBot && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                      <button onClick={() => setCreateFromBotStep('pick-bot')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><ArrowLeft size={18} /></button>
                      <p className="text-slate-600 font-bold text-sm">פרטי התבנית</p>
                    </div>
                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3">
                      <Bot size={16} className="text-violet-600" />
                      <span className="text-sm font-bold text-violet-800">{selectedSystemBot.name}</span>
                      <span className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded">מנהל</span>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">שם התבנית</label>
                      <input
                        type="text"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-100 focus:border-violet-500 outline-none transition-all font-medium"
                        value={newAdminTplName}
                        onChange={e => setNewAdminTplName(e.target.value)}
                        placeholder="שם לתבנית..."
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">תיאור <span className="text-slate-400 font-normal">(רשות)</span></label>
                      <textarea
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-100 focus:border-violet-500 outline-none resize-none h-24 transition-all font-medium"
                        value={newAdminTplDesc}
                        onChange={e => setNewAdminTplDesc(e.target.value)}
                        placeholder="תיאור קצר..."
                      />
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={createAdminTemplateFromBot}
                        disabled={!newAdminTplName.trim() || creatingAdminTpl}
                        className="flex-1 bg-violet-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-violet-700 transition-all disabled:opacity-50 text-sm"
                      >
                        {creatingAdminTpl ? 'יוצר...' : 'צור תבנית מנהל'}
                      </button>
                      <button onClick={() => setIsCreateChoiceModalOpen(false)} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors text-sm">
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal: Create Template */}
          {isTemplateModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-fade-in-up border border-white/50">
                 <div className="flex justify-between items-center mb-8">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">יצירת תבנית חדשה</h3>
                    <button onClick={() => setIsTemplateModalOpen(false)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                 </div>
                 <div className="space-y-6">
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">שם התבנית</label>
                     <input 
                       type="text" 
                       className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                       value={newTemplateData.name}
                       onChange={e => setNewTemplateData({...newTemplateData, name: e.target.value})}
                       placeholder="לדוגמה: בוט שירות לקוחות..."
                       autoFocus
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">תיאור קצר</label>
                     <textarea 
                       className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none resize-none h-36 transition-all font-medium"
                       value={newTemplateData.description}
                       onChange={e => setNewTemplateData({...newTemplateData, description: e.target.value})}
                       placeholder="תאר את מטרת התבנית ולמי היא מתאימה..."
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">שכפל מבוט קיים <span className="text-slate-400 font-normal">(רשות)</span></label>
                     <div className="relative">
                        <select 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none appearance-none transition-all font-medium cursor-pointer"
                        value={newTemplateData.botId}
                        onChange={e => setNewTemplateData({...newTemplateData, botId: e.target.value})}
                        >
                        <option value="">-- התחל מתבנית ריקה --</option>
                        {availableBots.map((bot: any) => (
                            <option key={bot.id} value={bot.id}>{bot.name}</option>
                        ))}
                        </select>
                        <ChevronRight className="absolute left-4 top-5 text-slate-400 pointer-events-none rotate-90" size={18} />
                     </div>
                   </div>
                   <div className="flex gap-4 mt-10 pt-6 border-t border-slate-100">
                     <button 
                       onClick={createTemplateFromBot}
                       disabled={!newTemplateData.name}
                       className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none hover:-translate-y-1 active:scale-95 text-lg"
                     >
                       צור תבנית
                     </button>
                     <button 
                       onClick={() => setIsTemplateModalOpen(false)}
                       className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors text-lg"
                     >
                       ביטול
                     </button>
                   </div>
                 </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
export default AdminPanel;
