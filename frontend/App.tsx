
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider, addEdge, Node, Edge, applyNodeChanges, applyEdgeChanges, OnNodesChange, OnEdgesChange, OnConnect, ReactFlowInstance, MarkerType } from 'reactflow';
import { NodeType, NodeData, User, FixedProcess, Version, BotFlow, PredefinedTemplate, RestorableVersionsData } from './types';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import RegisterPage from './components/RegisterPage';
import Editor from './components/Editor';
import TemplateSelection from './components/TemplateSelection';
import TemplateForm from './components/TemplateForm';
import AdminPanel from './components/AdminPanel';
import { StartNode, InputTextNode, InputDateNode, InputFileNode, OutputTextNode, OutputImageNode, OutputLinkNode, OutputMenuNode, ActionWebServiceNode, ActionWaitNode, ActionTimeRoutingNode, FixedProcessNode, AutomaticResponsesNode } from './components/nodes/CustomNodes';
import ButtonEdge from './components/edges/ButtonEdge';
import { CloudUpload, RotateCcw, Plus, AlertTriangle, Copy, X, Lock, Wallet } from 'lucide-react';
import Simulator from './components/Simulator';

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
  [NodeType.FIXED_PROCESS]: FixedProcessNode,
  [NodeType.AUTOMATIC_RESPONSES]: AutomaticResponsesNode,
};
const edgeTypes = { button: ButtonEdge };
const DEFAULT_EDGE_STYLE = { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' };
 
type ViewMode = 'dashboard' | 'editor' | 'editing-process' | 'viewing-process' | 'simulator-only' | 'template-selection' | 'template-form' | 'admin-panel' | 'editing-template' | 'creating-template';

const FlowBuilder: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('flowbot_user');
      if (!saved || saved === "undefined") return null;
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse user from local storage", e);
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('flowbot_token'));
  
  const [bots, setBots] = useState<BotFlow[]>([]);
  const [selectedBot, setSelectedBot] = useState<BotFlow | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'simulator' ? 'simulator-only' : 'dashboard';
  });

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [fixedProcesses, setFixedProcesses] = useState<FixedProcess[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [restorableVersions, setRestorableVersions] = useState<RestorableVersionsData | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(viewMode === 'simulator-only');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const lastSearchQueryRef = useRef('');

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
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

  // Change Template State
  const [isChangeTemplateModalOpen, setIsChangeTemplateModalOpen] = useState(false);

  // --- Edge Delete Listener ---
  useEffect(() => {
    const handleEdgeDelete = (e: any) => {
      const edgeId = e.detail.id;
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
      const { label, content, variableName, linkLabel, options, url, serialId } = node.data;
      const check = (val?: string) => (val || '').toLowerCase().includes(q);
      
      if (check(label) || check(content) || check(variableName) || check(linkLabel) || check(url) || check(serialId)) {
        uniqueMatches.add(node.id);
      } else if (options && Array.isArray(options)) {
        if (options.some(opt => check(opt))) uniqueMatches.add(node.id);
      }
    });

    const matchesArr = Array.from(uniqueMatches);
    setSearchResults(matchesArr);
    
    if (searchQuery !== lastSearchQueryRef.current) {
      setCurrentSearchIndex(matchesArr.length > 0 ? 0 : -1);
      lastSearchQueryRef.current = searchQuery;
    }
  }, [searchQuery, nodes]);

  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex] && reactFlowInstance) {
      const node = nodes.find(n => n.id === searchResults[currentSearchIndex]);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 140, node.position.y + 120, { zoom: 1.1, duration: 800 });
      }
    }
  }, [currentSearchIndex, searchResults, reactFlowInstance, nodes]);

  const onNodeDataChange = useCallback((nodeId: string, data: Partial<NodeData>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, []);

  const onDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, []);

  const bindNodeCallbacks = useCallback((node: Node): Node => ({
    ...node,
    data: { 
      ...node.data, 
      onChange: (data: Partial<NodeData>) => onNodeDataChange(node.id, data), 
      onDelete: () => onDeleteNode(node.id),
      searchQuery,
      isCurrentMatch: false 
    }
  }), [onNodeDataChange, onDeleteNode, searchQuery]);

  const loadBots = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/bots`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            console.error("Authentication error loading bots - forcing logout");
            setToken(null);
            setCurrentUser(null);
            localStorage.removeItem('flowbot_token');
            localStorage.removeItem('flowbot_user');
        }
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
        if (res.status === 401 || res.status === 403) {
            console.error("Authentication error loading processes - forcing logout");
            setToken(null);
            setCurrentUser(null);
            localStorage.removeItem('flowbot_token');
            localStorage.removeItem('flowbot_user');
        }
        return;
      }
      const data = await res.json();
      setFixedProcesses(data);
    } catch (e) { console.error(e); }
  }, [token]);

  const loadFlow = useCallback(async (botId: string | null, processId: string | null = null) => {
    const params = new URLSearchParams(window.location.search);
    const publicIdFromUrl = params.get('public_id');
    const versionIdFromUrl = params.get('version_id');

    if (!token && !publicIdFromUrl) return;
    
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
        return;
      }
      const data = await res.json();
      if (data.nodes?.length > 0) {
        setNodes(data.nodes.map((n: any) => bindNodeCallbacks(n)));
        setEdges(data.edges.map((e: any) => ({ ...e, style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } })));
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

    if (token) loadProcesses();
    if (botId || activeProcessId) {
      loadFlow(botId, activeProcessId);
      if (token && botId) {
        loadVersions(botId);
        loadRestorableVersions(botId);
      }
    }
  }, [selectedBot?.id, activeProcessId, token, loadFlow]);

  useEffect(() => { if (currentUser) loadBots(); }, [currentUser, loadBots]);

  const syncFlow = async (customNodes?: Node[], customEdges?: Edge[], customProcessId?: string) => {
    if (!token || (!selectedBot && !activeProcessId && !editingTemplateId && !creatingTemplate)) return;
    const n = customNodes || nodes;
    const e = customEdges || edges;
    const pId = customProcessId !== undefined ? customProcessId : activeProcessId;
    
    // If editing/creating template, sync to template endpoint
    if (editingTemplateId || creatingTemplate) {
      if (editingTemplateId) {
        await fetch(`${API_BASE}/templates/${editingTemplateId}/flow`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ nodes: n, edges: e })
        });
      }
      return;
    }
    
    await fetch(`${API_BASE}/flow/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ 
        nodes: n, 
        edges: e, 
        flow_id: selectedBot?.id || null, 
        standard_process_id: pId 
      })
    });
  };

  useEffect(() => {
    if (viewMode !== 'dashboard' && viewMode !== 'template-selection' && viewMode !== 'template-form' && viewMode !== 'simulator-only' && viewMode !== 'admin-panel' && (selectedBot || activeProcessId || editingTemplateId)) {
      const timer = setTimeout(syncFlow, 1500);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, viewMode, selectedBot, activeProcessId, editingTemplateId]);

  const tidyFlow = () => {
    if (!reactFlowInstance || nodes.length === 0) return;
    const horizontalSpacing = 450;
    const verticalGap = 80;

    const estimateHeight = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return 200;
      if (node.type === NodeType.START) return 110;
      let height = 112; 
      switch(node.type) {
        case NodeType.INPUT_TEXT: height += 160; break;
        case NodeType.INPUT_DATE: height += 80; break;
        case NodeType.INPUT_FILE: height += 80; break;
        case NodeType.OUTPUT_TEXT: height += 120; break;
        case NodeType.OUTPUT_IMAGE: height += 80 + 160; break;
        case NodeType.OUTPUT_LINK: height += 160; break;
        case NodeType.OUTPUT_MENU:
          height += 80 + 40; 
          if (node.data.options) height += node.data.options.length * 85; 
          height += 70; 
          break;
        case NodeType.ACTION_WEB_SERVICE:
          height += 80 + 50; 
          if (node.data.options) height += node.data.options.length * 115; 
          height += 40; 
          break;
        case NodeType.ACTION_WAIT: height += 80; break;
        case NodeType.ACTION_TIME_ROUTING:
          height += 100; // Default option
          if (node.data.timeRanges) height += node.data.timeRanges.length * 80;
          height += 70; // Add button
          break;
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
    nodes.forEach(n => { adj[n.id] = []; });
    edges.forEach(e => { if (adj[e.source]) adj[e.source].push(e.target); });

    const startNode = nodes.find(n => n.type === NodeType.START || n.type === NodeType.AUTOMATIC_RESPONSES);
    if (!startNode) return;

    const queue: [string, number][] = [[startNode.id, 0]];
    const visited = new Set();
    while (queue.length > 0) {
      const [id, level] = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      levels[id] = level;
      adj[id].forEach(childId => queue.push([childId, level + 1]));
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
        const edgeA = edges.find(e => e.target === a && levels[e.source] < levelIndex);
        const edgeB = edges.find(e => e.target === b && levels[e.source] < levelIndex);
        if (!edgeA) return 1;
        if (!edgeB) return -1;
        if (edgeA.source === edgeB.source) {
          const getHandleIdx = (h?: string | null) => {
            if (!h) return 1000;
            if (h === 'option-default') return -1; // default comes first
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

    setNodes(nds => nds.map(n => ({ ...n, position: finalPositions[n.id] || n.position })));
    setTimeout(() => reactFlowInstance.fitView({ duration: 800 }), 100);
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
    await fetch(`${API_BASE}/bots/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    setBots(prev => prev.filter(b => b.id !== id));
  };

  const handleSetDefaultBot = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/bots/${id}/set-default`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Update bots list - remove default from all, set it on the selected one
        setBots(prev => prev.map(b => ({
          ...b,
          is_default: b.id === id
        })));
      }
    } catch (error) {
      console.error('Error setting default bot:', error);
    }
  };
 
  const handleAuth = async () => {
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('flowbot_token', data.token);
      localStorage.setItem('flowbot_user', JSON.stringify(data.user));
      setViewMode('dashboard');
    } else {
      setAuthErrors({ general: data.error || 'Invalid credentials' });
    }
  };

  const handleImpersonate = useCallback((userData: any, impersonationToken: string) => {
    setToken(impersonationToken);
    setCurrentUser(userData);
    localStorage.setItem('flowbot_token', impersonationToken);
    localStorage.setItem('flowbot_user', JSON.stringify(userData));
    setViewMode('dashboard');
    // Reload bots for the impersonated user
    loadBots();
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
        localStorage.setItem('flowbot_token', data.token);
        localStorage.setItem('flowbot_user', JSON.stringify(data.user));
        setViewMode('dashboard');
        // Reload bots for the admin user
        loadBots();
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
      const formattedEdges = restoredEdges.map((e: any) => ({
        ...e,
        style: DEFAULT_EDGE_STYLE,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      }));
      
      setNodes(boundNodes);
      setEdges(formattedEdges);
      
      await syncFlow(boundNodes, formattedEdges);
      
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

  const openDeleteConfirmation = (id: string, name: string) => {
    const count = nodes.filter(n => n.data.processId?.toString() === id.toString() && !!n.data.isStandardProcess).length;
    setProcessToDelete({ id, name });
    setInstanceCount(count);
    setIsDeleteModalOpen(true);
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
        if (activeProcessId === id) { 
          setActiveProcessId(null); 
          setViewMode('editor'); 
          loadFlow(selectedBot?.id || null);
        }
        setNodes(nds => nds.filter(n => !(n.data.processId?.toString() === id.toString() && !!n.data.isStandardProcess)));
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

        await syncFlow(clonedNodes, clonedEdges, newProc.id);
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
        setNodes(data.nodes.map((n: any) => bindNodeCallbacks(n)));
        setEdges(data.edges.map((e: any) => ({ ...e, style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } })));
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
        setViewMode('admin-panel');
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
    setNodes([]);
    setEdges([]);
    setViewMode('admin-panel');
  };

  const handleChangeTemplate = async () => {
    if (!selectedBot || !token) return;
    
    try {
      // Clear current flow
      setNodes([]);
      setEdges([]);
      
      // Sync empty flow to server
      await syncFlow([], []);
      
      // Close modal and go to template selection
      setIsChangeTemplateModalOpen(false);
      setViewMode('template-selection');
    } catch (e) {
      console.error("Change template failed", e);
      alert("שגיאה בהחלפת התסריט");
    }
  };

  const enterBot = (bot: BotFlow) => {
    setActiveProcessId(null);
    setSelectedBot(bot);
    setViewMode('editor');
    loadFlow(bot.id);
  };

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: 'button', style: DEFAULT_EDGE_STYLE, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } }, eds)), []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    const type = event.dataTransfer.getData('application/reactflow') as NodeType;
    const extraData = JSON.parse(event.dataTransfer.getData('application/extra') || '{}');
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left,
      y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top,
    });
    const prefix = type === NodeType.FIXED_PROCESS ? 'B' : '#';
    const nextNum = nodes.filter(n => n.data.serialId?.startsWith(prefix)).length + 1;
    const newNode = bindNodeCallbacks({
      id: `${type}-${Date.now()}`,
      type, position,
      data: { 
        label: extraData.name || `חדש ${type}`, 
        processId: extraData.id, 
        serialId: `${prefix}${nextNum}`,
        isStandardProcess: type === NodeType.FIXED_PROCESS
      },
    });
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, bindNodeCallbacks, nodes]);

  const nodesWithSearch = useMemo(() => nodes.map(n => ({
    ...n, data: { ...n.data, searchQuery, isCurrentMatch: searchResults[currentSearchIndex] === n.id }
  })), [nodes, searchQuery, searchResults, currentSearchIndex]);

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

  if (!currentUser && viewMode !== 'simulator-only') {
    return <AuthScreen mode={authMode} form={authForm} errors={authErrors} onFormChange={setAuthForm} onAuth={handleAuth} onSwitchMode={() => setAuthMode(m => m === 'login' ? 'register' : 'login')} />;
  }

  if (viewMode === 'dashboard') {
    return (
      <>
        <Dashboard 
          bots={bots} 
          onEnterBot={enterBot} 
          onCreateBot={handleCreateBot} 
          onDeleteBot={handleDeleteBot} 
          onSetDefaultBot={handleSetDefaultBot} 
          onLogout={() => { localStorage.clear(); window.location.reload(); }} 
          currentUser={currentUser}
          onOpenAdminPanel={() => setViewMode('admin-panel')}
          onStopImpersonation={handleStopImpersonation}
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
    );
  }

  if (viewMode === 'admin-panel') {
    return (
      <AdminPanel 
        token={token!} 
        currentUser={currentUser}
        onBack={() => setViewMode('dashboard')}
        onImpersonate={handleImpersonate}
        onEditTemplate={handleLoadTemplateForEditing}
        onCreateTemplate={handleCreateNewTemplate}
      />
    );
  }

  if (viewMode === 'template-selection') {
    return <TemplateSelection 
      token={token}
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
      onBack={() => setViewMode('dashboard')}
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
          onSearchNav={(dir) => setCurrentSearchIndex(i => dir === 'up' ? (i > 0 ? i - 1 : searchResults.length - 1) : (i + 1) % searchResults.length)}
          onTidy={tidyFlow}
          onPublish={() => {}}
          onCloseEditor={handleCloseTemplateEditor}
          onHome={handleCloseTemplateEditor}
          onSimulatorOpen={() => {}}
          onSimulatorClose={() => {}}
          onDuplicate={() => {}}
          onChangeTemplate={() => {}}
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
        />
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
        onSearchNav={(dir) => setCurrentSearchIndex(i => dir === 'up' ? (i > 0 ? i - 1 : searchResults.length - 1) : (i + 1) % searchResults.length)}
        onTidy={tidyFlow}
        onPublish={openPublishModal}
        onCloseEditor={() => { setActiveProcessId(null); setViewMode('editor'); loadFlow(selectedBot?.id || null); }}
        onHome={() => { setViewMode('dashboard'); setSelectedBot(null); setActiveProcessId(null); }}
        onSimulatorOpen={() => setIsSimulatorOpen(true)}
        onSimulatorClose={() => setIsSimulatorOpen(false)}
        onDuplicate={() => { setDuplicateName(`${fixedProcesses.find(p => p.id.toString() === activeProcessId)?.name || ''} (עותק)`); setIsDuplicateModalOpen(true); }}
        onChangeTemplate={() => setIsChangeTemplateModalOpen(true)}
        sidebarProps={{
          fixedProcesses,
          versions,
          restorableVersions,
          activeProcessId,
          onAddFixedProcess: () => setIsProcessModalOpen(true),
          onEditFixedProcess: (id: string) => { setActiveProcessId(id); setViewMode('editing-process'); loadFlow(selectedBot?.id || null, id); },
          onViewFixedProcess: (id: string) => { setActiveProcessId(id); setViewMode('viewing-process'); loadFlow(selectedBot?.id || null, id); },
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
              שים לב: במחיקה זו ימחקו <span className="text-red-600 font-bold">{instanceCount}</span> מופעים של תהליך <span className="text-slate-900 font-bold">{processToDelete?.name}</span>.
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

export default function AppWrapper() { return <ReactFlowProvider><FlowBuilder /></ReactFlowProvider>; }
