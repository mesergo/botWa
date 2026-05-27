import React, { useState, useEffect, useRef } from 'react';
import { Clock, MessageSquare, Search, Bot, LogOut, User, Phone, List, Users, ExternalLink, X, Headphones, RefreshCw, Shield, Settings, UserCog, Layers, Plus } from 'lucide-react';
import ImpersonationBanner from './ImpersonationBanner';
import { FileUploader } from './FileUploader';

interface Session {
  id: string;
  phone: string;
  sender?: string;
  widget_id: string;
  bot_name: string;
  user_name?: string;
  created_at: string | null;
  parameters: Record<string, any>;
  process_history: any[];
  is_agent?: boolean;
  agent_since?: string | null;
}

interface Contact {
  phone: string;
  sessionCount: number;
  lastSeen: string | null;
  bots: { id: string; name: string }[];
}

interface SessionsPageProps {
  token: string | null;
  currentUser?: { name?: string; email?: string; role?: string; isImpersonating?: boolean } | null;
  onBack: () => void;
  onLogout: () => void;
  onOpenContacts?: (phone?: string) => void;
  onOpenGroups?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSubUsers?: () => void;
  onStopImpersonation?: () => void;
  ownOnly?: boolean;
  initialPhone?: string | null;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

const SessionsPage: React.FC<SessionsPageProps> = ({ token, currentUser, onBack, onLogout, onOpenContacts, onOpenGroups, onOpenAdminPanel, onOpenSettings, onOpenSubUsers, onStopImpersonation, initialPhone }) => {
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

  // Template dropdown state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateSettings, setTemplateSettings] = useState<Record<string, 'hidden' | 'manager' | 'agent'>>({});
  
  // Template parameters modal
  const [showTemplateParamsModal, setShowTemplateParamsModal] = useState(false);
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});

  // New conversation modal state
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvLoading, setNewConvLoading] = useState(false);
  const [newConvError, setNewConvError] = useState<string | null>(null);

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

  // Fetch all sessions for the selected phone (oldest → newest)
  useEffect(() => {
    if (!selectedPhone || !token) {
      setPhoneSessions([]);
      return;
    }
    setPhoneSessionsLoading(true);
    fetch(`${API_BASE}/sessions/by-phone?phone=${encodeURIComponent(selectedPhone)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setPhoneSessions(data))
      .catch(e => console.error('Failed to load sessions for phone', e))
      .finally(() => setPhoneSessionsLoading(false));
  }, [selectedPhone, token]);

  // Scroll to bottom after sessions load
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [phoneSessions]);

  // Clear message input when switching contacts
  useEffect(() => {
    setAgentMessage('');
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

  // ── New conversation handler ────────────────────────────────────────────────

  const handleNewConvConfirm = async () => {
    const sanitized = newConvPhone.replace(/[+\-\s()]/g, '');
    const digits = sanitized.replace(/\D/g, '');
    if (digits.length < 7) {
      setNewConvError('מספר טלפון לא תקין');
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
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1 ? { ...s, is_agent: true, agent_since: data.agent_since } : s
        ));
        
        // אם יש הודעה שנכתבה, שלח אותה מיד
        if (messageToSend) {
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
              setSelectedTemplate(null);
              setTemplateParams({});
              setPhoneSessions(prev => prev.map((s, i) =>
                i === prev.length - 1
                  ? { ...s, process_history: [...s.process_history, msgData.historyEntry || { type: 'Text', text: messageToSend, sender: 'agent', name: 'נציג', created, wa_sent: msgData.waSent }] }
                  : s
              ));
              if (!msgData.waSent) {
                setAgentWaFailed(true);
                setTimeout(() => setAgentWaFailed(false), 8000);
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
          i === prev.length - 1 ? { ...s, is_agent: false, agent_since: null } : s
        ));
      }
    } catch (e) {
      console.error('Failed to clear agent mode', e);
    }
  };

  const sendAgentMsg = async () => {
    if (!agentMessage.trim() || agentSending) return;

    // לקוח חדש ללא שיחות — שלח תבנית ישירות לטלפון (ללא session)
    if (phoneSessions.length === 0) {
      if (!selectedTemplate) return;
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
            setTimeout(() => setAgentWaFailed(false), 8000);
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
        setSelectedTemplate(null);
        setTemplateParams({});
        setPhoneSessions(prev => prev.map((s, i) =>
          i === prev.length - 1
            ? { ...s, process_history: [...s.process_history, data.historyEntry || { type: 'Text', text: msgText, sender: 'agent', name: 'נציג', created, wa_sent: data.waSent }] }
            : s
        ));
        if (!data.waSent) {
          setAgentWaFailed(true);
          setTimeout(() => setAgentWaFailed(false), 8000);
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
            initialParams.header = { type: comp.format.toLowerCase(), url: '' };
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

  const firstName = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  const filteredContacts = contacts.filter(c =>
    c.phone.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const selectedContact = contacts.find(c => c.phone === selectedPhone) ?? null;

  /* ─── render messages for one session ─── */
  const renderSessionMessages = (session: Session) => {
    if (!session.process_history.length) return null;

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
      const senderType: 'bot' | 'user' | 'agent' =
        item.sender === 'agent' ? 'agent'
        : item.sender === 'user' ? 'user'
        : item.type === 'UserInput' ? 'user'
        : item.sender === 'bot' ? 'bot'
        : 'bot';
      const isBot = senderType === 'bot';
      const isAgent = senderType === 'agent';
      const text = item.text ?? item.content ?? '';
      const msgDate = item.created ? formatMessageDate(item.created) : '';

      // Agent message — purple bubble on left side
      if (isAgent) {
        return (
          <div key={`${session.id}-${idx}`} className="flex w-full justify-start">
            <div className="flex gap-2 max-w-[88%] flex-row-reverse">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm bg-purple-100 border border-purple-200 text-purple-700">
                <Headphones size={15} />
              </div>
              <div className="flex flex-col gap-1 items-end">
                <div className="px-4 py-2.5 rounded-3xl text-sm font-semibold shadow-sm text-right bg-purple-50 border border-purple-200 text-purple-900 rounded-tr-none">
                  <p className="text-[9px] text-purple-400 font-black mb-1 uppercase tracking-widest">נציג</p>
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
                  {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                </div>
                {item.wa_sent === false && (
                  <span className="text-[9px] text-red-500 font-black px-1">⚠️ לא נשלח ללקוח</span>
                )}
                {msgDate && <span className="text-[10px] text-slate-400 font-semibold px-1">{msgDate}</span>}
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
          <div className={`flex gap-2 max-w-[88%] ${isBot ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm
              ${isBot ? 'bg-white border border-slate-100 text-slate-700' : 'bg-sky-500 text-white'}`}>
              {isBot ? <Bot size={15} /> : <User size={15} />}
            </div>
            <div className={`flex flex-col gap-1 ${isBot ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2.5 rounded-3xl text-sm font-semibold shadow-sm text-right
                ${isBot
                  ? 'bg-white border border-slate-100 text-slate-900 rounded-tr-none'
                  : 'bg-sky-500 text-white rounded-tl-none'}`}
              >
                {(item.type === 'Text' || item.type === 'UserInput' || !item.type || item.type.startsWith('input_')) && text && (
                  <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                )}
                {item.type === 'Image' && item.url && (
                  <>
                    <img src={item.url} alt="תמונה" className="rounded-xl max-w-[200px] h-auto mb-2" />
                    {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
                  </>
                )}
                {item.type === 'Video' && item.url && (
                  <>
                    <video src={item.url} controls className="rounded-xl max-w-[200px] mb-2" />
                    {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
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
                    {text && <p className="mb-2 text-slate-400 text-[10px] uppercase tracking-widest font-black">{text}</p>}
                    {Array.isArray(item.options) && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {item.options
                          .map((o: any) => (typeof o === 'object' && o !== null) ? (o.label ?? o.value ?? o.text ?? '') : String(o))
                          .filter((o: string) => o !== 'default' && o !== '')
                          .map((opt: string, i: number) => (
                            <div key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">{opt}</div>
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
              {msgDate && (
                <span className="text-[10px] text-slate-400 font-semibold px-1">{msgDate}</span>
              )}
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
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto cursor-pointer" onClick={onBack} />
        </div>
        {/* ── Navigation tabs ── */}
        {currentUser?.role !== 'rep' && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1" dir="rtl">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <Bot size={16} /> הבוטים שלי
            </button>
          )}
          <button
            className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm bg-white text-slate-900 shadow-sm transition-all"
          >
            <List size={16} /> שיחות
          </button>
          {onOpenContacts && (
            <button
              onClick={() => onOpenContacts()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <Users size={16} /> אנשי קשר
            </button>
          )}
          {onOpenGroups && (
            <button
              onClick={onOpenGroups}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <Layers size={16} /> קבוצות
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <Settings size={16} /> הגדרות
            </button>
          )}
          {onOpenSubUsers && currentUser?.role === 'user' && (
            <button
              onClick={onOpenSubUsers}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 transition-all"
            >
              <UserCog size={16} /> משתמשים
            </button>
          )}
        </div>
        )}
        <div className="flex items-center gap-4">
          {currentUser && (
            <span className="text-sm font-bold text-slate-600">שלום, {currentUser.name || currentUser.email}</span>
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
          <div
            title={currentUser?.name || currentUser?.email || ''}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md select-none"
          >
            {firstName}
          </div>
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
            <LogOut size={22} />
          </button>
        </div>
      </nav>

      {/* Main area  —  contacts panel on the right, chat area on the left (RTL flex) */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Contacts panel (first child = right side in RTL, ~30%) ── */}
        <div className="w-[30%] flex-shrink-0 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">אנשי קשר</h2>
                  <p className="text-xs text-slate-400 font-semibold">{contacts.length} קשרים</p>
                </div>
              </div>
              <button
                onClick={() => { setShowNewConvModal(true); setNewConvPhone(''); setNewConvError(null); }}
                title="שיחה חדשה"
                className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 transition-colors flex-shrink-0"
              >
                <Plus size={16} />
              </button>
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
                      {sim ? <MessageSquare size={16} /> : contact.phone.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-black truncate ${isSelected ? 'text-sky-700' : 'text-slate-800'}`}>
                          {sim ? 'סימולטור' : contact.phone}
                        </p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                          ${isSelected ? 'bg-sky-200 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                          {contact.sessionCount} שיחות
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold flex-shrink-0">
                        {formatContactTime(contact.lastSeen)}
                      </span>
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
                    <p className="text-base font-black text-slate-900">
                      {isSimulator(selectedPhone) ? 'סימולטור' : selectedPhone}
                    </p>
                    {!isSimulator(selectedPhone) && onOpenContacts && (
                      <button
                        onClick={() => onOpenContacts(selectedPhone)}
                        title="פתח פרטי איש קשר"
                        className="p-1 text-slate-400 hover:text-sky-500 transition-colors rounded-lg hover:bg-sky-50"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {selectedContact?.sessionCount ?? 0} שיחות
                    {selectedContact?.bots && selectedContact.bots.length > 0 && (
                      <> · {selectedContact.bots.map(b => b.name).join(', ')}</>
                    )}
                  </p>
                </div>
                {!isSimulator(selectedPhone) && isAgentMode && (
                  <button
                    onClick={deactivateAgent}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <RefreshCw size={14} /> החזרת השיחה לבוט
                  </button>
                )}
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
                    ⚠️ ההודעה נשמרה בהיסטוריה אך <strong>לא נשלחה ללקוח</strong> — בעיה ב-WhatsApp API
                  </p>
                  <button onClick={() => setAgentWaFailed(false)} className="text-red-400 hover:text-red-600">
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
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6" dir="rtl">
                  {phoneSessions.map(session => (
                    <React.Fragment key={session.id}>
                      {/* Thin divider with session date and bot name */}
                      <div className="flex items-center gap-3 py-3">
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
                      <div className="space-y-3 mb-2">
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
                  {phoneSessions.length === 0 && (
                    <div className="flex items-center gap-2 mb-2 px-1 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold">
                      <span className="text-base">⚠️</span>
                      לקוח חדש — ניתן לשלוח הודעות תבנית בלבד. הקש <span className="font-black">/</span> לבחירת תבנית.
                    </div>
                  )}
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
                      disabled={!agentMessage.trim() || agentSending || (phoneSessions.length === 0 && !selectedTemplate)}
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors
                        ${agentMessage.trim() && !agentSending && !(phoneSessions.length === 0 && !selectedTemplate)
                          ? 'bg-sky-500 text-white hover:bg-sky-600 cursor-pointer'
                          : 'bg-sky-500 text-white opacity-40 cursor-not-allowed'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
                      </svg>
                    </button>
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
                      onFocus={() => {
                        if (phoneSessions.length === 0 && !agentMessage) {
                          setAgentMessage('/');
                          setShowTemplates(true);
                          fetchTemplates();
                        }
                      }}
                      placeholder={phoneSessions.length === 0 ? 'הקש / לבחירת תבנית לשליחה...' : 'כתוב הודעה ללקוח... (/ לטמפלייטים)'}
                      className={`flex-1 bg-slate-50 border rounded-2xl px-4 py-2.5 text-sm text-right font-medium outline-none transition-all
                        text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500/20
                        ${phoneSessions.length === 0 && !selectedTemplate
                          ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-500/20'
                          : 'border-slate-200 focus:border-sky-400'}`}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

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
                placeholder="הזן מספר טלפון..."
                value={newConvPhone}
                onChange={e => {
                  setNewConvPhone(e.target.value);
                  setNewConvError(null);
                }}
                onKeyDown={e => e.key === 'Enter' && !newConvLoading && handleNewConvConfirm()}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
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
                disabled={newConvLoading || newConvError === 'איש קשר קיים במערכת'}
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
                          return (
                            <div key={varIdx}>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {match} - משתנה מספר {varNum}
                              </label>
                              <input
                                type="text"
                                value={templateParams.body?.[varIdx] || ''}
                                onChange={(e) => {
                                  const newBody = [...(templateParams.body || [])];
                                  newBody[varIdx] = e.target.value;
                                  setTemplateParams(prev => ({ ...prev, body: newBody }));
                                }}
                                placeholder={`הזן ערך ל-${match}`}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none"
                              />
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
    </div>
  );
};

export default SessionsPage;
