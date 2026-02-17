import React, { useState, useEffect } from 'react';
import { 
  Users, UserCog, LogOut, ArrowLeft, AlertCircle, Shield, Activity, 
  Search, Trash2, Edit2, Ban, CheckCircle, BarChart2, Settings, 
  FileText, Save, Plus, Eye, EyeOff, Bot, ChevronRight, LayoutDashboard,
  CreditCard, MoreVertical, X
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'templates' | 'settings'>('dashboard');
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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    fetchStats();
    if (activeTab === 'users') fetchAllUsers();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') fetchSystemConfig();
  }, [activeTab]);

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
      setSystemConfig(data);
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
    if (filterType === 'premium') return matchesSearch && user.account_type === 'Premium';
    if (filterType === 'inactive') return matchesSearch && user.status !== 'active';
    
    return matchesSearch;
  });

  // Render Component
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');
        
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
          background: linear-gradient(90deg, #EEF2FF 0%, #F5F3FF 100%);
          color: #4F46E5;
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
          background-color: #4F46E5;
        }
      `}</style>
      
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-white flex flex-col z-30 border-l border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-10">
           <div className="flex items-center gap-4">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto" />
        </div>
          </div>
          
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'סקירה כללית', icon: LayoutDashboard },
              { id: 'users', label: 'ניהול משתמשים', icon: Users },
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
                <item.icon size={20} className={`transition-colors flex-shrink-0 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="tracking-tight">{item.label}</span>
                {activeTab === item.id && <ChevronRight size={16} className="mr-auto opacity-50 text-indigo-400" />}
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
              {activeTab === 'templates' && 'ניהול תבניות'}
              {activeTab === 'settings' && 'הגדרות מערכת'}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {activeTab === 'dashboard' && 'סקירה מקיפה על נתוני וביצועי המערכת'}
              {activeTab === 'users' && 'צפייה, עריכה וניהול הרשאות משתמשים מתקדם'}
              {activeTab === 'templates' && 'ניהול ותחזוקת מאגר התבניות הגלובלי'}
              {activeTab === 'settings' && 'הגדרת מגבלות, מחירים ופרמטרים למערכת'}
            </p>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 bg-white pl-5 pr-2 py-2 rounded-full shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow cursor-default">
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700 leading-tight">{currentUser?.name}</div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Super Admin</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white">
                  {currentUser?.name?.charAt(0) || 'A'}
                </div>
             </div>
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

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-10 animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'סה"כ משתמשים', value: stats.totalUsers, icon: Users, color: 'blue', bg: 'bg-blue-500' },
                  { label: 'בוטים פעילים', value: stats.totalBots, icon: Activity, color: 'indigo', bg: 'bg-indigo-500' },
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
              
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex md:flex-row flex-col">
                <div className="flex-1 p-10 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold w-fit mb-6">
                     <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                     עדכוני מערכת
                  </div>
                  <h3 className="text-4xl font-black text-slate-800 mb-6 leading-tight">ברוכים הבאים <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">למרכז השליטה החדש</span></h3>
                  <p className="text-slate-500 text-lg mb-10 leading-relaxed max-w-xl">
                    כאן תוכלו לנהל את כל האספקטים של המערכת בצורה ויזואלית ונוחה. 
                    הדשבורד החדש מאפשר גישה מהירה לנתונים קריטיים ופעולות ניהול נפוצות.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setActiveTab('users')}
                      className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2 group"
                    >
                      ניהול משתמשים <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setActiveTab('templates')}
                      className="bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-all inline-flex items-center gap-2"
                    >
                      ספריית תבניות
                    </button>
                  </div>
                </div>
                <div className="md:w-1/3 bg-gradient-to-br from-indigo-600 to-violet-700 relative overflow-hidden flex items-center justify-center p-12">
                   <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
                   <div className="relative text-center text-white z-10">
                      <Shield size={80} className="mx-auto mb-6 opacity-90" strokeWidth={1.5} />
                      <h4 className="text-2xl font-bold mb-2">BotWa Admin v2.0</h4>
                      <p className="text-indigo-200">מערכת יציבה ומאובטחת</p>
                   </div>
                   {/* Abstract Circles */}
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                   <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400 opacity-20 rounded-full blur-3xl"></div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="grid grid-cols-12 gap-8 h-[calc(100vh-180px)] animate-fade-in-up">
              {/* Users List */}
              <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 space-y-5 bg-white z-10">
                  <div className="relative group">
                    <Search className="absolute right-4 top-4 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="חיפוש משתמשים..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl group-focus-within:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl overflow-x-auto no-scrollbar scroll-smooth">
                    {[
                      { id: 'all', label: 'כל המשתמשים' },
                      { id: 'admin', label: 'מנהלים' },
                      { id: 'premium', label: 'פרימיום' },
                      { id: 'inactive', label: 'חסומים' }
                    ].map(f => (
                      <button 
                        key={f.id}
                        onClick={() => setFilterType(f.id)} 
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 ${filterType === f.id ? 'bg-white text-indigo-700 shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                  {filteredUsers.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Search size={28} className="opacity-40" /></div>
                        <p className="font-medium">לא נמצאו משתמשים תואמים</p>
                        <button onClick={() => {setSearchQuery(''); setFilterType('all');}} className="text-sm text-indigo-600 font-bold mt-2 hover:underline">נקה סינון</button>
                     </div>
                  ) : (
                    filteredUsers.map(user => (
                      <div 
                        key={user.id}
                        onClick={() => fetchUserDetails(user.id)}
                        className={`group p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden ${
                          selectedUser?.id === user.id 
                            ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100/50 scale-[1.02] z-10 ring-1 ring-indigo-500/10' 
                            : 'bg-white border-transparent hover:border-slate-300 hover:shadow-md hover:scale-[1.01]'
                        }`}
                      >
                       {selectedUser?.id === user.id && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3.5">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${selectedUser?.id === user.id ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>
                                {user.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className={`font-bold text-sm leading-tight mb-0.5 ${selectedUser?.id === user.id ? 'text-indigo-900' : 'text-slate-800'}`}>{user.name}</h3>
                                <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                             </div>
                          </div>
                          {user.role === 'admin' && <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600" title="מנהל"><Shield size={14} fill="currentColor" className="opacity-20" /> </div>}
                        </div>
                        <div className="flex items-center justify-between mt-3 pl-2">
                          <div className="flex gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {user.status === 'active' ? 'פעיל' : 'חסום'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${user.account_type === 'Premium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                {user.account_type}
                            </span>
                          </div>
                          <ChevronRight size={14} className={`transition-transform duration-300 ${selectedUser?.id === user.id ? 'text-indigo-500 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* User Details Panel */}
              <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 flex flex-col relative transition-all h-full">
                {selectedUser ? (
                  <div className="flex flex-col animate-fade-in overflow-y-auto h-full rounded-3xl">
                    {/* Header Image Background */}
                    <div className="h-40 from-slate-800 to-slate-900 w-full relative shrink-0">
                        <div className="absolute inset-0 opacity-20"></div>
                        <div className="absolute -right-10 -top-20 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
                        <div className="absolute -left-10 bottom-0 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-8 pb-8 relative">
                        {/* Profile Header (Floating) */}
                        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center -mt-12 mb-8 relative z-10">
                            <div className="flex items-end gap-5">
                                <div className="w-24 h-24 bg-white rounded-3xl p-1.5 shadow-lg">
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-white rounded-2xl flex items-center justify-center text-4xl font-black text-indigo-900">
                                        {selectedUser.name.charAt(0)}
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none">{selectedUser.name}</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{selectedUser.public_id}</span>
                                        <span className="text-xs font-bold text-slate-400">•</span>
                                        <span className="text-xs font-bold text-slate-500">הצטרף ב-{new Date(selectedUser.createdAt).toLocaleDateString('he-IL')}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-4 sm:mt-0">
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
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-indigo-200 active:scale-95 flex items-center gap-2"
                                        >
                                            <UserCog size={18} /> כניסה כמשתמש
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
                                        <button onClick={handleUpdateUser} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"><CheckCircle size={18} /> שמירה</button>
                                        <button onClick={() => setIsEditing(false)} className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50">ביטול</button>
                                    </>
                                )}
                                <button onClick={() => handleDeleteUser(selectedUser.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2.5 rounded-xl transition-colors border border-rose-100" title="מחק משתמש"><Trash2 size={20} /></button>
                            </div>
                        </div>

                      {/* Info Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Box 1 */}
                        <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <Users size={14} className="text-slate-400" /> פרטים אישיים
                            </h3>
                            <div className="space-y-4">
                                {[{l:'שם מלא', k:'name'}, {l:'אימייל', k:'email'}, {l:'טלפון', k:'phone'}].map(f => (
                                    <div key={f.k}>
                                        <label className="block text-xs font-bold text-slate-400 mb-1.5">{f.l}</label>
                                        {isEditing ? (
                                            <input 
                                                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium outline-none" 
                                                value={(editForm[f.k as keyof Pick<User, 'name' | 'email' | 'phone'>] as string) || ''} 
                                                onChange={e => setEditForm(prev => ({...prev, [f.k]: e.target.value}))} 
                                            />
                                        ) : ( 
                                            <div className="text-slate-800 font-bold text-sm break-all">
                                                {(selectedUser[f.k as keyof Pick<User, 'name' | 'email' | 'phone'>] as string) || '-'}
                                            </div> 
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Box 2 */}
                        <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <Shield size={14} className="text-slate-400" /> הגדרות ואבטחה
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5">סטטוס</label>
                                    {isEditing ? (
                                        <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none" value={editForm.status || 'active'} onChange={e => setEditForm(prev => ({...prev, status: e.target.value}))}>
                                            <option value="active">פעיל</option>
                                            <option value="inactive">חסום</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-black ${selectedUser.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {selectedUser.status === 'active' ? 'חשבון פעיל' : 'חשבון חסום'}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5">תוכנית מנוי</label>
                                    {isEditing ? (
                                        <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none" value={editForm.account_type || 'Basic'} onChange={e => setEditForm(prev => ({...prev, account_type: e.target.value}))}>
                                            <option value="Basic">Basic (בסיסי)</option>
                                            <option value="Premium">Premium (מתקדם)</option>
                                        </select>
                                    ) : (
                                        <div className="text-slate-800 font-bold text-sm">{selectedUser.account_type}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                      </div>

                      {/* Stats & Limits */}
                      <div className="space-y-6">
                         <h3 className="text-sm font-black text-slate-800 mb-4 px-1">שימוש ומגבלות</h3>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                                <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wide">בוטים</div>
                                <div className="text-3xl font-black text-indigo-700">{selectedUser.stats?.bots || 0}</div>
                            </div>
                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                                <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wide">זרימות</div>
                                <div className="text-3xl font-black text-indigo-700">{selectedUser.stats?.flows || 0}</div>
                            </div>
                         </div>

                         {/* Custom Limits */}
                         {(isEditing || selectedUser.custom_limits) && (
                            <div className={`p-6 rounded-2xl border transition-all duration-300 ${isEditing ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                               <div className="flex items-center gap-2 mb-3">
                                  <Settings size={18} className="text-amber-600" />
                                  <h3 className="text-sm font-black text-amber-900">הגדרות מכסה אישיות (Override)</h3>
                               </div>
                               <p className="text-xs font-medium text-amber-700/70 mb-6 max-w-2xl leading-relaxed">
                                  ערכים אלו גוברים על הגדרות ברירת המחדל. שדות ריקים = רגיל.
                               </p>
                               
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {[
                                    { k: 'max_bots', label: 'Max Bots', ph: 3 },
                                    { k: 'max_versions', label: 'Max Vers', ph: 5 },
                                    { k: 'version_price', label: 'Ver Price (₪)', ph: 5 },
                                    { k: 'bot_price', label: 'Bot Price (₪)', ph: 30 },
                                  ].map(field => (
                                    <div key={field.k}>
                                      <label className="block text-[10px] font-black uppercase text-amber-800/60 mb-1.5 tracking-wider">{field.label}</label>
                                      {isEditing ? (
                                        <input 
                                          type="number"
                                          className="w-full p-2.5 border border-amber-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-bold outline-none shadow-sm"
                                          placeholder={String(field.ph)}
                                          value={editForm.custom_limits?.[field.k as keyof typeof editForm.custom_limits] ?? ''}
                                          onChange={e => setEditForm(prev => ({
                                            ...prev, 
                                            custom_limits: { ...prev.custom_limits, [field.k]: e.target.value } 
                                          } as any))}
                                        />
                                      ) : (
                                        <div className="font-bold text-lg bg-white/60 p-2.5 rounded-lg border border-amber-100 text-amber-900">
                                          {selectedUser.custom_limits?.[field.k as keyof typeof editForm.custom_limits] !== undefined 
                                            ? selectedUser.custom_limits?.[field.k as keyof typeof editForm.custom_limits] ?? <span className="text-xs opacity-50 font-normal">Auto</span> 
                                            : <span className="text-xs opacity-50 font-normal">Auto</span>}
                                        </div>
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
            <div className="space-y-8 animate-fade-in-up">
              <div className="relative bg-indigo-900 rounded-[2rem] p-10 shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 py-12">
                 {/* Background decoration */}
                 <div className="absolute top-0 right-0 w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-violet-900 to-transparent"></div>
                 <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-600 rounded-full blur-[80px] opacity-40"></div>

                 <div className="relative z-10 text-white max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-800/50 border border-indigo-700 text-indigo-200 text-xs font-bold mb-4">
                       <FileText size={12} /> ספריית תבניות
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">ניהול תבניות מערכת</h2>
                    <p className="text-indigo-100/80 text-lg leading-relaxed font-medium">
                      צור תבניות התחלה חכמות כדי לעזור למשתמשים שלך לבנות בוטים במהירות. תבניות ציבוריות חשופות לכלל הלקוחות.
                    </p>
                 </div>
                 <button 
                   onClick={onCreateTemplate}
                   className="relative z-10 bg-white text-indigo-900 px-8 py-4 rounded-2xl hover:bg-indigo-50 font-black shadow-lg shadow-indigo-900/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 group"
                 >
                   <div className="bg-indigo-100 p-1.5 rounded-full group-hover:bg-indigo-200 transition-colors"><Plus size={18} /></div>
                   <span>צור תבנית חדשה</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {templates.map(tpl => (
                  <div key={tpl._id} className="group bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.05)] hover:border-slate-200 transition-all duration-300 flex flex-col hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-indigo-200">
                        <FileText size={28} strokeWidth={1.5} />
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                         {/* Action Buttons */}
                         <button onClick={() => toggleTemplateVisibility(tpl)} className={`p-2.5 rounded-xl transition-colors ${tpl.isPublic ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title="שנה נראות">
                            {tpl.isPublic ? <Eye size={18} /> : <EyeOff size={18} />}
                         </button>
                         <button onClick={() => onEditTemplate(tpl._id)} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors" title="ערוך">
                            <Edit2 size={18} />
                         </button>
                         <button onClick={() => deleteTemplate(tpl._id)} className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors" title="מחק">
                            <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="mb-auto">
                      <div className="flex items-center gap-3 mb-2">
                         <h3 className="font-black text-xl text-slate-800">{tpl.name}</h3>
                         {!tpl.isPublic && <span className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-slate-200">טיוטה</span>}
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-4 font-medium">
                        {tpl.description || 'ללא תיאור'}
                      </p>
                    </div>

                    <div className="border-t border-slate-50 pt-5 mt-4 flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                      <span className="bg-slate-50 px-2.5 py-1 rounded-md text-slate-500">{new Date(tpl.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono text-[10px] opacity-70">ID: {tpl.template_id}</span>
                    </div>
                  </div>
                ))}

                {templates.length === 0 && (
                  <div className="col-span-full py-24 text-center text-slate-300 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-6">
                      <FileText size={64} className="opacity-30 text-slate-400" strokeWidth={1} />
                    </div>
                    <h3 className="text-xl font-black text-slate-600 mb-1">הספרייה ריקה כרגע</h3>
                    <p className="text-sm max-w-xs mx-auto mb-6 text-slate-400 font-medium">יצירת תבניות עוזרת למשתמשים שלך להבין את הערך של המערכת מהר יותר.</p>
                    <button onClick={onCreateTemplate} className="text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-2 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
                      <Plus size={16} /> צור תבנית ראשונה
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && systemConfig && (
            <div className="space-y-10 animate-fade-in-up max-w-6xl mx-auto">
               <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-20">
                 <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight">הגדרות ליבה ומחירים</h2>
                   <p className="text-slate-500 mt-2 font-medium">
                     שינויים גלובליים ישפיעו על כל המשתמשים (למעט חריגים).
                   </p>
                 </div>
                 <button 
                   onClick={updateSystemConfig}
                   className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 duration-200"
                 >
                   <Save size={20} />
                   שמור הגדרות
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {['Basic', 'Premium'].map(plan => (
                   <div key={plan} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                     {/* Header */}
                     <div className={`p-10 border-b border-slate-100 relative overflow-hidden ${plan === 'Premium' ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white' : 'bg-slate-50 text-slate-800'}`}>
                        {plan === 'Premium' && (
                            <div className="absolute top-0 right-0 w-full h-full opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                        )}
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider mb-4 shadow-sm ${plan === 'Premium' ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-white text-slate-600 border border-slate-200'}`}>
                          {plan.toUpperCase()}
                        </span>
                        <h3 className="text-4xl font-black mb-2">{plan === 'Basic' ? 'בסיסי' : 'פרימיום'}</h3>
                        <p className={`text-sm font-medium opacity-80 ${plan === 'Premium' ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {plan === 'Basic' ? 'הגדרות ברירת מחדל למשתמשים החדשים' : 'הגדרות למשתמשים משדרגים בתוכנית מלאה'}
                        </p>
                     </div>
                     
                     <div className="p-10 space-y-10">
                       <div className="space-y-6">
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Bot size={16} /> מגבלות ומשאבים
                         </h4>
                         <div className="grid grid-cols-2 gap-6">
                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-2">מקסימום בוטים</label>
                             <input 
                                type="number" 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-center focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-slate-800"
                                value={systemConfig[plan]?.maxBots || 0}
                                onChange={e => handleConfigChange(plan, 'maxBots', e.target.value)}
                              />
                           </div>
                           <div>
                             <label className="block text-xs font-bold text-slate-500 mb-2">גרסאות לבוט</label>
                             <input 
                                type="number" 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-center focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-slate-800"
                                value={systemConfig[plan]?.maxVersions || 0}
                                onChange={e => handleConfigChange(plan, 'maxVersions', e.target.value)}
                              />
                           </div>
                         </div>
                       </div>

                       <div className="space-y-6">
                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                            <CreditCard size={16} /> תמחור הרחבות (בש"ח)
                         </h4>
                         <div className="space-y-4">
                           <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                             <label className="text-sm font-bold text-slate-600">מחיר לבוט נוסף</label>
                             <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-bold">₪</span>
                                <input 
                                  type="number" 
                                  className="w-24 p-2 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                                  value={systemConfig[plan]?.botPrice || 0}
                                  onChange={e => handleConfigChange(plan, 'botPrice', e.target.value)}
                                />
                             </div>
                           </div>
                           <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                             <label className="text-sm font-bold text-slate-600">מחיר לגרסה נוספת</label>
                             <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-bold">₪</span>
                                <input 
                                  type="number" 
                                  className="w-24 p-2 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                                  value={systemConfig[plan]?.versionPrice || 0}
                                  onChange={e => handleConfigChange(plan, 'versionPrice', e.target.value)}
                                />
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
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
