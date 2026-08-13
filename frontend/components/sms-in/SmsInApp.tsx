/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const MESSAGES_PAGE_SIZE = 50;

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api/sms-in'
  : `${window.location.origin}/api/sms-in`;

type SmsInTab = 'dashboard' | 'sms_in' | 'routing' | 'clients' | 'integrations';

interface SmsInAppProps {
  embedded?: boolean;
  userEmail?: string;
  userId?: string;
  userName?: string;
  /**
   * Management UI (routing / clients filters).
   * Does NOT by itself mean "see every SMS" — use viewAll for that.
   */
  isAdmin?: boolean;
  /**
   * /admin panel only: load the full system inbox (all messages, all lines).
   * Regular accounts — including role=admin — must leave this false/undefined.
   */
  viewAll?: boolean;
  /** Auth token for fetching platform clients from MongoDB */
  token?: string | null;
  /** Open on a specific tab (e.g. Settings → שיוך קווים). */
  initialTab?: SmsInTab;
  /** When set, only this tab is shown and the tab switcher is hidden. */
  lockedTab?: SmsInTab;
}

export default function SmsInApp({
  embedded = false,
  userEmail,
  userId,
  userName,
  isAdmin: isAdminProp,
  viewAll = false,
  token,
  initialTab,
  lockedTab,
}: SmsInAppProps) {
  // Standalone demo = full admin UI; when embedded in botWa, only real admins get assignment tabs
  const isAdmin = isAdminProp ?? !embedded;
  // /admin panel → always every message; user SMS tab → only assigned lines
  const seeAllMessages = viewAll || (!embedded && isAdmin);
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
  const [activeTab, setActiveTab] = useState<SmsInTab>(() => lockedTab || initialTab || 'sms_in');

  // Keep locked tab in sync (e.g. Settings embed always on routing)
  useEffect(() => {
    if (lockedTab) setActiveTab(lockedTab);
  }, [lockedTab]);

  // Non-admins never stay on admin-only setup tabs
  useEffect(() => {
    if (lockedTab) return;
    if (!isAdmin && (activeTab === 'routing' || activeTab === 'clients')) {
      setActiveTab('sms_in');
      setEditingDestSetting(null);
    }
  }, [isAdmin, activeTab, lockedTab]);

  // Filters State
  const [searchText, setSearchText] = useState('');
  const [filterDest, setFilterDest] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [routingDestSearch, setRoutingDestSearch] = useState('');
  const [messagesPage, setMessagesPage] = useState(1);
  const [isExportingAll, setIsExportingAll] = useState(false);

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
  const [searchTotal, setSearchTotal] = useState<number | null>(null);

  /** Auth headers for SMS API calls. */
  const buildApiHeaders = (extra?: HeadersInit): HeadersInit => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (extra) Object.assign(headers, extra);
    return headers;
  };

  /** Management panel (/admin) uses dedicated unscoped admin routes. */
  const messagesEndpoint = seeAllMessages ? `${API_BASE}/admin/messages` : `${API_BASE}/messages`;
  const destSettingsEndpoint = seeAllMessages || isAdmin
    ? `${API_BASE}/admin/dest-settings`
    : `${API_BASE}/dest-settings`;

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

  // Fetch platform customers (User accounts) from MongoDB for line assignment
  const fetchClients = async () => {
    if (!token || !isAdmin) return;
    setIsLoadingClients(true);
    try {
      const res = await fetch(`${API_BASE}/clients`, {
        headers: buildApiHeaders(),
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
      const res = await fetch(destSettingsEndpoint, {
        headers: buildApiHeaders(),
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

  // Load when auth / management mode is ready (not only on first mount).
  // Message loading itself is handled by the paginated fetch effect below;
  // this just verifies DB connectivity and loads dest/line settings.
  useEffect(() => {
    fetchDbStatus();
    if (embedded && token) {
      fetchDestSettings();
    }
  }, [embedded, token, isAdmin, seeAllMessages]);

  useEffect(() => {
    if (embedded && token && isAdmin) {
      fetchClients();
    }
  }, [embedded, token, isAdmin]);

  // Load the current page from MongoDB whenever filters or the page number change.
  // Debounced so typing in the search box doesn't fire a request per keystroke.
  // Always server-paginated (page + limit), so scrolling through pages keeps going
  // across the entire collection instead of stopping at a fixed "recent 500" cap.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingMessages(true);
      try {
        const query = searchText.trim();
        const destQuery = filterDest !== 'all' ? filterDest.trim() : '';
        const params = new URLSearchParams({
          page: String(messagesPage),
          limit: String(MESSAGES_PAGE_SIZE),
        });
        if (query) params.set('q', query);
        if (destQuery) params.set('dest', destQuery);
        const res = await fetch(`${messagesEndpoint}?${params.toString()}`, {
          headers: buildApiHeaders(),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.source === 'mongodb' && Array.isArray(data.messages)) {
          setMessages(data.messages);
          setSearchTotal(Number(data.total) || 0);
          setMessagesSource('mongodb');
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Error loading SMS messages:', e);
          showToastMsg('טעינת הודעות ה-SMS נכשלה', 'error');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingMessages(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, filterDest, messagesPage, token, seeAllMessages, messagesEndpoint]);

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

  const sortedDestSettings = useMemo(() => {
    return [...destSettings].sort((a, b) => a.dest.localeCompare(b.dest));
  }, [destSettings]);

  const visibleDestSettings = useMemo(() => {
    const query = routingDestSearch.trim().toLowerCase();
    if (!query) return sortedDestSettings;
    return sortedDestSettings.filter((ds) => {
      const dest = ds.dest.toLowerCase();
      const clientName = (ds.assignedClientName || '').toLowerCase();
      const notes = (ds.notes || '').toLowerCase();
      return dest.includes(query) || clientName.includes(query) || notes.includes(query);
    });
  }, [sortedDestSettings, routingDestSearch]);

  const resolveClientLabel = (idOrName: string) => {
    const byId = clients.find(c => c.id === idOrName);
    if (byId) return byId.name;
    const byName = clients.find(c => c.name === idOrName);
    if (byName) return byName.name;
    return idOrName;
  };

  /** Dest lines belonging to the logged-in customer / admin-user account */
  const myAssignedDests = useMemo(() => {
    if (seeAllMessages || !userId) return null;
    return new Set(
      destSettings
        .filter(ds =>
          ds.assignedClients.includes(userId) ||
          ds.assignedClients.includes(userName || '') ||
          ds.assignedClients.includes(userEmail || '')
        )
        .map(ds => ds.dest)
    );
  }, [seeAllMessages, userId, userName, userEmail, destSettings]);

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

  // Messages are now always loaded page-by-page from the server (never a flat
  // "recent 500" snapshot), so the server's total/pagination is always authoritative.
  const isServerSearch = searchTotal !== null;

  // Filter messages logic
  const filteredMessages = messages.filter(msg => {
    // Customer / admin-user account: only their assigned lines (server already scopes; defense in depth)
    // /admin with viewAll: never scope here
    if (!seeAllMessages && userId && embedded) {
      if (!destSettingsFromMongo) {
        // Wait until we know which lines belong to this account
        return false;
      }
      if (!myAssignedDests || !myAssignedDests.has(msg.dest)) return false;
    }

    // 1. Text Search (Sender phone, content message, id_, destination)
    const textLower = searchText.toLowerCase();
    const matchText = isServerSearch || !searchText || 
      msg.phone.toLowerCase().includes(textLower) || 
      msg.message.toLowerCase().includes(textLower) || 
      msg.id_.toLowerCase().includes(textLower) || 
      msg.dest.toLowerCase().includes(textLower);

    // 2. Destination filter (exact when selected from list; partial when typed)
    const destLower = filterDest === 'all' ? '' : filterDest.trim().toLowerCase();
    const matchDest = !destLower || (
      isServerSearch
        ? true // server already filtered by dest
        : msg.dest.toLowerCase().includes(destLower)
    );

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

  const messageResultCount = isServerSearch ? (searchTotal ?? 0) : filteredMessages.length;
  const totalPages = Math.max(1, Math.ceil(messageResultCount / MESSAGES_PAGE_SIZE));
  const pageStart = messageResultCount === 0 ? 0 : (messagesPage - 1) * MESSAGES_PAGE_SIZE + 1;
  const pageEnd = Math.min(messagesPage * MESSAGES_PAGE_SIZE, messageResultCount);
  const paginatedMessages = isServerSearch
    ? filteredMessages
    : filteredMessages.slice(
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

  // Fetches the FULL matching dataset from the server (bypassing the 50-row page
  // load) for export purposes only. Reuses the current server-side filters
  // (searchText -> q, filterDest -> dest). Does NOT touch the paginated `messages` state.
  const fetchAllForExport = async (): Promise<{ messages: Message[]; total: number } | null> => {
    const query = searchText.trim();
    const destQuery = filterDest !== 'all' ? filterDest.trim() : '';
    try {
      const params = new URLSearchParams({ exportAll: 'true' });
      if (query) params.set('q', query);
      if (destQuery) params.set('dest', destQuery);
      const res = await fetch(`${messagesEndpoint}?${params.toString()}`, {
        headers: buildApiHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.source === 'mongodb' && Array.isArray(data.messages)) {
        return { messages: data.messages, total: Number(data.total) || data.messages.length };
      }
      return null;
    } catch (e) {
      console.error('Error fetching all messages for export:', e);
      return null;
    }
  };

  // Re-applies the client-only filters (associated client + date range) that are
  // never sent to the server, on top of a server-fetched export list.
  const applyExportOnlyFilters = (msgs: Message[]) => msgs.filter(msg => {
    // Defense in depth: server already scopes exportAll requests to allowedDests
    // for authenticated non-admin accounts.
    if (!seeAllMessages && userId && embedded) {
      if (!destSettingsFromMongo) return false;
      if (!myAssignedDests || !myAssignedDests.has(msg.dest)) return false;
    }

    let matchClient = true;
    if (isAdmin && filterClient !== 'all') {
      const lineSetting = destSettings.find(ds => ds.dest === msg.dest);
      matchClient = !!lineSetting && lineSetting.assignedClients.includes(filterClient);
    }

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

    return matchClient && matchDateRange;
  });

  // Export Filtered Messages to CSV
  const handleExportCSV = (customList?: Message[], options?: { suppressSuccessToast?: boolean }) => {
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

    if (!options?.suppressSuccessToast) {
      showToastMsg(`ייצוא של ${listToExport.length} הודעות בוצע בהצלחה!`, 'success');
    }
  };

  // Export ALL messages matching the current filters (not just the loaded/paginated
  // ones) — fetches the full matching set from the server first.
  // Export is only allowed once a dest (route/line) filter is selected, to avoid
  // accidentally exporting the entire, unscoped dataset.
  const hasDestFilter = filterDest !== 'all' && filterDest.trim().length > 0;

  const handleExportAllClick = async () => {
    if (isExportingAll) return;
    if (!hasDestFilter) {
      showToastMsg('יש לבחור נתב / קו נמען (dest) לפני ייצוא', 'error');
      return;
    }
    setIsExportingAll(true);
    try {
      const result = await fetchAllForExport();
      if (!result) {
        showToastMsg('שגיאה בטעינת ההודעות לייצוא', 'error');
        return;
      }
      const finalList = applyExportOnlyFilters(result.messages);
      if (finalList.length === 0) {
        showToastMsg('אין הודעות לייצוא בהתאם למסננים שנבחרו', 'error');
        return;
      }
      const isCapped = result.total > result.messages.length;
      handleExportCSV(finalList, { suppressSuccessToast: isCapped });
      if (isCapped) {
        showToastMsg(
          `יוצאו ${result.messages.length.toLocaleString()} מתוך ${result.total.toLocaleString()} הודעות התואמות למסננים — הקובץ אינו כולל את כל הרשומות`,
          'error'
        );
      }
    } finally {
      setIsExportingAll(false);
    }
  };

  // Export by Date Picker Dialog Helper
  const [expDateStr, setExpDateStr] = useState('');
  const handleExportByParticularDate = async () => {
    if (!expDateStr) {
      showToastMsg('נא לבחור תאריך תקין', 'error');
      return;
    }
    if (!hasDestFilter) {
      showToastMsg('יש לבחור נתב / קו נמען (dest) לפני ייצוא', 'error');
      return;
    }

    const selectedDate = new Date(expDateStr);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23,59,59,999);

    if (isExportingAll) return;
    setIsExportingAll(true);
    try {
      const result = await fetchAllForExport();
      if (!result) {
        showToastMsg('שגיאה בטעינת ההודעות לייצוא', 'error');
        return;
      }

      const matchDateList = result.messages.filter(m => {
        const dObj = parseMessageDate(m.date);
        return dObj >= startOfDay && dObj <= endOfDay;
      });

      if (matchDateList.length === 0) {
        showToastMsg(`לא נמצאו הודעות המתאימות לתאריך ${expDateStr}`, 'error');
        return;
      }

      const isCapped = result.total > result.messages.length;
      handleExportCSV(matchDateList, { suppressSuccessToast: isCapped });
      if (isCapped) {
        showToastMsg(
          `יוצאו ${result.messages.length.toLocaleString()} מתוך ${result.total.toLocaleString()} הודעות התואמות למסננים — ייתכן שהתאריך שנבחר אינו כולל את כל הרשומות`,
          'error'
        );
      }
      setShowExportDateModal(false);
    } finally {
      setIsExportingAll(false);
    }
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
          headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
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
  const activeRoutesCount = sortedDestSettings.filter(d => d.isActive).length;
  const totalClientsCount = clients.length;

  const displayEmail = userEmail || loginEmail;

  const embeddedTabClass = (active: boolean) =>
    `px-4 py-2 rounded-2xl text-sm font-bold transition cursor-pointer ${
      active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  const sidebarTabClass = (active: boolean) =>
    `w-full text-right flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-bold transition cursor-pointer ${
      active ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const tabButtons = !lockedTab ? (
    <>
      <button
        onClick={() => setActiveTab('sms_in')}
        className={embedded ? embeddedTabClass(activeTab === 'sms_in') : sidebarTabClass(activeTab === 'sms_in')}
      >
        <span className="flex items-center gap-2">
          <MessageSquare size={16} />
          <span>הודעות נכנסות</span>
        </span>
        {!embedded && totalMessageCount > 0 && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${
            activeTab === 'sms_in' ? 'bg-white text-sky-800' : 'bg-slate-100 text-slate-600'
          }`}>{totalMessageCount}</span>
        )}
      </button>

      {isAdmin && (
        <button
          onClick={() => setActiveTab('routing')}
          className={embedded
            ? `flex items-center gap-2 ${embeddedTabClass(activeTab === 'routing')}`
            : `flex items-center gap-2 ${sidebarTabClass(activeTab === 'routing')}`}
        >
          <GitFork size={16} />
          <span>שיוך קווים</span>
        </button>
      )}

      {isAdmin && (
        <button
          onClick={() => setActiveTab('clients')}
          className={embedded
            ? `flex items-center gap-2 ${embeddedTabClass(activeTab === 'clients')}`
            : `flex items-center gap-2 ${sidebarTabClass(activeTab === 'clients')}`}
        >
          <Users size={16} />
          <span>ניהול לקוחות</span>
        </button>
      )}

      <button
        onClick={() => setActiveTab('integrations')}
        className={embedded
          ? `flex items-center gap-2 ${embeddedTabClass(activeTab === 'integrations')}`
          : `flex items-center gap-2 ${sidebarTabClass(activeTab === 'integrations')}`}
      >
        <FileSpreadsheet size={16} />
        <span>ווב-הוקס</span>
      </button>

      <button
        onClick={() => setActiveTab('dashboard')}
        className={embedded
          ? `flex items-center gap-2 ${embeddedTabClass(activeTab === 'dashboard')}`
          : `flex items-center gap-2 ${sidebarTabClass(activeTab === 'dashboard')}`}
      >
        <LayoutDashboard size={16} />
        <span>סטטיסטיקה</span>
      </button>
    </>
  ) : null;

  const tabTitle =
    activeTab === 'sms_in' ? 'הודעות SMS נכנסות' :
    activeTab === 'routing' ? 'שיוך וניתוב קווים' :
    activeTab === 'clients' ? 'ניהול לקוחות' :
    activeTab === 'integrations' ? 'ווב-הוקס וחיבורים' :
    'סקירה וסטטיסטיקה';

  const tabSubtitle =
    activeTab === 'sms_in' ? 'צפייה, סינון וייצוא של הודעות SMS שנכנסו למערכת' :
    activeTab === 'routing' ? 'שיוך קווי destination ללקוחות קצה' :
    activeTab === 'clients' ? 'ניהול לקוחות הקצה במערכת' :
    activeTab === 'integrations' ? 'חיבור ל-Google Sheets ו-Webhook' :
    'תמונת מצב כללית של הניתוב וההודעות';

  return (
    <div
      className={`${embedded ? 'h-full' : 'min-h-screen'} bg-[#f8fafc] text-right flex flex-col font-medium`}
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      
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
            <span className="text-sm font-bold leading-relaxed">{toast.text}</span>
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

          <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] overflow-hidden">
            
            {/* TOP HEADER — matches bot pages (SendMessages / Contacts) */}
            <header className="bg-transparent px-6 py-4 z-10">
              {/* <div className="flex flex-col lg:flex-row-reverse lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900">{tabTitle}</h1>
                    <p className="text-slate-400 text-xs font-semibold mt-0.5">{tabSubtitle}</p>
                  </div>
                </div> */}

                {embedded && tabButtons && (
                  <div className="flex justify-center p-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {tabButtons}
                    </div>
                  </div>
                )}
              {/* </div> */}
            </header>

            {/* MAIN INTERNAL ROUTE VIEWS */}
            <div className="p-6 lg:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
              
              {/* STATUS WIDGET BAR — statistics tab only */}
              {activeTab === 'dashboard' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <span className="text-slate-400 text-xs font-semibold block">סך כל ה-SMS</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900">{totalMessageCount}</span>
                    <span className="text-xs text-slate-500 font-bold">הודעות רשומות</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <span className="text-slate-400 text-xs font-semibold block">מסוננות בטבלה</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-sky-700">{filteredMessageCount}</span>
                    <span className="text-xs text-slate-500 font-bold">מתוך {totalMessageCount}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <span className="text-slate-400 text-xs font-semibold block">קווים מנותבים פעילים</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-600">{activeRoutesCount}</span>
                    <span className="text-xs text-slate-500 font-bold">מתוך {sortedDestSettings.length} במסגרת</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <span className="text-slate-400 text-xs font-semibold block">מאגר לקוחות קצה</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-indigo-600">{totalClientsCount}</span>
                    <span className="text-xs text-slate-500 font-bold">חברות שונות</span>
                  </div>
                </div>
              </div>
              )}

              {/* VIEW SWITCHER CONTAINER */}
              <div>

                {/* 1. MAIN SMS TAB VIEW */}
                {activeTab === 'sms_in' && (
                  <div className="space-y-4">

                    {/* ADVANCED FILTER BAR */}
                    <div className="bg-white shadow-sm rounded-2xl border border-slate-100 p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Filter size={16} className="text-sky-600" />
                        <h3 className="font-black text-slate-900 text-sm">מסננים וחיפוש</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Search keyword input */}
                        <div className="lg:col-span-2 relative">
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">חפש לפי מספר שולח / תוכן הודעה / מזהה</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={searchText}
                              onChange={(e) => setSearchText(e.target.value)}
                              placeholder="סינון חופשי לפי מספר או טקסט..." 
                              className="w-full text-sm pr-9 pl-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium"
                            />
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>

                        {/* Filter by dest — searchable input + suggestions */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">נתב / קו נמען (dest)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={filterDest === 'all' ? '' : filterDest}
                              onChange={(e) => {
                                const value = e.target.value;
                                setFilterDest(value.trim() ? value : 'all');
                              }}
                              list="dest-numbers-list"
                              placeholder="חפש מספר נמען..."
                              dir="ltr"
                              className="w-full text-sm pr-9 pl-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium text-left"
                            />
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <datalist id="dest-numbers-list">
                              {messageDestNumbers.map(dest => (
                                <option key={dest} value={dest} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        {/* Filter by clients associated — admin only */}
                        {isAdmin && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">לקוח משויך לקו</label>
                            <select 
                              value={filterClient}
                              onChange={(e) => setFilterClient(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 font-medium"
                            >
                              <option value="all">כל הלקוחות</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Range/Date Filter elements wrapper */}
                        <div className="flex gap-2 items-end sm:col-span-2 lg:col-span-1">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">מתאריך</label>
                            <input 
                              type="date"
                              value={filterDateStart}
                              onChange={(e) => setFilterDateStart(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white text-left font-medium focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">עד תאריך</label>
                            <input 
                              type="date"
                              value={filterDateEnd}
                              onChange={(e) => setFilterDateEnd(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-2xl px-3 py-2.5 bg-white text-left font-medium focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action options in filter bank */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleExportAllClick()}
                              disabled={isExportingAll || !hasDestFilter}
                              title={!hasDestFilter ? 'יש לבחור נתב / קו נמען (dest) לפני ייצוא' : undefined}
                              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download size={14} />
                              <span>{isExportingAll ? 'מייצא...' : `יצא הכל ל-CSV (${messageResultCount})`}</span>
                            </button>
                            
                            <button
                              onClick={() => setShowExportDateModal(true)}
                              disabled={!hasDestFilter}
                              title={!hasDestFilter ? 'יש לבחור נתב / קו נמען (dest) לפני ייצוא' : undefined}
                              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 font-bold rounded-2xl px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Calendar size={14} className="text-slate-500" />
                              <span>יצא לפי תאריך ספציפי</span>
                            </button>
                          </div>
                          {!hasDestFilter && (
                            <p className="text-xs font-semibold text-amber-600">יש לבחור נתב / קו נמען (dest) כדי לאפשר ייצוא</p>
                          )}
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
                            className="text-sm text-sky-600 hover:text-sky-700 font-bold"
                          >
                            נקה מסננים פעילים
                          </button>
                        )}
                      </div>
                    </div>

                    {/* TABLE CONTROLLER & VISUAL */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-sm text-slate-500 font-bold">
                          {messageResultCount > 0 ? (
                            <>
                              מציג <span className="text-sky-600 font-black">{pageStart}-{pageEnd}</span> מתוך{' '}
                              <span className="font-black text-slate-800">{messageResultCount}</span> הודעות
                              {!isServerSearch && filteredMessageCount !== totalMessageCount && (
                                <> (סוננו מ-{totalMessageCount})</>
                              )}
                            </>
                          ) : (
                            <>אין הודעות תואמות</>
                          )}
                        </span>
                        
                      </div>

                      {filteredMessages.length === 0 ? (
                        <div className="py-16 sm:py-20 flex flex-col items-center justify-center gap-3 text-slate-300 px-4">
                          <AlertCircle size={48} strokeWidth={1} />
                          <p className="text-lg font-bold text-center text-slate-700">לא נמצאו הודעות SMS תואמות</p>
                          <p className="text-sm text-slate-400 font-semibold text-center">
                            {!isAdmin && myAssignedDests && myAssignedDests.size === 0
                              ? 'עדיין לא שויך אליך קו SMS. פנה למנהל המערכת לשיוך קו.'
                              : 'נסה לשנות את פרמטרי החיפוש או לבטל מסננים קיימים.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Mobile cards — same responsive language as the contacts table */}
                          <div className="lg:hidden p-3 space-y-3 bg-slate-50/40">
                            {paginatedMessages.map((msg) => (
                              <div key={`mobile-${msg.id_}`} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                                    <MessageSquare size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 truncate">{msg.phone}</p>
                                    <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">אל {msg.dest}</p>
                                  </div>
                                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{msg.date}</span>
                                </div>
                                <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                  <p className="text-xs text-slate-400 font-bold mb-1">תוכן ההודעה</p>
                                  <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{msg.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop table — mirrors the contacts table grid and spacing */}
                          <div className="hidden lg:block overflow-x-auto">
                            <div className="min-w-[760px]">
                              <div
                                className="grid gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide"
                                style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2.5fr' }}
                              >
                                <span>נמען</span>
                                <span>מי שלח</span>
                                <span>תאריך</span>
                                <span>תוכן ההודעה</span>
                              </div>

                              {paginatedMessages.map((msg, idx) => (
                                <div
                                  key={msg.id_}
                                  className={`grid gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 transition-colors ${
                                    idx !== paginatedMessages.length - 1 ? 'border-b border-slate-100' : ''
                                  }`}
                                  style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2.5fr' }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                                      <MessageSquare size={15} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 truncate">{msg.dest}</span>
                                  </div>
                                  <div className="text-sm font-semibold text-slate-700 truncate">{msg.phone}</div>
                                  <div className="text-sm text-slate-400 font-medium whitespace-nowrap">{msg.date}</div>
                                  <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{msg.message}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {messageResultCount > MESSAGES_PAGE_SIZE && (
                        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                          <button
                            type="button"
                            disabled={messagesPage <= 1}
                            onClick={() => setMessagesPage(p => p - 1)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <ChevronRight size={14} />
                            <span>הקודם</span>
                          </button>

                          <span className="text-sm text-slate-500 font-bold">
                            עמוד <span className="text-sky-600">{messagesPage}</span> מתוך {totalPages}
                          </span>

                          <button
                            type="button"
                            disabled={messagesPage >= totalPages}
                            onClick={() => setMessagesPage(p => p + 1)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                    <div className="bg-sky-50 rounded-2xl border border-sky-100 p-4 text-sm text-sky-900 font-semibold">
                      קווים מוצגים אוטומטית מתוך מספרי הנמען (dest) שנכנסו להודעות ממסד הנתונים. לחץ על שורה לעריכת שיוך לקוח, Google Sheets ו-Webhook.
                    </div>

                    <div className="bg-white shadow-sm rounded-2xl border border-slate-100 p-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">חפש קו נמען</label>
                      <div className="relative max-w-md">
                        <input
                          type="text"
                          value={routingDestSearch}
                          onChange={(e) => setRoutingDestSearch(e.target.value)}
                          placeholder="חפש לפי מספר נמען / לקוח / הערה..."
                          className="w-full text-sm pr-9 pl-3 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600 transition-all font-medium"
                        />
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {routingDestSearch.trim() && (
                        <p className="mt-2 text-xs text-slate-500 font-bold">
                          מציג {visibleDestSettings.length} מתוך {destSettings.length} קווים
                        </p>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500">
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
                                <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-semibold">
                                  {routingDestSearch.trim()
                                    ? 'לא נמצאו קווים תואמים לחיפוש'
                                    : 'אין קווים להצגה — טען הודעות ממסד הנתונים או המתן להודעות נכנסות'}
                                </td>
                              </tr>
                            ) : visibleDestSettings.map((ds) => (
                              <tr key={ds.dest} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{ds.dest}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                                    ds.isActive
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}>
                                    {ds.isActive ? 'פעיל' : 'מנוטרל'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 max-w-[160px]">
                                  {ds.assignedClients[0] ? (
                                    <span className="text-slate-700 font-semibold truncate block">
                                      {ds.assignedClientName || resolveClientLabel(ds.assignedClients[0])}
                                    </span>
                                  ) : (
                                    <span className="text-rose-500 italic font-semibold">לא משויך</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                  {ds.googleSheetsUrl ? (
                                    <span className="text-xs text-sky-700 truncate block font-medium" dir="ltr" title={ds.googleSheetsUrl}>
                                      {ds.googleSheetsUrl}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                  {ds.webhookUrl ? (
                                    <span className="text-xs text-indigo-700 truncate block font-medium" dir="ltr" title={ds.webhookUrl}>
                                      {ds.webhookUrl}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[140px]">
                                  <span className="text-slate-500 truncate block font-medium">{ds.notes || '—'}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => setEditingDestSetting(ds)}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-2xl transition-colors cursor-pointer inline-flex items-center gap-1"
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
                    defaultWebhookUrl={sortedDestSettings.length > 0 ? (sortedDestSettings[0].googleSheetsUrl || sortedDestSettings[0].webhookUrl) : ''}
                  />
                )}


                {/* 5. DASHBOARD STATS OVERVIEW TAB */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                      <h2 className="text-lg font-black text-slate-900 mb-2">סקירת מערכת ניתוב SMS</h2>
                      <p className="text-sm text-slate-500 font-semibold leading-relaxed">
                        מערכת זו מאפשרת לקבל הודעות נכנסות ממכשירי הקצה של לקוחותינו ולנתב אותם בזמן אמת אל קובצי Google Sheets וניהול לקוחות מרובים במקביל בצורה מאובטחת.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Distribution statistics chart placeholder (simulated clean CSS layout) */}
                      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
                        <h3 className="font-black text-slate-900 text-sm">פופולריות קווים (סך הודעות נכנסות לקו)</h3>
                        <div className="space-y-3.5 pt-2">
                          {messageDestNumbers.map(dest => {
                            const count = messages.filter(m => m.dest === dest).length;
                            const percentage = totalMessageCount > 0 ? (count / totalMessageCount) * 100 : 0;
                            return (
                              <div key={dest} className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-700 font-bold">{dest}</span>
                                  <span className="text-slate-500 font-semibold">{count} SMS ({Math.round(percentage)}%)</span>
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
                      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
                        <h3 className="font-black text-slate-900 text-sm">מדריכים וכלים חיצוניים</h3>
                        <div className="space-y-2 text-sm">
                          <a 
                            href="https://script.google.com" 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 block transition-colors font-bold text-slate-700 flex items-center justify-between"
                          >
                            <span>פתח את Google Apps Script Console</span>
                            <ExternalLink size={14} className="text-slate-400" />
                          </a>
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 leading-relaxed text-sm space-y-1">
                            <span className="font-black text-slate-800 block">עצה לפריסת Webhook מנצחת:</span>
                            <p className="font-semibold">במידה ומשתמשים בקוד ה-Apps Script, מומלץ תמיד לקבוע הרשאת ריצה של "Everyone - כולל כולם" כדי לאפשר לנתב מסרגו לקשר את הודעות ה-SMS בצורה חופשית ללא הפרעה.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {!embedded && (
            <footer className="bg-white border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400 font-semibold">
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 space-y-4" style={{ fontFamily: "'Heebo', sans-serif" }}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900 text-base">ייצוא הודעות SMS לפי תאריך</h4>
              <button 
                onClick={() => setShowExportDateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500">בחר תאריך יעד לייצוא</label>
              <input 
                type="date"
                value={expDateStr}
                onChange={(e) => setExpDateStr(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-2xl px-4 py-2.5 bg-slate-50 text-left font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10 focus:border-sky-600"
              />
              <p className="text-xs text-slate-400 font-semibold">כל הודעות ה-SMS אשר הגיעו למערכת בתאריך נבחר זה יסוננו וייוצאו כקובץ CSV.</p>
            </div>

            <div className="flex gap-2.5 justify-end text-sm font-bold pt-2">
              <button
                onClick={() => setShowExportDateModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl"
              >
                ביטול
              </button>
              <button
                onClick={handleExportByParticularDate}
                disabled={isExportingAll}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-2xl flex items-center gap-1.5"
              >
                <Download size={14} />
                {isExportingAll ? 'מייצא...' : 'ייצא והורד'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
