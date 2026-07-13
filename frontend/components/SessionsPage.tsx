import React, { useState, useEffect, useRef } from 'react';
import { Clock, MessageSquare, Search, Bot, LogOut, User, Phone, List, Users, ExternalLink, X, Headphones, RefreshCw, Shield, Settings, UserCog, Layers, Plus, UserPlus, Check, Paperclip, ChevronRight, Bell, MoreVertical, Ban } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { FileUploader } from './FileUploader';
import { usePermission } from '../hooks/usePermission';
import AppNav from './AppNav';
import { useContactFields } from '../context/ContactFieldsContext';
 
interface Session {
  id: string;
  phone: string;
  sender?: string;
  widget_id: string | null;
  bot_name: string;
  user_name?: string;
  created_at: string | null;
  parameters: Record<string, any>;
  process_history: any[];
  is_agent?: boolean;
  agent_since?: string | null;
  status?: 'bot' | 'waiting' | 'handling' | 'closed' | 'resolved';
}

interface Contact {
  phone: string;
  sessionCount: number;
  lastSeen: string | null;
  bots: { id: string; name: string }[];
  botPhones?: string[];
  assigned_to?: string[];
  status?: 'bot' | 'waiting' | 'handling' | 'closed' | 'resolved';
  wants_phone?: boolean;
  whatsapp_name?: string;
  full_name?: string;
}

interface SessionsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean; availability_status?: 'available' | 'unavailable' | 'on_break' } | null;
  onBack?: () => void;
  onLogout: () => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  onUpdateAvailability?: (status: 'available' | 'unavailable' | 'on_break') => Promise<void>;
  onGoHome?: () => void;
  ownOnly?: boolean;
  initialPhone?: string | null;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const WhatsAppIcon = ({ size = 12, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className} style={{ display: 'inline', flexShrink: 0 }}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.22 8.22 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.188 8.188 0 01-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24M8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.08-.37-.12-.56.12-.16.25-.64.82-.78.99-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.39.11-.5.11-.11.27-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.11-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z"/>
  </svg>
);

const SessionsPage: React.FC<SessionsPageProps> = ({ token, currentUser, onBack, onLogout, onOpenContacts, onOpenGroups, onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation, onUpdateAvailability, onGoHome, initialPhone }) => {
  // Contacts panel state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState('');

  // Selected contact sessions
  const [selectedPhone, setSelectedPhone] = useState<string | null>(initialPhone ?? null);
  const [phoneSessions, setPhoneSessions] = useState<Session[]>([]);
  const [phoneSessionsLoading, setPhoneSessionsLoading] = useState(false);

  // Agent mode state
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState('');
  const [showAgentConfirm, setShowAgentConfirm] = useState(false);
  const [agentSending, setAgentSending] = useState(false);
  const [agentWaFailed, setAgentWaFailed] = useState(false);
  const [agentWaError, setAgentWaError] = useState<string | null>(null);
  const [agentWaRetryable, setAgentWaRetryable] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{type: 'image'|'video'|'document'; url: string; name: string} | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileUploadRef = React.useRef<HTMLInputElement>(null);

  // Template dropdown state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateSettings, setTemplateSettings] = useState<Record<string, 'hidden' | 'manager' | 'agent'>>({});
  
  // Template parameters modal
  const [showTemplateParamsModal, setShowTemplateParamsModal] = useState(false);
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});
  // Full contact record (with custom_field_values) fetched when modal opens
  const [contactRecord, setContactRecord] = useState<Record<string, any> | null>(null);

  const { fields: contactFieldDefs } = useContactFields();

  // New conversation modal state
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvLoading, setNewConvLoading] = useState(false);
  const [newConvError, setNewConvError] = useState<string | null>(null);

  // Assign reps modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModalPhone, setAssignModalPhone] = useState<string | null>(null);
  const [assignCurrentReps, setAssignCurrentReps] = useState<string[]>([]);
  const [assignNewRepId, setAssignNewRepId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [subUsers, setSubUsers] = useState<{ id: string; name: string }[]>([]);

  // Actions dropdown (transfer + blocklist)
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [addingToBlocklist, setAddingToBlocklist] = useState(false);
  const [blocklistSuccess, setBlocklistSuccess] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Transfer conversation modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetType, setTransferTargetType] = useState<'group' | 'rep' | 'shift_manager'>('group');
  const [transferTargetId, setTransferTargetId] = useState('');
  // For admin/rep_manager: an optional specific rep within the chosen group
  // ('' = "כל נציג זמין" / any available rep in the group).
  const [transferGroupRepId, setTransferGroupRepId] = useState('');
  const [transferWantsPhone, setTransferWantsPhone] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferTargets, setTransferTargets] = useState<{
    groups: { id: string; name: string }[];
    reps: { id: string; name: string; email?: string; repGroupIds: string[] }[];
    shiftManagers: { id: string; name: string; email?: string }[];
    myGroupIds: string[] | null;
  }>({ groups: [], reps: [], shiftManagers: [], myGroupIds: null });

  // ── Pending transfer notifications ──────────────────────────────────────────
  interface PendingNotification {
    _id: string;
    session_id: string;
    session_phone: string;
    from_user_name: string;
    target_label: string;
    is_simulator: boolean;
    wants_phone?: boolean;
    createdAt: string;
  }
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);

  // Bot picker state
  interface BotEntry { id: string; name: string; display_phone_number: string; }
  const [botList, setBotList] = useState<BotEntry[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [activeBotFilter, setActiveBotFilter] = useState<BotEntry | null>(null);
  // If initialPhone is provided, skip bot picker and show all contacts
  const [showBotPicker, setShowBotPicker] = useState<boolean>(!initialPhone);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch contacts (sorted most-recent-first by backend)
  const fetchContacts = React.useCallback(() => {
    if (!token) return;
    setContactsLoading(true);
    fetch(`${API_BASE}/sessions/contacts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setContacts(data))
      .catch(e => console.error('Failed to load contacts', e))
      .finally(() => setContactsLoading(false));
  }, [token]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Fetch bots list for bot picker
  useEffect(() => {
    if (!token) return;
    setBotsLoading(true);
    fetch(`${API_BASE}/bots`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: BotEntry[]) => {
        setBotList(data);
        // If there is exactly one bot, skip the picker and go straight to sessions
        // Keep activeBotFilter null so contacts are not filtered (avoids ID mismatch)
        if (data.length === 1 && !initialPhone) {
          setShowBotPicker(false);
        }
      })
      .catch(e => console.error('Failed to load bots', e))
      .finally(() => setBotsLoading(false));
  }, [token]);
  useEffect(() => {
    if (!selectedPhone || !token) {
      setPhoneSessions([]);
      return;
    }
    setPhoneSessionsLoading(true);
    const botParam = activeBotFilter ? `&botId=${encodeURIComponent(activeBotFilter.id)}` : '';
    fetch(`${API_BASE}/sessions/by-phone?phone=${encodeURIComponent(selectedPhone)}${botParam}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setPhoneSessions(sortSessionsAsc(data)))
      .catch(e => console.error('Failed to load sessions for phone', e))
      .finally(() => setPhoneSessionsLoading(false));
  }, [selectedPhone, token, activeBotFilter]);

  // ── Real-time updates: SSE (instant) + 4s polling fallback ─────────────────
  //
  // SSE handles contact-list updates and instant session refreshes.
  // The 4s polling is a safety net for when the SSE connection drops or an
  // event is missed (e.g. the connection was closed mid-emit).

  // Refs so SSE handler always reads current values without causing reconnects
  const selectedPhoneRef = useRef<string | null>(selectedPhone);
  const activeBotFilterRef = useRef(activeBotFilter);
  useEffect(() => { selectedPhoneRef.current = selectedPhone; }, [selectedPhone]);
  useEffect(() => { activeBotFilterRef.current = activeBotFilter; }, [activeBotFilter]);

  // Stable fetch helper for the open conversation (used by both SSE and polling)
  const fetchPhoneSessionsRef = useRef<(phone: string, botFilter: typeof activeBotFilter) => void>(() => {});
  useEffect(() => {
    fetchPhoneSessionsRef.current = (phone: string, botFilter: typeof activeBotFilter) => {
      const botParam = botFilter ? `&botId=${encodeURIComponent(botFilter.id)}` : '';
      fetch(`${API_BASE}/sessions/by-phone?phone=${encodeURIComponent(phone)}${botParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then((data: Session[]) => {
          setPhoneSessions(prev => {
            const prevMsgs = prev.reduce((acc, s) => acc + (s.process_history?.length || 0), 0);
            const newMsgs = data.reduce((acc, s) => acc + (s.process_history?.length || 0), 0);
            if (prev.length === data.length && prevMsgs === newMsgs) return prev;
            return sortSessionsAsc(data);
          });
        })
        .catch(() => { /* swallow polling errors */ });
    };
  }, [token]);

  // SSE — opens once per token, never recreated on conversation switch
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`${API_BASE}/sessions/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const eventData = JSON.parse(e.data);
        if (eventData.type === 'session_update') {
          fetchContacts();
          const phone = selectedPhoneRef.current;
          if (phone) {
            fetchPhoneSessionsRef.current(phone, activeBotFilterRef.current);
          }
        } else if (eventData.type === 'notification' && eventData.notification) {
          setPendingNotifications(prev => {
            // Avoid duplicates
            if (prev.some(n => n._id === eventData.notification._id)) return prev;
            return [eventData.notification, ...prev];
          });
        }
      } catch { /* ignore malformed events */ }
    };
    return () => es.close();
  }, [token, fetchContacts]);

  // Fetch pending notifications once on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setPendingNotifications(data.notifications || []))
      .catch(() => {});
  }, [token]);

  const dismissNotification = (id: string) => {
    fetch(`${API_BASE}/notifications/${id}/dismiss`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
    setPendingNotifications(prev => prev.filter(n => n._id !== id));
  };

  const dismissAllNotifications = () => {
    fetch(`${API_BASE}/notifications/dismiss-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
    setPendingNotifications([]);
  };

  // Mark a phone-request session as resolved directly from the notification
  const markNotifPhoneHandled = async (notif: PendingNotification) => {
    if (notif.session_id) {
      try {
        const r = await fetch(`${API_BASE}/sessions/${notif.session_id}/mark-resolved`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (r.ok) {
          // Update contacts list — clear wants_phone flag and set resolved status
          setContacts(prev => prev.map(c =>
            c.phone === notif.session_phone
              ? { ...c, status: 'resolved' as const, wants_phone: false }
              : c
          ));
          // If this contact is currently open, update its sessions too
          if (selectedPhone === notif.session_phone) {
            setPhoneSessions(prev => prev.map((s, i) =>
              i === prev.length - 1 ? { ...s, status: 'resolved' as const } : s
            ));
          }
        }
      } catch (e) {
        console.error('Failed to mark phone call handled', e);
      }
    }
    dismissNotification(notif._id);
  };

  // 4s polling fallback — only for the currently open conversation.
  // Cheap: one DB query per 4s. Catches cases where SSE dropped/missed an event.
  useEffect(() => {
    if (!selectedPhone || !token) return;
    const interval = setInterval(() => {
      fetchPhoneSessionsRef.current(selectedPhone, activeBotFilterRef.current);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedPhone, token]);

  // Auto-scroll to bottom only when new messages arrive AND the user is already
  // near the bottom (so we don't yank them away while they scroll up to read).
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const totalMsgs = phoneSessions.reduce((acc, s) => acc + (s.process_history?.length || 0), 0);
    const grew = totalMsgs > lastMsgCountRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (grew && nearBottom) {
      el.scrollTop = el.scrollHeight;
    } else if (lastMsgCountRef.current === 0) {
      // First load — always go to the bottom
      el.scrollTop = el.scrollHeight;
    }
    lastMsgCountRef.current = totalMsgs;
  }, [phoneSessions]);

  // Reset scroll tracker when switching contacts
  useEffect(() => {
    lastMsgCountRef.current = 0;
  }, [selectedPhone]);

  // Clear message input when switching contacts
  useEffect(() => {
    setAgentMessage('');
    setAttachedFile(null);
    setFileUploadError(null);
    setShowTemplates(false);
    setSelectedTemplate(null);
    setTemplateParams({});
    setShowTemplateParamsModal(false);
  }, [selectedPhone]);

  // Detect agent mode from last session
  useEffect(() => {
    if (phoneSessions.length === 0) {
      setIsAgentMode(false);
      setAgentSessionId(null);
      return;
    }
    const last = phoneSessions[phoneSessions.length - 1];
    if (last.is_agent && last.agent_since) {
      const ageMinutes = (Date.now() - new Date(last.agent_since).getTime()) / 60000;
      if (ageMinutes <= 30) {
        setIsAgentMode(true);
        setAgentSessionId(last.id);
        return;
      }
    }
    setIsAgentMode(false);
    setAgentSessionId(null);
  }, [phoneSessions]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'לא ידוע';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'לא ידוע';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Extract millisecond timestamp from a session — uses created_at if available,
  // otherwise falls back to the MongoDB ObjectId embedded timestamp.
  const getSessionTimestamp = (s: Session): number => {
    if (s.created_at) {
      const t = new Date(s.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    // ObjectId: first 8 hex chars = Unix seconds
    if (s.id && s.id.length >= 8) {
      const ts = parseInt(s.id.substring(0, 8), 16);
      if (!isNaN(ts)) return ts * 1000;
    }
    return 0;
  };

  const sortSessionsAsc = (arr: Session[]): Session[] =>
    [...arr].sort((a, b) => getSessionTimestamp(a) - getSessionTimestamp(b));

  const formatContactTime = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);
    if (d >= startOfToday) {
      return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }
    if (d >= startOfYesterday) {
      return 'אתמול';
    }
    if (d >= startOfWeek) {
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      return days[d.getDay()];
    }
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatMessageDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const isSimulator = (phone: string) =>
    phone === 'Simulated' || phone === 'simulator' || phone.toLowerCase() === 'simulated';

  // ── Conversation status helpers ───────────────────────────────────────────
  type ConvStatus = 'bot' | 'waiting' | 'handling' | 'closed' | 'resolved';
  const STATUS_LABELS: Record<ConvStatus, string> = {
    bot: 'בוט',
    waiting: 'ממתין למענה',
    handling: 'בטיפול',
    closed: 'סיום שיחה',
    resolved: 'טופל'
  };
  const STATUS_STYLES: Record<ConvStatus, string> = {
    bot: 'bg-sky-100 text-sky-700 border-sky-200',
    waiting: 'bg-amber-100 text-amber-700 border-amber-200',
    handling: 'bg-purple-100 text-purple-700 border-purple-200',
    closed: 'bg-slate-200 text-slate-600 border-slate-300',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  const renderStatusBadge = (status?: ConvStatus | string | null) => {
    const s = (status as ConvStatus) || 'bot';
    const label = STATUS_LABELS[s] || STATUS_LABELS.bot;
    const cls = STATUS_STYLES[s] || STATUS_STYLES.bot;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black ${cls}`}>
        {label}
      </span>
    );
  };

  const currentStatus: ConvStatus = (phoneSessions.length > 0
    ? ((phoneSessions[phoneSessions.length - 1].status as ConvStatus) || 'bot')
    : 'bot');

  // ── Mark resolved handler ────────────────────────────────────────────────
  const markResolved = async () => {
    const sid = agentSessionId || (phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null);
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE}/sessions/${sid}/mark-resolved`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        const sysEntry = data.historyEntry || {
          type: 'System',
          text: 'השיחה סומנה כטופלה',
          sender: 'system',
          name: 'מערכת',
          event: 'conversation_resolved',
          created: new Date().toISOString()
        };
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1
            ? { ...s, status: 'resolved', process_history: [...s.process_history, sysEntry] }
            : s
        ));
        setContacts(prev => prev.map(c =>
          c.phone === selectedPhone ? { ...c, status: 'resolved' } : c
        ));
      }
    } catch (e) {
      console.error('Failed to mark resolved', e);
    }
  };

  const closeConversation = async () => {
    const sid = agentSessionId || (phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null);
    if (!sid) return;
    try {
      const r = await fetch(`${API_BASE}/sessions/${sid}/close-conversation`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        const sysEntry = data.historyEntry || {
          type: 'System',
          text: 'השיחה הסתיימה',
          sender: 'system',
          name: 'מערכת',
          event: 'conversation_closed',
          created: new Date().toISOString()
        };
        setIsAgentMode(false);
        setAgentSessionId(null);
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1
            ? { ...s, is_agent: false, agent_since: null, status: 'closed', process_history: [...s.process_history, sysEntry] }
            : s
        ));
        setContacts(prev => prev.map(c =>
          c.phone === selectedPhone ? { ...c, status: 'closed' } : c
        ));
      }
    } catch (e) {
      console.error('Failed to close conversation', e);
    }
  };

  // ── Transfer conversation handlers ────────────────────────────────────────

  const openTransferModal = async () => {
    setTransferError(null);
    setTransferTargetId('');
    setTransferGroupRepId('');
    setTransferTargetType('group');
    setTransferWantsPhone(false);
    setShowTransferModal(true);
    try {
      const r = await fetch(`${API_BASE}/sessions/transfer-targets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json();
        setTransferTargets({
          groups: data.groups || [],
          reps: data.reps || [],
          shiftManagers: data.shiftManagers || [],
          myGroupIds: data.myGroupIds || null
        });
      } else {
        setTransferError('שגיאה בטעינת יעדי העברה');
      }
    } catch (e) {
      console.error('Failed to load transfer targets', e);
      setTransferError('שגיאת רשת');
    }
  };

  const submitTransfer = async () => {
    const sid = phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null;
    if (!sid) { setTransferError('אין שיחה פעילה להעברה'); return; }
    if (!transferTargetId) { setTransferError('יש לבחור יעד להעברה'); return; }

    // For admin / rep_manager, the "קבוצה" tab may also include a specific
    // rep selection within that group. When a specific rep is chosen we send
    // targetType='rep' + groupId so the backend pins both fields.
    const role = currentUser?.role;
    const isManagerSide = role === 'user' || role === 'admin' || role === 'rep_manager';
    const payload: { targetType: 'group' | 'rep' | 'shift_manager'; targetId: string; groupId?: string; wantsPhone?: boolean } = {
      targetType: transferTargetType,
      targetId: transferTargetId,
      wantsPhone: transferWantsPhone
    };
    if (isManagerSide && transferTargetType === 'group' && transferGroupRepId) {
      payload.targetType = 'rep';
      payload.targetId = transferGroupRepId;
      payload.groupId = transferTargetId;
    }

    setTransferLoading(true);
    setTransferError(null);
    try {
      const r = await fetch(`${API_BASE}/sessions/${sid}/transfer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTransferError(data.error || 'שגיאה בהעברת השיחה');
        return;
      }
      // Update local state to reflect new status
      setPhoneSessions(prev => prev.map((s, i) =>
        i === prev.length - 1
          ? {
              ...s,
              status: 'waiting',
              is_agent: true,
              process_history: data.historyEntry
                ? [...s.process_history, data.historyEntry]
                : s.process_history
            }
          : s
      ));
      setContacts(prev => prev.map(c =>
        c.phone === selectedPhone ? { ...c, status: 'waiting' } : c
      ));
      setIsAgentMode(false);
      setShowTransferModal(false);
      // For reps: the conversation may no longer be theirs — refresh contacts.
      if (currentUser?.role === 'rep') {
        fetchContacts();
      }
    } catch (e) {
      console.error('Failed to transfer conversation', e);
      setTransferError('שגיאת רשת');
    } finally {
      setTransferLoading(false);
    }
  };

  // ── New conversation handler ────────────────────────────────────────────────

  const validatePhoneInput = (phone: string): string | null => {
    if (!phone.trim()) return 'יש להזין מספר טלפון';
    const stripped = phone.replace(/[\s\-\(\)]/g, '');
    const hasPlus = stripped.startsWith('+');
    const withoutPlus = hasPlus ? stripped.slice(1) : stripped;
    if (!/^\d+$/.test(withoutPlus)) return 'מספר טלפון יכול להכיל ספרות, +, מקף, רווחים וסוגריים בלבד';
    if (withoutPlus.length < 10) return 'מספר טלפון קצר מדי (מינימום 10 ספרות, לדוגמה: 0501234567)';
    if (withoutPlus.length > 15) return 'מספר טלפון ארוך מדי (מקסימום 15 ספרות)';
    // מספר בן 10 ספרות חייב להתחיל ב-0 (פורמט מקומי, לדוגמה 0501234567)
    // מספר בינלאומי (11+ ספרות) מתחיל בקידומת מדינה — חייב להתחיל בספרה 1-9 שאינה 0
    if (withoutPlus.length === 10 && !withoutPlus.startsWith('0')) {
      return 'מספר בן 10 ספרות חייב להתחיל ב-0 (לדוגמה: 0501234567)';
    }
    if (withoutPlus.length > 10 && withoutPlus.startsWith('0')) {
      return 'מספר בינלאומי לא מתחיל ב-0 — הזן קידומת מדינה (לדוגמה: 972501234567)';
    }
    return null;
  };

  const handleNewConvConfirm = async () => {
    const validationError = validatePhoneInput(newConvPhone);
    if (validationError) {
      setNewConvError(validationError);
      return;
    }
    const sanitized = newConvPhone.replace(/[+\-\s()]/g, '');
    const digits = sanitized.replace(/\D/g, '');
    if (digits.length < 10) {
      setNewConvError('מספר טלפון קצר מדי (מינימום 10 ספרות)');
      return;
    }
    const exists = contacts.some(c => c.phone.replace(/[+\-\s()]/g, '') === sanitized);
    if (exists) {
      setNewConvError('איש קשר קיים במערכת');
      return;
    }
    setNewConvLoading(true);
    setNewConvError(null);
    try {
      const r = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: sanitized })
      });
      if (r.ok) {
        setShowNewConvModal(false);
        setSelectedPhone(sanitized);
        fetchContacts();
      } else {
        const data = await r.json().catch(() => ({}));
        setNewConvError(data.message || 'שגיאה ביצירת איש קשר');
      }
    } catch (e) {
      setNewConvError('שגיאת רשת');
    } finally {
      setNewConvLoading(false);
    }
  };

  // ── Assign reps handlers ──────────────────────────────────────────────────

  const openAssignModal = async (phone: string) => {
    const contact = contacts.find(c => c.phone === phone);
    setAssignModalPhone(phone);
    setAssignCurrentReps(contact?.assigned_to || []);
    setAssignNewRepId('');
    try {
      const r = await fetch(`${API_BASE}/sub-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const data: { id: string; name: string; role: string }[] = await r.json();
        setSubUsers(data.filter(u => u.role === 'rep').map(u => ({ id: u.id, name: u.name })));
      }
    } catch (e) {
      console.error('Failed to load sub-users', e);
      setSubUsers([]);
    }
    setShowAssignModal(true);
  };

  const handleAssignRep = async (repId: string, action: 'assign' | 'unassign') => {
    if (!assignModalPhone || assignLoading) return;
    setAssignLoading(true);
    try {
      const r = await fetch(`${API_BASE}/contacts/assign-rep`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: assignModalPhone, rep_id: repId, action })
      });
      if (r.ok) {
        if (action === 'assign') {
          setAssignCurrentReps(prev => [...prev, repId]);
        } else {
          setAssignCurrentReps(prev => prev.filter(id => id !== repId));
        }
        setAssignNewRepId('');
      }
    } catch (e) {
      console.error('Failed to assign rep', e);
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Agent mode handlers ───────────────────────────────────────────────────

  const handleOpenAgentConfirm = () => {
    if (phoneSessions.length > 0) {
      setAgentSessionId(phoneSessions[phoneSessions.length - 1].id);
    }
    setShowAgentConfirm(true);
  };

  const activateAgent = async () => {
    const sid = agentSessionId || (phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null);
    if (!sid) return;
    
    const messageToSend = agentMessage.trim();
    const capturedFile = attachedFile;
    
    try {
      const r = await fetch(`${API_BASE}/sessions/${sid}/set-agent`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json();
        setIsAgentMode(true);
        setAgentSessionId(sid);
        setShowAgentConfirm(false);
        const newStatus: ConvStatus = data.status || 'waiting';
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1 ? { ...s, is_agent: true, agent_since: data.agent_since, status: newStatus } : s
        ));
        setContacts(prev => prev.map(c =>
          c.phone === selectedPhone ? { ...c, status: newStatus } : c
        ));
        
        // אם יש הודעה שנכתבה, שלח אותה מיד
        if (messageToSend || capturedFile) {
          const created = new Date().toISOString();
          setAgentSending(true);
          setAgentWaFailed(false);
          
          const isTemplate = messageToSend.startsWith('/') && selectedTemplate;
          let requestBody: any = { message: messageToSend };
          
          if (isTemplate) {
            requestBody.isTemplate = true;
            requestBody.templateData = {
              id: selectedTemplate.id,
              name: selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name,
              language: selectedTemplate.language || 'he',
              components: selectedTemplate.components || [],
              params: templateParams
            };
          } else if (capturedFile) {
            requestBody.mediaType = capturedFile.type;
            requestBody.mediaUrl = capturedFile.url;
            requestBody.mediaFilename = capturedFile.name;
          }
          
          try {
            const msgResponse = await fetch(`${API_BASE}/sessions/${sid}/send-agent-message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(requestBody)
            });
            
            if (msgResponse.ok) {
              const msgData = await msgResponse.json();
              setAgentMessage('');
              setAttachedFile(null);
              setSelectedTemplate(null);
              setTemplateParams({});
              const replyStatus: ConvStatus = msgData.status || (isTemplate ? 'waiting' : 'handling');
              const fallbackEntry = capturedFile
                ? { type: capturedFile.type === 'image' ? 'Image' : capturedFile.type === 'video' ? 'Video' : 'Document', url: capturedFile.url, text: messageToSend, sender: 'agent', name: 'נציג', created, wa_sent: msgData.waSent }
                : { type: 'Text', text: messageToSend, sender: 'agent', name: 'נציג', created, wa_sent: msgData.waSent };
              setPhoneSessions(prev => prev.map((s, i) =>
                i === prev.length - 1
                  ? { ...s, status: replyStatus, process_history: [...s.process_history, msgData.historyEntry || fallbackEntry] }
                  : s
              ));
              setContacts(prev => prev.map(c =>
                c.phone === selectedPhone ? { ...c, status: replyStatus } : c
              ));
              if (!msgData.waSent) {
                setAgentWaFailed(true);
                setAgentWaError(msgData.waError || null);
                setAgentWaRetryable(msgData.waRetryable === true);
                setTimeout(() => { setAgentWaFailed(false); setAgentWaError(null); setAgentWaRetryable(false); }, 12000);
              }
            }
          } catch (msgError) {
            console.error('Failed to send message after activating agent', msgError);
          } finally {
            setAgentSending(false);
          }
        }
      }
    } catch (e) {
      console.error('Failed to set agent mode', e);
    }
  };

  const deactivateAgent = async () => {
    if (!agentSessionId) return;
    try {
      const r = await fetch(`${API_BASE}/sessions/${agentSessionId}/clear-agent`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        setIsAgentMode(false);
        setAgentSessionId(null);
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1 ? { ...s, is_agent: false, agent_since: null, status: 'bot' } : s
        ));
        setContacts(prev => prev.map(c =>
          c.phone === selectedPhone ? { ...c, status: 'bot' } : c
        ));
      }
    } catch (e) {
      console.error('Failed to clear agent mode', e);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce per-type size limits (WhatsApp API constraints)
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const MB = 1024 * 1024;
    const MAX_IMAGE = 5 * MB;   // WhatsApp: 5MB
    const MAX_VIDEO = 16 * MB;  // WhatsApp: 16MB
    const MAX_DOC   = 50 * MB;  // server limit

    if (isImage && file.size > MAX_IMAGE) {
      setFileUploadError(`תמונות מוגבלות ל-5MB (הקובץ: ${(file.size / MB).toFixed(1)}MB)`);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
      return;
    }
    if (isVideo && file.size > MAX_VIDEO) {
      setFileUploadError(`סרטונים מוגבלים ל-16MB בגלל הגבלת WhatsApp (הקובץ: ${(file.size / MB).toFixed(1)}MB). נסה לדחוס את הסרטון או שלח קישור.`);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
      return;
    }
    if (!isImage && !isVideo && file.size > MAX_DOC) {
      setFileUploadError(`קבצים מוגבלים ל-50MB (הקובץ: ${(file.size / MB).toFixed(1)}MB)`);
      if (fileUploadRef.current) fileUploadRef.current.value = '';
      return;
    }

    setFileUploadError(null);
    setFileUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        let fileType: 'image' | 'video' | 'document' = 'document';
        if (isImage) fileType = 'image';
        else if (isVideo) fileType = 'video';
        setAttachedFile({ type: fileType, url: data.url, name: file.name });
      } else {
        const err = await res.json().catch(() => ({}));
        setFileUploadError(err.error || `שגיאה בהעלאה (${res.status})`);
      }
    } catch (err) {
      setFileUploadError('שגיאת רשת — לא ניתן להעלות את הקובץ');
      console.error('Upload failed', err);
    } finally {
      setFileUploading(false);
    }
    // Reset input so same file can be re-selected
    if (fileUploadRef.current) fileUploadRef.current.value = '';
  };

  const sendAgentMsg = async () => {
    if (!agentMessage.trim() && !attachedFile || agentSending) return;

    // לקוח חדש ללא שיחות — שלח תבנית ישירות לטלפון (ללא session)
    if (phoneSessions.length === 0) {
      // ── הגבלת תבנית בלבד ללקוח חדש — מבוטל זמנית (ניתן להחזיר ע"י ביטול ההערה) ──
      // if (!selectedTemplate) return;
      if (!selectedTemplate) return; // משאיר כברירת מחדל כי backend תומך רק ב-template-to-phone לסשן חדש
      const msgText = agentMessage.trim();
      setAgentSending(true);
      setAgentWaFailed(false);
      try {
        const r = await fetch(`${API_BASE}/sessions/send-template-to-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            phone: selectedPhone,
            message: msgText,
            templateData: {
              id: selectedTemplate.id,
              name: selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name,
              language: selectedTemplate.language || 'he',
              components: selectedTemplate.components || [],
              params: templateParams
            }
          })
        });
        if (r.ok) {
          const data = await r.json();
          setAgentMessage('');
          setSelectedTemplate(null);
          setTemplateParams({});
          if (data.waSent) {
            // Build session object locally from response — avoids phone normalisation mismatch
            const newSession = {
              id: data.sessionId,
              phone: data.phone || selectedPhone,
              sender: data.phone || selectedPhone,
              customer_phone: data.phone || selectedPhone,
              widget_id: null,
              bot_name: 'נציג',
              created_at: data.created,
              parameters: {},
              process_history: [data.historyEntry],
              is_agent: true,
              agent_since: data.created
            };
            setPhoneSessions([newSession]);
            setAgentSessionId(data.sessionId || null);
            setIsAgentMode(true);
            fetchContacts();
          } else {
            setAgentWaFailed(true);
            setAgentWaError(data.waError || null);
            setAgentWaRetryable(data.waRetryable === true);
            setTimeout(() => { setAgentWaFailed(false); setAgentWaError(null); setAgentWaRetryable(false); }, 12000);
          }
        }
      } catch (e) {
        console.error('Failed to send template to new contact', e);
      } finally {
        setAgentSending(false);
      }
      return;
    }

    // אם לא במצב נציג, הצג דיאלוג אישור
    if (!isAgentMode) {
      if (phoneSessions.length > 0) {
        setAgentSessionId(phoneSessions[phoneSessions.length - 1].id);
      }
      setShowAgentConfirm(true);
      return;
    }
    
    // אם אין agentSessionId, נסה לקחת מהסשן האחרון
    const sessionId = agentSessionId || (phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null);
    if (!sessionId) return;
    
    const msgText = agentMessage.trim();
    const currentAttachedFile = attachedFile;
    const created = new Date().toISOString();
    setAgentSending(true);
    setAgentWaFailed(false);
    
    // Check if it's a template message (starts with /)
    const isTemplate = msgText.startsWith('/') && selectedTemplate;
    let requestBody: any = { message: msgText };
    
    if (isTemplate) {
      // Build template data with user parameters
      requestBody.isTemplate = true;
      requestBody.templateData = {
        id: selectedTemplate.id,
        name: selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name,
        language: selectedTemplate.language || 'he',
        components: selectedTemplate.components || [],
        params: templateParams // Add user-provided parameters
      };
      console.log('[SessionsPage] Sending template:', requestBody.templateData);
    } else if (currentAttachedFile) {
      requestBody.mediaType = currentAttachedFile.type;
      requestBody.mediaUrl = currentAttachedFile.url;
      requestBody.mediaFilename = currentAttachedFile.name;
    }
    
    try {
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/send-agent-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody)
      });
      if (r.ok) {
        const data = await r.json();
        console.log('[SessionsPage] Response from server:', data);
        console.log('[SessionsPage] History entry:', data.historyEntry);
        setAgentMessage('');
        setAttachedFile(null);
        setSelectedTemplate(null);
        setTemplateParams({});
        const replyStatus: ConvStatus = data.status || (isTemplate ? (currentStatus === 'bot' ? 'waiting' : currentStatus) : 'handling');
        const fallbackEntry = currentAttachedFile
          ? { type: currentAttachedFile.type === 'image' ? 'Image' : currentAttachedFile.type === 'video' ? 'Video' : 'Document', url: currentAttachedFile.url, text: msgText, sender: 'agent', name: 'נציג', created, wa_sent: data.waSent }
          : { type: 'Text', text: msgText, sender: 'agent', name: 'נציג', created, wa_sent: data.waSent };
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1
            ? { ...s, status: replyStatus, process_history: [...s.process_history, data.historyEntry || fallbackEntry] }
            : s
        ));
        setContacts(prev => prev.map(c =>
          c.phone === selectedPhone ? { ...c, status: replyStatus } : c
        ));
        if (!data.waSent) {
          setAgentWaFailed(true);
          setAgentWaError(data.waError || null);
          setAgentWaRetryable(data.waRetryable === true);
          setTimeout(() => { setAgentWaFailed(false); setAgentWaError(null); setAgentWaRetryable(false); }, 12000);
        }
      }
    } catch (e) {
      console.error('Failed to send agent message', e);
    } finally {
      setAgentSending(false);
    }
  };

  // Fetch templates from Dialog360
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('[SessionsPage] Failed to fetch templates');
        setTemplates([]);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.templates) {
        const templateList = Array.isArray(data.templates) ? data.templates : 
                           (data.templates.data ? data.templates.data : 
                           (data.templates.waba_templates ? data.templates.waba_templates : []));
        setTemplates(templateList);
        
        // Fetch showInChat settings
        fetchTemplateSettings();
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error('[SessionsPage] Error fetching templates:', err);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  // Fetch template settings (showInChat)
  const fetchTemplateSettings = async () => {
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
        setTemplateSettings(settingsMap);
      }
    } catch (err) {
      console.error('Error fetching template settings:', err);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    const templateName = template.name || template.elementName || template.template_name || '';
    setAgentMessage(`/${templateName}`);
    setSelectedTemplate(template);
    setShowTemplates(false);
    
    // Check if template needs parameters
    const needsParams = checkTemplateNeedsParams(template);
    if (needsParams) {
      // Initialize params structure
      const initialParams: Record<string, any> = {};
      if (template.components && Array.isArray(template.components)) {
        template.components.forEach((comp: any) => {
          if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
            // Pre-fill with the template's example image so it's sent automatically if the user doesn't upload a new one
            const exampleUrl: string =
              comp.example?.header_url?.[0] ||
              comp.example?.header_url ||
              (Array.isArray(comp.example?.header_handle) ? comp.example.header_handle[0] : undefined) ||
              comp.example?.header_handle ||
              '';
            initialParams.header = { type: comp.format.toLowerCase(), url: exampleUrl };
          }
          if (comp.type === 'BODY' && comp.text) {
            // Extract {{1}}, {{2}} etc from body text
            const matches = comp.text.match(/\{\{\d+\}\}/g);
            if (matches) {
              initialParams.body = matches.map((m: string) => '');
            }
          }
        });
      }
      setTemplateParams(initialParams);
      setShowTemplateParamsModal(true);
      // Fetch full contact record so we can resolve contact-field values
      if (selectedPhone && token) {
        fetch(`${API_BASE}/contacts?search=${encodeURIComponent(selectedPhone)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const rec = data?.contacts?.[0] ?? null;
            setContactRecord(rec);
          })
          .catch(() => setContactRecord(null));
      }
    }
  };
  
  // Check if template needs parameters
  const checkTemplateNeedsParams = (template: any): boolean => {
    if (!template.components || !Array.isArray(template.components)) return false;
    
    for (const comp of template.components) {
      // Header with media
      if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
        return true;
      }
      // Body with variables {{1}}, {{2}}
      if (comp.type === 'BODY' && comp.text && /\{\{\d+\}\}/.test(comp.text)) {
        return true;
      }
    }
    return false;
  };
  
  // Confirm and send template with parameters
  const confirmTemplateParams = () => {
    setShowTemplateParamsModal(false);
    // Send immediately after confirming parameters
    setTimeout(() => sendAgentMsg(), 0);
  };

  // ─────────────────────────────────────────────────────────────────────────

  const can = usePermission(currentUser as any);
  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  // ── Availability badge (reps / rep_managers) ────────────────────────────
  const AVAILABILITY_OPTIONS: { value: 'available' | 'unavailable' | 'on_break'; label: string; dot: string; text: string; bg: string }[] = [
    { value: 'available',   label: 'זמין',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    { value: 'on_break',    label: 'בהפסקה',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
    { value: 'unavailable', label: 'לא זמין', dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100' },
  ];
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const availabilityWrapperRef = useRef<HTMLDivElement>(null);
  const currentAvailability = AVAILABILITY_OPTIONS.find(o => o.value === (currentUser?.availability_status || 'available')) || AVAILABILITY_OPTIONS[0];
  const showAvailability = (currentUser?.role === 'rep' || currentUser?.role === 'rep_manager') && !!onUpdateAvailability;

  useEffect(() => {
    if (!availabilityOpen) return;
    const handler = (e: MouseEvent) => {
      if (availabilityWrapperRef.current && !availabilityWrapperRef.current.contains(e.target as Node)) setAvailabilityOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [availabilityOpen]);

  useEffect(() => {
    if (!showActionsMenu) return;
    const handler = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) setShowActionsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActionsMenu]);

  const addContactToBlocklist = async () => {
    if (!selectedPhone || addingToBlocklist) return;
    setShowActionsMenu(false);
    setAddingToBlocklist(true);
    try {
      const groupsRes = await fetch(`${API_BASE}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!groupsRes.ok) throw new Error('שגיאה בטעינת הקבוצות');
      const groupsData = await groupsRes.json();
      const blocklist = (groupsData.groups || []).find((g: any) => g.is_blocklist);
      if (!blocklist) throw new Error('לא נמצאה רשימת הסרה במערכת');
      const addRes = await fetch(`${API_BASE}/groups/${blocklist._id}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: [selectedPhone] })
      });
      if (!addRes.ok) {
        const err = await addRes.json().catch(() => ({}));
        throw new Error(err.error || 'שגיאה בהוספה לרשימת הסרה');
      }
      setBlocklistSuccess(true);
      setTimeout(() => setBlocklistSuccess(false), 4000);
    } catch (e: any) {
      console.error('Failed to add to blocklist', e);
      alert(e.message || 'שגיאה בהוספה לרשימת הסרה');
    } finally {
      setAddingToBlocklist(false);
    }
  };

  const handleAvailabilitySelect = async (s: 'available' | 'unavailable' | 'on_break') => {
    if (!onUpdateAvailability) return;
    if (s === (currentUser?.availability_status || 'available')) { setAvailabilityOpen(false); return; }
    setAvailabilitySaving(true);
    try {
      await onUpdateAvailability(s);
    } finally {
      setAvailabilitySaving(false);
      setAvailabilityOpen(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState<ConvStatus | 'all'>('all');

  const filteredContacts = contacts.filter(c => {
    if (!c.phone.toLowerCase().includes(contactSearch.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (activeBotFilter) {
      // Match by bot flow id (widget-based sessions)
      if (c.bots.some(b => b.id === activeBotFilter.id)) return true;
      // Match by customer_phone (direct WhatsApp sessions without widget)
      const filterDigits = (activeBotFilter.display_phone_number || '').replace(/\D/g, '');
      if (filterDigits && c.botPhones?.some(p => p.replace(/\D/g, '') === filterDigits)) return true;
      return false;
    }
    return true;
  });

  const selectedContact = contacts.find(c => c.phone === selectedPhone) ?? null;

  /* ─── resend a failed agent message ─── */
  const resendMessage = async (sessionId: string, item: any) => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/send-agent-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: item.text || item.content || '' })
      });
      if (r.ok) {
        const data = await r.json();
        setPhoneSessions(prev => prev.map(s =>
          s.id !== sessionId ? s : {
            ...s,
            process_history: s.process_history.map(h =>
              h.created === item.created && h.sender === 'agent'
                ? { ...h, wa_sent: data.waSent, wa_error: data.waError || null }
                : h
            )
          }
        ));
      }
    } catch (e) {
      console.error('Failed to resend message', e);
    }
  };

  /* ─── render messages for one session ─── */
  const renderSessionMessages = (session: Session) => {
    if (!session.process_history.length) return null;

    const sortedHistory = [...session.process_history].sort((a, b) => {
      if (!a.created) return -1;
      if (!b.created) return 1;
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });

    const grouped: any[] = [];
    let hi = 0;
    while (hi < sortedHistory.length) {
      const cur = sortedHistory[hi];
      if (cur.type === 'waitingwebservice') { hi++; continue; }
      if (cur.type === 'SendItem') {
        const cards: any[] = [];
        const created = cur.created;
        while (hi < sortedHistory.length && sortedHistory[hi].type === 'SendItem') {
          cards.push(sortedHistory[hi]); hi++;
        }
        grouped.push({ type: '_carousel', carouselItems: cards, created });
      } else {
        grouped.push(cur); hi++;
      }
    }

    const renderTextWithLinks = (str: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = str.split(urlRegex);
      return parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="underline text-sky-600 hover:text-sky-800 break-all">
            {part}
          </a>
        ) : part
      );
    };

    return grouped.map((item: any, idx: number) => {
      const senderType: 'bot' | 'user' | 'agent' | 'system' =
        item.sender === 'system' || item.type === 'System' ? 'system'
        : item.sender === 'agent' ? 'agent'
        : item.sender === 'user' ? 'user'
        : item.type === 'UserInput' ? 'user'
        : item.sender === 'bot' ? 'bot'
        : 'bot';
      const isBot = senderType === 'bot';
      const isAgent = senderType === 'agent';
      const isSystem = senderType === 'system';
      const text = item.text ?? item.content ?? '';
      const msgDate = item.created ? formatMessageDate(item.created) : '';
      const isAudioUrl = /^https?:\/\/.+\.(oga|ogg|mp3|wav|m4a|aac|opus)(\?.*)?$/i.test(item.url || text);

      // System message — centered divider (e.g. "השיחה הסתיימה", "השיחה הועברה לנציג")
      if (isSystem) {
        const isClosed = item.event === 'conversation_closed' || /הסתיימה/.test(text);
        return (
          <div key={`${session.id}-${idx}`} className="flex w-full justify-center py-1">
            <div className={`flex items-center gap-2 px-3 py-0.5 rounded-full border text-[11px] font-black
              ${isClosed
                ? 'bg-slate-100 border-slate-300 text-slate-600'
                : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              {isClosed && <X size={12} />}
              <span>{text || 'הודעת מערכת'}</span>
              {msgDate && <span className="text-slate-400 font-semibold">· {msgDate}</span>}
            </div>
          </div>
        );
      }

      // Agent message — purple bubble on left side
      if (isAgent) {
        return (
          <div key={`${session.id}-${idx}`} className="flex w-full justify-start">
            <div className="flex gap-1.5 max-w-[88%] flex-row-reverse">
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm bg-purple-100 border border-purple-200 text-purple-700">
                  <Headphones size={12} />
                </div>
                {msgDate && <span className="text-[9px] text-slate-400 font-semibold">{msgDate}</span>}
              </div>
              <div className="flex flex-col gap-0.5 items-end">
                <div className="px-3 py-1.5 rounded-2xl text-sm font-semibold shadow-sm text-right bg-purple-50 border border-purple-200 text-purple-900 rounded-tr-none">
                  <p className="text-[9px] text-purple-400 font-black mb-0.5 uppercase tracking-widest">נציג</p>
                  {item.type === 'Image' && item.url && (
                    <img src={item.url} alt="תמונה" className="rounded-xl max-w-[200px] h-auto mb-2" />
                  )} 
                  {item.type === 'Video' && item.url && (
                    <video src={item.url} controls className="rounded-xl max-w-[200px] mb-2" />
                  )}
                  {item.type === 'Document' && item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors text-purple-700 text-xs font-bold mb-2">
                      <ExternalLink size={13} /> פתח מסמך
                    </a>
                  )}
                  {text && <p className="whitespace-pre-wrap leading-snug">{renderTextWithLinks(text)}</p>}
                  {Array.isArray(item.template_buttons) && item.template_buttons.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-purple-200">
                      {item.template_buttons.map((btn: any, bi: number) =>
                        btn.type === 'URL' && btn.url ? (
                          <a key={bi} href={btn.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-center text-xs font-bold rounded-xl border border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors">
                            <ExternalLink size={11} />{btn.text}
                          </a>
                        ) : btn.type === 'PHONE_NUMBER' && btn.phone_number ? (
                          <a key={bi} href={`tel:${btn.phone_number}`}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-center text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                            <Phone size={11} />{btn.text}
                          </a>
                        ) : (
                          <div key={bi} className="px-3 py-1.5 text-center text-xs font-bold rounded-xl border border-purple-300 bg-white text-purple-600 cursor-default select-none">
                            {btn.text}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
                {item.wa_sent === false && (
                  <div className="flex items-center gap-1.5 px-1 flex-wrap" dir="rtl">
                    <span className="text-[9px] text-red-500 font-black">⚠️ לא נשלח ללקוח</span>
                    {item.wa_error && (
                      <span className="text-[9px] text-red-400">
                        ({item.wa_error.length > 50 ? item.wa_error.slice(0, 50) + '…' : item.wa_error})
                      </span>
                    )}
                    <button
                      onClick={() => resendMessage(session.id, item)}
                      className="flex items-center gap-0.5 text-[9px] text-blue-500 hover:text-blue-700 font-black border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors"
                      title="שלח מחדש"
                    >
                      <RefreshCw size={9} />
                      שלח מחדש
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div
          key={`${session.id}-${idx}`}
          className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}
        >
          <div className={`flex gap-1.5 max-w-[88%] ${isBot ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-sm
                ${isBot ? 'bg-white border border-slate-100 text-slate-700' : 'bg-sky-500 text-white'}`}>
                {isBot ? <Bot size={12} /> : <User size={12} />}
              </div>
              {msgDate && <span className="text-[9px] text-slate-400 font-semibold">{msgDate}</span>}
            </div>
            <div className={`flex flex-col gap-0.5 ${isBot ? 'items-end' : 'items-start'}`}>
              <div className={`px-3 py-1.5 rounded-2xl text-sm font-semibold shadow-sm text-right
                ${isBot
                  ? 'bg-white border border-slate-100 text-slate-900 rounded-tr-none'
                  : 'bg-sky-500 text-white rounded-tl-none'}`}
              >
                {(item.type === 'Text' || item.type === 'UserInput' || !item.type || item.type.startsWith('input_')) && text && !isAudioUrl && (
                  <p className="whitespace-pre-wrap leading-snug">{renderTextWithLinks(text)}</p>
                )}
                {(item.type === 'Audio' || isAudioUrl) && (item.url || text) && (
                  <>
                    <p className="text-[10px] font-semibold mb-1 opacity-70">🎙️ הקלטה</p>
                    <audio src={item.url || text} controls className="max-w-[220px] mb-1" />
                  </>
                )}
                {item.type === 'Image' && item.url && (
                  <>
                    <img src={item.url} alt="תמונה" className="rounded-xl max-w-[200px] h-auto mb-1" />
                    {text && <p className="whitespace-pre-wrap leading-snug">{renderTextWithLinks(text)}</p>}
                  </>
                )}
                {item.type === 'Video' && item.url && (
                  <>
                    <video src={item.url} controls className="rounded-xl max-w-[200px] mb-1" />
                    {text && <p className="whitespace-pre-wrap leading-snug">{renderTextWithLinks(text)}</p>}
                  </>
                )}
                {item.type === 'Document' && item.url && (
                  <>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-sky-600 text-xs font-bold mb-2">
                      <ExternalLink size={13} /> פתח מסמך
                    </a>
                    {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                  </>
                )}
                {item.type === 'URL' && (
                  <div>
                    {text && <p className="mb-1">{text}</p>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs underline opacity-80 flex items-center gap-1 break-all">
                        {item.url} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
                {item.type === 'Options' && (
                  <div>
                    {text && <p className="mb-1 text-slate-400 text-[10px] uppercase tracking-widest font-black">{text}</p>}
                    {Array.isArray(item.options) && (
                      <div className="flex flex-col gap-1 mt-0.5">
                        {item.options
                          .map((o: any) => (typeof o === 'object' && o !== null) ? (o.label ?? o.value ?? o.text ?? '') : String(o))
                          .filter((o: string) => o !== 'default' && o !== '')
                          .map((opt: string, i: number) => (
                            <div key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">{opt}</div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                {item.type === '_carousel' && Array.isArray(item.carouselItems) && (
                  <div className="flex gap-2 overflow-x-auto pb-1 max-w-[320px]">
                    {item.carouselItems.map((card: any, ci: number) => (
                      <div key={ci} className="flex-shrink-0 w-40 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {card.image && <img src={card.image} alt={card.title || ''} className="w-full h-24 object-cover" />}
                        <div className="p-2.5">
                          {card.title && <p className="text-xs font-black text-slate-800 leading-tight">{card.title}</p>}
                          {card.subtitle && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{card.subtitle}</p>}
                          {card.url && (
                            <a href={card.url} target="_blank" rel="noopener noreferrer"
                              className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-600 font-bold hover:underline">
                              <ExternalLink size={9} /> פתח
                            </a>
                          )}
                          {Array.isArray(card.options) && card.options.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {card.options.map((opt: any, oi: number) => (
                                <div key={oi} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-700 text-center">
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
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden" dir="rtl">
      {/* Impersonation Banner */}
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
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
          )}
          {showAvailability && (
            <div ref={availabilityWrapperRef} className="relative" dir="rtl">
              <button
                type="button"
                onClick={() => setAvailabilityOpen(v => !v)}
                disabled={availabilitySaving}
                title="שינוי סטטוס זמינות"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 ${currentAvailability.bg} ${currentAvailability.text} hover:shadow-sm transition-all disabled:opacity-60`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  {currentAvailability.value === 'available' && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${currentAvailability.dot}`}></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${currentAvailability.dot}`}></span>
                </span>
                <span>{currentAvailability.label}</span>
              </button>
              {availabilityOpen && (
                <div className="absolute mt-2 left-0 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                  {AVAILABILITY_OPTIONS.map(opt => {
                    const isActive = opt.value === (currentUser?.availability_status || 'available');
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAvailabilitySelect(opt.value)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-right hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50' : ''}`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${opt.dot}`}></span>
                        <span className="flex-1 text-slate-700">{opt.label}</span>
                        {isActive && <Check size={14} className="text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {currentUser?.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
            >
              <Shield size={18} />
              פאנל ניהול
            </button>
          )}
          <div className="relative">
            <div
              title={currentUser?.name || currentUser?.email || ''}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none cursor-pointer hover:scale-105 transition-transform"
              onClick={onBack}
            >
              {firstName}
            </div>
            {showAvailability && (
              <span
                title={currentAvailability.label}
                className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full ring-2 ring-white ${currentAvailability.dot}`}
              />
            )}
          </div>
        </div>
      </nav>

      {/* ── Bot Picker ─────────────────────────────────────────────────────── */}
      {showBotPicker ? (
        <div className="flex-1 flex overflow-hidden">
          {currentUser?.role !== 'rep' && (
            <AppNav
              mode="sidebar"
              activePage="sessions"
              onGoHome={onGoHome}
              onBots={onBack && can('bots.view_tab') ? onBack : undefined}
              onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
              onGroups={onOpenGroups}
              onSettings={onOpenSettings}
              onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
            />
          )}
          <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                <MessageSquare size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">שיחות</h1>
                <p className="text-slate-400 text-sm font-semibold mt-0.5">בחר מספר מחובר לצפייה בשיחות</p>
              </div>
            </div>

            {botsLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {/* All bots card */}
                <button
                  onClick={() => { setActiveBotFilter(null); setShowBotPicker(false); }}
                  className="group bg-white border-2 border-slate-200 hover:border-sky-400 rounded-3xl p-6 flex flex-col items-center gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-sky-50 flex items-center justify-center transition-colors">
                    <Users size={28} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800 group-hover:text-sky-700 transition-colors">הכל</p>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">כל השיחות</p>
                  </div>
                </button>

                {/* Per-bot cards — only bots with a connected phone number */}
                {botList.filter(bot => bot.display_phone_number && bot.display_phone_number.trim()).map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => { setActiveBotFilter(bot); setShowBotPicker(false); }}
                    className="group bg-white border-2 border-slate-200 hover:border-indigo-400 rounded-3xl p-6 flex flex-col items-center gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                      <Phone size={26} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div>
                      <p className="text-base font-black text-indigo-700 group-hover:text-indigo-800 transition-colors leading-tight">
                        {bot.display_phone_number}
                      </p>
                      <p className="text-xs text-slate-400 font-semibold mt-1 truncate max-w-[9rem]">{bot.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {currentUser?.role !== 'rep' && (
          <AppNav
            mode="sidebar"
            activePage="sessions"
            onGoHome={onGoHome}
            onBots={onBack && can('bots.view_tab') ? onBack : undefined}
            onSessions={botList.length > 1 ? () => { setActiveBotFilter(null); setSelectedPhone(null); setShowBotPicker(true); } : undefined}
            onContacts={onOpenContacts ? () => onOpenContacts() : undefined}
            onGroups={onOpenGroups}
            onSettings={onOpenSettings}
            onUsers={onOpenSubUsers && can('users.view') ? onOpenSubUsers : undefined}
          />
        )}

        {/* ── Contacts panel (right side in RTL, ~25%) ── */}
        <div className="w-[25%] flex-shrink-0 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100">
            {/* Bot filter breadcrumb — only shown when there are multiple bots */}
            {activeBotFilter && botList.length > 1 && (
              <button
                onClick={() => { setActiveBotFilter(null); setShowBotPicker(true); setSelectedPhone(null); }}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 mb-3 transition-colors"
              >
                <ChevronRight size={14} />
                <span className="truncate">{activeBotFilter.display_phone_number || activeBotFilter.name}</span>
              </button>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center cursor-pointer" onClick={() => botList.length > 1 && setShowBotPicker(true)} title={botList.length > 1 ? 'חזור לבחירת בוט' : undefined}>
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {activeBotFilter ? (activeBotFilter.display_phone_number || activeBotFilter.name) : 'שיחות'}
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold">{filteredContacts.length} קשרים</p>
                </div>
              </div>
              {can('sessions.add') && (
              <button
                onClick={() => { setShowNewConvModal(true); setNewConvPhone(''); setNewConvError(null); }}
                title="שיחה חדשה"
                className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 transition-colors flex-shrink-0"
              >
                <Plus size={16} />
              </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
              <input
                className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all text-right font-medium"
                placeholder="חיפוש איש קשר..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
              />
            </div>
            {/* Status filter pills */}
            <div className="flex gap-1 mt-2 flex-wrap">
              {(['all', 'waiting', 'handling', 'resolved', 'bot', 'closed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-colors ${
                    statusFilter === s
                      ? s === 'all' ? 'bg-slate-700 text-white border-slate-700'
                        : s === 'waiting' ? 'bg-amber-500 text-white border-amber-500'
                        : s === 'handling' ? 'bg-purple-500 text-white border-purple-500'
                        : s === 'resolved' ? 'bg-emerald-500 text-white border-emerald-500'
                        : s === 'bot' ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-slate-500 text-white border-slate-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {s === 'all' ? 'הכל' : s === 'waiting' ? 'ממתין' : s === 'handling' ? 'בטיפול' : s === 'resolved' ? 'טופל' : s === 'bot' ? 'בוט' : 'סיום'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable contacts list */}
          <div className="flex-1 overflow-y-auto">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-7 h-7 border-2 border-slate-200 border-t-sky-500 rounded-full" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300 px-6 text-center">
                <Users size={36} strokeWidth={1} />
                <p className="text-sm font-bold">אין אנשי קשר</p>
              </div>
            ) : (
              filteredContacts.map(contact => {
                const sim = isSimulator(contact.phone);
                const isSelected = selectedPhone === contact.phone;
                return (
                  <button
                    key={contact.phone}
                    onClick={() => setSelectedPhone(contact.phone)}
                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-right transition-colors border-b border-slate-50 relative
                      ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                  >
                    {isSelected && (
                      <span className="absolute right-0 top-0 bottom-0 w-1 bg-sky-500 rounded-l-full" />
                    )}
                    <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-sm font-black
                      ${isSelected ? 'bg-sky-500 text-white' : sim ? 'bg-blue-50 text-blue-400' : 'bg-slate-100 text-slate-500'}`}>
                      {sim ? <MessageSquare size={16} /> : (contact.whatsapp_name || contact.full_name || contact.phone).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-black truncate flex items-center gap-1 ${isSelected ? 'text-sky-700' : 'text-slate-800'}`}>
                          {sim ? 'סימולטור' : contact.phone}
                          {!sim && !contact.full_name && contact.whatsapp_name && (
                            <span className={`text-sm font-semibold flex items-center gap-0.5 mr-1 ${isSelected ? 'text-sky-600' : 'text-slate-500'}`}>
                              · <WhatsAppIcon size={11} className="text-slate-400" /> {contact.whatsapp_name}
                            </span>
                          )}
                          {!sim && contact.full_name && (
                            <span className={`text-sm font-semibold flex items-center gap-0.5 mr-1 ${isSelected ? 'text-sky-600' : 'text-slate-500'}`}>
                              · {contact.full_name}
                            </span>
                          )}
                        </p>
                        {!sim && contact.full_name && contact.whatsapp_name && (
                          <p className="text-[10px] font-medium truncate text-slate-400 flex items-center gap-0.5">
                            <WhatsAppIcon size={10} className="text-slate-400 flex-shrink-0" /> {contact.whatsapp_name}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                            ${isSelected ? 'bg-sky-200 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                            {contact.sessionCount} שיחות
                          </span>
                          {!sim && renderStatusBadge(contact.status)}
                          {contact.wants_phone && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 ring-1 ring-green-400/60 animate-pulse">
                              <Phone size={9} />טלפוני
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {formatContactTime(contact.lastSeen)}
                        </span>
                        {!sim && onOpenContacts && (
                          <button
                            onClick={e => { e.stopPropagation(); onOpenContacts(contact.phone); }}
                            title="פתח פרטי איש קשר"
                            className="p-1 text-slate-300 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                          >
                            <User size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat history area (second child = left side in RTL, ~70%) ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <MessageSquare size={72} strokeWidth={0.7} className="text-slate-200" />
              <p className="text-xl font-black text-slate-300">בחר איש קשר לצפייה בשיחות</p>
              <p className="text-sm font-semibold text-slate-300">בחר איש קשר מהפאנל מימין</p>
            </div>
          ) : (
            <>
              {/* Contact header */}
              <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0
                  ${isSimulator(selectedPhone) ? 'bg-blue-50 text-blue-400' : 'bg-sky-50 text-sky-500'}`}>
                  {isSimulator(selectedPhone) ? <MessageSquare size={20} /> : <Phone size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                      {isSimulator(selectedPhone) ? 'סימולטור' : selectedPhone}
                      {!isSimulator(selectedPhone) && !selectedContact?.full_name && selectedContact?.whatsapp_name && (
                        <span className="flex items-center gap-0.5 text-sm font-semibold text-slate-500">
                          · <WhatsAppIcon size={13} className="text-slate-400" /> {selectedContact.whatsapp_name}
                        </span>
                      )}
                      {!isSimulator(selectedPhone) && selectedContact?.full_name && (
                        <span className="flex items-center gap-0.5 text-sm font-semibold text-slate-500">
                          · {selectedContact.full_name}
                        </span>
                      )}
                    </p>
                    {!isSimulator(selectedPhone) && onOpenContacts && (
                      <button
                        onClick={() => onOpenContacts(selectedPhone)}
                        title="פתח פרטי איש קשר"
                        className="p-1 text-slate-400 hover:text-sky-500 transition-colors rounded-lg hover:bg-sky-50"
                      >
                        <User size={14} />
                      </button>
                    )}
                  </div>
                  {!isSimulator(selectedPhone) && selectedContact?.full_name && selectedContact?.whatsapp_name && (
                    <p className="text-xs text-slate-400 font-semibold flex items-center gap-0.5 mt-0.5">
                      <WhatsAppIcon size={11} className="text-slate-400" /> {selectedContact.whatsapp_name}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {selectedContact?.sessionCount ?? 0} שיחות
                    {selectedContact?.bots && selectedContact.bots.length > 0 && (
                      <> · {selectedContact.bots.map(b => b.name).join(', ')}</>
                    )}
                  </p>
                </div>
                {/* Conversation status badge */}
                {!isSimulator(selectedPhone) && phoneSessions.length > 0 && (
                  <div className="flex-shrink-0">{renderStatusBadge(currentStatus)}</div>
                )}
                {/* Phone callback tag + handled button */}
                {selectedContact?.wants_phone && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-black ring-1 ring-green-400/50">
                      <Phone size={11} /> טלפוני
                    </span>
                    {(currentStatus === 'waiting' || currentStatus === 'handling' || currentStatus === 'resolved') && (
                      <button
                        onClick={async () => {
                          const sid = agentSessionId || (phoneSessions.length > 0 ? phoneSessions[phoneSessions.length - 1].id : null);
                          if (!sid) return;
                          try {
                            const r = await fetch(`${API_BASE}/sessions/${sid}/mark-resolved`, {
                              method: 'PATCH',
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (r.ok) {
                              setContacts(prev => prev.map(c =>
                                c.phone === selectedPhone ? { ...c, status: 'resolved' as const, wants_phone: false } : c
                              ));
                              setPhoneSessions(prev => prev.map((s, i) =>
                                i === prev.length - 1 ? { ...s, status: 'resolved' as const } : s
                              ));
                            }
                          } catch (e) { console.error(e); }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-600 text-white text-[11px] font-black hover:bg-green-700 transition-colors"
                        title="סמן שיחת טלפון כטופלה"
                      >
                        <Check size={11} /> טופל
                      </button>
                    )}
                  </div>
                )}
                {/* Actions dropdown — all conversation actions */}
                {phoneSessions.length > 0 && currentStatus !== 'closed' && (
                  <div className="relative flex-shrink-0" ref={actionsMenuRef}>
                    <button
                      onClick={() => setShowActionsMenu(v => !v)}
                      className="w-9 h-9 flex items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="פעולות שיחה"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {showActionsMenu && (
                      <div className="absolute top-full mt-1 left-0 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 min-w-[200px]">
                        {!isSimulator(selectedPhone!) && (currentStatus === 'bot' || currentStatus === 'waiting' || currentStatus === 'handling') && (
                          <button
                            onClick={() => { setShowActionsMenu(false); markResolved(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-right"
                            title="סמן כטופל — השיחה תיפתח מחדש אם הלקוח יכתוב"
                          >
                            <Check size={15} />
                            טופל
                          </button>
                        )}
                        {!isSimulator(selectedPhone!) && isAgentMode && (
                          <button
                            onClick={() => { setShowActionsMenu(false); deactivateAgent(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-right"
                          >
                            <RefreshCw size={15} />
                            החזרת השיחה לבוט
                          </button>
                        )}
                        {!isSimulator(selectedPhone!) && (currentStatus === 'waiting' || currentStatus === 'handling' || currentStatus === 'resolved') && (
                          <button
                            onClick={() => { setShowActionsMenu(false); closeConversation(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-800 transition-colors text-right"
                            title="סמן שיחה כסיומה"
                          >
                            <X size={15} />
                            סיום שיחה
                          </button>
                        )}
                        <button
                          onClick={() => { setShowActionsMenu(false); openTransferModal(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-right"
                        >
                          <Headphones size={15} />
                          העברת שיחה{isSimulator(selectedPhone!) ? ' (סימולטור)' : ''}
                        </button>
                        {!isSimulator(selectedPhone!) && (
                          <button
                            onClick={addContactToBlocklist}
                            disabled={addingToBlocklist}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors text-right disabled:opacity-60"
                          >
                            <Ban size={15} />
                            {addingToBlocklist ? 'מוסיף...' : 'הוספה לרשימת הסרה'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Blocklist success toast */}
                {blocklistSuccess && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex-shrink-0">
                    <Check size={13} /> נוסף לרשימת הסרה
                  </span>
                )}
                {/* {currentUser?.role !== 'rep' && !isSimulator(selectedPhone) && (
                  <button
                    onClick={() => openAssignModal(selectedPhone)}
                    title="שיוך נציגים"
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                  >
                    <Headphones size={18} />
                  </button>
                )} */}
                <button
                  onClick={() => setSelectedPhone(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Agent mode banner */}
              {isAgentMode && (
                <div className="flex-shrink-0 px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3" dir="rtl">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <p className="text-xs font-black text-amber-800 flex-1">
                    מצב נציג פעיל — הבוט מושהה. הודעות מהלקוח לא יקבלו מענה אוטומטי.
                  </p>
                  {phoneSessions.length > 0 && phoneSessions[phoneSessions.length - 1].agent_since && (
                    <span className="text-xs text-amber-600 font-semibold flex-shrink-0">
                      הופעל {formatContactTime(phoneSessions[phoneSessions.length - 1].agent_since!)}
                    </span>
                  )}
                </div>
              )}

              {/* WhatsApp send failure banner */}
              {agentWaFailed && (
                <div className="flex-shrink-0 px-6 py-2.5 bg-red-50 border-b border-red-200 flex items-center gap-3" dir="rtl">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-xs font-black text-red-700 flex-1">
                    ⚠️ ההודעה נשמרה בהיסטוריה אך <strong>לא נשלחה ללקוח</strong>
                    {agentWaRetryable
                      ? <span className="font-normal text-red-600"> — שגיאת שער (502): השרת עמוס זמנית. <span className="underline cursor-pointer" onClick={() => { setAgentWaFailed(false); setAgentWaError(null); setAgentWaRetryable(false); sendAgentMsg(); }}>נסה שוב</span></span>
                      : <span className="font-normal text-red-500 mr-1"> — {agentWaError ? (agentWaError.length > 100 ? agentWaError.slice(0, 100) + '…' : agentWaError) : 'בעיה ב-WhatsApp API'}</span>
                    }
                  </p>
                  <button onClick={() => { setAgentWaFailed(false); setAgentWaError(null); setAgentWaRetryable(false); }} className="text-red-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              )}
              {phoneSessionsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full" />
                </div>
              ) : phoneSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <MessageSquare size={48} strokeWidth={1} />
                  <p className="text-base font-bold">אין שיחות לאיש קשר זה</p>
                </div> 
              ) : ( 
                /* Sessions ordered oldest (top) → newest (bottom) */
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3" dir="rtl">
                  {phoneSessions.map(session => (
                    <React.Fragment key={session.id}>
                      {/* Thin divider with session date and bot name */}
                      <div className="flex items-center gap-3 py-1.5">
                        <hr className="flex-1 border-slate-200" />
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Clock size={10} className="text-slate-400" />
                          <span className="text-[10px] text-slate-400 font-bold">
                            {formatDate(session.created_at)}
                          </span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-black px-2 py-0.5 rounded-full">
                            {session.bot_name}
                          </span>
                        </div>
                        <hr className="flex-1 border-slate-200" />
                      </div>

                      {/* Messages for this session */}
                      <div className="space-y-1 mb-1">
                        {renderSessionMessages(session) ?? (
                          <p className="text-center text-xs text-slate-300 font-semibold py-2">אין הודעות בשיחה זו</p>
                        )}
                      </div>
                    </React.Fragment>
                  ))}
                  <div className="h-4" />
                </div>
              )}

              {/* Message input bar */}
              {!phoneSessionsLoading && (
                <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3" dir="rtl">
                  {/* {phoneSessions.length === 0 && (
                    <div className="flex items-center gap-2 mb-2 px-1 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold">
                      <span className="text-base">⚠️</span>
                      לקוח חדש — ניתן לשלוח הודעות תבנית בלבד. הקש <span className="font-black">/</span> לבחירת תבנית.
                    </div>
                  )} */}
                  <div className="flex items-center gap-3 relative">
                    {/* Template dropdown */}
                    {showTemplates && selectedPhone && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto z-50">
                        {templatesLoading ? (
                          <div className="p-4 text-center text-slate-400 text-sm">טוען טמפלייטים...</div>
                        ) : templates.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-sm">לא נמצאו טמפלייטים</div>
                        ) : (
                          <div className="p-2">
                            {(() => {
                              const role = currentUser?.role;
                              const isAgent = role === 'rep' || role === 'rep_bot';
                              // Visibility filter:
                              //   - 'rep' / 'rep_bot' agents see only templates explicitly marked 'agent'.
                              //   - All other roles (rep_manager, user, admin) see anything not 'hidden'.
                              const isVisibleForUser = (name: string): boolean => {
                                const vis = templateSettings[name] ?? 'manager';
                                if (vis === 'hidden') return false;
                                if (isAgent) return vis === 'agent';
                                return true;
                              };
                              const searchQuery = agentMessage.startsWith('/') ? agentMessage.slice(1).toLowerCase() : '';
                              const filtered = templates.filter(t => {
                                const name = t.name || t.elementName || t.template_name || '';
                                if (!isVisibleForUser(name)) return false;
                                if (searchQuery && !name.toLowerCase().includes(searchQuery)) return false;
                                return true;
                              });

                              return filtered.length > 0 ? (
                                filtered.map((template: any, idx: number) => {
                                  const name = template.name || template.elementName || template.template_name || 'ללא שם';
                                  const lang = template.language || 'he';
                                  const status = template.status || '';
                                  
                                  // Extract body text
                                  let bodyText = '';
                                  if (template.components && Array.isArray(template.components)) {
                                    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
                                    if (bodyComponent && bodyComponent.text) {
                                      bodyText = bodyComponent.text.substring(0, 60) + (bodyComponent.text.length > 60 ? '...' : '');
                                    }
                                  }

                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => handleTemplateSelect(template)}
                                      className="w-full text-right px-3 py-2 hover:bg-sky-50 rounded-lg transition-colors"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-800 text-sm">/{name}</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-slate-500">{lang}</span>
                                          {status === 'APPROVED' && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">מאושר</span>
                                          )}
                                        </div>
                                      </div>
                                      {bodyText && (
                                        <div className="text-xs text-slate-500">{bodyText}</div>
                                      )}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-4 text-center text-slate-400 text-sm">לא נמצאו תוצאות</div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={sendAgentMsg}
                      /* ── הגבלת "לקוח חדש = תבנית בלבד" מבוטלת זמנית ──
                         גרסה מקורית:
                         disabled={!agentMessage.trim() || agentSending || (phoneSessions.length === 0 && !selectedTemplate)}
                         className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors
                           ${agentMessage.trim() && !agentSending && !(phoneSessions.length === 0 && !selectedTemplate)
                             ? 'bg-sky-500 text-white hover:bg-sky-600 cursor-pointer'
                             : 'bg-sky-500 text-white opacity-40 cursor-not-allowed'}`}
                      */
                      disabled={(!agentMessage.trim() && !attachedFile) || agentSending}
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors self-end
                        ${(agentMessage.trim() || attachedFile) && !agentSending
                          ? 'bg-sky-500 text-white hover:bg-sky-600 cursor-pointer'
                          : 'bg-sky-500 text-white opacity-40 cursor-not-allowed'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => fileUploadRef.current?.click()}
                      title="צרף קובץ / תמונה / וידאו"
                      disabled={fileUploading}
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors cursor-pointer self-end
                        ${fileUploading ? 'text-sky-500 bg-sky-50 animate-pulse' : 'text-slate-400 hover:text-sky-500 hover:bg-slate-100'}`}
                    >
                      {fileUploading
                        ? <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                        : <Paperclip size={18} />
                      }
                    </button>
                    <input
                      ref={fileUploadRef}
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                      className="hidden"
                      onChange={handleFileAttach}
                    />
                    {/* Composite input: preview thumbnail top-right + text below, all inside one bordered box */}
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 transition-all">
                      {attachedFile && (
                        <div className="flex justify-start px-2 pt-2">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setAttachedFile(null)}
                              className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 bg-slate-600/80 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow"
                            >
                              <X size={9} />
                            </button>
                            {attachedFile.type === 'image' && (
                              <img src={attachedFile.url} alt="תצוגה מקדימה" className="block w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm" />
                            )}
                            {attachedFile.type === 'video' && (
                              <video src={attachedFile.url} className="block w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm" />
                            )}
                            {attachedFile.type === 'document' && (
                              <div className="w-16 h-16 bg-slate-100 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1">
                                <span className="text-2xl">📄</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center px-1">{attachedFile.name.split('.').pop()?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <input
                        type="text"
                        value={agentMessage}
                        onChange={e => {
                          const value = e.target.value;
                          setAgentMessage(value);
                          if (value === '/' || value.startsWith('/')) {
                            setShowTemplates(true);
                            if (value === '/') fetchTemplates();
                          } else {
                            setShowTemplates(false);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') sendAgentMsg(); }}
                        placeholder={attachedFile ? 'כיתוב (אופציונלי)...' : 'כתוב הודעה ללקוח... (/ לטמפלייטים)'}
                        className='w-full bg-transparent px-4 py-2.5 text-sm text-right font-medium outline-none text-slate-800 placeholder:text-slate-400'
                      />
                    </div>
                    {fileUploadError && (
                      <div className="absolute bottom-full right-0 left-0 mb-1 z-50 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm shadow-md">
                        <span className="text-red-600 font-medium flex-1">⚠️ {fileUploadError}</span>
                        <button onClick={() => setFileUploadError(null)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
      )}

      {/* New conversation modal */}
      {showNewConvModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center">
                  <Plus size={20} className="text-sky-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900">שיחה חדשה</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">הזן מספר טלפון ליצירת שיחה חדשה</p>
              <input
                type="tel"
                dir="ltr"
                placeholder="לדוגמה: 972501234567 או 0501234567"
                value={newConvPhone}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d+\-\s()]/g, '');
                  setNewConvPhone(val);
                  setNewConvError(val ? validatePhoneInput(val) : null);
                }}
                onKeyDown={e => e.key === 'Enter' && !newConvLoading && handleNewConvConfirm()}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 transition-all ${
                  newConvError && newConvPhone
                    ? 'border-red-400 focus:ring-red-500/20 focus:border-red-400'
                    : 'border-slate-200 focus:ring-sky-500/20 focus:border-sky-400'
                }`}
                autoFocus
              />
              {newConvError && (
                <p className="text-xs text-red-500 font-semibold mt-2">{newConvError}</p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowNewConvModal(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleNewConvConfirm}
                disabled={newConvLoading || (!!newConvPhone && !!validatePhoneInput(newConvPhone)) || newConvError === 'איש קשר קיים במערכת'}
                className="px-5 py-2.5 rounded-2xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {newConvLoading ? '...' : 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent confirmation dialog */}
      {showAgentConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <Headphones size={20} className="text-amber-600" />
                </div>
                <h3 className="text-lg font-black text-slate-900">שיחה עם נציג</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                לחיצה על אישור <strong>תשהה את תגובות הבוט ל-30 דקות</strong>.
                <br />תוכל לשוחח ישירות עם הלקוח דרך שדה ההודעות.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowAgentConfirm(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={activateAgent}
                className="px-5 py-2.5 rounded-2xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 transition-colors"
              >
                אישור — עבור למצב נציג
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template parameters modal */}
      {showTemplateParamsModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-slate-900">מילוי פרמטרים לטמפלייט</h3>
                <button
                  onClick={() => setShowTemplateParamsModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-600">
                {selectedTemplate.name || 'טמפלייט'}
              </p>
            </div>

            {/* Body - Two columns: Form on right, Preview on left */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Right Side - Form */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 border-l border-slate-100">
              {selectedTemplate.components && selectedTemplate.components.map((comp: any, idx: number) => {
                // Header with media
                if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
                  const mediaType = comp.format.toLowerCase() as 'image' | 'video' | 'document';
                  // Try to extract sample URL from the template's example field
                  const sampleUrl: string | undefined =
                    comp.example?.header_url?.[0] ||
                    comp.example?.header_url ||
                    (Array.isArray(comp.example?.header_handle) ? comp.example.header_handle[0] : undefined) ||
                    comp.example?.header_handle ||
                    undefined;
                  return (
                    <div key={idx} className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700">
                        {mediaType === 'image' ? '🖼️ תמונה' : mediaType === 'video' ? '🎥 וידאו' : '📄 מסמך'}
                      </label>
                      <FileUploader
                        value={templateParams.header?.url || ''}
                        onChange={(url) => {
                          setTemplateParams(prev => ({
                            ...prev,
                            header: { type: mediaType, url }
                          }));
                        }}
                        accept={
                          mediaType === 'image' ? 'image/*' :
                          mediaType === 'video' ? 'video/*' : '*/*'
                        }
                        label={mediaType === 'image' ? 'תמונה' : mediaType === 'video' ? 'וידאו' : 'מסמך'}
                        mediaType={mediaType}
                        token={token || ''}
                        sampleUrl={sampleUrl}
                      />
                    </div>
                  );
                }

                // Body with variables
                if (comp.type === 'BODY' && comp.text) {
                  const matches = comp.text.match(/\{\{\d+\}\}/g);
                  if (matches && matches.length > 0) {
                    return (
                      <div key={idx} className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700">💬 משתנים בהודעה</label>
                        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg mb-2">
                          {comp.text}
                        </div>
                        {matches.map((match: string, varIdx: number) => {
                          const varNum = match.match(/\d+/)?.[0];

                          const baseFields = [
                            { key: 'base:phone',        label: 'טלפון' },
                            { key: 'base:full_name',     label: 'שם מלא' },
                            { key: 'base:whatsapp_name', label: 'שם וואטסאפ' },
                            { key: 'base:email',         label: 'כתובת מייל' },
                          ];

                          const resolveField = (optKey: string): string => {
                            if (!contactRecord) return '';
                            if (optKey.startsWith('base:')) return String(contactRecord[optKey.slice(5)] ?? '');
                            if (optKey.startsWith('custom:')) return String(contactRecord.custom_field_values?.[optKey.slice(7)] ?? '');
                            return '';
                          };

                          const hasContactFields = baseFields.length > 0 || contactFieldDefs.length > 0;

                          return (
                            <div key={varIdx}>
                              <label className="block text-xs font-semibold text-slate-600 mb-1 text-right">
                                {match} - משתנה מספר {varNum}
                              </label>
                              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400 transition-all bg-white">
                                <input
                                  type="text"
                                  dir="rtl"
                                  value={templateParams.body?.[varIdx] || ''}
                                  onChange={(e) => {
                                    const newBody = [...(templateParams.body || [])];
                                    newBody[varIdx] = e.target.value;
                                    setTemplateParams(prev => ({ ...prev, body: newBody }));
                                  }}
                                  placeholder={`הזן ערך ל-${match}`}
                                  className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-slate-800"
                                />
                                {hasContactFields && (
                                  <div className="relative flex-shrink-0">
                                    <select
                                      dir="rtl"
                                      className="appearance-none h-full px-2 py-2 bg-slate-50 border-r border-slate-200 text-slate-400 text-xs cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors outline-none pr-6 pl-1"
                                      value=""
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        const resolved = resolveField(e.target.value);
                                        const newBody = [...(templateParams.body || [])];
                                        newBody[varIdx] = resolved;
                                        setTemplateParams(prev => ({ ...prev, body: newBody }));
                                        e.target.value = '';
                                      }}
                                      title="בחר שדה מאיש קשר"
                                    >
                                      <option value="">שדה מאיש קשר ▾</option>
                                      {baseFields.map(f => (
                                        <option key={f.key} value={f.key}>
                                          {f.label}{contactRecord ? ` — ${resolveField(f.key) || '—'}` : ''}
                                        </option>
                                      ))}
                                      {contactFieldDefs.map(f => (
                                        <option key={f._id} value={`custom:${f._id}`}>
                                          {f.label}{contactRecord ? ` — ${resolveField(`custom:${f._id}`) || '—'}` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                }

                return null;
              })}
              </div>

              {/* Left Side - Preview */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="sticky top-0">
                  <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-sky-500 text-white rounded-lg flex items-center justify-center text-xs">👁️</span>
                    תצוגה מקדימה
                  </h4>
                  
                  {/* WhatsApp-like message preview */}
                  <div className="bg-[#DCF8C6] rounded-2xl shadow-lg overflow-hidden border border-[#34B7F1]/20 max-w-sm">
                    {/* Header Media */}
                    {(() => {
                      const headerComp = selectedTemplate.components?.find((c: any) => c.type === 'HEADER');
                      if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                        const mediaUrl = templateParams.header?.url;
                        const mediaType = headerComp.format.toLowerCase();
                        
                        if (mediaType === 'image') {
                          return (
                            <div className="w-full aspect-video bg-slate-200 flex items-center justify-center overflow-hidden">
                              {mediaUrl ? (
                                <img 
                                  src={mediaUrl} 
                                  alt="תמונת תבנית" 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-400 py-8">
                                  <svg className="w-20 h-20 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs font-semibold">העלה תמונה ראשית</span>
                                </div>
                              )}
                            </div>
                          );
                        } else if (mediaType === 'video') {
                          return mediaUrl ? (
                            <video src={mediaUrl} controls className="w-full bg-black" />
                          ) : (
                            <div className="w-full aspect-video bg-slate-200 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2 text-slate-400">
                                <span className="text-4xl">🎥</span>
                                <span className="text-xs font-semibold">העלה וידאו</span>
                              </div>
                            </div>
                          );
                        } else if (mediaType === 'document') {
                          return mediaUrl ? (
                            <div className="p-4 bg-white/80 flex items-center gap-3">
                              <div className="w-12 h-12 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xl">📄</div>
                              <div className="flex-1">
                                <div className="text-sm font-bold text-slate-700">מסמך מצורף</div>
                                <div className="text-xs text-slate-500">קובץ מסמך</div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-200 text-slate-400 text-sm text-center flex flex-col items-center gap-2">
                              <span className="text-3xl">📄</span>
                              <span className="text-xs font-semibold">העלה מסמך</span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {/* Body Text */}
                    <div className="p-4">
                      {(() => {
                        const bodyComp = selectedTemplate.components?.find((c: any) => c.type === 'BODY');
                        if (bodyComp && bodyComp.text) {
                          let bodyText = bodyComp.text;
                          
                          // Replace {{1}}, {{2}}, etc. with actual values
                          const matches = bodyText.match(/\{\{\d+\}\}/g);
                          if (matches && templateParams.body) {
                            matches.forEach((match: string, idx: number) => {
                              const value = templateParams.body[idx] || `<span class="text-slate-500 italic">${match}</span>`;
                              bodyText = bodyText.replace(match, `<strong class="text-green-700">${value}</strong>`);
                            });
                          }
                          
                          return (
                            <p 
                              className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: bodyText }}
                            />
                          );
                        }
                        return <p className="text-sm text-slate-500 italic">אין תוכן להצגה</p>;
                      })()}
                    </div>

                    {/* Footer */}
                    {(() => {
                      const footerComp = selectedTemplate.components?.find((c: any) => c.type === 'FOOTER');
                      if (footerComp && footerComp.text) {
                        return (
                          <div className="px-4 pb-3 text-xs text-slate-600">
                            {footerComp.text}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Buttons */}
                    {(() => {
                      const buttonsComp = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
                      if (buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0) {
                        return (
                          <div className="border-t border-green-700/20">
                            {buttonsComp.buttons.map((btn: any, idx: number) => (
                              <button
                                key={idx}
                                className="w-full py-3 text-sm font-bold text-[#34B7F1] hover:bg-white/50 transition-colors border-b border-green-700/10 last:border-b-0"
                              >
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* WhatsApp timestamp */}
                    <div className="px-4 pb-2 flex justify-end">
                      <span className="text-[10px] text-slate-600">
                        {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-3 text-center flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    התצוגה מתעדכנת אוטומטית
                  </p>
                </div>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowTemplateParamsModal(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={confirmTemplateParams}
                className="px-5 py-2.5 rounded-2xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 transition-colors"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign reps modal */}
      {showAssignModal && assignModalPhone && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">שיוך נציגים</h3>
              <button
                onClick={() => { setShowAssignModal(false); fetchContacts(); }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">שיחה: <span className="font-bold text-slate-700">{assignModalPhone}</span></p>

            {/* Currently assigned reps */}
            <div className="mb-5">
              <p className="text-xs font-black text-slate-700 mb-2">נציגים משויכים:</p>
              {assignCurrentReps.length === 0 ? (
                <p className="text-xs text-slate-400 italic">אין נציגים משויכים</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignCurrentReps.map(repId => {
                    const rep = subUsers.find(u => u.id === repId);
                    return (
                      <div key={repId} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-sm font-semibold text-slate-800">{rep?.name || repId}</span>
                        <button
                          onClick={() => handleAssignRep(repId, 'unassign')}
                          disabled={assignLoading}
                          className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="הסר נציג"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add new rep */}
            <div className="flex gap-2">
              <select
                value={assignNewRepId}
                onChange={e => setAssignNewRepId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
              >
                <option value="">בחר נציג להוספה...</option>
                {subUsers.filter(u => !assignCurrentReps.includes(u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                onClick={() => assignNewRepId && handleAssignRep(assignNewRepId, 'assign')}
                disabled={!assignNewRepId || assignLoading}
                className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-black hover:bg-sky-600 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer conversation modal */}
      {showTransferModal && selectedPhone && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900">העברת שיחה</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              שיחה: <span className="font-bold text-slate-700">
                {selectedPhone && isSimulator(selectedPhone) ? '📱 סימולטור (לבדיקות)' : selectedPhone}
              </span>
            </p>

            {/* Target type tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
              {([
                { key: 'group', label: 'קבוצה' },
                { key: 'rep', label: 'נציג' },
                { key: 'shift_manager', label: 'מנהל משמרת' }
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTransferTargetType(t.key); setTransferTargetId(''); }}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    transferTargetType === t.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Target selector */}
            <div className="mb-4">
              <label className="text-xs font-black text-slate-700 mb-1.5 block">
                {transferTargetType === 'group' && 'בחר קבוצה:'}
                {transferTargetType === 'rep' && 'בחר נציג מהקבוצה שלך:'}
                {transferTargetType === 'shift_manager' && 'בחר מנהל משמרת:'}
              </label>
              <select
                value={transferTargetId}
                onChange={e => setTransferTargetId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              >
                <option value="">בחר...</option>
                {transferTargetType === 'group' && transferTargets.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
                {transferTargetType === 'rep' && (() => {
                  // For reps: filter to reps in the same groups (exclude self).
                  const myGroups = transferTargets.myGroupIds;
                  const filtered = transferTargets.reps.filter(r => {
                    if (currentUser && (r.id === (currentUser as any).id)) return false;
                    if (!myGroups || myGroups.length === 0) return true;
                    return r.repGroupIds.some(gid => myGroups.includes(gid));
                  });
                  return filtered.length === 0
                    ? <option value="" disabled>אין נציגים זמינים</option>
                    : filtered.map(r => (
                        <option key={r.id} value={r.id}>{r.name}{r.email ? ` (${r.email})` : ''}</option>
                      ));
                })()}
                {transferTargetType === 'shift_manager' && (
                  transferTargets.shiftManagers.length === 0
                    ? <option value="" disabled>אין מנהלי משמרת זמינים</option>
                    : transferTargets.shiftManagers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.email ? ` (${m.email})` : ''}</option>
                      ))
                )}
              </select>
            </div>

            {transferError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                {transferError}
              </div>
            )}

            {/* Wants phone checkbox */}
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={transferWantsPhone}
                onChange={e => setTransferWantsPhone(e.target.checked)}
                className="w-4 h-4 accent-green-600 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Phone size={14} className="text-green-600" />
                לקוח מעוניין בחזרת טלפון
              </span>
            </label>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowTransferModal(false)}
                disabled={transferLoading}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={submitTransfer}
                disabled={!transferTargetId || transferLoading}
                className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-black hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {transferLoading ? 'מעביר...' : 'העבר שיחה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer notifications toast stack ─────────────────────────────── */}
      {pendingNotifications.length > 0 && (
        <div
          className="fixed bottom-5 left-5 z-[100] flex flex-col gap-2 max-w-xs w-full"
          dir="rtl"
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          {/* Dismiss-all button when more than one */}
          {pendingNotifications.length > 1 && (
            <button
              onClick={dismissAllNotifications}
              className="self-end text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 bg-white/90 rounded-lg shadow border border-slate-100 mb-1 transition-colors"
            >
              נקה הכל ({pendingNotifications.length})
            </button>
          )}
          {pendingNotifications.map(notif => (
            <div
              key={notif._id}
              className={`rounded-2xl shadow-lg px-4 py-3 flex gap-3 items-start animate-fade-in border ${
                notif.wants_phone
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-indigo-100'
              }`}
            >
              <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                notif.wants_phone ? 'bg-green-100' : 'bg-indigo-50'
              }`}>
                {notif.wants_phone
                  ? <Phone size={16} className="text-green-600" />
                  : <Bell size={16} className="text-indigo-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black leading-snug ${notif.wants_phone ? 'text-green-900' : 'text-slate-800'}`}>
                  {notif.wants_phone ? '📞 בקשת שיחה טלפונית!' : 'שיחה חדשה הועברה אליך'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {notif.from_user_name && <span>מאת <span className="font-bold">{notif.from_user_name}</span> · </span>}
                  {notif.target_label}
                </p>
                {(notif.session_phone || notif.is_simulator) && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {notif.is_simulator ? '📱 סימולטור' : notif.session_phone}
                  </p>
                )}
                {notif.wants_phone && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-green-200 text-green-800 ring-1 ring-green-400/50">
                    <Phone size={10} /> טלפוני
                  </span>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {!notif.is_simulator && notif.session_phone && (
                    <button
                      onClick={() => {
                        setSelectedPhone(notif.session_phone);
                        dismissNotification(notif._id);
                      }}
                      className={`text-[11px] font-black underline underline-offset-2 transition-colors ${
                        notif.wants_phone
                          ? 'text-green-700 hover:text-green-900'
                          : 'text-indigo-600 hover:text-indigo-800'
                      }`}
                    >
                      פתח שיחה ←
                    </button>
                  )}
                  {notif.wants_phone && (
                    <button
                      onClick={() => markNotifPhoneHandled(notif)}
                      className="flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                      title="סמן שיחה טלפונית כטופלה"
                    >
                      <Check size={10} /> טופל
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissNotification(notif._id)}
                className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-500 transition-colors mt-0.5"
                title="הסתר"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionsPage;
