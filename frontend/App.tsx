
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider, addEdge, Node, Edge, applyNodeChanges, applyEdgeChanges, OnNodesChange, OnEdgesChange, OnConnect, ReactFlowInstance, MarkerType } from 'reactflow';
import { NodeType, NodeData, User, FixedProcess, Version, BotFlow, PredefinedTemplate, RestorableVersionsData } from './types';
import { ContactFieldsProvider } from './context/ContactFieldsContext';
import { usePermission } from './hooks/usePermission';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import RegisterPage from './components/RegisterPage';
import Editor from './components/Editor';
import TemplateSelection from './components/TemplateSelection';
import TemplateForm from './components/TemplateForm';
import ContactsPage from './components/ContactsPage';
import SessionsPage from './components/SessionsPage';
import GroupsPage from './components/GroupsPage';
import SmsInPage from './components/SmsInPage';
import { StartNode, InputTextNode, InputDateNode, InputFileNode, OutputTextNode, OutputImageNode, OutputLinkNode, OutputMenuNode, ActionWebServiceNode, ActionWaitNode, ActionTimeRoutingNode, ActionAddToGroupNode, ActionRemoveFromGroupNode, ActionTransferToAgentNode, ActionSetParameterNode, FixedProcessNode, AutomaticResponsesNode } from './components/nodes/CustomNodes';
import ButtonEdge from './components/edges/ButtonEdge';
import { CloudUpload, RotateCcw, Plus, AlertTriangle, Copy, X, Lock, Wallet, Sliders, Save } from 'lucide-react';
import Simulator from './components/Simulator';
import AdminPanel from './components/AdminPanel';
import HomePage from './components/HomePage'; 
import BotSettingsModal from './components/BotSettingsModal';
  
// ── Trial Expired Screen ─────────────────────────────────────────────────────
const TrialExpiredScreen: React.FC<{ userName: string; onLogout: () => void }> = ({ userName, onLogout }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-12 text-center border border-slate-100">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-red-500" strokeWidth={2} />
        </div>
      </div>
      <h2 className="text-3xl font-black text-slate-800 mb-3">תקופת הניסיון הסתיימה</h2>
      <p className="text-slate-500 mb-2 font-medium">
        שלום <span className="font-bold text-slate-700">{userName}</span>,
      </p>
      <p className="text-slate-500 mb-8 text-sm leading-relaxed">
        תקופת הניסיון החינמי שלך של 30 יום הסתיימה.<br />
        כדי להמשיך להשתמש במערכת, אנא שדרג את חשבונך לתוכנית Basic או Premium.
      </p>
      <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-right space-y-2">
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">מה כלול בתוכנית Basic</p>
        {['עד 3 בוטים פעילים', 'עד 5 גרסאות לבוט', 'פרסום ושיתוף הבוט', 'ממשק ניהול מלא'].map(f => (
          <div key={f} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
            <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0">✓</span>
            {f}
          </div>
        ))}
      </div>
      <button
        onClick={() => { alert('ליצירת קשר לשדרוג: go@mesergo.co.il'); }}
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all mb-3"
      >
        שדרג עכשיו
      </button>
      <button
        onClick={onLogout}
        className="w-full text-slate-400 py-2 text-sm font-medium hover:text-slate-600 transition-colors"
      >
        התנתק
      </button>
    </div>
  </div>
);

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : `${window.location.origin}/api`;
const nodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.INPUT_TEXT]: InputTextNode,
  [NodeType.INPUT_DATE]: InputDateNode,
  [NodeType.INPUT_FILE]: InputFileNode,
  [NodeType.OUTPUT_TEXT]: OutputTextNode,
  [NodeType.OUTPUT_IMAGE]: OutputImageNode,
  [NodeType.OUTPUT_LINK]: OutputLinkNode,
  [NodeType.OUTPUT_MENU]: OutputMenuNode,
  [NodeType.ACTION_WEB_SERVICE]: ActionWebServiceNode,
  [NodeType.ACTION_WAIT]: ActionWaitNode,
  [NodeType.ACTION_TIME_ROUTING]: ActionTimeRoutingNode,
  [NodeType.ACTION_ADD_TO_GROUP]: ActionAddToGroupNode,
  [NodeType.ACTION_REMOVE_FROM_GROUP]: ActionRemoveFromGroupNode,
  [NodeType.ACTION_TRANSFER_TO_AGENT]: ActionTransferToAgentNode,
  [NodeType.ACTION_SET_PARAMETER]: ActionSetParameterNode,
  [NodeType.FIXED_PROCESS]: FixedProcessNode,
  [NodeType.AUTOMATIC_RESPONSES]: AutomaticResponsesNode,
};
const edgeTypes = { button: ButtonEdge };
const DEFAULT_EDGE_STYLE = { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' };

/** Returns true if the stored JWT token is expired (or unreadable). */
function isStoredTokenExpired(): boolean {
  const token = localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token');
  if (!token) return false;
  try {
    // JWT uses base64url — replace chars before decoding
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64));
    return !!exp && exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token');
}

function getStoredUser(): string | null {
  return localStorage.getItem('flowbot_user') || sessionStorage.getItem('flowbot_user');
}

function clearStoredAuth() {
  localStorage.removeItem('flowbot_token');
  localStorage.removeItem('flowbot_user');
  sessionStorage.removeItem('flowbot_token');
  sessionStorage.removeItem('flowbot_user');
  window.dispatchEvent(new Event('flowbot-auth-change'));
}
 
function saveStoredAuth(token: string, user: any, rememberMe: boolean) {
  clearStoredAuth();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('flowbot_token', token);
  storage.setItem('flowbot_user', JSON.stringify(user));
  window.dispatchEvent(new Event('flowbot-auth-change'));
}

type ViewMode = 'home' | 'dashboard' | 'editor' | 'editing-process' | 'viewing-process' | 'simulator-only' | 'template-selection' | 'template-form' | 'admin-panel' | 'editing-template' | 'creating-template' | 'contacts' | 'sessions' | 'groups' | 'sms_in';

const FlowBuilder: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Detect expired token once on mount, before any render
  const tokenExpiredOnLoad = (() => {
    if (!isStoredTokenExpired()) return false;
    clearStoredAuth();
    return true;
  })();

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (tokenExpiredOnLoad) return null;
    try {
      const saved = getStoredUser();
      if (!saved || saved === "undefined") return null;
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse user from local storage", e);
      return null;
    }
  });
  const can = usePermission(currentUser);

  // Returns true when the user should be routed to /sessions (no main dashboard access).
  // Uses bots.view_tab permission when available; falls back to role for legacy sessions.
  const isRepOnlyUser = (user: User | null): boolean => {
    if (!user) return false;
    const perms = (user as any).permissions;
    if (perms) return !perms?.bots?.view_tab;
    return user.role === 'rep' || user.role === 'rep_manager';
  };

  const [token, setToken] = useState<string | null>(tokenExpiredOnLoad ? null : getStoredToken());
  const [sessionExpired, setSessionExpired] = useState(tokenExpiredOnLoad);

  // Refresh permissions from the server on load, so admin-side changes
  // (e.g. the per-client "SMS נכנס" toggle) take effect without re-login.
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const profile = await res.json();
        if (!profile?.permissions) return;
        setCurrentUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, permissions: profile.permissions } as User;
          try {
            const storage = localStorage.getItem('flowbot_token') ? localStorage : sessionStorage;
            storage.setItem('flowbot_user', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  
  const [bots, setBots] = useState<BotFlow[]>([]);
  const [selectedBot, setSelectedBot] = useState<BotFlow | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'simulator') return 'simulator-only';
    return 'home';
  });

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fixedProcesses, setFixedProcesses] = useState<FixedProcess[]>([]);
  const [groups, setGroups] = useState<Array<{ _id: string; name: string }>>([]);
  const [repGroups, setRepGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [repUsers, setRepUsers] = useState<Array<{ id: string; name: string; email: string; repGroupIds: string[] }>>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [restorableVersions, setRestorableVersions] = useState<RestorableVersionsData | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [isFlowTransitioning, setIsFlowTransitioning] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(viewMode === 'simulator-only');
  const [simulatorActiveNodeId, setSimulatorActiveNodeId] = useState<string | null>(null);
  const [simulatorFixedProcessNodeId, setSimulatorFixedProcessNodeId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const lastSearchQueryRef = useRef('');
  // Incremented only on explicit navigation (new query or arrow press) so the
  // pan effect does NOT fire when unrelated nodes are moved/edited.
  const [searchNavigateTrigger, setSearchNavigateTrigger] = useState(0);
  const nodesRef = useRef<Node[]>([]);
  const searchResultsRef = useRef<string[]>([]);
  const currentSearchIndexRef = useRef(-1);
  const [globalSearchResults, setGlobalSearchResults] = useState<{ processId: string; processName: string; nodeId: string; matchText: string }[]>([]);
  const processNodesCacheRef = useRef<Record<string, any[]>>({});
  const pendingFocusNodeIdRef = useRef<string | null>(null);
  const [globalSearchTrigger, setGlobalSearchTrigger] = useState(0);
  // Signals that the next nodes update is a fresh bot load and needs fitView
  const pendingFitViewRef = useRef(false);

  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', rememberMe: false });
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<Version | null>(null);
  
  const [isRestoreArchivedModalOpen, setIsRestoreArchivedModalOpen] = useState(false);
  const [archivedVersionToRestore, setArchivedVersionToRestore] = useState<{ id: string, price: number } | null>(null);
  
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<{ id: string, name: string } | null>(null);
  const [instanceCount, setInstanceCount] = useState(0);

  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');

  // Quota State
  const [quotaError, setQuotaError] = useState<{ type: 'bots' | 'versions', message: string, price: number } | null>(null);

  // Template State
  const [selectedTemplate, setSelectedTemplate] = useState<PredefinedTemplate | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateData, setEditingTemplateData] = useState<{ name: string; description: string; isPublic: boolean } | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  // Template Params Modal (accessible from editor)
  const [isTemplateParamsModalOpen, setIsTemplateParamsModalOpen] = useState(false);
  const [templateEditingParams, setTemplateEditingParams] = useState<Array<{ label: string; variableName: string }>>([]);
  const [templateSavingParams, setTemplateSavingParams] = useState(false);

  // Change Template State
  const [isChangeTemplateModalOpen, setIsChangeTemplateModalOpen] = useState(false);
  const [sessionsOwnOnly, setSessionsOwnOnly] = useState(false);
  const [sessionsInitialPhone, setSessionsInitialPhone] = useState<string | null>(null);
  const [contactsInitialPhone, setContactsInitialPhone] = useState<string | null>(null);
  const [isBotSettingsOpen, setIsBotSettingsOpen] = useState(false);

  // Auto-route reps to /sessions on first load
  useEffect(() => {
    if (!currentUser) return;
    if (isRepOnlyUser(currentUser)) {
      if (location.pathname === '/' || location.pathname === '') {
        navigate('/sessions', { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear initialPhone when navigating away so it doesn't re-open on return
  useEffect(() => {
    if (location.pathname !== '/contacts') setContactsInitialPhone(null);
    if (location.pathname !== '/sessions') setSessionsInitialPhone(null);
  }, [location.pathname]);

  // Load bot from URL on direct navigation / refresh (e.g. /bot/:botId)
  useEffect(() => {
    const match = location.pathname.match(/^\/bot\/([^/]+)/);
    if (!match) return;
    const botId = match[1];
    if (selectedBot?.id === botId) return; // already loaded
    if (bots.length === 0) return; // bots list not fetched yet
    const bot = bots.find(b => b.id === botId);
    if (!bot) { navigate('/dashboard', { replace: true }); return; }
    setIsFlowTransitioning(true);
    pendingFitViewRef.current = true;
    setNodes([]);
    setEdges([]);
    setActiveProcessId(null);
    setSelectedBot(bot);
    setViewMode('editor');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, bots]);

  // --- Edge Delete Listener ---
  // Tracks whether a real user action occurred since the last save (ignores ReactFlow
  // internal changes like node dimension measurements and selection state).
  const dirtyRef = useRef(false);

  useEffect(() => {
    const handleEdgeDelete = (e: any) => {
      const edgeId = e.detail.id;
      dirtyRef.current = true;
      setEdges(eds => eds.filter(edge => edge.id !== edgeId));
    };
    window.addEventListener('delete-edge', handleEdgeDelete);
    return () => window.removeEventListener('delete-edge', handleEdgeDelete);
  }, []);

  // --- Search Logic Restored ---
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      lastSearchQueryRef.current = '';
      return;
    }
    
    const q = searchQuery.toLowerCase();
    const uniqueMatches = new Set<string>();
    
    nodes.forEach(node => {
      const d = node.data;
      const check = (val?: string) => typeof val === 'string' && val.toLowerCase().includes(q);
      const reasons: string[] = [];

      // ID search: when query starts with #, match by serialId across all node types
      if (q.startsWith('#')) {
        const numPart = q.slice(1);
        const sid = typeof d.serialId === 'string' ? d.serialId.toLowerCase() : '';
        const sidNumPart = sid.replace(/^[^0-9]*/, '');
        if (numPart && sidNumPart.includes(numPart)) {
          reasons.push(`serialId: "${d.serialId}"`);
        }
      }

      // Only search fields that are actually user-editable for each node type
      switch (node.type as NodeType) {
        case NodeType.INPUT_TEXT:
        case NodeType.INPUT_DATE:
        case NodeType.INPUT_FILE:
          if (check(d.label))        reasons.push(`label: "${d.label}"`);
          if (check(d.variableName)) reasons.push(`variableName: "${d.variableName}"`);
          break;
        case NodeType.OUTPUT_TEXT:
          if (check(d.content)) reasons.push(`content: "${d.content}"`);
          break;
        case NodeType.OUTPUT_IMAGE:
          if (check(d.url))     reasons.push(`url: "${d.url}"`);
          if (check(d.caption)) reasons.push(`caption: "${d.caption}"`);
          break;
        case NodeType.OUTPUT_LINK:
          if (check(d.linkLabel))   reasons.push(`linkLabel: "${d.linkLabel}"`);
          if (check(d.url))         reasons.push(`url: "${d.url}"`);
          if (check(d.urlVariable)) reasons.push(`urlVariable: "${d.urlVariable}"`);
          break;
        case NodeType.OUTPUT_MENU:
          if (check(d.content))     reasons.push(`content: "${d.content}"`);
          if (check(d.variableName)) reasons.push(`variableName: "${d.variableName}"`);
          if (Array.isArray(d.options) && d.options.some((opt: string) => check(opt)))
            reasons.push(`options`);
          break;
        case NodeType.ACTION_WEB_SERVICE:
          if (check(d.url)) reasons.push(`url: "${d.url}"`);
          if (Array.isArray(d.options) && d.options.some((opt: string) => check(opt)))
            reasons.push(`branches`);
          break;
        case NodeType.ACTION_TRANSFER_TO_AGENT:
          // No searchable text fields (only dropdowns)
          break;
        case NodeType.ACTION_ADD_TO_GROUP:
        case NodeType.ACTION_REMOVE_FROM_GROUP:
          // Only removalReason is user-typed text (shown when removing from all groups)
          if (check(d.removalReason)) reasons.push(`removalReason: "${d.removalReason}"`);
          break;
        case NodeType.ACTION_TIME_ROUTING:
        case NodeType.ACTION_WAIT:
        case NodeType.START:
          // No searchable text fields
          break;
        case NodeType.AUTOMATIC_RESPONSES:
          if (Array.isArray(d.options) && d.options.some((opt: string) => check(opt)))
            reasons.push(`options`);
          break;
        case NodeType.FIXED_PROCESS:
          // Included in results only when searching by #ID (handled above)
          break;
        default:
          if (check(d.label))   reasons.push(`label: "${d.label}"`);
          if (check(d.content)) reasons.push(`content: "${d.content}"`);
          break;
      }

      if (reasons.length > 0) {
        console.log(`[Search] node ${d.serialId} (${node.type}): matched on ${reasons.join(' | ')}`);
        uniqueMatches.add(node.id);
      }
    });

    const matchesArr = Array.from(uniqueMatches);
    setSearchResults(matchesArr);
    
    searchResultsRef.current = matchesArr;
    if (pendingFocusNodeIdRef.current) {
      const idx = matchesArr.indexOf(pendingFocusNodeIdRef.current);
      const newIdx = idx >= 0 ? idx : matchesArr.length > 0 ? 0 : -1;
      setCurrentSearchIndex(newIdx);
      pendingFocusNodeIdRef.current = null;
      if (newIdx >= 0) setSearchNavigateTrigger(t => t + 1);
    } else if (searchQuery !== lastSearchQueryRef.current) {
      setCurrentSearchIndex(matchesArr.length > 0 ? 0 : -1);
      lastSearchQueryRef.current = searchQuery;
      if (matchesArr.length > 0) setSearchNavigateTrigger(t => t + 1);
    }
  }, [searchQuery, nodes]);

  // Keep refs current on every render so the nav effect never needs nodes/searchResults in its deps
  nodesRef.current = nodes;
  currentSearchIndexRef.current = currentSearchIndex;

  useEffect(() => {
    const idx = currentSearchIndexRef.current;
    const nodeId = searchResultsRef.current[idx];
    if (idx < 0 || !nodeId || !reactFlowInstance) return;

    // requestAnimationFrame ensures React has already painted the new isCurrentMatch
    // so the <mark> elements inside the node reflect the current match
    requestAnimationFrame(() => {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`) as HTMLElement | null;
      if (nodeEl) {
        // Find the first highlighted match element inside this node
        const markEl = nodeEl.querySelector('mark') as HTMLElement | null;
        if (markEl) {
          const rect = markEl.getBoundingClientRect();
          const flowPos = reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          reactFlowInstance.setCenter(flowPos.x, flowPos.y, { zoom: 1.1, duration: 800 });
          return;
        }
      }
      // Fallback: center on node top (no mark found – e.g. header-only match)
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 140, node.position.y + 120, { zoom: 1.1, duration: 800 });
      }
    });
  }, [searchNavigateTrigger, reactFlowInstance]);

  // After a bot switch (enterBot), wait for the new nodes to arrive then fitView
  useEffect(() => {
    if (!pendingFitViewRef.current || nodes.length === 0) return;
    pendingFitViewRef.current = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          reactFlowInstance?.fitView({ padding: 0.5, duration: 0 });
          requestAnimationFrame(() => requestAnimationFrame(() => setIsFlowTransitioning(false)));
        })
      )
    );
  }, [nodes, reactFlowInstance]);

  // --- Pre-fetch process nodes into cache when fixedProcesses list changes ---
  useEffect(() => {
    if (!token || fixedProcesses.length === 0) return;
    const cache = processNodesCacheRef.current;
    const newProcessIds = fixedProcesses.map(p => p.id).filter(id => !cache[id]);
    if (newProcessIds.length === 0) return;
    (async () => {
      for (const procId of newProcessIds) {
        try {
          const res = await fetch(`${API_BASE}/flow?standard_process_id=${procId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            cache[procId] = data.nodes || [];
          }
        } catch (e) { /* silent */ }
      }
    })();
  }, [fixedProcesses, token]);

  // --- Global cross-process search (only when in main flow) ---
  useEffect(() => {
    if (!searchQuery.trim() || activeProcessId !== null) {
      setGlobalSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results: { processId: string; processName: string; nodeId: string; matchText: string }[] = [];
    const check = (val?: string) => typeof val === 'string' && val.toLowerCase().includes(q);

    fixedProcesses.forEach(proc => {
      const procNodes: any[] = processNodesCacheRef.current[proc.id] || [];
      procNodes.forEach(node => {
        const d = node.data || {};
        let matchText = '';
        switch (node.type as NodeType) {
          case NodeType.INPUT_TEXT:
          case NodeType.INPUT_DATE:
          case NodeType.INPUT_FILE:
            matchText = check(d.label) ? d.label : check(d.variableName) ? d.variableName : '';
            break;
          case NodeType.OUTPUT_TEXT:
            matchText = check(d.content) ? d.content : '';
            break;
          case NodeType.OUTPUT_IMAGE:
            matchText = check(d.caption) ? d.caption : check(d.url) ? d.url : '';
            break;
          case NodeType.OUTPUT_LINK:
            matchText = check(d.linkLabel) ? d.linkLabel : check(d.url) ? d.url : '';
            break;
          case NodeType.OUTPUT_MENU:
            if (check(d.content)) matchText = d.content;
            else if (Array.isArray(d.options)) {
              const m = (d.options as string[]).find(opt => check(opt));
              if (m) matchText = m;
            }
            break;
          case NodeType.ACTION_WEB_SERVICE:
            matchText = check(d.url) ? d.url : '';
            break;
          case NodeType.ACTION_TRANSFER_TO_AGENT:
            // No searchable text fields (only dropdowns)
            break;
          case NodeType.ACTION_ADD_TO_GROUP:
          case NodeType.ACTION_REMOVE_FROM_GROUP:
            // Only removalReason is user-typed text
            matchText = check(d.removalReason) ? d.removalReason : '';
            break;
          case NodeType.AUTOMATIC_RESPONSES:
            if (Array.isArray(d.options)) {
              const m = (d.options as string[]).find(opt => check(opt));
              if (m) matchText = m;
            }
            break;
          case NodeType.FIXED_PROCESS:
            // Do not include fixed-process nodes in search results (name comes from the process definition, not user input)
            break;
          default:
            matchText = check(d.label) ? d.label : check(d.content) ? d.content : '';
        }
        if (matchText) {
          results.push({ processId: proc.id, processName: proc.name, nodeId: node.id, matchText });
        }
      });
    });
    setGlobalSearchResults(results);
  }, [searchQuery, fixedProcesses, activeProcessId, globalSearchTrigger]);

  const onNodeDataChange = useCallback((nodeId: string, data: Partial<NodeData>) => {
    dirtyRef.current = true;
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, []);

  const onDeleteNode = useCallback((id: string) => {
    dirtyRef.current = true;
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, []);

  // When a menu/branch option is removed at `optionIndex`, we must:
  // 1. Delete any edge connected to that option's handle (option-<optionIndex>)
  // 2. Re-index handles of options that shifted down (indices > optionIndex)
  const onRemoveOption = useCallback((nodeId: string, optionIndex: number) => {
    dirtyRef.current = true;
    setEdges((eds) =>
      eds
        .filter((e) => !(e.source === nodeId && e.sourceHandle === `option-${optionIndex}`))
        .map((e) => {
          if (e.source !== nodeId) return e;
          const match = e.sourceHandle?.match(/^option-(\d+)$/);
          if (!match) return e;
          const idx = parseInt(match[1], 10);
          if (idx > optionIndex) return { ...e, sourceHandle: `option-${idx - 1}` };
          return e;
        })
    );
  }, []);

  const bindNodeCallbacks = useCallback((node: Node): Node => ({
    ...node,
    data: { 
      ...node.data, 
      onChange: (data: Partial<NodeData>) => onNodeDataChange(node.id, data), 
      onDelete: () => onDeleteNode(node.id),
      onRemoveOption: (optionIndex: number) => onRemoveOption(node.id, optionIndex),
    }
  }), [onNodeDataChange, onDeleteNode, onRemoveOption]);

  // Centralized session-expiry handler — called from any place that gets 401/403
  const handleSessionExpired = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    clearStoredAuth();
    setSessionExpired(true);
  }, []);

  // Auto-expire: set a timer that fires exactly when the JWT expires.
  // Also listen for visibilitychange so that returning to a background tab
  // (where the browser may have throttled the timer) triggers the check immediately.
  useEffect(() => {
    if (!token) return;
    let exp: number;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      ({ exp } = JSON.parse(atob(base64)));
      if (!exp) return;
    } catch { return; /* unreadable token — leave it to the API call to catch */ }

    const msUntilExpiry = exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) { handleSessionExpired(); return; }

    // Primary: precise timer for active tabs
    const timer = setTimeout(handleSessionExpired, msUntilExpiry);

    // Secondary: catch throttled timers when user returns to a background tab
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && exp * 1000 < Date.now()) {
        handleSessionExpired();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, handleSessionExpired]);

  const loadBots = useCallback(async (overrideToken?: string) => {
    const activeToken = overrideToken ?? token;
    if (!activeToken) return;
    try {
      const res = await fetch(`${API_BASE}/bots`, { headers: { 'Authorization': `Bearer ${activeToken}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) handleSessionExpired();
        return;
      }
      const data = await res.json();
      setBots(data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadProcesses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/processes`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) handleSessionExpired();
        return;
      }
      const data = await res.json();
      setFixedProcesses(data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/groups`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setGroups((data.groups || []).filter((g: any) => !g.is_blocklist));
    } catch (e) { console.error(e); }
  }, [token]);

  const loadRepGroups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/rep-groups`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setRepGroups(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadRepUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/rep-groups/reps`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setRepUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadFlow = useCallback(async (botId: string | null, processId: string | null = null) => {
    const params = new URLSearchParams(window.location.search);
    const publicIdFromUrl = params.get('public_id');
    const versionIdFromUrl = params.get('version_id');

    if (!token && !publicIdFromUrl) return;

    // Until the load completes successfully, no auto-save may run for this key.
    // This is the core guard that turns "loaded blank due to error" into a no-op
    // instead of a destructive save.
    flowReadyKeyRef.current = null;
    loadedWidgetCountRef.current = null;
    syncBlockedRef.current = false;

    let url = '';
    const headers: Record<string, string> = {};
    
    if (token) {
      url = processId 
        ? `${API_BASE}/flow?standard_process_id=${processId}` 
        : `${API_BASE}/flow?flow_id=${botId}`;
      if (versionIdFromUrl) url += (url.includes('?') ? '&' : '?') + `version_id=${versionIdFromUrl}`;
      headers['Authorization'] = `Bearer ${token}`;
    } else if (publicIdFromUrl) {
      url = `${API_BASE}/flow/public/${publicIdFromUrl}?flow_id=${botId}`;
      if (versionIdFromUrl) url += (url.includes('?') ? '&' : '?') + `version_id=${versionIdFromUrl}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.error("Failed to load flow:", res.status, res.statusText);
        // Leave flowReadyKeyRef as null → auto-save stays disabled, so the
        // user's empty canvas can't accidentally overwrite the real flow.
        return;
      }
      const data = await res.json();
      if (data.nodes?.length > 0) {
        const loadedNodeIds = new Set((data.nodes as any[]).map((n: any) => n.id));
        const seenHandles = new Set<string>();
        const cleanEdges = (data.edges as any[])
          .filter((e: any) => loadedNodeIds.has(e.source) && loadedNodeIds.has(e.target))
          .filter((e: any) => {
            const key = `${e.source}|${e.sourceHandle ?? ''}`;
            if (seenHandles.has(key)) return false;
            seenHandles.add(key);
            return true;
          });
        setNodes(data.nodes.map((n: any) => bindNodeCallbacks(n)));
        setEdges(cleanEdges.map((e: any, i: number) => ({ ...e, type: 'button', id: e.id || `edge-${i}-${Date.now()}`, style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } })));
      } else {
        const isSubProcess = !!processId;
        const start = bindNodeCallbacks({
          id: `${isSubProcess ? 'start' : 'auto-responses'}-${Date.now()}`,
          type: isSubProcess ? NodeType.START : NodeType.AUTOMATIC_RESPONSES,
          position: { x: 800, y: 400 },
          data: isSubProcess 
            ? { label: 'תחילת תזרים', serialId: '#1' }
            : { label: 'תגובות אוטומטיות', serialId: '#1', options: ['כניסה'], optionOperators: ['eq'] },
        });
        setNodes([start]);
        setEdges([]);
      }
      // Mark this key as ready and remember the server-authoritative count.
      flowReadyKeyRef.current = buildFlowKey(botId, processId, null);
      loadedWidgetCountRef.current = typeof data.widget_count === 'number'
        ? data.widget_count
        : (data.nodes?.length || 0);
    } catch (e) { console.error(e); }
  }, [token, bindNodeCallbacks]);

  const loadVersions = useCallback(async (botIdOverride?: string) => {
    const params = new URLSearchParams(window.location.search);
    const botId = botIdOverride || selectedBot?.id || params.get('flow_id');
    if (!token || !botId) return;
    const url = activeProcessId 
      ? `${API_BASE}/versions?flow_id=${botId}&standard_process_id=${activeProcessId}` 
      : `${API_BASE}/versions?flow_id=${botId}`;
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setVersions(data);
    } catch (e) { console.error(e); }
  }, [token, selectedBot, activeProcessId]);

  const loadRestorableVersions = useCallback(async (botIdOverride?: string) => {
    const params = new URLSearchParams(window.location.search);
    const botId = botIdOverride || selectedBot?.id || params.get('flow_id');
    if (!token || !botId) return;
    const url = activeProcessId 
      ? `${API_BASE}/versions/restorable?flow_id=${botId}&standard_process_id=${activeProcessId}` 
      : `${API_BASE}/versions/restorable?flow_id=${botId}`;
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setRestorableVersions(data);
    } catch (e) { 
      console.error(e);
      setRestorableVersions(null);
    }
  }, [token, selectedBot, activeProcessId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowIdFromUrl = params.get('flow_id');
    // Ensure we don't treat the public_id as the botId
    const botId = selectedBot?.id || flowIdFromUrl || null;

    if (token) { loadProcesses(); loadGroups(); loadRepGroups(); loadRepUsers(); }
    if (botId || activeProcessId) {
      loadFlow(botId, activeProcessId);
      if (token && botId) {
        loadVersions(botId);
        loadRestorableVersions(botId);
      }
    }
  }, [selectedBot?.id, activeProcessId, token, loadFlow]);

  useEffect(() => { if (currentUser) loadBots(); }, [currentUser, loadBots]);

  // Ref to abort a previous in-flight sync request when a newer one starts,
  // preventing a slower old request from overwriting a more recent save.
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  // ─── Save-safety guards ────────────────────────────────────────────────────
  // Identifies which (bot, process) the current nodes/edges state actually
  // represents. Auto-save is BLOCKED until a successful loadFlow sets this to
  // the current key. Prevents the "loaded blank due to network error → user
  // hits save → bot wiped" scenario.
  const flowReadyKeyRef = useRef<string | null>(null);
  // Server-authoritative widget count from the most recent load/save. Sent on
  // every sync as `expected_widget_count` so the server can detect stale state
  // (two-tab editing, programmatic out-of-band saves).
  const loadedWidgetCountRef = useRef<number | null>(null);
  // Latch that disables auto-save after a server-side conflict, until the user
  // reloads. Prevents the same broken state from being retried repeatedly.
  const syncBlockedRef = useRef<boolean>(false);
  // Cross-tab coordination: when this tab saves, broadcast to siblings so they
  // can refresh their loadedWidgetCountRef instead of overwriting our save.
  const flowChannelRef = useRef<BroadcastChannel | null>(null);
  if (typeof window !== 'undefined' && !flowChannelRef.current && 'BroadcastChannel' in window) {
    flowChannelRef.current = new BroadcastChannel('flowbot-sync');
  }

  const buildFlowKey = (botId: string | null, processId: string | null, templateId: string | null) => {
    if (templateId) return `tpl:${templateId}`;
    return `bot:${botId || ''}:proc:${processId || ''}`;
  };

  useEffect(() => {
    const ch = flowChannelRef.current;
    if (!ch) return;
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || msg.type !== 'flow-saved') return;
      const myKey = buildFlowKey(selectedBot?.id || null, activeProcessId, editingTemplateId);
      if (msg.key !== myKey) return;
      // Another tab just saved this same flow. Our snapshot is now stale —
      // disable auto-save and tell the user to refresh, rather than letting
      // our timer overwrite their work.
      syncBlockedRef.current = true;
      console.warn('🛑 Another tab saved this flow. Auto-save disabled until reload.');
      // Update expected count so a manual save attempt would also fail-fast
      // server-side instead of clobbering.
      if (typeof msg.widgetCount === 'number') {
        loadedWidgetCountRef.current = msg.widgetCount;
      }
    };
    ch.addEventListener('message', onMsg);
    return () => ch.removeEventListener('message', onMsg);
  }, [selectedBot?.id, activeProcessId, editingTemplateId]);

  const syncFlow = async (
    customNodes?: Node[],
    customEdges?: Edge[],
    customProcessId?: string,
    opts: { force?: boolean } = {}
  ) => {
    if (!token || (!selectedBot && !activeProcessId && !editingTemplateId && !creatingTemplate)) return;
    const n = customNodes || nodes;
    const e = customEdges || edges;
    const pId = customProcessId !== undefined ? customProcessId : activeProcessId;
    const force = !!opts.force;

    // Hard block: a previous save was rejected for being stale/destructive.
    // Only an explicit force (e.g. confirmed template change) can override.
    if (syncBlockedRef.current && !force) {
      console.warn('syncFlow skipped — sync is blocked until reload');
      return;
    }

    // Only the bot-flow path uses the new guards (template editor uses a
    // different endpoint and is out of scope here).
    const isFlowSync = !editingTemplateId && !creatingTemplate;

    if (isFlowSync) {
      // Don't auto-save before the flow has actually loaded for the current
      // bot/process. This is the front-line defense against "UI loaded blank,
      // user clicked save, bot got wiped".
      const currentKey = buildFlowKey(selectedBot?.id || null, pId, null);
      if (!force && flowReadyKeyRef.current !== currentKey) {
        console.warn('syncFlow skipped — flow not ready for', currentKey, 'ready=', flowReadyKeyRef.current);
        return;
      }
      // Defense-in-depth: never POST an empty flow unless explicitly forced.
      // The server will reject it too, but skipping avoids the network round-trip
      // and prevents log spam from the auto-save timer.
      if (!force && n.length === 0) {
        console.warn('syncFlow skipped — empty nodes (no force)');
        return;
      }
    }

    // Cancel any previous in-flight sync so it cannot overwrite this newer one
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    syncAbortControllerRef.current = controller;

    try {
      // If editing/creating template, sync to template endpoint
      if (editingTemplateId || creatingTemplate) {
        if (editingTemplateId) {
          const templateResponse = await fetch(`${API_BASE}/templates/${editingTemplateId}/flow`, {
            method: 'PUT',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nodes: n, edges: e })
          });

          // Check for authentication errors in template save
          if (!templateResponse.ok) {
            if (templateResponse.status === 401 || templateResponse.status === 403) {
              handleSessionExpired();
            } else {
              console.error('Failed to save template:', templateResponse.status, templateResponse.statusText);
            }
          }
        }
        return;
      }

      const response = await fetch(`${API_BASE}/flow/sync`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          nodes: n,
          edges: e,
          flow_id: selectedBot?.id || null,
          standard_process_id: pId,
          force,
          expected_widget_count: loadedWidgetCountRef.current ?? undefined
        })
      });

      // Check for authentication errors
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleSessionExpired();
          return;
        }
        // Server-side safety guard tripped (empty / stale / shrink). Block any
        // further auto-saves until the user reloads, then surface a clear
        // message.
        if (response.status === 409) {
          syncBlockedRef.current = true;
          let body: any = {};
          try { body = await response.json(); } catch {}
          console.warn('syncFlow blocked by server guard:', body);
          const msg = body?.message ||
            'השמירה נחסמה ע"י השרת כדי למנוע איבוד רכיבים. רענני את הדף לפני שמירה.';
          // Use setTimeout so we don't alert during a React render cycle
          setTimeout(() => {
            if (window.confirm(`${msg}\n\nלטעון מחדש את הדף עכשיו?`)) {
              window.location.reload();
            }
          }, 0);
          return;
        }
        console.error('Failed to save flow:', response.status, response.statusText);
        return;
      }

      // Successful save — refresh our expected count and tell sibling tabs.
      try {
        const result = await response.json();
        if (typeof result.widget_count === 'number') {
          loadedWidgetCountRef.current = result.widget_count;
        }
        const ch = flowChannelRef.current;
        if (ch) {
          const key = buildFlowKey(selectedBot?.id || null, pId, null);
          ch.postMessage({ type: 'flow-saved', key, widgetCount: result.widget_count });
        }
      } catch {
        // Server returned non-JSON; ignore — guards still hold for next save.
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // Superseded by a newer sync – ignore
      throw err;
    }
  };

  // Always keep a ref to the latest syncFlow so the debounce timer never calls a stale closure
  const syncFlowRef = useRef(syncFlow);
  useEffect(() => { syncFlowRef.current = syncFlow; });

  // ── Save status indicator ──────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Persistent debounce timer ref — NOT cleaned up by useEffect so that
  // ReactFlow internal re-renders (dimension measurements, hover state, etc.)
  // don't cancel a pending save mid-flight.
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (viewMode !== 'dashboard' && viewMode !== 'template-selection' && viewMode !== 'template-form' && viewMode !== 'simulator-only' && viewMode !== 'admin-panel' && viewMode !== 'contacts' && viewMode !== 'sessions' && viewMode !== 'groups' && (selectedBot || activeProcessId || editingTemplateId)) {
      // Skip ReactFlow internal changes (dimension measurements, selection state, etc.)
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveStatus('saving');
      // Cancel any previous pending debounce then start a fresh one.
      // Using a ref (not useEffect cleanup) so that unrelated re-renders
      // don't accidentally clear a timer that's still counting down.
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
      saveDebounceTimerRef.current = setTimeout(() => {
        saveDebounceTimerRef.current = null;
        syncFlowRef.current().then(() => {
          setSaveStatus('saved');
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
        }).catch(() => setSaveStatus('idle'));
      }, 1500);
    }
  }, [nodes, edges, viewMode, selectedBot, activeProcessId, editingTemplateId]);

  const tidyFlow = () => {
    if (!reactFlowInstance || nodes.length === 0) return;
    const horizontalSpacing = 450;
    const verticalGap = 80;

    const estimateHeight = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return 200;
      // Use the actual rendered height from ReactFlow when available — this guarantees
      // the vertical gap is always exactly `verticalGap` regardless of node content.
      if (node.height) return node.height;
      if (node.type === NodeType.START) return 110;
      let height = 112; 
      switch(node.type) {
        case NodeType.INPUT_TEXT: height += 160; break;
        case NodeType.INPUT_DATE: height += 185; break;
        case NodeType.INPUT_FILE: height += 80; break;
        case NodeType.OUTPUT_TEXT: height += 120; break;
        case NodeType.OUTPUT_IMAGE: height += 80 + 360; break;
        case NodeType.OUTPUT_LINK: height += 180; break;
        case NodeType.OUTPUT_MENU:
          height += 80 + 40; 
          if (node.data.options) height += node.data.options.length * 100; 
          height += 100; 
          break;
        case NodeType.ACTION_WEB_SERVICE:
          height += 80 + 50; 
          if (node.data.options) height += node.data.options.length * 115; 
          height += 40; 
          break;
        case NodeType.ACTION_WAIT: height += 80; break;
        case NodeType.ACTION_TIME_ROUTING: {
          const trCount = (node.data.timeRanges || []).length;
          const drCount = (node.data.dateRanges || []).length;
          const rangeCount = Math.max(trCount, drCount);
          height += 250; // mode toggle + label + default option + add button + space-y-4 gaps (~232px content)
          height += rangeCount * 90; // per range row: p-3 + inputs (~70px) + space-y-4 gap (16px) ≈ 86px
          break;
        }
        case NodeType.FIXED_PROCESS: height += 70; break;
        case NodeType.AUTOMATIC_RESPONSES:
          height += 80;
          if (node.data.options) height += node.data.options.length * 80;
          height += 100;
          break;
        default: height += 100;
      }
      return height;
    };

    const levels: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    const nodeIds = new Set(nodes.map(n => n.id));
    // Filter out stale edges whose source/target node no longer exists
    const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    nodes.forEach(n => { adj[n.id] = []; });
    validEdges.forEach(e => { adj[e.source].push(e.target); });

    const startNode = nodes.find(n => n.type === NodeType.START || n.type === NodeType.AUTOMATIC_RESPONSES);
    if (!startNode) return;

    const queue: [string, number][] = [[startNode.id, 0]];
    const visited = new Set();
    while (queue.length > 0) {
      const [id, level] = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      levels[id] = level;
      // Guard: skip targets that no longer exist in the nodes array (stale/orphaned edges)
      (adj[id] ?? []).forEach(childId => { if (adj[childId] !== undefined) queue.push([childId, level + 1]); });
    }

    const maxLevel = Math.max(...Object.values(levels), 0);
    const nodesByLevel: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
    nodes.forEach(n => {
      const lvl = levels[n.id] ?? 0;
      nodesByLevel[lvl].push(n.id);
    });

    const finalPositions: Record<string, { x: number, y: number }> = {};
    const levelYAccumulator = Array(maxLevel + 1).fill(150);
    nodesByLevel.forEach((levelNodeIds, levelIndex) => {
      const sortedLevel = [...levelNodeIds].sort((a, b) => {
        const edgeA = validEdges.find(e => e.target === a && levels[e.source] < levelIndex);
        const edgeB = validEdges.find(e => e.target === b && levels[e.source] < levelIndex);
        if (!edgeA) return 1;
        if (!edgeB) return -1;
        if (edgeA.source === edgeB.source) {
          const getHandleIdx = (h?: string | null) => {
            if (!h) return 1000;
            if (h === 'option-default' || h === 'default') return -1; // default comes first
            if (h.startsWith('option-')) {
              const num = parseInt(h.split('-')[1]);
              return isNaN(num) ? 1000 : num;
            }
            return 1000;
          };
          return getHandleIdx(edgeA.sourceHandle) - getHandleIdx(edgeB.sourceHandle);
        }
        return (finalPositions[edgeA.source]?.y || 0) - (finalPositions[edgeB.source]?.y || 0);
      });

      sortedLevel.forEach((id) => {
        finalPositions[id] = { x: levelIndex * horizontalSpacing + 100, y: levelYAccumulator[levelIndex] };
        levelYAccumulator[levelIndex] += estimateHeight(id) + verticalGap;
      });
    });

    const currentZoom = reactFlowInstance.getZoom();
    const startPos = finalPositions[startNode.id] || { x: 100, y: 150 };
    dirtyRef.current = true;
    setNodes(nds => nds.map(n => ({ ...n, position: finalPositions[n.id] || n.position })));
    setTimeout(() => {
      // מיקום הרכיב הראשון צמוד לצד שמאל (60px מהקצה) ו-80px מלמעלה, באותו זום
      const newX = 60 - startPos.x * currentZoom;
      const newY = 80 - startPos.y * currentZoom;
      reactFlowInstance.setViewport({ x: newX, y: newY, zoom: currentZoom }, { duration: 800 });
    }, 100);
  };

  const handleCreateBot = async (name: string) => {
    console.log("Creating bot with name:", name);
    const res = await fetch(`${API_BASE}/bots`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
      body: JSON.stringify({ name }) 
    });
    console.log("Create bot response status:", res.status);
    const data = await res.json();
    if (res.status === 403 && data.error === 'MAX_BOTS_REACHED') {
      setQuotaError({ type: 'bots', message: data.message, price: data.price });
      return;
    }
    console.log("Created bot data:", data);
    setBots(prev => [data, ...prev]);
    setSelectedBot(data);
    setViewMode('template-selection');
  };

  const handleDeleteBot = async (id: string) => {
    if (!window.confirm("בטוח שברצונך למחוק את הבוט?")) return;
    try {
      const res = await fetch(`${API_BASE}/bots/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { handleSessionExpired(); return; }
        throw new Error('Failed to delete bot');
      }
      
      setBots(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting bot:', error);
      alert('שגיאה במחיקת הבוט. נסה שוב.');
    }
  };

  const handleConnectFacebook = async (bot: BotFlow) => {
    const res = await fetch(`${API_BASE}/bots/${bot.id}/connect-facebook`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'שגיאה בשליחת הבקשה');
    }
  };

  const handleSetDefaultBot = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/bots/${id}/set-default`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Refresh bots list from server to ensure sync
        await loadBots();
      } else {
        const errorData = await res.json();
        console.error('Failed to set default bot:', errorData);
        alert('שגיאה בהגדרת ברירת מחדל: ' + (errorData.error || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      console.error('Error setting default bot:', error);
      alert('שגיאה בהגדרת ברירת מחדל');
    }
  };

  const handleUpdateBotPublicId = async (id: string, publicId: string) => {
    const res = await fetch(`${API_BASE}/bots/${id}/public-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ public_id: publicId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'שגיאה בעדכון המזהה');
    }
    const data = await res.json();
    setBots(prev => prev.map(b => b.id === id ? { ...b, public_id: data.public_id } : b));
  };

  const handleUpdateBotEndpoint = async (id: string, endpoint: string) => {
    const res = await fetch(`${API_BASE}/bots/${id}/endpoint`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'שגיאה בעדכון ה-Endpoint');
    }
    const data = await res.json();
    setBots(prev => prev.map(b => b.id === id ? { ...b, endpoint: data.endpoint } : b));
  };

  const handleUpdateBotRestartKeyword = async (id: string, keyword: string) => {
    const res = await fetch(`${API_BASE}/bots/${id}/restart-keyword`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ restart_keyword: keyword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'שגיאה בעדכון מילת המפתח');
    }
    const data = await res.json();
    setBots(prev => prev.map(b => b.id === id ? { ...b, restart_keyword: data.restart_keyword } : b));
  };

  // Update current user's availability status (rep / rep_manager)
  const handleUpdateAvailability = useCallback(async (status: 'available' | 'unavailable' | 'on_break') => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ availability_status: status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'שגיאה בעדכון סטטוס זמינות');
    }
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, availability_status: status } as User;
      try {
        if (localStorage.getItem('flowbot_token')) {
          localStorage.setItem('flowbot_user', JSON.stringify(updated));
        } else {
          sessionStorage.setItem('flowbot_user', JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
  }, [token]);

  // Logout: notify server (so reps are marked as 'unavailable'), then clear local state and reload.
  const handleLogout = useCallback(() => {
    const t = token;
    // Fire-and-forget; don't wait for the response — keep logout instant.
    if (t) {
      try {
        fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
          keepalive: true,
        }).catch(() => {});
      } catch { /* ignore */ }
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  }, [token]);
 
  const handleGoogleLogin = async (credential: string) => {
    setAuthErrors({});
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        saveStoredAuth(data.token, data.user, authForm.rememberMe);
        setToken(data.token);
        setCurrentUser(data.user);
        // Route reps directly to sessions view
        if (isRepOnlyUser(data.user)) {
          setSessionsOwnOnly(false);
          navigate('/sessions');
        } else {
          navigate('/');
        }
      } else {
        setAuthErrors({ general: data.error || 'שגיאה בהתחברות עם גוגל' });
      }
    } catch {
      setAuthErrors({ general: 'אין חיבור לשרת' });
    }
  };

  const handleAuth = async () => {
    setAuthErrors({});
    const endpoint = '/auth/login';
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authForm.email, password: authForm.password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      saveStoredAuth(data.token, data.user, authForm.rememberMe);
      setToken(data.token);
      setCurrentUser(data.user);
      // Route reps directly to sessions view
      if (isRepOnlyUser(data.user)) {
        setSessionsOwnOnly(false);
        navigate('/sessions');
      } else {
        navigate('/');
      }
    } else {
      setAuthErrors({ general: data.error === 'Invalid credentials' ? 'שם משתמש או סיסמה שגויים' : (data.error || 'שם משתמש או סיסמה שגויים') });
    }
  };

  const handleImpersonate = useCallback((userData: any, impersonationToken: string) => {
    setToken(impersonationToken);
    setCurrentUser(userData);
    saveStoredAuth(impersonationToken, userData, true);
    // Route based on permissions — same logic as normal login
    if (isRepOnlyUser(userData)) {
      setSessionsOwnOnly(false);
      navigate('/sessions');
    } else {
      navigate('/dashboard');
    }
    // Pass the new token directly to avoid stale closure with the old admin token
    loadBots(impersonationToken);
  }, [loadBots]);

  const handleStopImpersonation = useCallback(async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/stop-impersonation`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        saveStoredAuth(data.token, data.user, true);
        navigate('/dashboard');
        // Pass the new token directly to avoid stale closure with the old impersonation token
        loadBots(data.token);
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error);
    }
  }, [token, loadBots]);

  const handlePublishPaidVersion = async () => {
    if (!newVersionName.trim() || !selectedBot || !token) return;
    
    try {
      console.log('Starting paid version publish...');
      
      // In a real implementation, here you would:
      // 1. Open payment gateway (e.g., PayPal, Stripe, etc.)
      // 2. Wait for payment confirmation
      // 3. Then call the publish-paid endpoint
      
      const res = await fetch(`${API_BASE}/versions/publish-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newVersionName,
          nodes: nodes,
          edges: edges,
          flow_id: selectedBot.id,
          standard_process_id: activeProcessId
        })
      });
      
      const data = await res.json();
      console.log('Paid publish response:', res.status, data);
      
      if (res.ok) {
        setIsPublishModalOpen(false);
        setNewVersionName('');
        setQuotaError(null);
        await loadVersions();
        await loadRestorableVersions();
        alert(`הגרסה פורסמה בהצלחה! סכום התשלום: ${quotaError?.price}₪`);
      } else {
        console.error('Paid publish error:', data);
        alert(`שגיאה בפרסום: ${data.error || 'אנא נסה שוב'}`);
      }
    } catch (e) {
      console.error("Publish paid version failed", e);
      alert("שגיאה בתקשורת עם השרת");
    }
  };

  const handlePublishVersion = async () => {
    if (!newVersionName.trim() || !selectedBot || !token) {
      if (!newVersionName.trim()) alert("נא להזין שם לגרסה");
      return;
    }

    // Validate: any input_text node with saveToContact=true must have contactFieldKey set
    const invalidNodes = nodes.filter(
      n => n.type === 'input_text' && n.data?.saveToContact && !n.data?.contactFieldKey
    );
    if (invalidNodes.length > 0) {
      const ids = invalidNodes.map(n => n.data?.serialId ?? n.id).join(', ');
      alert(`⚠ יש צמתים עם "שמור בפרטי איש קשר" ללא שדה נבחר (${ids}).\nיש לבחור שדה לשמירה בכל צומת כזה לפני הפרסום.`);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/versions/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newVersionName,
          nodes: nodes,
          edges: edges,
          flow_id: selectedBot.id,
          standard_process_id: activeProcessId
        })
      });
      
      const data = await res.json();
      if (res.status === 403 && data.error === 'MAX_VERSIONS_LOCKED') {
        console.info('Version quota reached - showing payment modal');
        setIsPublishModalOpen(false);
        setQuotaError({ type: 'versions', message: data.message, price: data.price });
        return;
      }

      if (res.ok) {
        setIsPublishModalOpen(false);
        setNewVersionName('');
        loadVersions();
        loadRestorableVersions();
      } else {
        alert(`שגיאה בפרסום: ${data.error || 'אנא נסה שוב'}`);
      }
    } catch (e) {
      console.error("Publish version failed", e);
      alert("שגיאה בתקשורת עם השרת");
    }
  };

  const handleToggleVersionLock = async (id: string, isLocked: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/versions/${id}/lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isLocked })
      });
      if (res.ok) {
        loadVersions();
        loadRestorableVersions();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteVersion = async (id: string) => {
    if (!token || !window.confirm("בטוח שברצונך למחוק את הגרסה?")) return;
    try {
      const res = await fetch(`${API_BASE}/versions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setVersions(prev => prev.filter(v => v.id !== id));
        loadRestorableVersions();
      } else {
        alert("שגיאה במחיקת הגרסה");
      }
    } catch (e) { console.error(e); }
  };

  const handleRestoreVersion = async () => {
    if (!versionToRestore || !selectedBot || !token) return;
    
    try {
      const { nodes: restoredNodes, edges: restoredEdges } = versionToRestore.data;
      
      const boundNodes = restoredNodes.map((n: any) => bindNodeCallbacks(n));
      const formattedEdges = restoredEdges.map((e: any, i: number) => ({
        ...e,
        id: e.id || `edge-${i}-${Date.now()}`,
        style: DEFAULT_EDGE_STYLE,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      }));
      
      setNodes(boundNodes);
      setEdges(formattedEdges);
      
      // User explicitly confirmed restoring an older version — force-bypass the
      // shrink guard since intentional smaller-than-current saves are valid here.
      await syncFlow(boundNodes, formattedEdges, undefined, { force: true });
      
      setIsRestoreModalOpen(false);
      setVersionToRestore(null);
      
      if (reactFlowInstance) {
        setTimeout(() => reactFlowInstance.fitView({ padding: 0.5, duration: 800 }), 100);
      }
    } catch (e) {
      console.error("Restore version failed", e);
      alert("שגיאה בשחזור הגרסה");
    }
  };

  const handleRestoreArchivedVersion = async () => {
    if (!archivedVersionToRestore || !selectedBot || !token) return;
    
    try {
      // In a real implementation, here you would:
      // 1. Open payment gateway (e.g., PayPal, Stripe, etc.)
      // 2. Wait for payment confirmation
      // 3. Then call the restore endpoint
      
      // For now, we'll simulate payment confirmation
      const confirmPayment = window.confirm(
        `האם אתה בטוח שברצונך לשלם ${archivedVersionToRestore.price}₪ לשיחזור הגירסה?`
      );
      
      if (!confirmPayment) {
        setIsRestoreArchivedModalOpen(false);
        setArchivedVersionToRestore(null);
        return;
      }
      
      const res = await fetch(`${API_BASE}/versions/${archivedVersionToRestore.id}/restore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Refresh versions and restorable versions
        await loadVersions();
        await loadRestorableVersions();
        
        setIsRestoreArchivedModalOpen(false);
        setArchivedVersionToRestore(null);
        alert(`הגרסה שוחזרה בהצלחה! סכום התשלום: ${archivedVersionToRestore.price}₪`);
      } else {
        alert(`שגיאה בשיחזור: ${data.error || 'אנא נסה שוב'}`);
      }
    } catch (e) {
      console.error("Restore archived version failed", e);
      alert("שגיאה בתקשורת עם השרת");
    }
  };

  const handleRenameProcess = async (processId: string, newName: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/processes/${processId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setFixedProcesses(prev => prev.map(p => p.id.toString() === processId ? { ...p, name: newName } : p));
      }
    } catch (e) { console.error('Failed to rename process', e); }
  };

  const handleCreateProcess = async () => {
    if (!newProcessName.trim() || !selectedBot || !token) return;
    try {
      const res = await fetch(`${API_BASE}/processes`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ name: newProcessName, flow_id: selectedBot.id }) 
      });
      if (res.ok) {
        setIsProcessModalOpen(false);
        setNewProcessName('');
        loadProcesses();
      } else {
        alert("שגיאה ביצירת תהליך");
      }
    } catch (e) { console.error(e); }
  };

  const openDeleteConfirmation = async (id: string, name: string) => {
    setProcessToDelete({ id, name });
    setInstanceCount(0);
    setIsDeleteModalOpen(true);
    try {
      const res = await fetch(`${API_BASE}/processes/${id}/usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstanceCount(data.count);
      }
    } catch (e) { console.error(e); }
  };

  const confirmDeleteProcess = async () => {
    if (!processToDelete || !token || !selectedBot) return;
    const id = processToDelete.id;
    try {
      const res = await fetch(`${API_BASE}/processes/${id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        loadProcesses();
        setActiveProcessId(null);
        setViewMode('editor');
        loadFlow(selectedBot?.id || null);
      }
    } catch (e) { console.error(e); }
    setIsDeleteModalOpen(false);
    setProcessToDelete(null);
  };

  const handleDuplicateProcess = async () => {
    if (!duplicateName.trim() || !activeProcessId || !token || !selectedBot) return;
    
    try {
      const res = await fetch(`${API_BASE}/processes`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ name: duplicateName, flow_id: selectedBot.id }) 
      });
      const newProc = await res.json();
      
      if (newProc.id) {
        const idMap: Record<string, string> = {};
        const clonedNodes = nodes.map(n => {
          const newId = `${n.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          idMap[n.id] = newId;
          return { ...n, id: newId };
        });
        const clonedEdges = edges.map(e => ({
          ...e,
          id: `e-${idMap[e.source]}-${idMap[e.target]}-${Math.random().toString(36).substr(2, 5)}`,
          source: idMap[e.source],
          target: idMap[e.target]
        })).filter(e => e.source && e.target);

        // Sync to a brand-new process — bypass the ready-key/shrink guards
        // (target process has 0 existing widgets and isn't the one currently loaded).
        await syncFlow(clonedNodes, clonedEdges, newProc.id, { force: true });
        await loadProcesses();
        setIsDuplicateModalOpen(false);
        setDuplicateName('');
        setActiveProcessId(newProc.id.toString());
        setViewMode('editing-process');
      }
    } catch (e) {
      console.error("Duplicate failed", e);
      alert("שכפול התהליך נכשל. אנא נסה שוב.");
    }
  };

  const handleInitializeFromTemplate = async (templateId: string, values: Record<string, string>) => {
    if (!selectedBot || !token) return;
    try {
      const res = await fetch(`${API_BASE}/templates/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          bot_id: selectedBot.id,
          template_id: templateId,
          values: values
        })
      });
      if (res.ok) {
        // Persist the user-filled values on selectedBot state so the simulator
        // pre-loads them via initialParams (--variableName-- replacement)
        if (Object.keys(values).length > 0) {
          setSelectedBot(prev => prev ? { ...prev, botParams: values } : prev);
          setBots(prev => prev.map(b => b.id === selectedBot.id ? { ...b, botParams: values } : b));
        }
        loadFlow(selectedBot.id);
        setViewMode('editor');
      } else {
        alert("שגיאה ביצירת תהליך מהתבנית");
      }
    } catch (e) { console.error(e); }
  };

  const handleLoadTemplateForEditing = async (templateId: string) => {
    if (!token) return;
    try {
      // Load template data first
      const templateRes = await fetch(`${API_BASE}/templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const templateData = await templateRes.json();
      setEditingTemplateData({
        name: templateData.name,
        description: templateData.description || '',
        isPublic: templateData.isPublic
      });

      // Load template flow
      const res = await fetch(`${API_BASE}/templates/${templateId}/flow`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.nodes?.length > 0) {
        const loadedNodeIds2 = new Set((data.nodes as any[]).map((n: any) => n.id));
        const seenHandles2 = new Set<string>();
        const cleanEdges2 = (data.edges as any[])
          .filter((e: any) => loadedNodeIds2.has(e.source) && loadedNodeIds2.has(e.target))
          .filter((e: any) => {
            const key = `${e.source}|${e.sourceHandle ?? ''}`;
            if (seenHandles2.has(key)) return false;
            seenHandles2.add(key);
            return true;
          });
        setNodes(data.nodes.map((n: any) => bindNodeCallbacks(n)));
        setEdges(cleanEdges2.map((e: any, i: number) => ({ ...e, type: 'button', id: e.id || `edge-${i}-${Date.now()}`, style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } })));
      } else {
        // Empty template - start with automatic responses node
        const start = bindNodeCallbacks({
          id: `auto-responses-${Date.now()}`,
          type: NodeType.AUTOMATIC_RESPONSES,
          position: { x: 800, y: 400 },
          data: { label: 'תגובות אוטומטיות', serialId: '#1', options: ['כניסה'], optionOperators: ['eq'] },
        });
        setNodes([start]);
        setEdges([]);
      }
      setEditingTemplateId(templateId);
      setViewMode('editing-template');
    } catch (e) { 
      console.error(e); 
      alert("שגיאה בטעינת תבנית");
    }
  };

  const handleCreateNewTemplate = () => {
    // Start with empty template
    const start = bindNodeCallbacks({
      id: `auto-responses-${Date.now()}`,
      type: NodeType.AUTOMATIC_RESPONSES,
      position: { x: 800, y: 400 },
      data: { label: 'תגובות אוטומטיות', serialId: '#1', options: ['כניסה'], optionOperators: ['eq'] },
    });
    setNodes([start]);
    setEdges([]);
    setCreatingTemplate(true);
    setViewMode('creating-template');
  };

  const handleSaveNewTemplate = async (name: string, description: string, isPublic: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name,
          description,
          isPublic,
          nodes,
          edges
        })
      });
      if (res.ok) {
        setCreatingTemplate(false);
        navigate('/admin/templates');
        alert('תבנית נשמרה בהצלחה!');
      } else {
        alert('שגיאה בשמירת תבנית');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בשמירת תבנית');
    }
  };

  const handleUpdateExistingTemplate = async (name: string, description: string, isPublic: boolean) => {
    if (!token || !editingTemplateId) return;
    try {
      const res = await fetch(`${API_BASE}/templates/${editingTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name,
          description,
          isPublic,
          nodes,
          edges
        })
      });
      if (res.ok) {
        setEditingTemplateData({ name, description, isPublic });
        alert('תבנית עודכנה בהצלחה!');
      } else {
        alert('שגיאה בעדכון תבנית');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בעדכון תבנית');
    }
  };

  const handleCloseTemplateEditor = () => {
    setEditingTemplateId(null);
    setEditingTemplateData(null);
    setCreatingTemplate(false);
    setIsTemplateParamsModalOpen(false);
    setNodes([]);
    setEdges([]);
    navigate('/admin/templates');
  };

  const openTemplateParamsModal = async () => {
    if (!token || !editingTemplateId) return;
    try {
      const res = await fetch(`${API_BASE}/templates/${editingTemplateId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tpl = await res.json();
      setTemplateEditingParams(tpl.params ? tpl.params.map((p: any) => ({ ...p })) : []);
      setIsTemplateParamsModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const saveTemplateParamsFromEditor = async () => {
    if (!token || !editingTemplateId) return;
    setTemplateSavingParams(true);
    try {
      const res = await fetch(`${API_BASE}/templates/${editingTemplateId}/params`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ params: templateEditingParams })
      });
      if (res.ok) {
        setIsTemplateParamsModalOpen(false);
      } else {
        alert('שגיאה בשמירת הפרמטרים');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTemplateSavingParams(false);
    }
  };

  const handleChangeTemplate = async () => {
    if (!selectedBot || !token) return;
    
    try {
      // Clear current flow
      setNodes([]);
      setEdges([]);
      
      // Sync empty flow to server — this is the ONE intentional wipe in the app,
      // so we pass force:true to bypass the empty/shrink guards.
      await syncFlow([], [], undefined, { force: true });
      
      // Close modal and go to template selection
      setIsChangeTemplateModalOpen(false);
      setViewMode('template-selection');
    } catch (e) {
      console.error("Change template failed", e);
      alert("שגיאה בהחלפת התסריט");
    }
  };

  const enterBot = useCallback((bot: BotFlow) => {
    setIsFlowTransitioning(true);  // show spinner while loading
    pendingFitViewRef.current = true;  // signal: next nodes update needs fitView
    setNodes([]);   // clear stale nodes so fitView has no old canvas to inherit
    setEdges([]);
    setActiveProcessId(null);
    setSelectedBot(bot);  // triggers useEffect → loadFlow (single call)
    setViewMode('editor');
    navigate('/bot/' + bot.id);
  }, [navigate]);

  /**
   * Flush any pending sync BEFORE changing activeProcessId/viewMode.
   * Without this, navigation that mutates those deps cancels the debounce
   * timer (via useEffect cleanup) and the latest connections are never saved.
   */
  const handleCloseProcessEditor = useCallback(async () => {
    const zoom = reactFlowInstance?.getViewport().zoom ?? 1;
    setIsFlowTransitioning(true);
    await syncFlowRef.current();
    const closingProcessId = activeProcessId;
    setActiveProcessId(null);
    setViewMode('editor');
    loadFlow(selectedBot?.id || null).then(() => {
      requestAnimationFrame(() =>        // React commits new nodes to DOM
        requestAnimationFrame(() =>      // ReactFlow measures node sizes
          requestAnimationFrame(() => {  // safe to fitView
            reactFlowInstance?.fitView({ padding: 0.5, duration: 0, minZoom: zoom, maxZoom: zoom });
            requestAnimationFrame(() => requestAnimationFrame(() => setIsFlowTransitioning(false)));
          })
        )
      );
      // Background-refresh the cache for the process we just edited, then re-run global search
      if (closingProcessId && token) {
        fetch(`${API_BASE}/flow?standard_process_id=${closingProcessId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(data => {
          processNodesCacheRef.current[closingProcessId] = data.nodes || [];
          setGlobalSearchTrigger(t => t + 1);
        }).catch(() => {});
      }
    });
  }, [reactFlowInstance, selectedBot, loadFlow, activeProcessId, token]);

  const handleEditFixedProcess = useCallback(async (id: string) => {
    const zoom = reactFlowInstance?.getViewport().zoom ?? 1;
    setIsFlowTransitioning(true);
    // Flush current process changes before switching
    await syncFlowRef.current();
    setActiveProcessId(id);
    setViewMode('editing-process');
    loadFlow(selectedBot?.id || null, id).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            reactFlowInstance?.fitView({ padding: 0.5, duration: 0, minZoom: zoom, maxZoom: zoom });
            requestAnimationFrame(() => requestAnimationFrame(() => setIsFlowTransitioning(false)));
          })
        )
      );
    });
  }, [reactFlowInstance, selectedBot, loadFlow]);

  const handleViewFixedProcess = useCallback(async (id: string) => {
    const zoom = reactFlowInstance?.getViewport().zoom ?? 1;
    setIsFlowTransitioning(true);
    await syncFlowRef.current();
    setActiveProcessId(id);
    setViewMode('viewing-process');
    loadFlow(selectedBot?.id || null, id).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            reactFlowInstance?.fitView({ padding: 0.5, duration: 0, minZoom: zoom, maxZoom: zoom });
            requestAnimationFrame(() => requestAnimationFrame(() => setIsFlowTransitioning(false)));
          })
        )
      );
    });
  }, [reactFlowInstance, selectedBot, loadFlow]);

  // Navigate from a global search result into the fixed process and highlight the node
  const navigateToProcessResult = useCallback(async (processId: string, nodeId: string) => {
    pendingFocusNodeIdRef.current = nodeId;
    setGlobalSearchResults([]);
    await handleEditFixedProcess(processId);
  }, [handleEditFixedProcess]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    // Only mark dirty for real structural changes, not ReactFlow internals
    // (dimension measurements, hover selection, etc.)
    if (changes.some(c => c.type === 'remove' || (c.type === 'position' && !c.dragging))) {
      dirtyRef.current = true;
    }
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove')) dirtyRef.current = true;
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);
  const onConnect: OnConnect = useCallback((params) => {
    dirtyRef.current = true;
    return setEdges((eds) => {
    // Remove any existing edge from the same source-handle before adding the new connection.
    // Without this, old edges loaded from the DB coexist with the new one and the backend
    // finds the OLD edge first (via Array.find), saving the wrong target.
    const withoutOld = params.sourceHandle
      ? eds.filter(e => !(e.source === params.source && e.sourceHandle === params.sourceHandle))
      : eds;
    return addEdge({ ...params, type: 'button', style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } }, withoutOld);
  });
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    const type = event.dataTransfer.getData('application/reactflow') as NodeType;
    // Guard: only accept drops that originated from the sidebar (valid node type)
    if (!type) return;
    const extraData = JSON.parse(event.dataTransfer.getData('application/extra') || '{}');
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left,
      y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top,
    });
    const prefix = type === NodeType.FIXED_PROCESS ? 'B' : '#';
    const nextNum = nodes.filter(n => n.data.serialId?.startsWith(prefix)).length + 1;
    const hebrewNodeNames: Record<string, string> = {
      [NodeType.INPUT_TEXT]: 'שדה טקסט',
      [NodeType.INPUT_DATE]: 'בחירת תאריך/שעה',
      [NodeType.INPUT_FILE]: 'העלאת קובץ',
      [NodeType.OUTPUT_TEXT]: 'הודעת טקסט',
      [NodeType.OUTPUT_IMAGE]: 'הודעת תמונה',
      [NodeType.OUTPUT_LINK]: 'קישור חיצוני',
      [NodeType.OUTPUT_MENU]: 'תפריט בחירה',
      [NodeType.ACTION_WEB_SERVICE]: 'קריאת API',
      [NodeType.ACTION_WAIT]: 'המתנה',
      [NodeType.ACTION_TIME_ROUTING]: 'ניתוב לפי שעה',
      [NodeType.ACTION_ADD_TO_GROUP]: 'הוספה/הסרה מקבוצה',
      [NodeType.ACTION_REMOVE_FROM_GROUP]: 'הסר מקבוצה',
      [NodeType.ACTION_TRANSFER_TO_AGENT]: 'העברה לנציג',
      [NodeType.FIXED_PROCESS]: 'תהליך',
    };
    const newNode = bindNodeCallbacks({
      id: `${type}-${Date.now()}`,
      type, position,
      data: { 
        label: extraData.name || hebrewNodeNames[type] || 'רכיב חדש', 
        processId: extraData.id, 
        serialId: `${prefix}${nextNum}`,
        isStandardProcess: type === NodeType.FIXED_PROCESS
      },
    });
    dirtyRef.current = true;
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, bindNodeCallbacks, nodes]);

  // Center & zoom the canvas on the simulator's active node.
  // When inside a fixed-process sub-flow, prefer centering on the FixedProcess node in the main canvas.
  useEffect(() => {
    const targetId = simulatorFixedProcessNodeId || simulatorActiveNodeId;
    if (!targetId || !reactFlowInstance) return;
    const node = nodes.find(n => n.id === targetId);
    if (!node) return;
    const x = node.position.x + (node.width ?? 300) / 2;
    const y = node.position.y + (node.height ?? 150) / 2;
    const currentZoom = reactFlowInstance.getViewport().zoom;
    reactFlowInstance.setCenter(x, y, { zoom: currentZoom, duration: 500 });
  }, [simulatorFixedProcessNodeId, simulatorActiveNodeId, reactFlowInstance, nodes]);

  const nodesWithSearch = useMemo(() => nodes.map(n => ({
    ...n, data: { ...n.data, groups, repGroups, repUsers, searchQuery, isCurrentMatch: searchResults[currentSearchIndex] === n.id, isSearchMatch: searchResults.includes(n.id), isSimulatorActive: n.id === simulatorActiveNodeId || n.id === simulatorFixedProcessNodeId }
  })), [nodes, groups, repGroups, repUsers, searchQuery, searchResults, currentSearchIndex, simulatorActiveNodeId, simulatorFixedProcessNodeId]);

  const openPublishModal = useCallback(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL').replace(/\./g, '/');
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    setNewVersionName(`גרסה מ-${dateStr} ${timeStr}`);
    setIsPublishModalOpen(true);
  }, []);

  // Show standalone registration page when ?register=1 is in the URL
  const isRegisterPage = new URLSearchParams(window.location.search).get('register') === '1';
  if (isRegisterPage) {
    return <RegisterPage />;
  }

  if (sessionExpired) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-12 max-w-sm w-full text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><path stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">הסשן פג תוקף</h2>
            <p className="text-slate-500 text-sm">כל השינויים שביצעת עד כה נשמרו.<br/>אנא התחבר מחדש כדי להמשיך לעבוד.</p>
          </div>
          <button
            onClick={() => { setSessionExpired(false); window.location.reload(); }}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
          >
            התחבר מחדש
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser && viewMode !== 'simulator-only') {
    return <AuthScreen form={authForm} errors={authErrors} onFormChange={(data) => { setAuthErrors({}); setAuthForm(data); }} onAuth={handleAuth} onGoogleLogin={handleGoogleLogin} />
  }

  // Trial expiry check — show blocking screen if trial has expired
  if (
    currentUser &&
    currentUser.account_type === 'Trial' &&
    currentUser.trial_expires_at &&
    new Date() > new Date(currentUser.trial_expires_at) &&
    viewMode !== 'simulator-only'
  ) {
    return (
      <TrialExpiredScreen
        userName={currentUser.name}
        onLogout={handleLogout}
      />
    );
  }

  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin" element={
          <AdminPanel
            token={token!}
            currentUser={currentUser}
            onBack={() => navigate('/dashboard')}
            onImpersonate={handleImpersonate}
            onEditTemplate={handleLoadTemplateForEditing}
            onCreateTemplate={handleCreateNewTemplate}
          />
        } />
        <Route path="/admin/:tab" element={
          <AdminPanel
            token={token!}
            currentUser={currentUser}
            onBack={() => navigate('/dashboard')}
            onImpersonate={handleImpersonate}
            onEditTemplate={handleLoadTemplateForEditing}
            onCreateTemplate={handleCreateNewTemplate}
          />
        } />
      </Routes>
    );
  }

  if (viewMode === 'template-selection') {
    return <TemplateSelection 
      token={token}
      selectedBotId={selectedBot?.id || null}
      currentUser={currentUser}
      onSelect={(template) => { 
        if (!template) {
          setViewMode('editor');
          loadFlow(selectedBot?.id || null);
        } else if (template.fields && template.fields.length > 0) {
          // Old predefined template with fields
          setSelectedTemplate(template);
          setViewMode('template-form');
        } else {
          // DB template - directly initialize from it
          handleInitializeFromTemplate(template.id, {});
        }
      }} 
      onBack={() => navigate('/dashboard')}
    />;
  }

  if (viewMode === 'template-form' && selectedTemplate) {
    return <TemplateForm 
      template={selectedTemplate} 
      onSubmit={(values) => handleInitializeFromTemplate(selectedTemplate.id, values)}
      onBack={() => setViewMode('template-selection')}
    />;
  }

  // Template Editor (creating or editing)
  if (viewMode === 'creating-template' || viewMode === 'editing-template') {
    return (
      <>
        <Editor 
          selectedBot={null}
          nodes={nodesWithSearch}
          edges={edges}
          fixedProcesses={fixedProcesses}
          versions={[]}
          currentUser={currentUser}
          token={token}
          viewMode='main'
          activeProcessId={null}
          searchQuery={searchQuery}
          searchResults={searchResults}
          currentSearchIndex={currentSearchIndex}
          reactFlowWrapper={reactFlowWrapper}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isSimulatorOpen={false}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onSearchChange={setSearchQuery}
          onSearchNav={(dir) => { setCurrentSearchIndex(i => dir === 'up' ? (i > 0 ? i - 1 : searchResults.length - 1) : (i + 1) % searchResults.length); setSearchNavigateTrigger(t => t + 1); }}
          onTidy={tidyFlow}
          onPublish={() => {}}
          onCloseEditor={handleCloseTemplateEditor}
          onHome={handleCloseTemplateEditor}
          onSimulatorOpen={() => {}}
          onSimulatorClose={() => {}}
          onDuplicate={() => {}}
          onChangeTemplate={() => {}}
          onOpenContacts={() => navigate('/contacts')}
          onOpenSessions={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
          sidebarProps={{
            fixedProcesses,
            versions: [],
            restorableVersions: null,
            activeProcessId: null,
            onAddFixedProcess: () => {},
            onEditFixedProcess: () => {},
            onViewFixedProcess: () => {},
            onDeleteFixedProcess: () => {},
            onRestoreVersion: () => {},
            onArchiveVersion: () => {},
            onRestoreArchivedVersion: () => {},
            onDeleteVersion: () => {}
          }}
          isEditingTemplate={true}
          onSaveTemplate={viewMode === 'creating-template' ? handleSaveNewTemplate : handleUpdateExistingTemplate}
          existingTemplateData={editingTemplateData}
          onManageParams={viewMode === 'editing-template' ? openTemplateParamsModal : undefined}
          saveStatus={saveStatus}
        />

        {/* Template Params Modal - accessible from within editor */}
        {isTemplateParamsModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[300] flex items-center justify-center p-6" dir="rtl">
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <button onClick={() => setIsTemplateParamsModalOpen(false)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                  <X size={20} />
                </button>
                <div className="text-right">
                  <h3 className="text-xl font-black text-slate-800">ניהול פרמטרים</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{editingTemplateData?.name}</p>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex-shrink-0">
                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                  הגדר כאן את השדות שיוצגו למשתמש בטופס לפני שימוש בתבנית.<br />
                  בתוכן הרכיבים השתמש בתחביר <span className="font-black font-mono bg-amber-100 px-1 rounded">--שם_משתנה--</span> כדי להציג את הערך.
                </p>
              </div>

              {/* Params list */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {templateEditingParams.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Sliders size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">אין פרמטרים. לחץ &ldquo;הוסף פרמטר&rdquo; להתחיל.</p>
                  </div>
                )}
                {templateEditingParams.map((param, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <button
                      onClick={() => setTemplateEditingParams(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <X size={15} />
                    </button>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">תווית למשתמש</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: שם החברה"
                          value={param.label}
                          onChange={e => setTemplateEditingParams(prev => prev.map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-right outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">שם משתנה (ב‑--‑--)</label>
                        <input
                          type="text"
                          placeholder="לדוגמה: comp_name"
                          value={param.variableName}
                          onChange={e => setTemplateEditingParams(prev => prev.map((p, i) => i === idx ? { ...p, variableName: e.target.value.replace(/\s/g, '_') } : p))}
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
                  onClick={() => setTemplateEditingParams(prev => [...prev, { label: '', variableName: '' }])}
                  className="w-full py-3 border-2 border-dashed border-amber-300 text-amber-600 rounded-2xl font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> הוסף פרמטר
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsTemplateParamsModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={saveTemplateParamsFromEditor}
                    disabled={templateSavingParams || templateEditingParams.some(p => !p.label.trim() || !p.variableName.trim())}
                    className="flex-[2] py-3 bg-amber-500 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {templateSavingParams ? 'שומר...' : 'שמור פרמטרים'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (viewMode === 'simulator-only') {
    const params = new URLSearchParams(window.location.search);
    const flowId = selectedBot?.id || params.get('flow_id');
    return (
      <div className="h-screen w-screen bg-white">
        <Simulator 
          isOpen={true} 
          onClose={() => window.close()} 
          flowInstance={null} 
          nodes={nodes}
          edges={edges}
          fixedProcesses={fixedProcesses} 
          versions={versions}
          token={token}
          isStandalone={true}
          currentUser={currentUser}
          flowId={flowId}
        />
      </div>
    );
  }

  // Ensure 'simulator-only' doesn't get blocked by the Loading check
  // The check for viewMode !== 'simulator-only' is redundant here as it's handled above.
  if (viewMode !== 'editor' && viewMode !== 'editing-process' && viewMode !== 'viewing-process' && !location.pathname.startsWith('/bot/')) {
    // URL-based pages — rendered by React Router
    return (
      <>
        <Routes>
          <Route path="/" element={
            <HomePage
              currentUser={currentUser}
              onGoToBots={() => navigate('/dashboard')}
              onGoToChats={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
              onGoToContacts={() => navigate('/contacts')}
              onGoToSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onGoToSettings={() => navigate('/settings')}
              onOpenAdminPanel={currentUser?.role === 'admin' ? () => navigate('/admin') : undefined}
              onLogout={handleLogout}
              onStopImpersonation={handleStopImpersonation}
            />
          } />
          <Route path="/contacts" element={
            <ContactsPage
              token={token}
              currentUser={currentUser}
              onBack={() => navigate('/dashboard')}
              onGoHome={() => navigate('/')}
              onLogout={() => { localStorage.clear(); window.location.reload(); }}
              onOpenSessions={can('sessions.view') ? (phone?: string) => { setSessionsInitialPhone(phone ?? null); setSessionsOwnOnly(true); navigate('/sessions'); } : undefined}
              onOpenGroups={can('groups.view') ? () => navigate('/groups') : undefined}
              onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onOpenAdminPanel={() => navigate('/admin')}
              onOpenSettings={can('settings.view') ? () => navigate('/settings') : undefined}
              onOpenSubUsers={can('users.view') ? () => navigate('/users') : undefined}
              onStopImpersonation={handleStopImpersonation}
              initialPhone={contactsInitialPhone}
            />
          } />
          <Route path="/groups" element={
            <GroupsPage
              token={token}
              currentUser={currentUser}
              onBack={() => navigate('/dashboard')}
              onGoHome={() => navigate('/')}
              onLogout={() => { localStorage.clear(); window.location.reload(); }}
              onOpenContacts={can('contacts.view') ? (phone?: string) => { setContactsInitialPhone(phone ?? null); navigate('/contacts'); } : undefined}
              onOpenSessions={can('sessions.view') ? (phone?: string) => { setSessionsInitialPhone(phone ?? null); setSessionsOwnOnly(true); navigate('/sessions'); } : undefined}
              onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onOpenAdminPanel={() => navigate('/admin')}
              onOpenSettings={can('settings.view') ? () => navigate('/settings') : undefined}
              onOpenSubUsers={can('users.view') ? () => navigate('/users') : undefined}
              onStopImpersonation={handleStopImpersonation}
            />
          } />
          <Route path="/sessions" element={
            <SessionsPage
              token={token}
              currentUser={currentUser}
              onBack={isRepOnlyUser(currentUser) ? undefined : () => navigate('/dashboard')}
              onGoHome={isRepOnlyUser(currentUser) ? undefined : () => navigate('/')}
              onLogout={() => { localStorage.clear(); window.location.reload(); }}
              onOpenContacts={can('contacts.view') ? (phone?: string) => { setContactsInitialPhone(phone ?? null); navigate('/contacts'); } : undefined}
              onOpenGroups={can('groups.view') ? () => navigate('/groups') : undefined}
              onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onOpenAdminPanel={() => navigate('/admin')}
              ownOnly={sessionsOwnOnly}
              initialPhone={sessionsInitialPhone}
              onOpenSettings={can('settings.view') ? () => navigate('/settings') : undefined}
              onOpenSubUsers={can('users.view') ? () => navigate('/users') : undefined}
              onStopImpersonation={handleStopImpersonation}
              onUpdateAvailability={handleUpdateAvailability}
            />
          } />
          <Route path="/dashboard" element={
            <>
              <Dashboard
                bots={bots}
                onEnterBot={enterBot}
                onCreateBot={handleCreateBot}
                onDeleteBot={handleDeleteBot}
                onSetDefaultBot={handleSetDefaultBot}
                onLogout={handleLogout}
                currentUser={currentUser}
                onOpenAdminPanel={() => navigate('/admin')}
                onOpenContacts={() => navigate('/contacts')}
                onOpenSessions={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
                onOpenGroups={() => navigate('/groups')}
                onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
                onStopImpersonation={handleStopImpersonation}
                onConnectFacebook={(can('bots.publish') || currentUser?.isImpersonating) ? handleConnectFacebook : undefined}
                onUpdateBotPublicId={handleUpdateBotPublicId}
                onUpdateBotEndpoint={currentUser?.isImpersonating ? handleUpdateBotEndpoint : undefined}
                onUpdateBotRestartKeyword={handleUpdateBotRestartKeyword}
                onUpdateAvailability={handleUpdateAvailability}
                onGoHome={() => navigate('/')}
                token={token}
                initialTab="bots"
              />
              {quotaError && quotaError.type === 'bots' && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-6 text-right">
                  <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 mr-0"><AlertTriangle size={32} /></div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">המכסה הסתיימה</h3>
                    <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">{quotaError.message}</p>
                    <div className="flex flex-col gap-3">
                      <button onClick={() => window.open('https://payment.mesergo.com', '_blank')} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700">קנה בוט חדש ({quotaError.price}₪)</button>
                      <button onClick={() => setQuotaError(null)} className="w-full py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold hover:bg-slate-50">ביטול</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          } />
          <Route path="/settings" element={
            <Dashboard
              bots={bots}
              onEnterBot={enterBot}
              onCreateBot={handleCreateBot}
              onDeleteBot={handleDeleteBot}
              onSetDefaultBot={handleSetDefaultBot}
              onLogout={handleLogout}
              currentUser={currentUser}
              onOpenAdminPanel={() => navigate('/admin')}
              onOpenContacts={() => navigate('/contacts')}
              onOpenSessions={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
              onOpenGroups={() => navigate('/groups')}
              onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onStopImpersonation={handleStopImpersonation}
              onConnectFacebook={(can('bots.publish') || currentUser?.isImpersonating) ? handleConnectFacebook : undefined}
              onUpdateBotPublicId={handleUpdateBotPublicId}
              onUpdateBotEndpoint={currentUser?.isImpersonating ? handleUpdateBotEndpoint : undefined}
              onUpdateBotRestartKeyword={handleUpdateBotRestartKeyword}
              onUpdateAvailability={handleUpdateAvailability}
              onGoHome={() => navigate('/')}
              token={token}
              initialTab="settings"
            />
          } />
          <Route path="/users" element={
            <Dashboard
              bots={bots}
              onEnterBot={enterBot}
              onCreateBot={handleCreateBot}
              onDeleteBot={handleDeleteBot}
              onSetDefaultBot={handleSetDefaultBot}
              onLogout={handleLogout}
              currentUser={currentUser}
              onOpenAdminPanel={() => navigate('/admin')}
              onOpenContacts={() => navigate('/contacts')}
              onOpenSessions={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
              onOpenGroups={() => navigate('/groups')}
              onOpenSmsIn={can('sms_in.view') ? () => navigate('/sms-in') : undefined}
              onStopImpersonation={handleStopImpersonation}
              onConnectFacebook={(can('bots.publish') || currentUser?.isImpersonating) ? handleConnectFacebook : undefined}
              onUpdateBotPublicId={handleUpdateBotPublicId}
              onUpdateBotEndpoint={currentUser?.isImpersonating ? handleUpdateBotEndpoint : undefined}
              onUpdateBotRestartKeyword={handleUpdateBotRestartKeyword}
              onUpdateAvailability={handleUpdateAvailability}
              onGoHome={() => navigate('/')}
              token={token}
              initialTab="users"
            />
          } />
          <Route path="/sms-in" element={
            !can('sms_in.view') ? <Navigate to="/" replace /> :
            <SmsInPage
              token={token}
              currentUser={currentUser}
              onBack={() => navigate('/dashboard')}
              onLogout={() => { localStorage.clear(); window.location.reload(); }}
              onOpenSessions={can('sessions.view') ? (phone?: string) => { setSessionsInitialPhone(phone ?? null); setSessionsOwnOnly(true); navigate('/sessions'); } : undefined}
              onOpenContacts={can('contacts.view') ? (phone?: string) => { setContactsInitialPhone(phone ?? null); navigate('/contacts'); } : undefined}
              onOpenGroups={can('groups.view') ? () => navigate('/groups') : undefined}
              onOpenAdminPanel={currentUser?.role === 'admin' ? () => navigate('/admin') : undefined}
              onOpenSettings={can('settings.view') ? () => navigate('/settings') : undefined}
              onOpenSubUsers={can('users.view') ? () => navigate('/users') : undefined}
              onStopImpersonation={handleStopImpersonation}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  if (!selectedBot && !activeProcessId && !editingTemplateId && !creatingTemplate) return <div>Loading...</div>;

  return (
    <>
      <Editor 
        selectedBot={selectedBot!}
        nodes={nodesWithSearch}
        edges={edges}
        fixedProcesses={fixedProcesses}
        versions={versions}
        currentUser={currentUser}
        token={token}
        viewMode={viewMode === 'editor' ? 'main' : (viewMode === 'editing-process' ? 'editing-process' : 'viewing-process')}
        activeProcessId={activeProcessId}
        searchQuery={searchQuery}
        searchResults={searchResults}
        currentSearchIndex={currentSearchIndex}
        reactFlowWrapper={reactFlowWrapper}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isSimulatorOpen={isSimulatorOpen}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onSearchChange={setSearchQuery}
        onSearchNav={(dir) => { setCurrentSearchIndex(i => dir === 'up' ? (i > 0 ? i - 1 : searchResults.length - 1) : (i + 1) % searchResults.length); setSearchNavigateTrigger(t => t + 1); }}
        onTidy={tidyFlow}
        onPublish={openPublishModal}
        onCloseEditor={handleCloseProcessEditor}
        onHome={() => { setSelectedBot(null); setActiveProcessId(null); setViewMode('home'); navigate('/dashboard'); }}
        onSimulatorOpen={() => setIsSimulatorOpen(true)}
        onSimulatorClose={() => { setIsSimulatorOpen(false); setSimulatorActiveNodeId(null); setSimulatorFixedProcessNodeId(null); }}
        onDuplicate={() => { setDuplicateName(`${fixedProcesses.find(p => p.id.toString() === activeProcessId)?.name || ''} (עותק)`); setIsDuplicateModalOpen(true); }}
        onChangeTemplate={() => setIsChangeTemplateModalOpen(true)}
        onOpenContacts={() => navigate('/contacts')}
        onOpenSessions={() => { setSessionsOwnOnly(true); navigate('/sessions'); }}
        initialParams={selectedBot?.botParams}
        onNodeFocus={setSimulatorActiveNodeId}
        onFixedProcessActive={setSimulatorFixedProcessNodeId}
        isTransitioning={isFlowTransitioning}
        globalSearchResults={globalSearchResults}
        onNavigateToProcessResult={navigateToProcessResult}
        onOpenBotSettings={can('bots.settings') ? () => setIsBotSettingsOpen(true) : undefined}
        onRenameProcess={handleRenameProcess}
        saveStatus={saveStatus}
        sidebarProps={{
          fixedProcesses,
          versions,
          restorableVersions,
          activeProcessId,
          onAddFixedProcess: () => setIsProcessModalOpen(true),
          onEditFixedProcess: handleEditFixedProcess,
          onViewFixedProcess: handleViewFixedProcess,
          onDeleteFixedProcess: openDeleteConfirmation,
          onRestoreVersion: (v: Version) => { setVersionToRestore(v); setIsRestoreModalOpen(true); },
          onDeleteVersion: handleDeleteVersion,
          onToggleVersionLock: handleToggleVersionLock,
          onOpenPublishModal: openPublishModal,
          onRestoreArchivedVersion: (versionId: string, versionPrice: number) => {
            setArchivedVersionToRestore({ id: versionId, price: versionPrice });
            setIsRestoreArchivedModalOpen(true);
          }
        }}
      />

      {/* Bot Settings Modal – accessible from within the editor */}
      {isBotSettingsOpen && selectedBot && (
        <BotSettingsModal
          bot={selectedBot}
          currentUser={currentUser}
          onClose={() => setIsBotSettingsOpen(false)}
          onUpdateBotPublicId={async (id, publicId) => {
            await handleUpdateBotPublicId(id, publicId);
            setSelectedBot(prev => prev ? { ...prev, public_id: publicId } : null);
          }}
          onUpdateBotEndpoint={(currentUser?.isImpersonating || currentUser?.role === 'admin') ? async (id, endpoint) => {
            await handleUpdateBotEndpoint(id, endpoint);
            setSelectedBot(prev => prev ? { ...prev, endpoint } : null);
          } : undefined}
          onUpdateBotRestartKeyword={async (id, keyword) => {
            await handleUpdateBotRestartKeyword(id, keyword);
            setSelectedBot(prev => prev ? { ...prev, restart_keyword: keyword } : null);
          }}
          onConnectFacebook={(can('bots.publish') || currentUser?.isImpersonating) ? handleConnectFacebook : undefined}
        />
      )}

      {quotaError && quotaError.type === 'versions' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 mr-0"><Lock size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              הגעת למגבלת הגרסאות
            </h3>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">{quotaError.message}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handlePublishPaidVersion} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
              >
                פרסם גרסה בתשלום ({quotaError.price}₪)
              </button>
              <button 
                onClick={() => { setQuotaError(null); setIsPublishModalOpen(false); setNewVersionName(''); }} 
                className="w-full py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><Plus size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">תהליך חדש</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed text-right">צור תהליך חדש שתוכל להשתמש בו שוב ושוב.</p>
            <div className="space-y-6">
              <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm font-bold text-right" placeholder="שם התהליך..." value={newProcessName} onChange={e => setNewProcessName(e.target.value)} autoFocus />
              <div className="flex gap-4">
                <button onClick={() => { setIsProcessModalOpen(false); setNewProcessName(''); }} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">ביטול</button>
                <button onClick={handleCreateProcess} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">צור תהליך</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChangeTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center mb-6 mr-0"><AlertTriangle size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">הזהרה</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed text-right">
              פעולה זו תמחק את כל התסריט, לרבות השינויים שבוצעו בו עד כה. האם תרצה להמשיך לשינוי התסריט?
            </p>
            <div className="flex gap-4">
              <button onClick={() => setIsChangeTemplateModalOpen(false)} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">בטל</button>
              <button onClick={handleChangeTemplate} className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors">אשר</button>
            </div>
          </div>
        </div>
      )}

      {isDuplicateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[110] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><Copy size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">שכפול תהליך</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed text-right">הזן שם חדש עבור העותק של התהליך הנוכחי.</p>
            <div className="space-y-6">
              <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm font-bold text-right" placeholder="שם העותק..." value={duplicateName} onChange={e => setDuplicateName(e.target.value)} autoFocus />
              <div className="flex gap-4">
                <button onClick={() => setIsDuplicateModalOpen(false)} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">ביטול</button>
                <button onClick={handleDuplicateProcess} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">שכפול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[120] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6 mr-0"><AlertTriangle size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">אישור מחיקה</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed text-right">
              שים לב: תהליך זה מופיע <span className="text-red-600 font-bold">{instanceCount}</span> פעמים בסך כל הבוטים. המחיקה תסיר את כל המופעים של <span className="text-slate-900 font-bold">{processToDelete?.name}</span> מכל הבוטים.
              <br /> האם אתה בטוח שברצונך למחוק?
            </p>
            <div className="flex gap-4">
              <button onClick={() => { setIsDeleteModalOpen(false); setProcessToDelete(null); }} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">ביטול</button>
              <button onClick={confirmDeleteProcess} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors">מחק</button>
            </div>
          </div>
        </div>
      )}

      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><CloudUpload size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">פרסום גרסה</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed text-right">שמור צילום מצב (Snapshot) מלא של התזרים הנוכחי.</p>
            <div className="space-y-6">
              <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-blue-600 transition-all text-sm font-bold text-right" placeholder="שם הגרסה (למשל: לפני עדכון API)..." value={newVersionName} onChange={e => setNewVersionName(e.target.value)} autoFocus />
              <div className="flex gap-4">
                <button onClick={() => { setIsPublishModalOpen(false); setNewVersionName(''); }} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">ביטול</button>
                <button onClick={handlePublishVersion} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors">פרסם</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-6 mr-0"><RotateCcw size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">אישור שחזור גרסה</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed text-right">
              שים לב: שחזור הגרסה <span className="text-slate-900 font-bold">{versionToRestore?.name}</span> ידרוס את העבודה הנוכחית שלך אם לא שמרת גרסה.
              <br /> האם אתה בטוח שברצונך להמשיך?
            </p>
            <div className="flex gap-4">
              <button onClick={() => { setIsRestoreModalOpen(false); setVersionToRestore(null); }} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">ביטול</button>
              <button onClick={handleRestoreVersion} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors">שחזר עכשיו</button>
            </div>
          </div>
        </div>
      )}

      {isRestoreArchivedModalOpen && archivedVersionToRestore && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><RotateCcw size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">שיחזור גרסה</h3>
            <p className="text-slate-500 text-sm mb-4 font-medium leading-relaxed text-right">
              שחזור גרסה זו ידרוס את העבודה הנוכחית שלך אם לא שמרת גרסה.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-slate-700">
                <Wallet size={20} />
                <span className="text-lg font-bold">עלות שחזור: {archivedVersionToRestore.price}₪</span>
              </div>
              <div className="text-xs text-center text-slate-600 mt-2">
                תשלום חד פעמי
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-6 text-center">
              שחזור הגרסה ינעל אותה ותוסיף אותה לרשימה הנראית מעבר למגבלה
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => { setIsRestoreArchivedModalOpen(false); setArchivedVersionToRestore(null); }} 
                className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
              >
                ביטול
              </button>
              <button 
                onClick={handleRestoreArchivedVersion} 
                className="flex-1 py-4 bg-slate-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-slate-600/20 hover:bg-slate-700 transition-colors"
              >
                שלם ושחזר ({archivedVersionToRestore.price}₪)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function AppWrapper() {
  return (
    <ReactFlowProvider>
      <ContactFieldsWrapper />
    </ReactFlowProvider>
  );
}

/** Inner wrapper so ContactFieldsProvider receives the reactive token from FlowBuilder's state */
function ContactFieldsWrapper() {
  const [token, setToken] = React.useState<string | null>(
    localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token')
  );

  React.useEffect(() => {
    const onStorage = () => {
      setToken(localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token'));
    };
    window.addEventListener('storage', onStorage);
    // Also listen to a custom event fired on login/logout within the same tab
    window.addEventListener('flowbot-auth-change', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('flowbot-auth-change', onStorage);
    };
  }, []);

  return (
    <ContactFieldsProvider token={token}>
      <FlowBuilder />
    </ContactFieldsProvider>
  );
}
