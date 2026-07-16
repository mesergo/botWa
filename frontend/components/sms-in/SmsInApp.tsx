/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  INITIAL_CLIENTS, 
  INITIAL_DEST_SETTINGS,
  normalizeDestSetting,
} from './data';
import { Message, Client, DestSetting, WebhookLog } from './types';
import LineSettingsModal from './components/LineSettingsModal';
import WebhookSimulator from './components/WebhookSimulator';
import ClientsManager from './components/ClientsManager';

// Icons
import { 
  LayoutDashboard, 
  MessageSquare, 
  GitFork, 
  Users, 
  FileSpreadsheet, 
  LogOut, 
  Search, 
  Filter, 
  Download, 
  ArrowLeft, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Link2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const MESSAGES_FETCH_LIMIT = 500;
const MESSAGES_PAGE_SIZE = 50;

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/sms-in'
  : `${window.location.origin}/api/sms-in`;

interface SmsInAppProps {
  embedded?: boolean;
  userEmail?: string;
  userId?: string;
  userName?: string;
  /** Line assignment (routing) is admin-only; customers only see their SMS. */
  isAdmin?: boolean;
  /** Auth token for fetching platform clients from MongoDB */
  token?: string | null;
}

export default function SmsInApp({
  embedded = false,
  userEmail,
  userId,
  userName,
  isAdmin: isAdminProp,
  token,
}: SmsInAppProps) {
  // Standalone demo = full admin UI; when embedded in botWa, only real admins get assignment tabs
  const isAdmin = isAdminProp ?? !embedded;
  // Authentication State — skip when embedded in botWa (already authenticated)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (embedded) return true;
    return localStorage.getItem('mesergo_logged_in') === 'true';
  });
  const [loginEmail, setLoginEmail] = useState('battzyong@mesergo.co.il');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [loginError, setLoginError] = useState('');

  // Messages come exclusively from the SMS MongoDB — never from browser storage
  const [messages, setMessages] = useState<Message[]>(() => {
    localStorage.removeItem('mesergo_messages'); // purge stale demo data from old versions
    return [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    // When embedded, start empty and load from MongoDB; standalone keeps demo/localStorage
    if (embedded) return [];
    const saved = localStorage.getItem('mesergo_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });
  const [clientsFromMongo, setClientsFromMongo] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const [destSettings, setDestSettings] = useState<DestSetting[]>(() => {
    if (embedded) return [];
    const saved = localStorage.getItem('mesergo_dest_settings');
    const parsed: DestSetting[] = saved ? JSON.parse(saved) : INITIAL_DEST_SETTINGS;
    return parsed.map(normalizeDestSetting);
  });
  const [destSettingsFromMongo, setDestSettingsFromMongo] = useState(false);

  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(() => {
    const saved = localStorage.getItem('mesergo_webhook_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sms_in' | 'routing' | 'clients' | 'integrations'>('sms_in');

  // Non-admins never stay on admin-only setup tabs
  useEffect(() => {
    if (!isAdmin && (activeTab === 'routing' || activeTab === 'clients')) {
      setActiveTab('sms_in');
      setEditingDestSetting(null);
    }
  }, [isAdmin, activeTab]);

  // Filters State
  const [searchText, setSearchText] = useState('');
  const [filterDest, setFilterDest] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [messagesPage, setMessagesPage] = useState(1);

  // Modals & Panels State
  const [editingDestSetting, setEditingDestSetting] = useState<DestSetting | null>(null);
  const [showExportDateModal, setShowExportDateModal] = useState(false);

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Database integration state for MongoDB
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    configured: boolean;
    message?: string;
    reason?: string;
    dbName?: string;
    collection?: string;
    collectionsDetected?: string[];
  }>({ connected: false, configured: false });
  const [messagesSource, setMessagesSource] = useState<'mongodb' | 'local' | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Fetch real-time connection status of database
  const fetchDbStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setDbStatus(data);
      return data;
    } catch (e) {
      console.error('Error fetching DB status', e);
      return { connected: false, configured: false };
    }
  };

  // Fetch real messages from MongoDB (scoped to assigned lines for non-admins)
  const fetchRealMessages = async (silent = false) => {
    setIsLoadingMessages(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/messages?limit=${MESSAGES_FETCH_LIMIT}`, { headers });
      const data = await res.json();
      if (data.source === 'mongodb' && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setMessagesSource('mongodb');
        if (!silent) {
          showToastMsg(`הנתונים נטענו בהצלחה מ-MongoDB (${data.messages.length} SMS)`, 'success');
        }
      } else {
        setMessagesSource('local');
        if (!silent) {
          showToastMsg('אין חיבור לטבלת ה-SMS — בדוק את הגדרות השרת', 'error');
        }
      }
    } catch (e) {
      console.error('Error fetching messages from MongoDB:', e);
      setMessagesSource('local');
      if (!silent) {
        showToastMsg('מצב מקומי — נתונים מהדפדפן (בפרודקשן ייטענו מהשרת)', 'info');
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Fetch platform customers (User accounts) from MongoDB for line assignment
  const fetchClients = async () => {
    if (!token || !isAdmin) return;
    setIsLoadingClients(true);
    try {
      const res = await fetch(`${API_BASE}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.clients)) {
        setClients(data.clients);
        setClientsFromMongo(data.source === 'mongodb');
      }
    } catch (e) {
      console.error('Error fetching SMS clients from MongoDB:', e);
      setToast({ type: 'error', text: 'לא ניתן לטעון לקוחות מ-MongoDB' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Load line assignments from MongoDB (shared across admin + customers)
  const fetchDestSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/dest-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.settings)) {
        setDestSettings(data.settings.map(normalizeDestSetting));
        setDestSettingsFromMongo(true);
      }
    } catch (e) {
      console.error('Error fetching dest settings:', e);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchDbStatus().then((status) => {
      if (status && status.connected) {
        fetchRealMessages(true);
      }
    });
    if (embedded && token) {
      fetchDestSettings();
    }
  }, []);

  useEffect(() => {
    if (embedded && token && isAdmin) {
      fetchClients();
    }
  }, [embedded, token, isAdmin]);

  // Sync state to LocalStorage
  useEffect(() => {
    // Don't overwrite local demo clients when using MongoDB accounts
    if (clientsFromMongo || embedded) return;
    localStorage.setItem('mesergo_clients', JSON.stringify(clients));
  }, [clients, clientsFromMongo, embedded]);

  useEffect(() => {
    if (destSettingsFromMongo || embedded) return;
    localStorage.setItem('mesergo_dest_settings', JSON.stringify(destSettings));
  }, [destSettings, destSettingsFromMongo, embedded]);

  useEffect(() => {
    localStorage.setItem('mesergo_webhook_logs', JSON.stringify(webhookLogs));
  }, [webhookLogs]);

  const messageDestNumbers = useMemo(() => {
    const unique = new Set<string>();
    messages.forEach(msg => {
      const dest = msg.dest?.trim();
      if (dest) unique.add(dest);
    });
    // Also include assigned dests even if no messages yet (customer / admin routing)
    destSettings.forEach(ds => {
      if (ds.dest?.trim()) unique.add(ds.dest.trim());
    });
    return Array.from(unique).sort();
  }, [messages, destSettings]);

  useEffect(() => {
    // Admin UI: ensure every seen dest has a settings row. Don't overwrite Mongo assignments.
    if (!isAdmin) return;
    setDestSettings(prev => {
      const messageDestSet = new Set(messageDestNumbers);
      const existing = new Set(prev.map(s => s.dest));
      const missing = messageDestNumbers.filter(d => !existing.has(d));
      if (missing.length === 0) return prev;
      return [
        ...prev,
        ...missing.map(dest => ({
          dest,
          assignedClients: [] as string[],
          assignedClientName: '',
          googleSheetsUrl: '',
          webhookUrl: '',
          isActive: false,
          notes: 'נוסף אוטומטית מהודעות נכנסות',
        })),
      ];
    });
  }, [messageDestNumbers, isAdmin]);

  const visibleDestSettings = useMemo(() => {
    return [...destSettings].sort((a, b) => a.dest.localeCompare(b.dest));
  }, [destSettings]);

  const resolveClientLabel = (idOrName: string) => {
    const byId = clients.find(c => c.id === idOrName);
    if (byId) return byId.name;
    const byName = clients.find(c => c.name === idOrName);
    if (byName) return byName.name;
    return idOrName;
  };

  /** Dest lines belonging to the logged-in customer */
  const myAssignedDests = useMemo(() => {
    if (isAdmin || !userId) return null;
    return new Set(
      destSettings
        .filter(ds =>
          ds.assignedClients.includes(userId) ||
          ds.assignedClients.includes(userName || '') ||
          ds.assignedClients.includes(userEmail || '')
        )
        .map(ds => ds.dest)
    );
  }, [isAdmin, userId, userName, userEmail, destSettings]);

  const showToastMsg = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('אנא הזן דוא"ל וסיסמה תקינים');
      return;
    }
    // simple authentication validation
    if (loginPassword.length >= 4) {
      localStorage.setItem('mesergo_logged_in', 'true');
      setIsLoggedIn(true);
      setLoginError('');
      showToastMsg('התחברת למערכת בהצלחה אדמין מסרגו', 'success');
    } else {
      setLoginError('סיסמה שגויה או קצרה מדי (מינימום 4 תווים)');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('mesergo_logged_in');
    setIsLoggedIn(false);
    showToastMsg('התנתקת מהמערכת בהצלחה', 'info');
  };

  // Delete message handler
  const handleDeleteMessage = (id_: string) => {
    setMessages(messages.filter(m => m.id_ !== id_));
    showToastMsg('ההודעה נמחקה בהצלחה', 'info');
  };

  // Copy ID helper
  const handleCopyId = (id: string) => {
    // extract string code inside quotes
    const match = id.match(/"([^"]+)"/);
    const textToCopy = match ? match[1] : id;
    navigator.clipboard.writeText(textToCopy);
    showToastMsg('מזהה ObjectID הועתק ללוח', 'success');
  };

  // Parse message date to JS Date object
  const parseMessageDate = (dateStr: string): Date => {
    try {
      // Input format: "14:03:54 08/03/26"
      const parts = dateStr.split(' ');
      if (parts.length < 2) return new Date();
      const timeParts = parts[0].split(':');
      const dateParts = parts[1].split('/');
      
      const hour = parseInt(timeParts[0], 10) || 0;
      const min = parseInt(timeParts[1], 10) || 0;
      const sec = parseInt(timeParts[2], 10) || 0;
      
      const day = parseInt(dateParts[0], 10) || 1;
      const month = parseInt(dateParts[1], 10) - 1 || 0;
      const year = 2000 + (parseInt(dateParts[2], 10) || 26);
      
      return new Date(year, month, day, hour, min, sec);
    } catch (e) {
      return new Date();
    }
  };

  // Filter messages logic
  const filteredMessages = messages.filter(msg => {
    // Customer scope from assignments (server already scopes; defense in depth)
    if (!isAdmin && userId && embedded) {
      if (!destSettingsFromMongo) {
        // Wait until we know which lines belong to this account
        return false;
      }
      if (!myAssignedDests || !myAssignedDests.has(msg.dest)) return false;
    }

    // 1. Text Search (Sender phone, content message, id_, destination)
    const textLower = searchText.toLowerCase();
    const matchText = !searchText || 
      msg.phone.toLowerCase().includes(textLower) || 
      msg.message.toLowerCase().includes(textLower) || 
      msg.id_.toLowerCase().includes(textLower) || 
      msg.dest.toLowerCase().includes(textLower);

    // 2. Destination filter
    const matchDest = filterDest === 'all' || msg.dest === filterDest;

    // 3. Associated Client filter (admin only)
    let matchClient = true;
    if (isAdmin && filterClient !== 'all') {
      const lineSetting = destSettings.find(ds => ds.dest === msg.dest);
      matchClient = !!lineSetting && lineSetting.assignedClients.includes(filterClient);
    }

    // 4. Date Range filter
    let matchDateRange = true;
    const msgDateObj = parseMessageDate(msg.date);

    if (filterDateStart) {
      const startDate = new Date(filterDateStart);
      startDate.setHours(0, 0, 0, 0);
      if (msgDateObj < startDate) matchDateRange = false;
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      if (msgDateObj > endDate) matchDateRange = false;
    }

    return matchText && matchDest && matchClient && matchDateRange;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / MESSAGES_PAGE_SIZE));
  const pageStart = filteredMessages.length === 0 ? 0 : (messagesPage - 1) * MESSAGES_PAGE_SIZE + 1;
  const pageEnd = Math.min(messagesPage * MESSAGES_PAGE_SIZE, filteredMessages.length);
  const paginatedMessages = filteredMessages.slice(
    (messagesPage - 1) * MESSAGES_PAGE_SIZE,
    messagesPage * MESSAGES_PAGE_SIZE
  );

  useEffect(() => {
    setMessagesPage(1);
  }, [searchText, filterDest, filterClient, filterDateStart, filterDateEnd]);

  useEffect(() => {
    if (messagesPage > totalPages) {
      setMessagesPage(totalPages);
    }
  }, [messagesPage, totalPages]);

  // Export Filtered Messages to CSV
  const handleExportCSV = (customList?: Message[]) => {
    const listToExport = customList || filteredMessages;
    if (listToExport.length === 0) {
      showToastMsg('אין הודעות לייצוא בהתאם למסננים שנבחרו', 'error');
      return;
    }

    // Prepare CSV header and lines
    const headers = ['Message ID', 'Destination (dest)', 'Sender (phone)', 'Date Received', 'Message Text', 'Associated Clients'];
    const csvContent = [
      '\uFEFF' + headers.join(','), // adding BOM for Hebrew Excel readability
      ...listToExport.map(msg => {
        // Find line clients
        const setting = destSettings.find(s => s.dest === msg.dest);
        const clientsStr = setting
          ? (setting.assignedClientName ||
              setting.assignedClients.map(resolveClientLabel).join(' | ') ||
              'ללא שיוך')
          : 'ללא שיוך';
        
        // Clean and quote fields to handle commas in messages
        const cleanId = msg.id_.replace(/"/g, '""');
        const cleanDest = msg.dest;
        const cleanPhone = msg.phone;
        const cleanDate = msg.date;
        const cleanMsg = msg.message.replace(/"/g, '""').replace(/\r?\n/g, ' ');
        const cleanClients = clientsStr.replace(/"/g, '""');

        return `"${cleanId}","${cleanDest}","${cleanPhone}","${cleanDate}","${cleanMsg}","${cleanClients}"`;
      })
    ].join('\n');

    // Create file and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mesergo_sms_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToastMsg(`ייצוא של ${listToExport.length} הודעות בוצע בהצלחה!`, 'success');
  };

  // Export by Date Picker Dialog Helper
  const [expDateStr, setExpDateStr] = useState('');
  const handleExportByParticularDate = () => {
    if (!expDateStr) {
      showToastMsg('נא לבחור תאריך תקין', 'error');
      return;
    }

    const selectedDate = new Date(expDateStr);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23,59,59,999);

    const matchDateList = messages.filter(m => {
      const dObj = parseMessageDate(m.date);
      return dObj >= startOfDay && dObj <= endOfDay;
    });

    if (matchDateList.length === 0) {
      showToastMsg(`לא נמצאו הודעות המתאימות לתאריך ${expDateStr}`, 'error');
      return;
    }

    handleExportCSV(matchDateList);
    setShowExportDateModal(false);
  };

  const triggerWebhookToUrl = async (
    msg: Message,
    setting: DestSetting,
    url: string,
    options?: { silent?: boolean; event?: string }
  ) => {
    const payload = {
      event: options?.event ?? 'incoming_sms',
      id: msg.id_,
      dest: msg.dest,
      phone: msg.phone,
      date: msg.date,
      message: msg.message,
      clients: setting.assignedClients,
      triggeredAt: new Date().toISOString()
    };

    const logId = 'wlog_' + Math.random().toString(36).substr(2, 9);
    const timestampNow = new Date().toLocaleTimeString('he-IL') + ' ' + new Date().toLocaleDateString('he-IL');

    if (!options?.silent) {
      const newLog: WebhookLog = {
        id: logId,
        timestamp: timestampNow,
        dest: msg.dest,
        payload: payload,
        status: 'pending'
      };
      setWebhookLogs(prev => [newLog, ...prev]);
    }

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!options?.silent) {
        setWebhookLogs(prev => prev.map(l => l.id === logId ? {
          ...l,
          status: 'success',
          response: '200 OK — בקשת POST נשלחה בהצלחה במצב מעקף CORS'
        } : l));
      }

    } catch (err: any) {
      if (!options?.silent) {
        setWebhookLogs(prev => prev.map(l => l.id === logId ? {
          ...l,
          status: 'failed',
          response: `שגיאה בחיבור: ${err.message || err}`
        } : l));
      }
      throw err;
    }
  };

  const syncGoogleSheetsHistory = async (setting: DestSetting, options?: { silent?: boolean }) => {
    if (!setting.googleSheetsUrl) {
      return { sent: 0, total: 0 };
    }

    const lineMessages = messages
      .filter(m => m.dest === setting.dest)
      .sort((a, b) => parseMessageDate(a.date).getTime() - parseMessageDate(b.date).getTime());

    let sent = 0;
    for (const msg of lineMessages) {
      try {
        await triggerWebhookToUrl(msg, setting, setting.googleSheetsUrl, {
          silent: true,
          event: 'history_sync',
        });
        sent++;
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch {
        // continue with remaining messages
      }
    }

    if (!options?.silent) {
      showToastMsg(
        sent === lineMessages.length
          ? `${sent} הודעות היסטוריות נשלחו לגוגל שיטס`
          : `${sent} מתוך ${lineMessages.length} הודעות נשלחו לגוגל שיטס`,
        sent > 0 ? 'success' : 'info'
      );
    }

    return { sent, total: lineMessages.length };
  };

  const triggerLineWebhooks = async (msg: Message, setting: DestSetting) => {
    const urls = [setting.googleSheetsUrl, setting.webhookUrl].filter(Boolean);
    for (const url of urls) {
      await triggerWebhookToUrl(msg, setting, url);
    }
  };

  // Trigger webhook manual resend
  const handleManualWebhookResend = (msg: Message) => {
    const lineSetting = destSettings.find(ds => ds.dest === msg.dest);
    if (!lineSetting) {
      showToastMsg(`לא נמצאו הגדרות שיוך למספר נמען ${msg.dest}`, 'error');
      return;
    }
    if (!lineSetting.googleSheetsUrl && !lineSetting.webhookUrl) {
      showToastMsg('לא הוגדרה כתובת Google Sheets או Webhook עבור מספר זה. אנא הגדר בהגדרות החיבור', 'error');
      return;
    }

    triggerLineWebhooks(msg, lineSetting);
    showToastMsg(`בקשת ניתוב חוזרת נשלחה לכתובת הווב-הוק של ${msg.dest}`, 'info');
  };

  // Handle client updates
  const handleAddClient = (nc: Client) => {
    setClients(prev => [...prev, nc]);
    showToastMsg(`הלקוח "${nc.name}" התווסף בהצלחה למאגר`, 'success');
  };

  const handleDeleteClient = (id: string) => {
    const clientToRemove = clients.find(c => c.id === id);
    if (!clientToRemove) return;

    // Remove from lines assigned too
    setDestSettings(prev => prev.map(s => ({
      ...s,
      assignedClients: s.assignedClients.filter(ac => ac !== clientToRemove.id && ac !== clientToRemove.name),
      assignedClientName:
        s.assignedClients[0] === clientToRemove.id || s.assignedClients[0] === clientToRemove.name
          ? ''
          : s.assignedClientName,
    })));

    setClients(prev => prev.filter(c => c.id !== id));
    showToastMsg('הלקוח נמחק בהצלחה ועודכנו שיוכי קווים פעילים', 'info');
  };

  const handleUpdateClient = (uc: Client) => {
    const oldClient = clients.find(c => c.id === uc.id);
    if (oldClient && oldClient.name !== uc.name) {
      setDestSettings(prev => prev.map(s => ({
        ...s,
        assignedClientName:
          s.assignedClients[0] === uc.id || s.assignedClients[0] === oldClient.name
            ? uc.name
            : s.assignedClientName,
      })));
    }

    setClients(prev => prev.map(c => c.id === uc.id ? uc : c));
    showToastMsg('פרטי הלקוח עודכנו בהצלחה', 'success');
  };

  // Update line destination config
  const handleSaveDestSettings = async (updated: DestSetting) => {
    const clientId = updated.assignedClients[0] || null;
    const clientName =
      updated.assignedClientName ||
      (clientId ? resolveClientLabel(clientId) : '');

    const toSave: DestSetting = {
      ...updated,
      assignedClientName: clientName,
    };

    setDestSettings(prev => {
      if (prev.some(s => s.dest === toSave.dest)) {
        return prev.map(s => s.dest === toSave.dest ? toSave : s);
      }
      return [...prev, toSave];
    });
    setEditingDestSetting(null);

    if (token && embedded) {
      try {
        await fetch(`${API_BASE}/dest-settings/${encodeURIComponent(toSave.dest)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            assignedClientId: clientId,
            assignedClientName: clientName,
            assignedClients: toSave.assignedClients,
            googleSheetsUrl: toSave.googleSheetsUrl,
            webhookUrl: toSave.webhookUrl,
            isActive: toSave.isActive,
            notes: toSave.notes,
          }),
        });
        setDestSettingsFromMongo(true);
      } catch (e) {
        console.error('Failed to persist dest setting:', e);
        showToastMsg('ההגדרות נשמרו מקומית בלבד — שמירה לשרת נכשלה', 'error');
      }
    }

    if (toSave.googleSheetsUrl) {
      showToastMsg('שומר הגדרות ומסנכרן היסטוריית הודעות לגוגל שיטס...', 'info');
      const { sent, total } = await syncGoogleSheetsHistory(toSave, { silent: true });
      showToastMsg(
        `הגדרות קו ${toSave.dest} נשמרו! ${sent} הודעות היסטוריות נשלחו לגוגל שיטס (מתוך ${total})`,
        'success'
      );
    } else {
      showToastMsg(`הגדרות קו ${toSave.dest} עודכנו בהצלחה!`, 'success');
    }
  };

  // Custom visual CSS statistics counts
  const totalMessageCount = messages.length;
  const filteredMessageCount = filteredMessages.length;
  const activeRoutesCount = visibleDestSettings.filter(d => d.isActive).length;
  const totalClientsCount = clients.length;

  const displayEmail = userEmail || loginEmail;

  const tabButtons = (
    <>
      <button
        onClick={() => setActiveTab('sms_in')}
        className={`${embedded ? 'shrink-0' : 'w-full text-right'} flex items-center ${embedded ? 'gap-1.5 px-3 py-2' : 'justify-between px-3 py-2.5'} rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          activeTab === 'sms_in'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <span className="flex items-center gap-2">
          <MessageSquare size={16} />
          <span>הודעות נכנסות</span>
        </span>
        {!embedded && totalMessageCount > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            activeTab === 'sms_in' ? 'bg-white text-sky-800' : 'bg-slate-100 text-slate-600'
          }`}>{totalMessageCount}</span>
        )}
      </button>

      {isAdmin && (
        <button
          onClick={() => setActiveTab('routing')}
          className={`${embedded ? 'shrink-0' : 'w-full text-right'} flex items-center gap-2 ${embedded ? 'px-3 py-2' : 'px-3 py-2.5'} rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'routing'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          }`}
        >
          <GitFork size={16} />
          <span>שיוך קווים</span>
        </button>
      )}

      {isAdmin && (
        <button
          onClick={() => setActiveTab('clients')}
          className={`${embedded ? 'shrink-0' : 'w-full text-right'} flex items-center gap-2 ${embedded ? 'px-3 py-2' : 'px-3 py-2.5'} rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'clients'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
          }`}
        >
          <Users size={16} />
          <span>ניהול לקוחות</span>
        </button>
      )}

      <button
        onClick={() => setActiveTab('integrations')}
        className={`${embedded ? 'shrink-0' : 'w-full text-right'} flex items-center gap-2 ${embedded ? 'px-3 py-2' : 'px-3 py-2.5'} rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          activeTab === 'integrations'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <FileSpreadsheet size={16} />
        <span>ווב-הוקס</span>
      </button>

      <button
        onClick={() => setActiveTab('dashboard')}
        className={`${embedded ? 'shrink-0' : 'w-full text-right'} flex items-center gap-2 ${embedded ? 'px-3 py-2' : 'px-3 py-2.5'} rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          activeTab === 'dashboard'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <LayoutDashboard size={16} />
        <span>סטטיסטיקה</span>
      </button>
    </>
  );

  return (
    <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-slate-50 text-right flex flex-col font-sans`} dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -40, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-2.5 max-w-sm ${
              toast.type === 'success' 
                ? 'bg-slate-900 text-emerald-400 border-slate-800' 
                : toast.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border-rose-800'
                : 'bg-slate-900 text-sky-400 border-slate-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-bold leading-relaxed">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!embedded && !isLoggedIn ? (
        /* ==================== LOGIN SCREEN ==================== */
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
          {/* Subtle grid pattern for light mode background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
          
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl relative z-10">
            {/* Mesergo Logo */}
            <div className="text-center space-y-2 mb-8">
              <div className="mx-auto w-14 h-14 bg-sky-600 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-md ring-4 ring-sky-100/30">
                m
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">mesergo</h1>
                <span className="text-[10px] text-sky-600 uppercase tracking-widest font-bold">Solutions & Routing Gateway</span>
              </div>
              <p className="text-xs text-slate-500 pt-1.5 font-medium leading-relaxed">המערכת המרכזית לניהול, ניתוב ווב-הוק ושליית הודעות נכנסות</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">כתובת אימייל מורשת</label>
                <input 
                  type="email"
                  dir="ltr"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@mesergo.co.il"
                  className="w-full text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-4 py-3 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">סיסמת מנהל (אדמין)</label>
                <input 
                  type="password"
                  dir="ltr"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="הזן סיסמה..."
                  className="w-full text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-4 py-3 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-mono transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">סיסמת הדגמה ברירת מחדל: <code className="bg-slate-100 px-1 rounded text-sky-700 font-semibold">admin</code></span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 bg-slate-50" />
                  <span>זכור אותי במחשב זה</span>
                </label>
                <span className="text-sky-600 font-semibold hover:underline cursor-pointer">שכחת סיסמה?</span>
              </div>

              <button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 px-4 rounded-lg text-xs tracking-wide transition-all shadow-md hover:shadow-sky-500/10 mt-2 cursor-pointer"
              >
                כניסה מאובטחת לאדמין
              </button>
            </form>

            <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
              מערכת ניהול מבית מסרגו פתרונות תקשורת בע"מ (2026)
            </div>
          </div>
        </div>
      ) : (
        /* ==================== ADMIN SYSTEM LAYOUT ==================== */
        <div className={`flex-1 flex flex-col ${embedded ? 'h-full overflow-hidden' : 'md:flex-row min-h-screen'}`}>
          
          {!embedded && (
          <aside className="w-full md:w-64 bg-white text-slate-800 border-l border-slate-200 flex flex-col justify-between shrink-0 relative z-20">
            <div>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-sky-600 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md">
                    m
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base tracking-tight text-slate-950 leading-none">mesergo</h2>
                    <span className="text-[9px] text-sky-600 font-bold block mt-0.5 tracking-wider uppercase">SMS Management</span>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded uppercase">LIVE</span>
              </div>

              <nav className="p-4 space-y-1">
                {tabButtons}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-700">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200/60">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold border border-slate-300">
                  AD
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-slate-900 truncate text-[11px]">{displayEmail}</p>
                  <p className="text-[10px] text-slate-500">אדמין ראשי מורשה</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded px-2.5 py-1.5 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer font-bold border border-slate-200"
              >
                <LogOut size={13} />
                <span>התנתקות</span>
              </button>
            </div>
          </aside>
          )}

          <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
            
            {/* TOP ACTIONS RIBBON */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 z-10">
              <div>
                <span className="text-[10px] text-sky-600 font-extrabold uppercase tracking-widest block">Mesergo SMS Core Router</span>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                  {activeTab === 'sms_in' && 'הודעות SMS נכנסות מהטבלה'}
                  {activeTab === 'routing' && 'שיוך וניתוב קווי destination ללקוחות קצה'}
                  {activeTab === 'clients' && 'ניהול לקוחות קצה'}
                  {activeTab === 'integrations' && 'חיבור ל-Google Sheets Webhook'}
                  {activeTab === 'dashboard' && 'סקירה כללית וסטטיסטיקה'}
                </h1>
              </div>

            </header>

            {embedded && (
              <nav className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap gap-1.5 overflow-x-auto shrink-0">
                {tabButtons}
              </nav>
            )}

            {/* MAIN INTERNAL ROUTE VIEWS */}
            <div className="p-6 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
              
              {/* STATUS WIDGET BAR - Always visible for quick insights */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shrink-0 shadow-xs">
                  <span className="text-slate-400 text-xs font-semibold block uppercase">סך כל ה-SMS</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">{totalMessageCount}</span>
                    <span className="text-[10px] text-slate-500 font-bold">הודעות רשומות</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shrink-0 shadow-xs">
                  <span className="text-slate-400 text-xs font-semibold block uppercase">מסוננות בטבלה</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-sky-700 font-mono">{filteredMessageCount}</span>
                    <span className="text-[10px] text-slate-500 font-bold">מתוך {totalMessageCount}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shrink-0 shadow-xs">
                  <span className="text-slate-400 text-xs font-semibold block uppercase">קווים מנותבים פעילים</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-600 font-mono">{activeRoutesCount}</span>
                    <span className="text-[10px] text-slate-500 font-bold">מתוך {visibleDestSettings.length} במסגרת</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shrink-0 shadow-xs">
                  <span className="text-slate-400 text-xs font-semibold block uppercase">מאגר לקוחות קצה</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-indigo-600 font-mono">{totalClientsCount}</span>
                    <span className="text-[10px] text-slate-500 font-bold">חברות שונות</span>
                  </div>
                </div>
              </div>

              {/* VIEW SWITCHER CONTAINER */}
              <div>

                {/* 1. MAIN SMS TAB VIEW */}
                {activeTab === 'sms_in' && (
                  <div className="space-y-4">

                    {/* ADVANCED FILTER BAR */}
                    <div className="bg-white shadow-xs rounded-xl border border-slate-200 p-4 space-y-4">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <Filter size={15} className="text-sky-600" />
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">מסננים מובנים וניהול חיפוש</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Search keyword input */}
                        <div className="lg:col-span-2 relative">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">חפש לפי מספר שולח / תוכן הודעה / מזהה</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={searchText}
                              onChange={(e) => setSearchText(e.target.value)}
                              placeholder="סינון חופשי עפ מספר או טקסט וכו..." 
                              className="w-full text-xs pr-8 pl-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all font-medium"
                            />
                            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>

                        {/* Filter by dest input */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">נתב / קו נמען (dest)</label>
                          <select 
                            value={filterDest}
                            onChange={(e) => setFilterDest(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                          >
                            <option value="all">כל המספרים המקבלים (הכל)</option>
                            {messageDestNumbers.map(dest => (
                              <option key={dest} value={dest}>{dest}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter by clients associated — admin only */}
                        {isAdmin && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">לקוח משויך לקו</label>
                            <select 
                              value={filterClient}
                              onChange={(e) => setFilterClient(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                            >
                              <option value="all">כל הלקוחות</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Range/Date Filter elements wrapper */}
                        <div className="flex gap-1 items-end sm:col-span-2 lg:col-span-1">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">מתאריך</label>
                            <input 
                              type="date"
                              value={filterDateStart}
                              onChange={(e) => setFilterDateStart(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-white text-left"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">עד תאריך</label>
                            <input 
                              type="date"
                              value={filterDateEnd}
                              onChange={(e) => setFilterDateEnd(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-white text-left"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action options in filter bank */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleExportCSV()}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg px-3.5 py-2 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Download size={13} />
                            <span>יצא הכל ל-CSV ({filteredMessageCount})</span>
                          </button>
                          
                          <button
                            onClick={() => setShowExportDateModal(true)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg px-3.5 py-2 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Calendar size={13} className="text-slate-500" />
                            <span>יצא לפי תאריך ספציפי</span>
                          </button>
                        </div>

                        {(searchText || filterDest !== 'all' || filterClient !== 'all' || filterDateStart || filterDateEnd) && (
                          <button
                            onClick={() => {
                              setSearchText('');
                              setFilterDest('all');
                              setFilterClient('all');
                              setFilterDateStart('');
                              setFilterDateEnd('');
                              showToastMsg('המסננים נוקו בהצלחה', 'info');
                            }}
                            className="text-xs text-sky-600 hover:text-sky-700 font-bold underline"
                          >
                            נקה מסננים פעילים
                          </button>
                        )}
                      </div>
                    </div>

                    {/* TABLE CONTROLLER & VISUAL */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold">
                          {filteredMessageCount > 0 ? (
                            <>
                              מציג <span className="text-sky-600 font-extrabold">{pageStart}-{pageEnd}</span> מתוך{' '}
                              <span className="font-extrabold">{filteredMessageCount}</span> הודעות
                              {filteredMessageCount !== totalMessageCount && (
                                <> (סוננו מ-{totalMessageCount})</>
                              )}
                            </>
                          ) : (
                            <>אין הודעות תואמות (נטענו {totalMessageCount} מ-MongoDB)</>
                          )}
                        </span>
                        
                      </div>

                      {/* RESPONSIVE TABLE FRAMEWORK */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                              <th className="p-4 text-right">נמען</th>
                              <th className="p-4 text-right">מי שלח</th>
                              <th className="p-4 text-right whitespace-nowrap">תאריך</th>
                              <th className="p-4 text-right min-w-[300px]">תוכן ההודעה</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedMessages.map((msg) => (
                                <tr 
                                  key={msg.id_}
                                  className="hover:bg-slate-50 transition-colors group"
                                >
                                  <td className="p-4 font-mono font-bold text-slate-800 align-middle">
                                    {msg.dest}
                                  </td>

                                  <td className="p-4 font-bold text-slate-700 align-middle">
                                    <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-mono text-xs">{msg.phone}</span>
                                  </td>

                                  <td className="p-4 text-slate-600 align-middle whitespace-nowrap font-mono text-[11px]">
                                    {msg.date}
                                  </td>

                                  <td className="p-4 text-slate-800 align-middle leading-relaxed font-normal whitespace-normal break-words max-w-md">
                                    <span className="text-slate-800 text-[12px] font-medium pre-wrap text-right">{msg.message}</span>
                                  </td>
                                </tr>
                            ))}

                            {filteredMessages.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-400 text-sm font-medium">
                                  <div className="max-w-xs mx-auto space-y-1">
                                    <AlertCircle className="mx-auto text-slate-300" size={32} />
                                    <p className="font-bold text-slate-700 mt-2">לא נמצאו הודעות SMS תואמות</p>
                                    <p className="text-xs text-slate-400">
                                      {!isAdmin && myAssignedDests && myAssignedDests.size === 0
                                        ? 'עדיין לא שויך אליך קו SMS. פנה למנהל המערכת לשיוך קו.'
                                        : 'נסה לשנות את פרמטרי החיפוש או לבטל מסננים קיימים.'}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {filteredMessages.length > MESSAGES_PAGE_SIZE && (
                        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                          <button
                            type="button"
                            disabled={messagesPage <= 1}
                            onClick={() => setMessagesPage(p => p - 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <ChevronRight size={14} />
                            <span>הקודם</span>
                          </button>

                          <span className="text-xs text-slate-500 font-bold">
                            עמוד <span className="text-sky-600">{messagesPage}</span> מתוך {totalPages}
                          </span>

                          <button
                            type="button"
                            disabled={messagesPage >= totalPages}
                            onClick={() => setMessagesPage(p => p + 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <span>הבא</span>
                            <ChevronLeft size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* 2. ROUTING & LINE SETTINGS TAB (admin only) */}
                {isAdmin && activeTab === 'routing' && (
                  <div className="space-y-4">
                    <div className="bg-sky-50/60 rounded-xl border border-sky-100 p-4 text-xs text-sky-900">
                      קווים מוצגים אוטומטית מתוך מספרי הנמען (dest) שנכנסו להודעות ממסד הנתונים. לחץ על שורה לעריכת שיוך לקוח, Google Sheets ו-Webhook.
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              <th className="px-4 py-3 text-right">קו נמען (dest)</th>
                              <th className="px-4 py-3 text-right">סטטוס</th>
                              <th className="px-4 py-3 text-right">לקוח משויך</th>
                              <th className="px-4 py-3 text-right">Google Sheets</th>
                              <th className="px-4 py-3 text-right">Webhook</th>
                              <th className="px-4 py-3 text-right">הערות</th>
                              <th className="px-4 py-3 text-center w-28">פעולות</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visibleDestSettings.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                  אין קווים להצגה — טען הודעות ממסד הנתונים או המתן להודעות נכנסות
                                </td>
                              </tr>
                            ) : visibleDestSettings.map((ds) => (
                              <tr key={ds.dest} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{ds.dest}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    ds.isActive
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}>
                                    {ds.isActive ? 'פעיל' : 'מנוטרל'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 max-w-[160px]">
                                  {ds.assignedClients[0] ? (
                                    <span className="text-slate-700 font-medium truncate block">
                                      {ds.assignedClientName || resolveClientLabel(ds.assignedClients[0])}
                                    </span>
                                  ) : (
                                    <span className="text-rose-500 italic font-medium">לא משויך</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                  {ds.googleSheetsUrl ? (
                                    <span className="font-mono text-[10px] text-sky-700 truncate block" dir="ltr" title={ds.googleSheetsUrl}>
                                      {ds.googleSheetsUrl}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                  {ds.webhookUrl ? (
                                    <span className="font-mono text-[10px] text-indigo-700 truncate block" dir="ltr" title={ds.webhookUrl}>
                                      {ds.webhookUrl}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[140px]">
                                  <span className="text-slate-500 truncate block">{ds.notes || '—'}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => setEditingDestSetting(ds)}
                                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Link2 size={12} />
                                    עריכה
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}


                {/* 3. CLIENTS MANAGER TAB (admin only) */}
                {isAdmin && activeTab === 'clients' && (
                  <ClientsManager
                    clients={clients}
                    onAdd={handleAddClient}
                    onDelete={handleDeleteClient}
                    onUpdate={handleUpdateClient}
                    readOnly={clientsFromMongo || embedded}
                    loading={isLoadingClients}
                  />
                )}


                {/* 4. INTEGRATIONS GUIDE & LOGS TAB */}
                {activeTab === 'integrations' && (
                  <WebhookSimulator 
                    logs={webhookLogs} 
                    onClearLogs={() => setWebhookLogs([])}
                    defaultWebhookUrl={visibleDestSettings.length > 0 ? (visibleDestSettings[0].googleSheetsUrl || visibleDestSettings[0].webhookUrl) : ''}
                  />
                )}


                {/* 5. DASHBOARD STATS OVERVIEW TAB */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                      <h2 className="text-lg font-bold text-slate-900 mb-2">סקירת מערכת ניתוב SMS - מסרגו</h2>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        מערכת זו מאפשרת לקבל הודעות נכנסות ממכשירי הקצה של לקוחותינו ולנתב אותם בזמן אמת אל קובצי Google Sheets וניהול לקוחות מרובים במקביל בצורה מאובטחת.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Distribution statistics chart placeholder (simulated clean CSS layout) */}
                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm">פופולריות קווים (סך הודעות נכנסות לקו)</h3>
                        <div className="space-y-3.5 pt-2">
                          {messageDestNumbers.map(dest => {
                            const count = messages.filter(m => m.dest === dest).length;
                            const percentage = totalMessageCount > 0 ? (count / totalMessageCount) * 100 : 0;
                            return (
                              <div key={dest} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-mono text-slate-700 font-bold">{dest}</span>
                                  <span className="text-slate-500">{count} SMS ({Math.round(percentage)}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                                  <div 
                                    className="bg-sky-600 h-full rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick helpers links */}
                      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm">מדריכים וכלים חיצוניים</h3>
                        <div className="space-y-2 text-xs">
                          <a 
                            href="https://script.google.com" 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border block transition-colors font-medium text-slate-700 flex items-center justify-between"
                          >
                            <span>פתח את Google Apps Script Console 📊</span>
                            <ExternalLink size={14} className="text-slate-400" />
                          </a>
                          <div className="p-3 bg-slate-50 rounded-lg border text-slate-600 leading-relaxed text-[11px] space-y-1">
                            <span className="font-bold text-slate-800 block">עצה לפריסת Webhook מנצחת:</span>
                            <p>במידה ומשתמשים בקוד ה-Apps Script, מומלץ תמיד לקבוע הרשאת ריצה של "Everyone - כולל כולם" כדי לאפשר לנתב מסרגו לקשר את הודעות ה-SMS בצורה חופשית ללא הפרעה.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {!embedded && (
            <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-[10px] text-slate-400">
              כל הזכויות שמורות למנהל אדמין Mesergo Solutions. מחובר כעת: {displayEmail}
            </footer>
            )}
          </main>

        </div>
      )}

      {/* ==================== 1. MODAL: EDIT DEST ROUTING SETTINGS ==================== */}
      {isAdmin && editingDestSetting && (
        <LineSettingsModal
          setting={editingDestSetting}
          allClients={clients}
          historyMessageCount={messages.filter(m => m.dest === editingDestSetting.dest).length}
          onSyncHistory={(draft) => syncGoogleSheetsHistory(draft)}
          onClose={() => setEditingDestSetting(null)}
          onSave={handleSaveDestSettings}
        />
      )}

      {/* ==================== 2. MODAL: EXPORT BY DATE PICKER ==================== */}
      {showExportDateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-900 text-sm">ייצוא הודעות SMS לפי תאריך מוגדר</h4>
              <button 
                onClick={() => setShowExportDateModal(false)}
                className="text-slate-400 hover:text-slate-600 block"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">בחר תאריך יעד לייצוא</label>
              <input 
                type="date"
                value={expDateStr}
                onChange={(e) => setExpDateStr(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-left font-mono focus:bg-white focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">כל הודעות ה-SMS אשר הגיעו למערכת בתאריך נבחר זה, יסוננו וייוצאו כקובץ Excel CSV קריא.</p>
            </div>

            <div className="flex gap-2.5 justify-end text-xs font-semibold pt-2">
              <button
                onClick={() => setShowExportDateModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg"
              >
                ביטול
              </button>
              <button
                onClick={handleExportByParticularDate}
                className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2 rounded-lg flex items-center gap-1"
              >
                <Download size={13} />
                ייצא והורד
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
