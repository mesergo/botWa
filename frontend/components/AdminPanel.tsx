import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, UserCog, LogOut, ArrowLeft, AlertCircle, AlertTriangle, Shield, Activity, 
  Search, Trash2, Edit2, Ban, CheckCircle, BarChart2, Settings, 
  FileText, Save, Plus, Eye, EyeOff, Bot, ChevronRight, LayoutDashboard,
  CreditCard, MoreVertical, X, Star, Globe, Lock, Copy, List, Phone, Clock,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, XCircle, MessageSquare,
  User as UserIcon, ExternalLink, Sliders, Image as ImageIcon, Layers,
  UserCheck, Headphones, UserMinus, RefreshCcw
} from 'lucide-react';
import UserTypesManager from './UserTypesManager';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: string;
  public_id: string;
  account_type: string;
  status: string;
  dialog360_bot_id?: string;
  manager_id?: string | null;
  user_type_id?: { _id: string; name: string; system_role: string } | null;
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
  showInChat?: boolean;
  createdAt: string;
  /** Parameters the admin has defined for this template */
  params?: Array<{ label: string; variableName: string }>;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'user-types' | 'templates' | 'settings' | 'sessions' | 'dialog360'>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New State for Templates & Settings
  const [templates, setTemplates] = useState<Template[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Global default config for the auto-removal-from-group feature
  interface RemovalConfigShape { enabled: boolean; keywords: string[]; message: string; }
  const [removalConfig, setRemovalConfig] = useState<RemovalConfigShape | null>(null);
  const [removalDefaults, setRemovalDefaults] = useState<RemovalConfigShape | null>(null);
  const [removalNewKeyword, setRemovalNewKeyword] = useState('');
  const [removalSaving, setRemovalSaving] = useState(false);
  const [removalSaved, setRemovalSaved] = useState(false);
  const [removalConfirmOpen, setRemovalConfirmOpen] = useState(false);
  
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

  // Template Params modal
  const [paramsModalTemplate, setParamsModalTemplate] = useState<Template | null>(null);
  const [editingParams, setEditingParams] = useState<Array<{ label: string; variableName: string }>>([]);
  const [savingParams, setSavingParams] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsSearch, setSessionsSearch] = useState('');
  const [sessionsSearchInput, setSessionsSearchInput] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [adminHistoryOpenId, setAdminHistoryOpenId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const adminHistoryScrollRef = useRef<HTMLDivElement>(null);
  const adminActiveSession = sessions.find(s => s.id === adminHistoryOpenId) ?? null;

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [showPassword, setShowPassword] = useState(false);
  
  // Dialog360 Templates
  const [dialog360Templates, setDialog360Templates] = useState<any[]>([]);
  const [dialog360Loading, setDialog360Loading] = useState(false);
  const [dialog360TemplateSettings, setDialog360TemplateSettings] = useState<Record<string, 'hidden' | 'manager' | 'agent'>>({});
  
  // Admin Sessions Message Input
  const [adminNewMessage, setAdminNewMessage] = useState('');
  const [showAdminTemplates, setShowAdminTemplates] = useState(false);
  const [adminTemplates, setAdminTemplates] = useState<any[]>([]);
  const [adminTemplatesLoading, setAdminTemplatesLoading] = useState(false);

  // Delete User confirmation modal
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Create User modal
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: '', email: '', phone: '', password: '', account_type: 'Trial', user_type_id: '' });
  const [createUserTypes, setCreateUserTypes] = useState<any[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    if (activeTab === 'users') fetchAllUsers();
    if (activeTab === 'templates') fetchTemplates();
    if (activeTab === 'settings') { fetchSystemConfig(); fetchRemovalConfig(); }
    if (activeTab === 'sessions') fetchAllSessions(1, sessionsSearch);
    if (activeTab === 'dialog360') fetchDialog360Templates();
    if (activeTab === 'users' || activeTab === 'user-types') fetchUserTypesForModal();
  }, [activeTab]);

  // Refetch when page changes
  useEffect(() => {
    if (activeTab === 'sessions') fetchAllSessions(sessionsPage, sessionsSearch);
  }, [sessionsPage]);

  // Debounced search: fire API call 400ms after user stops typing
  useEffect(() => {
    if (activeTab !== 'sessions') return;
    const timer = setTimeout(() => {
      setSessionsSearch(sessionsSearchInput);
      setSessionsPage(1);
      fetchAllSessions(1, sessionsSearchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [sessionsSearchInput]);

  // Scroll history panel to bottom when it opens/changes
  useEffect(() => {
    if (adminHistoryScrollRef.current) {
      adminHistoryScrollRef.current.scrollTop = adminHistoryScrollRef.current.scrollHeight;
    }
  }, [adminHistoryOpenId]);

  // Debug: Log when showAdminTemplates changes
  useEffect(() => {
    console.log('[Admin Templates] showAdminTemplates changed to:', showAdminTemplates);
    console.log('[Admin Templates] adminTemplates count:', adminTemplates.length);
    console.log('[Admin Templates] adminTemplatesLoading:', adminTemplatesLoading);
  }, [showAdminTemplates, adminTemplates, adminTemplatesLoading]);

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

  const fetchUserTypesForModal = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/user-types`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setCreateUserTypes(d.userTypes || []); }
    } catch {}
  };

  const handleCreateUser = async () => {
    setCreateUserError(null);
    if (!createUserForm.name.trim() || !createUserForm.email.trim()) {
      setCreateUserError('שם ואימייל נדרשים');
      return;
    }
    setCreatingUser(true);
    try {
      const r = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: createUserForm.name.trim(),
          email: createUserForm.email.trim(),
          phone: createUserForm.phone.trim(),
          password: createUserForm.password || null,
          account_type: createUserForm.account_type,
          user_type_id: createUserForm.user_type_id || null
        })
      });
      const d = await r.json();
      if (!r.ok) { setCreateUserError(d.error); return; }
      setShowCreateUserModal(false);
      setCreateUserForm({ name: '', email: '', phone: '', password: '', account_type: 'Trial', user_type_id: '' });
      fetchAllUsers();
    } catch (e: any) {
      setCreateUserError(e.message);
    } finally {
      setCreatingUser(false);
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
      setShowPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  };

  const fetchDialog360Templates = async () => {
    console.log('[Dialog360] Starting fetch...');
    try {
      setDialog360Loading(true);
      
      console.log('[Dialog360] Calling API:', `${API_BASE}/auth/templates`);
      console.log('[Dialog360] Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE}/auth/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('[Dialog360] Response status:', response.status);
      console.log('[Dialog360] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error' }));
        console.error('[Dialog360] Failed to fetch templates:', errorData);
        alert(`שגיאה בטעינת templates: ${errorData.error || 'Unknown error'}`);
        setDialog360Templates([]);
        return;
      }
      
      const data = await response.json();
      console.log('[Dialog360] Full response data:', data);
      console.log('[Dialog360] data.success:', data.success);
      console.log('[Dialog360] data.templates type:', typeof data.templates);
      console.log('[Dialog360] data.templates:', data.templates);
      
      if (data.success && data.templates) {
        // Handle different response structures from Dialog360
        // Response is { success: true, templates: { data: [...], useful: [...], byName: {...}, waba_templates: [...] } }
        let templateList = [];
        
        if (Array.isArray(data.templates)) {
          console.log('[Dialog360] templates is array, length:', data.templates.length);
          templateList = data.templates;
        } else if (data.templates.data && Array.isArray(data.templates.data)) {
          console.log('[Dialog360] templates.data is array, length:', data.templates.data.length);
          templateList = data.templates.data;
        } else if (data.templates.waba_templates && Array.isArray(data.templates.waba_templates)) {
          console.log('[Dialog360] templates.waba_templates is array, length:', data.templates.waba_templates.length);
          templateList = data.templates.waba_templates;
        } else {
          console.warn('[Dialog360] Could not find templates array in response');
          templateList = [];
        }
        
        console.log('[Dialog360] Final parsed templates:', templateList.length, 'templates');
        console.log('[Dialog360] First template:', templateList[0]);
        setDialog360Templates(templateList);
        
        // Fetch showInChat settings for these templates
        fetchDialog360TemplateSettings();
      } else {
        console.warn('[Dialog360] Response missing success or templates:', { success: data.success, hasTemplates: !!data.templates });
        setDialog360Templates([]);
      }
    } catch (err) {
      console.error('[Dialog360] Error fetching templates:', err);
      alert(`שגיאה: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setDialog360Templates([]);
    } finally {
      setDialog360Loading(false);
    }
  };

  const fetchDialog360TemplateSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/dialog360-templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const settingsList = data.success && Array.isArray(data.settings) ? data.settings : [];
        const settingsMap: Record<string, 'hidden' | 'manager' | 'agent'> = {};
        settingsList.forEach((s: any) => {
          settingsMap[s.templateName] = s.visibility || (s.showInChat === false ? 'hidden' : 'manager');
        });
        setDialog360TemplateSettings(settingsMap);
      }
    } catch (err) {
      console.error('Error fetching template settings:', err);
    }
  };

  const cycleDialog360Visibility = async (template: any) => {
    const templateName = template.name || template.elementName || template.template_name || '';
    const currentVis = dialog360TemplateSettings[templateName] ?? 'manager';
    const nextMap: Record<'hidden' | 'manager' | 'agent', 'hidden' | 'manager' | 'agent'> = {
      hidden: 'manager',
      manager: 'agent',
      agent: 'hidden',
    };
    const newVis = nextMap[currentVis];

    try {
      const response = await fetch(`${API_BASE}/dialog360-templates/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateName,
          templateId: template.id,
          language: template.language,
          category: template.category,
          status: template.status,
          visibility: newVis,
          showInChat: newVis !== 'hidden'
        })
      });

      if (response.ok) {
        setDialog360TemplateSettings(prev => ({
          ...prev,
          [templateName]: newVis
        }));
      } else {
        alert('שגיאה בעדכון הגדרות התבנית');
      }
    } catch (err) {
      console.error('Error updating template visibility:', err);
      alert('שגיאה בעדכון הגדרות התבנית');
    }
  };

  // Fetch templates for admin sessions chat input
  const fetchAdminTemplates = async () => {
    setAdminTemplatesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Admin Sessions] Failed to fetch templates:', errorData);
        setAdminTemplates([]);
        return;
      }
      
      const data = await response.json();
      console.log('[Admin Sessions] Templates response:', data);
      
      if (data.success && data.templates) {
        const templateList = Array.isArray(data.templates) ? data.templates : 
                           (data.templates.data ? data.templates.data : 
                           (data.templates.waba_templates ? data.templates.waba_templates : []));
        console.log('[Admin Sessions] Parsed templates:', templateList.length, 'templates');
        setAdminTemplates(templateList);
      } else {
        setAdminTemplates([]);
      }
    } catch (err) {
      console.error('[Admin Sessions] Error fetching templates:', err);
      setAdminTemplates([]);
    } finally {
      setAdminTemplatesLoading(false);
    }
  };

  // Handle template selection in admin sessions
  const handleAdminTemplateSelect = (template: any) => {
    const templateName = template.name || template.elementName || template.template_name || '';
    setAdminNewMessage(`/${templateName}`);
    setShowAdminTemplates(false);
  };

  // Send message from admin to session
  const sendAdminMessage = async () => {
    if (!adminNewMessage.trim() || !adminHistoryOpenId) return;
    
    try {
      console.log('[Admin] Sending message:', adminNewMessage, 'to session:', adminHistoryOpenId);
      
      const response = await fetch(`${API_BASE}/sessions/admin-send-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: adminHistoryOpenId,
          message: adminNewMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Admin] Failed to send message:', errorData);
        alert(`שגיאה בשליחת הודעה: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('[Admin] Message sent successfully:', data);

      // Clear input
      setAdminNewMessage('');
      setShowAdminTemplates(false);

      // Refresh the session to show the new message
      await fetchAllSessions(sessionsPage, sessionsSearch);

      // Scroll to bottom to show new message
      if (adminHistoryScrollRef.current) {
        setTimeout(() => {
          adminHistoryScrollRef.current?.scrollTo({
            top: adminHistoryScrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }

      // Show success message
      if (data.waSent) {
        console.log('[Admin] ✅ Message sent via WhatsApp');
      } else {
        console.warn('[Admin] ⚠️ Message saved but WhatsApp delivery failed:', data.waError);
        alert(`הודעה נשמרה אך השליחה לווטסאפ נכשלה: ${data.waError || 'Unknown error'}`);
      }

    } catch (err) {
      console.error('[Admin] Error sending message:', err);
      alert(`שגיאה: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
        custom_limits: cleanLimits,
        user_type_id: editForm.user_type_id ? editForm.user_type_id._id : null
      };

      console.log('[AdminPanel] Updating user with payload:', payload);
      console.log('[AdminPanel] dialog360_bot_id in payload:', payload.dialog360_bot_id);

      const response = await fetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[AdminPanel] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[AdminPanel] Update failed:', errorData);
        throw new Error(errorData.error || 'Update failed');
      }
      
      const data = await response.json();
      console.log('[AdminPanel] Server response data:', data);
      console.log('[AdminPanel] User from server:', data.user);
      console.log('[AdminPanel] dialog360_bot_id from server:', data.user?.dialog360_bot_id);
      
      setSelectedUser(data.user);
      setIsEditing(false);
      fetchAllUsers(); // Refresh list
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDeleteUser = (userId: string) => {
    setDeleteConfirmUserId(userId);
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmUserId) return;
    setIsDeletingUser(true);
    try {
      const response = await fetch(`${API_BASE}/admin/users/${deleteConfirmUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      setDeleteConfirmUserId(null);
      setSelectedUser(null);
      fetchAllUsers();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeletingUser(false);
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

  // ── Removal-from-group config (global default) ───────────────────────────
  const fetchRemovalConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings/removal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load removal config');
      const data = await res.json();
      setRemovalConfig({
        enabled: data.config?.enabled !== false,
        keywords: Array.isArray(data.config?.keywords) ? data.config.keywords : [],
        message: typeof data.config?.message === 'string' ? data.config.message : ''
      });
      setRemovalDefaults({
        enabled: data.defaults?.enabled !== false,
        keywords: Array.isArray(data.defaults?.keywords) ? data.defaults.keywords : [],
        message: typeof data.defaults?.message === 'string' ? data.defaults.message : ''
      });
    } catch (err) {
      console.error('[admin removal config]', err);
    }
  };

  const persistRemovalConfig = async () => {
    if (!removalConfig) return;
    setRemovalSaving(true);
    setRemovalSaved(false);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/removal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ config: removalConfig })
      });
      if (!res.ok) throw new Error('Failed to save removal config');
      const data = await res.json();
      if (data.config) {
        setRemovalConfig({
          enabled: data.config.enabled !== false,
          keywords: Array.isArray(data.config.keywords) ? data.config.keywords : [],
          message: typeof data.config.message === 'string' ? data.config.message : ''
        });
      }
      setRemovalSaved(true);
      setTimeout(() => setRemovalSaved(false), 2500);
    } catch (err) {
      alert('שגיאה בשמירת הגדרות ההסרה');
    } finally {
      setRemovalSaving(false);
      setRemovalConfirmOpen(false);
    }
  };

  const addRemovalKeyword = () => {
    const k = removalNewKeyword.trim();
    if (!k || !removalConfig) return;
    if (removalConfig.keywords.some(x => x.trim().toLowerCase() === k.toLowerCase())) {
      setRemovalNewKeyword('');
      return;
    }
    setRemovalConfig({ ...removalConfig, keywords: [...removalConfig.keywords, k] });
    setRemovalNewKeyword('');
  };

  const removeRemovalKeyword = (idx: number) => {
    if (!removalConfig) return;
    setRemovalConfig({ ...removalConfig, keywords: removalConfig.keywords.filter((_, i) => i !== idx) });
  };

  const resetRemovalConfigToDefaults = () => {
    if (!removalDefaults) return;
    if (!window.confirm('לאפס את כל מילות המפתח וההודעה לערכי ברירת המחדל של המערכת?')) return;
    setRemovalConfig({
      enabled: removalDefaults.enabled,
      keywords: [...removalDefaults.keywords],
      message: removalDefaults.message
    });
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

  const toggleShowInChat = async (template: any) => {
    try {
        await fetch(`${API_BASE}/templates/${template._id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ showInChat: !template.showInChat })
        });
        fetchTemplates();
    } catch (err) {
        console.error(err);
    }
  };

  /** Open the params management modal for a template */
  const openParamsModal = (tpl: Template) => {
    setParamsModalTemplate(tpl);
    setEditingParams(tpl.params ? tpl.params.map(p => ({ ...p })) : []);
  };

  /** Save the current editingParams to the backend */
  const saveTemplateParams = async () => {
    if (!paramsModalTemplate) return;
    setSavingParams(true);
    try {
      const res = await fetch(`${API_BASE}/templates/${paramsModalTemplate._id}/params`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ params: editingParams })
      });
      if (res.ok) {
        fetchTemplates();
        setParamsModalTemplate(null);
      } else {
        alert('שגיאה בשמירת הפרמטרים');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingParams(false);
    }
  };

  const addParam = () => {
    setEditingParams(prev => [...prev, { label: '', variableName: '' }]);
  };

  const removeParam = (idx: number) => {
    setEditingParams(prev => prev.filter((_, i) => i !== idx));
  };

  const updateParam = (idx: number, field: 'label' | 'variableName', value: string) => {
    setEditingParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
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
              { id: 'users', label: 'ניהול לקוחות', icon: Users },
              { id: 'user-types', label: 'סוגי משתמשים', icon: Shield },
              { id: 'sessions', label: 'סשנים', icon: List },
              { id: 'dialog360', label: 'הודעות תבנית', icon: MessageSquare },
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
              {activeTab === 'users' && 'ניהול לקוחות'}
              {activeTab === 'user-types' && 'סוגי משתמשים'}
              {activeTab === 'sessions' && 'כל הסשנים'}
              {activeTab === 'dialog360' && 'הודעות תבנית Dialog360'}
              {activeTab === 'templates' && 'ניהול תבניות'}
              {activeTab === 'settings' && 'הגדרות מערכת'}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {activeTab === 'dashboard' && 'סקירה מקיפה על נתוני וביצועי המערכת'}
              {activeTab === 'users' && 'צפייה, עריכה וניהול הרשאות משתמשים מתקדם'}
              {activeTab === 'user-types' && 'הגדרת הרשאות לכל סוג משתמש במערכת'}
              {activeTab === 'sessions' && 'צפייה בכל הסשנים של כל המשתמשים במערכת'}
              {activeTab === 'dialog360' && 'צפייה בהודעות תבנית מ-Dialog360'}
              {activeTab === 'templates' && 'ניהול ותחזוקת מאגר התבניות הגלובלי'}
              {activeTab === 'settings' && 'הגדרת מגבלות, מחירים ופרמטרים למערכת'}
            </p>
          </div>

        </header>

        {/* Content Scroll Area */}
        <div className={`flex-1 z-10 ${activeTab === 'sessions' ? 'overflow-hidden' : 'overflow-y-auto px-10 pb-10 pt-2'}`}>
          
          {error && (
            <div className="bg-red-50 border-r-4 border-red-500 p-4 mb-8 rounded-xl shadow-sm flex items-center gap-4 animate-fade-in group hover:bg-red-100/50 transition-colors">
              <div className="p-2 bg-red-100 rounded-full text-red-600 group-hover:bg-red-200 transition-colors"><AlertCircle className="w-5 h-5" /></div>
              <p className="text-red-700 font-bold">{error}</p>
              <button onClick={() => setError(null)} className="mr-auto p-2 hover:bg-red-200 rounded-full text-red-400 hover:text-red-700 transition-all"><X size={18} /></button>
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="flex flex-row h-full overflow-hidden">

              {/* LEFT: Sessions list (flex-1, scrollable) */}
              <div className="flex-1 overflow-y-auto px-10 pb-10 pt-2">
                <div className="space-y-4 animate-fade-in-up" dir="rtl">
                  {/* Search bar with submit */}
                  <div className="relative max-w-md mb-6">
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
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                        {sessionsTotal} סשנים · עמוד {sessionsPage} מתוך {sessionsTotalPages}
                      </p>

                      {/* Table */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm" dir="rtl">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">טלפון</th>
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">משתמש</th>
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">בוט</th>
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">תאריך</th>
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">סטטוס</th>
                              <th className="text-right px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">פעולות</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sessions.map(session => {
                              const isExpanded = expandedSessionId === session.id;
                              const isHistoryOpen = adminHistoryOpenId === session.id;
                              const paramEntries = Object.entries(session.parameters || {}).filter(([, v]) => v !== null && v !== '' && v !== undefined);
                              const hasHistory = (session.process_history || []).length > 0;
                              const formatD = (d: string | null) => {
                                if (!d) return 'לא ידוע';
                                const dt = new Date(d);
                                if (isNaN(dt.getTime())) return 'לא ידוע';
                                return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                              };
                              return (
                                <React.Fragment key={session.id}>
                                  <tr className={`transition-colors ${isHistoryOpen ? 'bg-sky-50/60' : session.is_active ? 'hover:bg-slate-50/60' : 'bg-slate-50/40 hover:bg-slate-50'}`}>
                                    {/* Phone */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <Phone size={13} className="text-slate-300 flex-shrink-0" />
                                        <span className="font-bold text-slate-700 text-sm" dir="ltr">{session.phone}</span>
                                      </div>
                                    </td>
                                    {/* User */}
                                    <td className="px-4 py-3">
                                      <span className="text-sm font-bold text-indigo-600">{session.user_name || 'לא ידוע'}</span>
                                    </td>
                                    {/* Bot */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <Bot size={13} className="text-blue-400 flex-shrink-0" />
                                        <span className="text-sm font-bold text-slate-600">{session.bot_name}</span>
                                      </div>
                                    </td>
                                    {/* Date */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5 text-slate-400">
                                        <Clock size={12} className="flex-shrink-0" />
                                        <span className="text-xs font-bold">{formatD(session.created_at)}</span>
                                      </div>
                                    </td>
                                    {/* Status */}
                                    <td className="px-4 py-3">
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
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        {paramEntries.length > 0 && (
                                          <button
                                            onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                              isExpanded
                                                ? 'bg-slate-200 text-slate-700'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                            }`}
                                          >
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            פרמטרים
                                          </button>
                                        )}
                                        {hasHistory && (
                                          <button
                                            onClick={() => setAdminHistoryOpenId(isHistoryOpen ? null : session.id)}
                                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                              isHistoryOpen
                                                ? 'bg-sky-100 text-sky-600'
                                                : 'bg-sky-50 text-sky-500 hover:bg-sky-100 hover:text-sky-600'
                                            }`}
                                          >
                                            <MessageSquare size={13} />
                                            היסטוריה
                                            <span className="bg-sky-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none">
                                              {session.process_history.length}
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Expanded parameters row */}
                                  {isExpanded && paramEntries.length > 0 && (
                                    <tr className="bg-slate-50/70">
                                      <td colSpan={6} className="px-6 py-4 border-t border-slate-100">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">פרמטרים שנאספו</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {paramEntries.map(([key, value]) => (
                                            <div key={key} className="bg-white border border-slate-100 rounded-xl p-3">
                                              <p className="text-xs font-black text-slate-400 mb-1">{key}</p>
                                              <p className="text-sm font-bold text-slate-700 truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

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
              </div>

              {/* RIGHT: History side panel (1/4 width) */}
              {adminHistoryOpenId && adminActiveSession && (() => {
                const session = adminActiveSession;
                const fmtMsgDate = (dateStr: string) => {
                  if (!dateStr) return '';
                  const d = new Date(dateStr);
                  if (isNaN(d.getTime())) return '';
                  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' +
                    d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                };
                return (
                  <div className="w-1/4 flex-shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-white shadow-lg">
                    {/* Panel header */}
                    <div className="flex-shrink-0 px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center shadow">
                          <Bot size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">{session.bot_name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[130px]">{session.phone}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAdminHistoryOpenId(null)}
                        className="p-1.5 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0"
                        title="סגור"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {/* Messages */}
                    <div
                      ref={adminHistoryScrollRef}
                      className="flex-1 overflow-y-auto p-3 space-y-4 bg-[#fcfcfc]"
                      dir="rtl"
                    >
                      {session.process_history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                          <MessageSquare size={36} strokeWidth={1} />
                          <p className="text-xs font-bold">אין הודעות</p>
                        </div>
                      ) : (() => {
                        const grouped: any[] = [];
                        let hi = 0;
                        while (hi < session.process_history.length) {
                          const cur = session.process_history[hi];
                          if (cur.type === 'waitingwebservice') { hi++; continue; }
                          if (cur.type === 'SendItem') {
                            const cards: any[] = [];
                            const created = cur.created;
                            while (hi < session.process_history.length && session.process_history[hi].type === 'SendItem') {
                              cards.push(session.process_history[hi]); hi++;
                            }
                            grouped.push({ type: '_carousel', carouselItems: cards, created });
                          } else {
                            grouped.push(cur); hi++;
                          }
                        }
                        return grouped.map((item: any, idx: number) => {
                        const sender: 'bot' | 'user' = item.sender
                          ? item.sender
                          : item.type === 'UserInput' ? 'user' : 'bot';
                        const isBot = sender === 'bot';
                        const text = item.text ?? item.content ?? '';
                        const msgDate = item.created ? fmtMsgDate(item.created) : '';
                        return (
                          <div key={idx} className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
                            <div className={`flex gap-1.5 max-w-[90%] ${isBot ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm ${
                                isBot ? 'bg-white border border-slate-100 text-slate-700' : 'bg-sky-500 text-white'
                              }`}>
                                {isBot ? <Bot size={13} /> : <UserIcon size={13} />}
                              </div>
                              <div className={`flex flex-col gap-0.5 ${isBot ? 'items-end' : 'items-start'}`}>
                                <div className={`px-3 py-2 rounded-2xl text-xs font-semibold shadow-sm text-right ${
                                  isBot
                                    ? 'bg-white border border-slate-100 text-slate-900 rounded-tr-none'
                                    : 'bg-sky-500 text-white rounded-tl-none'
                                }`}>
                                  {(item.type === 'Text' || item.type === 'UserInput' || !item.type || item.type.startsWith('input_')) && text && (
                                    <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                                  )}
                                  {item.type === 'Image' && item.url && (
                                    <>
                                      <img src={item.url} alt="תמונה" className="rounded-xl max-w-[160px] h-auto mb-2" />
                                      {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                                    </>
                                  )}
                                  {item.type === 'Video' && item.url && (
                                    <>
                                      <video src={item.url} controls className="rounded-xl max-w-[160px] mb-2" />
                                      {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                                    </>
                                  )}
                                  {item.type === 'Document' && item.url && (
                                    <>
                                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-600 underline text-[11px] mb-2">
                                        <ExternalLink size={10} /> פתח מסמך
                                      </a>
                                      {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                                    </>
                                  )}
                                  {item.type === 'URL' && (
                                    <div>
                                      {text && <p>{text}</p>}
                                      {item.url && (
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline opacity-80 break-all flex items-center gap-1">
                                          {item.url} <ExternalLink size={10} />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {item.type === 'Options' && (
                                    <div>
                                      {text && <p className="mb-1 text-[10px] text-slate-400 font-black uppercase tracking-widest">{text}</p>}
                                      {Array.isArray(item.options) && (
                                        <div className="flex flex-col gap-1">
                                          {item.options.filter((o: string) => o !== 'default').map((opt: string, i: number) => (
                                            <div key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700">{opt}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {/* Carousel (SendItem) */}
                                  {item.type === '_carousel' && Array.isArray(item.carouselItems) && (
                                    <div className="flex gap-2 overflow-x-auto pb-1 max-w-[220px]">
                                      {item.carouselItems.map((card: any, ci: number) => (
                                        <div key={ci} className="flex-shrink-0 w-36 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                          {card.image && <img src={card.image} alt={card.title || ''} className="w-full h-20 object-cover" />}
                                          <div className="p-2">
                                            {card.title && <p className="text-[11px] font-black text-slate-800 leading-tight">{card.title}</p>}
                                            {card.subtitle && <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{card.subtitle}</p>}
                                            {card.url && (
                                              <a href={card.url} target="_blank" rel="noopener noreferrer"
                                                className="mt-1 flex items-center gap-1 text-[9px] text-sky-600 font-bold hover:underline">
                                                <ExternalLink size={8} /> פתח
                                              </a>
                                            )}
                                            {Array.isArray(card.options) && card.options.length > 0 && (
                                              <div className="mt-1 flex flex-col gap-0.5">
                                                {card.options.map((opt: any, oi: number) => (
                                                  <div key={oi} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-700 text-center">
                                                    {typeof opt === 'object' ? opt.text : opt}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {msgDate && (
                                  <span className="text-[9px] text-slate-400 font-semibold px-0.5">{msgDate}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                        });
                      })()}
                    </div>
                    
                    {/* Admin Message Input - HIDDEN */}
                    {false && (
                    <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3">
                      <div className="relative">
                        {/* Templates Dropdown */}
                        {showAdminTemplates && (
                          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-50">
                            {adminTemplatesLoading ? (
                              <div className="p-4 text-center text-slate-400 text-xs">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600 mx-auto mb-2"></div>
                                טוען טמפלייטים...
                              </div>
                            ) : adminTemplates.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-xs">
                                לא נמצאו טמפלייטים. נא להגדיר Bot ID בהגדרות המשתמש.
                              </div>
                            ) : (() => {
                              // Filter templates by search query (after "/")
                              const searchQuery = adminNewMessage.substring(1).toLowerCase();
                              const filteredTemplates = adminTemplates.filter((tpl: any) => {
                                if (!searchQuery) return true;
                                const name = (tpl.name || tpl.elementName || tpl.template_name || '').toLowerCase();
                                return name.includes(searchQuery);
                              });
                              
                              return filteredTemplates.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-xs">
                                  לא נמצאו טמפלייטים התואמים לחיפוש "{searchQuery}"
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100">
                                  {filteredTemplates.map((tpl: any, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleAdminTemplateSelect(tpl)}
                                      className="w-full text-right px-4 py-3 hover:bg-slate-50 transition-colors"
                                    >
                                      <div className="font-bold text-sm text-slate-800 mb-1">
                                        {tpl.name || tpl.elementName || tpl.template_name || 'ללא שם'}
                                      </div>
                                      {tpl.components && tpl.components.length > 0 && (() => {
                                        const bodyComp = tpl.components.find((c: any) => c.type === 'BODY');
                                        return bodyComp?.text ? (
                                          <div className="text-xs text-slate-500 truncate">
                                            {bodyComp.text.substring(0, 60)}...
                                          </div>
                                        ) : null;
                                      })()}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        
                        {/* Input Field */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={adminNewMessage}
                            onChange={(e) => {
                              const value = e.target.value;
                              console.log('[Admin Input] Value changed:', value);
                              setAdminNewMessage(value);
                              
                              // Show templates dropdown when typing "/" or anything starting with "/"
                              if (value === '/' || value.startsWith('/')) {
                                console.log('[Admin Input] Starts with "/", showing templates');
                                setShowAdminTemplates(true);
                                if (value === '/') {
                                  fetchAdminTemplates();
                                }
                              } else {
                                console.log('[Admin Input] Not starting with "/", hiding templates');
                                setShowAdminTemplates(false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendAdminMessage();
                              } else if (e.key === 'Escape') {
                                setShowAdminTemplates(false);
                              }
                            }}
                            placeholder="כתוב הודעה לליקוט... (הקלד / לטמפלייטים)"
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                            dir="rtl"
                          />
                          <button
                            onClick={sendAdminMessage}
                            disabled={!adminNewMessage.trim()}
                            className="px-4 py-2 bg-sky-500 text-white rounded-lg text-xs font-bold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13"></line>
                              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            שלח
                          </button>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                );
              })()}
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
                      ניהול לקוחות <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
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
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative group flex-1">
                      <Search className="absolute right-3.5 top-3 text-slate-400 w-4 h-4 group-focus-within:text-sky-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="חיפוש משתמשים..."
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl group-focus-within:bg-white focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-medium text-slate-700 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => { setCreateUserError(null); setShowCreateUserModal(true); fetchUserTypesForModal(); }}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm flex-shrink-0"
                    >
                      <Plus size={14} />
                      הוסף לקוח
                    </button>
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
                  {loading ? (
                     <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mb-3"></div>
                        <p className="font-medium text-sm">טוען משתמשים...</p>
                     </div>
                  ) : filteredUsers.length === 0 ? (
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
                          <div className="flex gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {user.status === 'active' ? 'פעיל' : 'חסום'}
                            </span>
                            {user.role !== 'rep' && user.role !== 'rep_manager' && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                user.account_type === 'Premium' ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : user.account_type === 'Trial' ? 'bg-orange-50 text-orange-600 border-orange-100'
                                : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                  {user.account_type === 'Trial' ? 'ניסיוני' : user.account_type}
                              </span>
                            )}
                            {user.user_type_id?.name && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-purple-50 text-purple-600 border-purple-100 flex items-center gap-1">
                                <UserCheck size={9} />{user.user_type_id.name}
                              </span>
                            )}
                          </div>
                          <ChevronRight size={14} className={`transition-transform duration-300 ${selectedUser?.id === user.id ? 'text-sky-500 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        {(user.role === 'rep' || user.role === 'rep_manager') && user.manager_id && (() => {
                          const parentUser = users.find(u => u.id === user.manager_id);
                          return parentUser ? (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                              <UserIcon size={10} className="shrink-0" />
                              <span className="truncate">קשור ל: <span className="font-semibold text-slate-600">{parentUser.name}</span></span>
                            </div>
                          ) : null;
                        })()}
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
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><Lock size={12} /> סיסמה</label>
                                    {isEditing ? (
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                className="w-full p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all font-mono"
                                                value={editForm.password || ''}
                                                onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                                placeholder="סיסמת המשתמש"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(p => !p)}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="font-mono bg-slate-50 p-3 pr-10 rounded-xl border border-slate-100 text-slate-800 text-sm select-all tracking-widest">
                                                {selectedUser.password
                                                    ? (showPassword ? selectedUser.password : '••••••••••••')
                                                    : '-'}
                                            </div>
                                            {selectedUser.password && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(p => !p)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                         {/* Dialog360 Settings - Full Width */}
                        <div className="col-span-12 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-50 pb-4">
                                <MessageSquare size={16} className="text-slate-400" /> הגדרות חיבור
                            </h3>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400">Bot ID <span className="text-amber-500 font-normal">(לצורך שליחה לקבוצות בלבד)</span></label>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <input 
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all font-mono" 
                                            value={editForm.dialog360_bot_id || ''} 
                                            onChange={e => setEditForm(prev => ({...prev, dialog360_bot_id: e.target.value}))}
                                            placeholder="676bc253356d6d0fdf7bb242"
                                        />
                                        <div className="text-xs text-slate-500 px-2">
                                            הזן רק את Bot ID. הקישור ייבנה אוטומטית: <code className="bg-slate-100 px-1 rounded">dialog360/{'{bot_id}'}</code>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-800 font-medium text-sm select-all px-2 font-mono bg-slate-50 p-3 rounded-xl">
                                        {selectedUser.dialog360_bot_id || '-'}
                                    </div>
                                )}
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
                                            selectedUser.role === 'rep' || selectedUser.role === 'rep_manager' ? (
                                                <div className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-slate-400 font-bold text-sm">— (נציג)</div>
                                            ) : (
                                                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer" value={editForm.account_type || 'Basic'} onChange={e => setEditForm(prev => ({...prev, account_type: e.target.value}))}>
                                                    <option value="Trial">Trial (ניסיוני)</option>
                                                    <option value="Basic">Basic (בסיסי)</option>
                                                    <option value="Premium">Premium (מתקדם)</option>
                                                </select>
                                            )
                                        ) : (
                                            <div className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-slate-800 font-bold text-sm flex justify-between items-center">
                                                {(selectedUser.role === 'rep' || selectedUser.role === 'rep_manager') ? '—' : (selectedUser.account_type || '—')}
                                                {selectedUser.role !== 'rep' && selectedUser.role !== 'rep_manager' && <Star size={16} className="text-amber-400 fill-amber-400" />}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 flex items-center gap-1"><Shield size={12} /> סוג משתמש / הרשאות</label>
                                        {isEditing ? (
                                            <select
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer"
                                                value={editForm.user_type_id?._id || ''}
                                                onChange={e => {
                                                    const selected = createUserTypes.find(ut => ut._id === e.target.value);
                                                    setEditForm(prev => ({
                                                        ...prev,
                                                        user_type_id: selected ? { _id: selected._id, name: selected.name, system_role: selected.system_role } : null
                                                    }));
                                                }}
                                            >
                                                <option value="">— ללא סוג מוגדר</option>
                                                {createUserTypes.map(ut => (
                                                    <option key={ut._id} value={ut._id}>{ut.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-slate-800 font-bold text-sm flex justify-between items-center">
                                                {selectedUser.user_type_id?.name || '—'}
                                                {selectedUser.user_type_id && <Shield size={14} className="text-purple-400" />}
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

          {/* DIALOG360 TEMPLATES TAB */}
          {activeTab === 'dialog360' && (
            <div className="space-y-6 animate-fade-in-up">
              {dialog360Loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-slate-400 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
                    <div className="text-sm">טוען הודעות תבנית...</div>
                  </div> 
                </div>
              ) : dialog360Templates.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                  <MessageSquare size={48} className="text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-600 mb-2">לא נמצאו הודעות תבנית</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    אנא ודא שהגדרת את Bot ID בהגדרות המשתמש. <br/>
                    לאחר הגדרת Bot ID, ההודעות יופיעו כאן.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dialog360Templates.map((template, idx) => {
                    const name = template.name || template.elementName || template.template_name || `Template ${idx + 1}`;
                    const language = template.language || '';
                    const status = template.status || '';
                    const category = template.category || '';
                    const components = template.components || [];
                    
                    // Extract components
                    const headerComponent = components.find((c: any) => c.type === 'HEADER');
                    const bodyComponent = components.find((c: any) => c.type === 'BODY');
                    const footerComponent = components.find((c: any) => c.type === 'FOOTER');
                    const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
                    
                    const bodyText = bodyComponent?.text || '';
                    const hasImage = headerComponent?.format === 'IMAGE';
                    const hasButtons = !!buttonsComponent;
                    const buttonCount = buttonsComponent?.buttons?.length || 0;
                    const showInChat = dialog360TemplateSettings[name] ?? true;
                    
                    return (
                      <div 
                        key={template.id || idx} 
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:border-sky-300 group"
                      >
                        {/* Header section with image indicator */}
                        <div className={`p-6 ${hasImage ? 'bg-gradient-to-br from-sky-50 to-blue-50' : 'bg-slate-50'} border-b border-slate-200`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-sky-700 transition-colors">
                                  {name}
                                </h3>
                                {/* Visibility cycling toggle: hidden -> manager -> agent -> hidden */}
                                {(() => {
                                  const currentVis = dialog360TemplateSettings[name] ?? 'manager';
                                  const cfg = {
                                    hidden:  { icon: <EyeOff size={16} />,    title: 'מוסתר לכולם — לחץ כדי לשנות',              cls: 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600' },
                                    manager: { icon: <UserCheck size={16} />, title: 'מוצג למנהל משמרת  — לחץ כדי לשנות',     cls: 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' },
                                    agent:   { icon: <Headphones size={16} />, title: 'מוצג גם לנציגים — לחץ כדי לשנות',          cls: 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' },
                                  }[currentVis];
                                  return (
                                    <button
                                      onClick={() => cycleDialog360Visibility(template)}
                                      className={`p-2 rounded-lg transition-colors border ${cfg.cls}`}
                                      title={cfg.title}
                                    >
                                      {cfg.icon}
                                    </button>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {language && (
                                  <span className="bg-white text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1">
                                    <Globe size={12} />
                                    {language.toUpperCase()}
                                  </span>
                                )}
                                {status && (
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                    status === 'APPROVED' ? 'bg-emerald-500 text-white' : 
                                    status === 'PENDING' ? 'bg-amber-500 text-white' : 
                                    'bg-slate-400 text-white'
                                  }`}>
                                    {status === 'APPROVED' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                    {status}
                                  </span>
                                )}
                                {category && (
                                  <span className="bg-sky-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold">
                                    {category}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasImage && (
                              <div className="ml-3 p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                                <ImageIcon size={20} className="text-sky-600" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Body section */}
                        <div className="p-6">
                          {bodyText && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
                                {bodyText.substring(0, 200)}{bodyText.length > 200 ? '...' : ''}
                              </p>
                            </div>
                          )}
                          
                          {/* Components info */}
                          <div className="flex items-center justify-between text-xs mb-4">
                            <div className="flex items-center gap-3 text-slate-500">
                              <span className="flex items-center gap-1">
                                <Layers size={14} />
                                {components.length} רכיבים
                              </span>
                              {hasButtons && (
                                <span className="flex items-center gap-1 text-sky-600 font-bold">
                                  <MessageSquare size={14} />
                                  {buttonCount} כפתורים
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Footer info */}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            {template.id && (
                              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                                ID: {template.id.substring(0, 10)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                         {/* Show in chat toggle */}
                         <button 
                            onClick={() => toggleShowInChat(tpl)} 
                            className={`p-2 rounded-lg transition-colors border ${tpl.showInChat !== false ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`} 
                            title={tpl.showInChat !== false ? 'מוצג בשיחות (/)' : 'מוסתר בשיחות (/)'}
                         >
                            {tpl.showInChat !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                         </button>
                         {/* Cycle type button */}
                         <button onClick={() => cycleTemplateType(tpl)} className={`p-2 rounded-lg transition-colors border ${typeConfig.color}`} title="שנה סוג">
                            <TypeIcon size={14} />
                         </button>
                         <button onClick={() => openParamsModal(tpl)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200" title="ניהול פרמטרים לטופס">
                            <Sliders size={16} />
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
                      <div className="flex items-center gap-2">
                        {tpl.params && tpl.params.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                            <Sliders size={9} />
                            {tpl.params.length} פרמטרים
                          </span>
                        )}
                        <span className="font-mono opacity-70">ID: {tpl.template_id}</span>
                      </div>
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

          {/* ───────────────────────────────────────────────────────────────
               PARAMS MODAL - Manage template parameters (for --varName-- filling)
               ─────────────────────────────────────────────────────────────── */}
          {paramsModalTemplate && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6" dir="rtl">
              <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-fade-in-up border border-white/50 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                  <button onClick={() => setParamsModalTemplate(null)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                  </button>
                  <div className="text-right">
                    <h3 className="text-xl font-black text-slate-800">ניהול פרמטרים</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{paramsModalTemplate.name}</p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex-shrink-0">
                  <p className="text-xs font-bold text-amber-800 leading-relaxed">
                    הגדר כאן את השדות שיוצגו למשתמש בטופס לפני שימוש בתבנית.<br />
                    בתוכן הרכיבים השתמש בתחביר <span className="font-black font-mono bg-amber-100 px-1 rounded">--שם_משתנה--</span> כדי להציג את הערך בסימולטור.
                  </p>
                </div>

                {/* Params list */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                  {editingParams.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <Sliders size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">אין פרמטרים. לחץ "הוסף פרמטר" להתחיל.</p>
                    </div>
                  )}
                  {editingParams.map((param, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl group">
                      <button
                        onClick={() => removeParam(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                        title="הסר פרמטר"
                      >
                        <X size={15} />
                      </button>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">תווית למשתמש</label>
                          <input
                            type="text"
                            placeholder='לדוגמה: שם החברה'
                            value={param.label}
                            onChange={e => updateParam(idx, 'label', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-right outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">שם משתנה</label>
                          <input
                            type="text"
                            placeholder='לדוגמה: comp_name'
                            value={param.variableName}
                            onChange={e => updateParam(idx, 'variableName', e.target.value.replace(/\s/g, '_'))}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-right outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-5 border-t border-slate-100 mt-5 flex-shrink-0">
                  <button
                    onClick={addParam}
                    className="w-full py-3 border-2 border-dashed border-amber-300 text-amber-600 rounded-2xl font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> הוסף פרמטר
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setParamsModalTemplate(null)}
                      className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={saveTemplateParams}
                      disabled={savingParams || editingParams.some(p => !p.label.trim() || !p.variableName.trim())}
                      className="flex-[2] py-3 bg-amber-500 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      {savingParams ? 'שומר...' : 'שמור פרמטרים'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USER TYPES TAB */}
          {activeTab === 'user-types' && (
            <div className="max-w-3xl mx-auto animate-fade-in-up">
              <UserTypesManager token={token} apiBase={API_BASE} />
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

               {/* ── Global default config for the auto-removal-from-group feature ── */}
               {removalConfig && (
                 <div dir="rtl" className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                     <div className="text-right">
                       <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 justify-end">
                         <UserMinus size={20} className="text-rose-500" />
                         ניהול הסרה מקבוצה — ברירת מחדל כללית
                       </h3>
                       <p className="text-sm text-slate-500 font-medium mt-1">
                         מילות מפתח והודעת אישור המשמשות כברירת מחדל עבור כל בוט. כל משתמש יכול לדרוס את הערכים האלה בהגדרות שלו.
                       </p>
                     </div>
                     <div className="flex items-center gap-3">
                       <button
                         onClick={resetRemovalConfigToDefaults}
                         className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                         title="שחזור לערכי ברירת המחדל של המערכת"
                       >
                         <RefreshCcw size={14} /> ערכי ברירת מחדל
                       </button>
                       <button
                         onClick={() => setRemovalConfirmOpen(true)}
                         disabled={removalSaving}
                         className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-60 active:scale-95"
                       >
                         <Save size={14} />
                         {removalSaving ? 'שומר…' : 'שמור שינויים'}
                       </button>
                     </div>
                   </div>

                   <div className="p-8 space-y-8">
                     <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                       <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                       <div className="text-amber-800 text-sm font-bold leading-relaxed">
                         שינוי הגדרות אלו ישפיע על <span className="underline">כל המשתמשים</span> שלא דרסו את ההגדרה. הסרה לא תקינה של מילים עלולה למנוע הסרה אוטומטית של נמענים שביקשו זאת — באחריותך.
                       </div>
                     </div>

                     <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
                       <div className="text-right">
                         <div className="text-sm font-black text-slate-800">הסרה אוטומטית פעילה</div>
                         <div className="text-xs text-slate-500 font-medium">כאשר נמען שולח אחת ממילות המפתח — המספר שלו יתווסף אוטומטית לרשימת ההסרה.</div>
                       </div>
                       <button
                         onClick={() => setRemovalConfig({ ...removalConfig, enabled: !removalConfig.enabled })}
                         className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                           removalConfig.enabled
                             ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                             : 'bg-slate-100 text-slate-500 border-slate-200'
                         }`}
                       >
                         {removalConfig.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                         {removalConfig.enabled ? 'פעיל' : 'מושבת'}
                       </button>
                     </div>

                     <div>
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">מילות מפתח להסרה</label>
                       <div className="flex gap-2 mb-4">
                         <input
                           type="text"
                           value={removalNewKeyword}
                           onChange={e => setRemovalNewKeyword(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRemovalKeyword(); } }}
                           placeholder="הוסף מילת מפתח (למשל: הסר, remove)"
                           className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-500 transition-all"
                         />
                         <button
                           onClick={addRemovalKeyword}
                           className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-900 transition-all"
                         >
                           <Plus size={14} /> הוסף
                         </button>
                       </div>
                       {removalConfig.keywords.length === 0 ? (
                         <div className="text-center text-slate-400 text-sm py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           אין מילות מפתח. ללא מילות מפתח לא תתבצע הסרה אוטומטית.
                         </div>
                       ) : (
                         <div className="flex flex-wrap gap-2">
                           {removalConfig.keywords.map((kw, idx) => (
                             <span
                               key={`${kw}-${idx}`}
                               className="inline-flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-sm font-bold"
                             >
                               <span dir="auto">{kw}</span>
                               <button
                                 onClick={() => removeRemovalKeyword(idx)}
                                 className="text-rose-400 hover:text-rose-700 transition-colors"
                                 title="הסר מילה"
                               >
                                 <X size={14} />
                               </button>
                             </span>
                           ))}
                         </div>
                       )}
                       {removalDefaults && (
                         <p className="text-[11px] text-slate-400 font-medium mt-3 text-right">
                           ברירת המחדל המקורית של המערכת כוללת {removalDefaults.keywords.length} מילים בעברית ובאנגלית.
                         </p>
                       )}
                     </div>

                     <div>
                       <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">הודעת אישור לאחר ההסרה</label>
                       <textarea
                         value={removalConfig.message}
                         onChange={e => setRemovalConfig({ ...removalConfig, message: e.target.value })}
                         rows={3}
                         placeholder="הודעה שתישלח לנמען אחרי שהוסר אוטומטית"
                         className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-500 transition-all resize-none text-right"
                       />
                       {removalDefaults && removalDefaults.message && (
                         <p className="text-[11px] text-slate-400 font-medium mt-2 text-right">
                           ברירת מחדל: <span className="text-slate-500">"{removalDefaults.message}"</span>
                         </p>
                       )}
                     </div>

                     {removalSaved && (
                       <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-bold flex items-center gap-2">
                         <CheckCircle size={16} /> ההגדרה הגלובלית נשמרה
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* Modal: confirm global removal-config save */}
          {removalConfirmOpen && removalConfig && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6" dir="rtl">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div className="text-right">
                    <h4 className="text-lg font-black text-slate-900 mb-1">לאשר שינוי הגדרת הסרה גלובלית?</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      ההגדרות החדשות יחולו על כל המשתמשים שלא דרסו את ברירת המחדל. שינוי שגוי עלול למנוע הסרה אוטומטית של נמענים שביקשו להסירם — באחריותך.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemovalConfirmOpen(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold text-xs uppercase hover:bg-slate-50"
                    disabled={removalSaving}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={persistRemovalConfig}
                    disabled={removalSaving}
                    className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase hover:bg-rose-700 disabled:opacity-60"
                  >
                    {removalSaving ? 'שומר…' : 'אני מבין/ה, שמור'}
                  </button>
                </div>
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
                      className="w-full flex items-center gap-5 p-5 bg-slate-50 hover:bg-pink-50 border border-slate-200 hover:border-pink-400 rounded-2xl transition-all text-right group"
                    >
                      <div className="w-12 h-12 bg-white text-slate-400 group-hover:bg-pink-600 group-hover:text-white rounded-2xl flex items-center justify-center flex-shrink-0 transition-all border border-slate-200 shadow-sm">
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
                        (() => {
                          const groups: { userName: string; bots: any[] }[] = [];
                          allSystemBots.forEach(bot => {
                            const uName = bot.user_name || 'לא ידוע';
                            const existing = groups.find(g => g.userName === uName);
                            if (existing) existing.bots.push(bot);
                            else groups.push({ userName: uName, bots: [bot] });
                          });
                          return groups.map(group => (
                            <div key={group.userName}>
                              <div className="flex items-center gap-2 px-2 py-1.5 mb-1 mt-2">
                                <UserIcon size={13} className="text-pink-500" />
                                <span className="text-xs font-black text-pink-700 tracking-wide">{group.userName}</span>
                                <div className="flex-1 h-px bg-pink-100" />
                                <span className="text-xs text-slate-400">{group.bots.length} בוטים</span>
                              </div>
                              {group.bots.map(bot => (
                                <div
                                  key={bot.id}
                                  onClick={() => { setSelectedSystemBot(bot); setNewAdminTplName(`תבנית מ-${bot.name}`); setCreateFromBotStep('name'); }}
                                  className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-pink-50 border border-slate-200 hover:border-pink-300 rounded-xl cursor-pointer transition-all group mb-1.5"
                                >
                                  <div className="w-10 h-10 bg-white text-slate-400 group-hover:bg-pink-600 group-hover:text-white rounded-xl flex items-center justify-center border border-slate-200 transition-all">
                                    <Bot size={18} />
                                  </div>
                                  <div className="flex-1 text-right">
                                    <p className="font-bold text-slate-800 text-sm">{bot.name}</p>
                                    <p className="text-xs text-slate-400">ID: {bot.id.slice(-6)}</p>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-300 group-hover:text-pink-500 transition-colors" />
                                </div>
                              ))}
                            </div>
                          ));
                        })()
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
                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-xl flex items-center gap-3">
                      <Bot size={16} className="text-pink-600" />
                      <span className="text-sm font-bold text-pink-800">{selectedSystemBot.name}</span>
                      <span className="text-xs text-pink-500 bg-pink-100 px-2 py-0.5 rounded">מנהל</span>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">שם התבנית</label>
                      <input
                        type="text"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-pink-100 focus:border-pink-500 outline-none transition-all font-medium"
                        value={newAdminTplName}
                        onChange={e => setNewAdminTplName(e.target.value)}
                        placeholder="שם לתבנית..."
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">תיאור <span className="text-slate-400 font-normal">(רשות)</span></label>
                      <textarea
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-pink-100 focus:border-pink-500 outline-none resize-none h-24 transition-all font-medium"
                        value={newAdminTplDesc}
                        onChange={e => setNewAdminTplDesc(e.target.value)}
                        placeholder="תיאור קצר..."
                      />
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={createAdminTemplateFromBot}
                        disabled={!newAdminTplName.trim() || creatingAdminTpl}
                        className="flex-1 bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-pink-700 transition-all disabled:opacity-50 text-sm"
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

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800">הוספת לקוח חדש</h3>
              <button onClick={() => setShowCreateUserModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={createUserForm.name}
                  onChange={e => setCreateUserForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">אימייל *</label>
                <input
                  type="email"
                  value={createUserForm.email}
                  onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={createUserForm.phone}
                  onChange={e => setCreateUserForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="050-0000000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">סיסמא (אופציונלי)</label>
                <input
                  type="password"
                  value={createUserForm.password}
                  onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">סוג חשבון</label>
                <select
                  value={createUserForm.account_type}
                  onChange={e => setCreateUserForm(f => ({ ...f, account_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="Trial">ניסיון</option>
                  <option value="Basic">בסיסי</option>
                  <option value="Premium">פרימיום</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">סוג משתמש</label>
                <select
                  value={createUserForm.user_type_id}
                  onChange={e => setCreateUserForm(f => ({ ...f, user_type_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">בחר סוג משתמש...</option>
                  {createUserTypes.map((ut: any) => (
                    <option key={ut._id} value={ut._id}>{ut.name}</option>
                  ))}
                </select>
              </div>
              {createUserError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                  <AlertCircle size={14} />
                  {createUserError}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creatingUser ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={16} />}
                צור משתמש
              </button>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="px-5 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUserId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-6" dir="rtl">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 border border-slate-100 text-right animate-in zoom-in duration-200">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">מחיקת לקוח</h3>
            <p className="text-slate-500 text-sm mb-2 font-medium leading-relaxed">
              האם אתה בטוח שברצונך למחוק לקוח זה לצמיתות?
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-6">
              <p className="text-red-700 text-xs font-bold leading-relaxed">
                ⚠️ פעולה זו תמחק לצמיתות את:
              </p>
              <ul className="text-red-600 text-xs mt-1.5 space-y-0.5 font-medium">
                <li>• כל הבוטים שלו</li>
                <li>• כל השיחות וההיסטוריה</li>
                <li>• כל הנתונים המשויכים לחשבון</li>
              </ul>
              <p className="text-red-700 text-xs font-bold mt-2">פעולה זו אינה ניתנת לביטול!</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-60 text-sm"
              >
                {isDeletingUser ? 'מוחק...' : 'כן, מחק לצמיתות'}
              </button>
              <button
                onClick={() => setDeleteConfirmUserId(null)}
                disabled={isDeletingUser}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
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
export default AdminPanel;
