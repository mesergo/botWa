
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, RotateCcw, User, Bot, ExternalLink, FileText, ChevronLeft, ChevronRight, Maximize2, Share2, Check, GitBranch, Upload, History, Globe } from 'lucide-react';
import { ChatMessage, NodeType, FixedProcess, CarouselItem, User as UserType, Version } from '../types';
import { ReactFlowInstance } from 'reactflow';

interface SimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  flowInstance: ReactFlowInstance | null;
  nodes?: any[];
  edges?: any[];
  fixedProcesses: FixedProcess[];
  versions: Version[];
  token: string | null;
  isStandalone?: boolean;
  currentUser: UserType | null;
  flowId?: string | null;
}

interface StackItem {
  nodeId: string;
  instance: { getNodes: () => any[], getEdges: () => any[] };
}

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : `${window.location.origin}/api`;
const evaluateCondition = (op: string, val: any, target: any) => {
  if (val === null || val === undefined) return false;
  
  const v = isNaN(Number(val)) ? String(val).toLowerCase() : Number(val);
  const t = isNaN(Number(target)) ? String(target).toLowerCase() : Number(target);
  
  switch(op) {
    case 'gt': return typeof v === 'number' && typeof t === 'number' ? v > t : false;
    case 'gte': return typeof v === 'number' && typeof t === 'number' ? v >= t : false;
    case 'lt': return typeof v === 'number' && typeof t === 'number' ? v < t : false;
    case 'lte': return typeof v === 'number' && typeof t === 'number' ? v <= t : false;
    case 'cont': 
    case 'contains': {
      const vStr = String(val).toLowerCase();
      const tStr = String(target).toLowerCase();
      return vStr.includes(tStr) || tStr.includes(vStr);
    }
    case 'contains_any': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(val).toLowerCase();
      return words.some(w => w.trim() && (valStr.includes(w.trim()) || w.trim().includes(valStr)));
    }
    case 'contains_all': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(val).toLowerCase();
      return words.every(w => !w.trim() || valStr.includes(w.trim()));
    }
    case 'eq':
    default: return String(val).toLowerCase() === String(target).toLowerCase();
  }
};

const Carousel: React.FC<{ items: CarouselItem[], onSelect: (text: string, idx: number, val?: string) => void }> = ({ items, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };
  return (
    <div className="w-full flex flex-col items-end gap-2 group/carousel relative">
      <div className="flex gap-3 items-center flex-row-reverse mb-1 mr-1">
         <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400"><Bot size={14} /></div>
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">תוצאות חיפוש</span>
      </div>
      <div className="relative w-full">
        <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 border border-slate-100 rounded-full shadow-lg opacity-0 group-hover/carousel:opacity-100 transition-all"><ChevronLeft size={20} /></button>
        <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 border border-slate-100 rounded-full shadow-lg opacity-0 group-hover/carousel:opacity-100 transition-all"><ChevronRight size={20} /></button>
        <div ref={scrollRef} className="w-full overflow-x-auto scrollbar-hide pb-4 flex gap-4 px-1" style={{ direction: 'rtl', scrollSnapType: 'x mandatory' }}>
          {items.map((item, idx) => (
            <div key={idx} className="flex-shrink-0 w-64 bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
              {item.image && <div className="h-36 w-full overflow-hidden bg-slate-50 border-b border-slate-50"><img src={item.image} alt={item.title} className="w-full h-full object-cover" /></div>}
              <div className="p-5 flex flex-col gap-3 text-right">
                <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                {item.subtitle && <p className="text-[11px] text-slate-500">{item.subtitle}</p>}
                <div className="flex flex-col gap-1.5 mt-2">
                  {item.options?.map((opt, oIdx) => (
                    <button key={oIdx} onClick={() => onSelect(opt.text, oIdx, opt.value)} className="w-full text-right py-2 px-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[11px] font-bold uppercase tracking-tight">{opt.text}</button>
                  ))}
                  {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full text-center py-2 px-4 bg-white border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-50 transition-all text-[11px] font-bold uppercase tracking-tight flex items-center justify-center gap-1.5">מידע נוסף <ExternalLink size={12} /></a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Simulator: React.FC<SimulatorProps> = ({ isOpen, onClose, flowInstance, nodes, edges, fixedProcesses, versions, token, isStandalone, currentUser, flowId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [currentInstance, setCurrentInstance] = useState<any>(null);
  const [executionStack, setExecutionStack] = useState<StackItem[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isWaitingForWebserviceResponse, setIsWaitingForWebserviceResponse] = useState(false);
  const sessionParamsRef = useRef<Record<string, any>>({});
  const [sessionParameters, setSessionParameters] = useState<Record<string, any>>({});
  const [lastUserValue, setLastUserValue] = useState<{ string: string | null, number: number | null }>({ string: null, number: null });
  const [currentCommand, setCurrentCommand] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const simulatorFileInputRef = useRef<HTMLInputElement>(null);
  const initialStartRef = useRef(false);

  useEffect(() => { 
    if (isOpen && nodes && nodes.length > 0 && !initialStartRef.current) {
      initialStartRef.current = true;
      resetChat(); 
    }
  }, [isOpen, nodes?.length]); 

  useEffect(() => {
    if (!isOpen) {
      initialStartRef.current = false;
      setShowShareOptions(false);
    }
  }, [isOpen]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isBotTyping]);

  useEffect(() => {
    if (sessionId && token) {
      fetch(`${API_BASE}/sessions/update-parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sessionId, parameters: sessionParameters })
      }).catch(err => console.error("Failed to sync parameters:", err));
    }
  }, [sessionParameters, sessionId, token]);

  const updateParam = (name: string, value: any) => {
    sessionParamsRef.current = { ...sessionParamsRef.current, [name]: value };
    setSessionParameters({ ...sessionParamsRef.current });
  };

  const getActiveInstance = () => {
    if (flowInstance) return flowInstance;
    if (nodes && edges) return { getNodes: () => nodes, getEdges: () => edges };
    return null;
  };

  const resetChat = async () => {
    setMessages([]); setExecutionStack([]); sessionParamsRef.current = {}; setSessionParameters({});
    setLastUserValue({ string: null, number: null }); setCurrentCommand(null); setIsWaitingForWebserviceResponse(false); setSessionId(null);
    const instance = getActiveInstance();
    const startNode = instance?.getNodes().find((n: any) => n.type === NodeType.START || n.type === NodeType.AUTOMATIC_RESPONSES);
    
    if (token && startNode) {
      try {
        const res = await fetch(`${API_BASE}/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ widget_id: startNode?.id })
        });
        const data = await res.json();
        setSessionId(data.sessionId);
      } catch (e) { console.error("Failed to start session:", e); }
    }

    if (startNode) { 
      setCurrentInstance(instance); 
      processNext(startNode.id, instance, 0, []); 
    }
  };

  const openInNewWindow = () => {
    const url = window.location.origin + window.location.pathname + '?mode=simulator' + (flowId ? `&flow_id=${flowId}` : '');
    window.open(url, 'FlowBotSimulator', 'width=450,height=850,menubar=no,toolbar=no,location=no,status=no');
  };

  const copyShareLink = (versionId?: string) => {
    const pid = currentUser?.public_id || currentUser?.id || (new URLSearchParams(window.location.search)).get('public_id');
    
    if (!pid) {
      alert("שגיאה: לא נמצא מזהה משתמש לשיתוף. אנא נסה להתחבר מחדש.");
      return;
    }

    let shareUrl = `${window.location.origin}${window.location.pathname}?mode=simulator&public_id=${pid}`;
    if (flowId) shareUrl += `&flow_id=${flowId}`;
    if (versionId) {
      shareUrl += `&version_id=${versionId}`;
    }
    
    const doCopy = (text: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return Promise.resolve();
        } catch (err) {
          document.body.removeChild(textArea);
          return Promise.reject(err);
        }
      }
    };

    doCopy(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
        setShowShareOptions(false);
      }, 1500);
    }).catch(() => {
      window.prompt("העתק את הקישור לשיתוף:", shareUrl);
    });
  };

  const interpolate = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/--(.+?)--/g, (match, paramName) => {
      const value = sessionParamsRef.current[paramName];
      return value !== undefined ? String(value) : "null";
    });
  };

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const interpolatedContent= msg.sender === 'bot' ? interpolate(msg.content) : msg.content;
    const interpolatedContentNoNull = interpolatedContent?.replace(/null/g, '');
    const interpolatedOptions = msg.sender === 'bot' ? msg.options?.map(opt => interpolate(opt)) : msg.options;
    const interpolatedCarousel = msg.sender === 'bot' ? msg.carouselItems?.map(item => ({
      ...item, title: interpolate(item.title), subtitle: interpolate(item.subtitle),
      options: item.options?.map(opt => ({ ...opt, text: interpolate(opt.text) }))
    })) : msg.carouselItems;
    setMessages(prev => [...prev, { ...msg, content: interpolatedContentNoNull, options: interpolatedOptions, carouselItems: interpolatedCarousel, id: Math.random().toString(36).substr(2, 9), timestamp: new Date() }]);
  };

  const findNextNodeId = (id: string, instance: any, handleId?: string) => {
    const edgesList = instance?.getEdges() || [];
    const edge = edgesList.find((e: any) => e.source === id && (!handleId || e.sourceHandle === handleId));
    return edge?.target || null;
  };

  const executeServerActions = async (actions: any[], instance: any, stack: StackItem[]) => {
    let i = 0; let foundReturnValue: any = null; let shouldPauseForInput = false;
    while (i < actions.length) {
      const action = actions[i];
      if (action.type === 'SendItem') {
        const carouselItems: CarouselItem[] = [];
        let j = i;
        while (j < actions.length && actions[j].type === 'SendItem') {
          const item = actions[j];
          carouselItems.push({ title: item.title, subtitle: item.subtitle, image: item.image, url: item.url, options: item.options });
          j++;
        }
        setIsBotTyping(true); await new Promise(r => setTimeout(r, 400));
        addMessage({ sender: 'bot', type: 'carousel', carouselItems: carouselItems });
        setIsBotTyping(false); shouldPauseForInput = true; i = j; continue;
      }
      switch (action.type) {
        case 'SetParameter': updateParam(action.name, action.value); break;
        case 'SendMessage': setIsBotTyping(true); await new Promise(r => setTimeout(r, 300)); addMessage({ sender: 'bot', type: 'text', content: action.text }); setIsBotTyping(false); break;
        case 'SendImage': setIsBotTyping(true); await new Promise(r => setTimeout(r, 400)); addMessage({ sender: 'bot', type: 'image', url: action.url }); setIsBotTyping(false); break;
        case 'SendWebpage': setIsBotTyping(true); await new Promise(r => setTimeout(r, 300)); addMessage({ sender: 'bot', type: 'link', content: action.text, url: action.url }); setIsBotTyping(false); break;
        case 'InputText': setIsBotTyping(true); await new Promise(r => setTimeout(r, 300)); if (action.text) { addMessage({ sender: 'bot', type: action.options && action.options.length > 0 ? 'menu' : 'input_text', content: action.text, options: action.options }); } setIsBotTyping(false); shouldPauseForInput = true; break;
        case 'Goto': const targetNode = instance.getNodes().find((n: any) => n.data.label === action.name); if (targetNode) { processNext(targetNode.id, instance, 0, stack); return { paused: true }; } break;
        case 'Return': foundReturnValue = action.value; updateParam('last_return', action.value); break;
        case 'ChangeState': addMessage({ sender: 'bot', type: 'text', content: `[מצב בוט שונה ל: ${action.value}]` }); break;
      }
      i++;
    }
    return { paused: shouldPauseForInput, returnValue: foundReturnValue };
  };

  const processNext = async (nodeId: string | null, instance: any, depth: number = 0, stack: StackItem[] = [], forcedValue?: { string: string | null, number: number | null }, forcedCommand?: string | null) => {
    if (depth > 250) { addMessage({ sender: 'bot', type: 'text', content: "⚠️ חריגה ממורכבות המערכת המותרת." }); return; }
    setCurrentInstance(instance); setExecutionStack(stack);
    if (!nodeId) {
      if (stack.length > 0) {
        const last = stack[stack.length - 1]; const remainingStack = stack.slice(0, -1);
        const nextInParent = findNextNodeId(last.nodeId, last.instance);
        return processNext(nextInParent, last.instance, depth + 1, remainingStack);
      }
      return; 
    }
    const nodesList = instance?.getNodes() || [];
    const node = nodesList.find((n: any) => n.id === nodeId);
    if (!node) return processNext(null, instance, depth + 1, stack);
    setCurrentNodeId(nodeId); await new Promise(r => setTimeout(r, 50));
    switch (node.type) {
      case NodeType.START: return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      case NodeType.AUTOMATIC_RESPONSES:
        if (forcedValue) {
           const options = node.data.options || [];
           const operators = node.data.optionOperators || Array(options.length).fill('eq');
           const val = forcedValue.string;
           
           let matchedIdx = -1;
           // Skip index 0 (כניסה) - it acts as a fallback
           for(let k=1; k<options.length; k++) {
             if (evaluateCondition(operators[k], val, options[k])) {
               matchedIdx = k;
               break;
             }
           }
           
           // If no specific match found, default to index 0 (כניסה)
           const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
           return processNext(findNextNodeId(nodeId, instance, `option-${finalIdx}`), instance, depth + 1, stack);
        }
        break;
      case NodeType.FIXED_PROCESS:
        try {
          const fetchUrl = `${API_BASE}/flow?flow_id=${flowId}&standard_process_id=${node.data.processId}`;
          const res = await fetch(fetchUrl, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
          const subFlow = await res.json();
          const subInstance = { getNodes: () => subFlow.nodes, getEdges: () => subFlow.edges };
          const subStart = subFlow.nodes?.find((n: any) => n.type === NodeType.START);
          if (subStart) { const newStack = [...stack, { nodeId, instance }]; return processNext(subStart.id, subInstance, depth + 1, newStack); }
        } catch (e) { console.error(e); }
        return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      case NodeType.ACTION_WEB_SERVICE:
        setIsBotTyping(true); setIsWaitingForWebserviceResponse(false);
        try {
          const payload = { campaign: { id: 50000, name: "FlowBot Campaign" }, chat: { created: new Date().toISOString().replace('T', ' ').split('.')[0], source: "FlowBot_Studio", sender: "SimUser_123", control: nodeId }, parameters: Object.entries(sessionParamsRef.current).map(([name, value]) => ({ name, value })), value: forcedValue || lastUserValue, command: forcedCommand !== undefined ? forcedCommand : currentCommand };
          const response = await fetch(`${API_BASE}/proxy/webservice`, { method: 'POST', headers: token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: interpolate(node.data.url), payload: payload }) });
          const data = await response.json(); 
          
          setIsBotTyping(false); 
          await new Promise(r => setTimeout(r, 100));
          
          setLastUserValue({ string: null, number: null }); setCurrentCommand(null);
          if (data.actions && Array.isArray(data.actions)) {
            const result = await executeServerActions(data.actions, instance, stack);
            if (result.paused) { setIsWaitingForWebserviceResponse(true); return; }
            
            if (result.returnValue !== null && result.returnValue !== undefined) {
              const returnValue = result.returnValue;
              const options = node.data.options || [];
              const operators = node.data.optionOperators || Array(options.length).fill('eq');
              
              let foundIndex = -1;
              for(let k=0; k < options.length; k++) {
                if (evaluateCondition(operators[k], returnValue, options[k])) {
                  foundIndex = k;
                  break;
                }
              }
              
              if (foundIndex !== -1) {
                return processNext(findNextNodeId(nodeId, instance, `option-${foundIndex}`), instance, depth + 1, stack);
              }
            }
            return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
          } else { return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack); }
        } catch (error) { 
          setIsBotTyping(false); 
          addMessage({ sender: 'bot', type: 'text', content: `❌ שגיאה בחיבור לשרת ה-Webservice` }); 
          return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack); 
        }
        break;
      case NodeType.OUTPUT_TEXT: setIsBotTyping(true); await new Promise(r => setTimeout(r, 400)); addMessage({ sender: 'bot', type: 'text', content: node.data.content || "..." }); setIsBotTyping(false); return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      case NodeType.OUTPUT_IMAGE: setIsBotTyping(true); await new Promise(r => setTimeout(r, 500)); addMessage({ sender: 'bot', type: 'image', url: node.data.url }); setIsBotTyping(false); return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      case NodeType.OUTPUT_LINK: setIsBotTyping(true); await new Promise(r => setTimeout(r, 400)); addMessage({ sender: 'bot', type: 'link', content: node.data.linkLabel || 'קישור חיצוני', url: node.data.url }); setIsBotTyping(false); return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      case NodeType.OUTPUT_MENU: setIsBotTyping(true); await new Promise(r => setTimeout(r, 400)); addMessage({ sender: 'bot', type: 'menu', content: node.data.content, options: node.data.options, optionImages: node.data.optionImages }); setIsBotTyping(false); break;
      case NodeType.INPUT_TEXT: case NodeType.INPUT_DATE: case NodeType.INPUT_FILE: setIsBotTyping(true); await new Promise(r => setTimeout(r, 300)); if (node.data.label) { addMessage({ sender: 'bot', type: node.type as any, content: node.data.label }); } setIsBotTyping(false); break;
      case NodeType.ACTION_WAIT: await new Promise(r => setTimeout(r, (node.data.waitTime || 1) * 1000)); return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
      default: return processNext(findNextNodeId(nodeId, instance), instance, depth + 1, stack);
    }
  };

  const handleSend = async () => {
    if (!userInput.trim() || !currentNodeId || !currentInstance) return;
    const text = userInput; setUserInput('');
    const isNum = !isNaN(Number(text)) && text.trim() !== "";
    const newValue = { string: text, number: isNum ? Number(text) : null }; setLastUserValue(newValue);
    const nodesList = currentInstance.getNodes() || [];
    const node = nodesList.find((n: any) => n.id === currentNodeId);
    if (node && node.data.variableName) updateParam(node.data.variableName, text);
    addMessage({ sender: 'user', type: 'text', content: text });
    
    if (node.type === NodeType.AUTOMATIC_RESPONSES) {
       await processNext(currentNodeId, currentInstance, 0, executionStack, newValue, null);
    } else if (isWaitingForWebserviceResponse && node.type === NodeType.ACTION_WEB_SERVICE) { 
       await processNext(currentNodeId, currentInstance, 0, executionStack, newValue, null); 
    } else { 
       await processNext(findNextNodeId(currentNodeId, currentInstance), currentInstance, 0, executionStack); 
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentNodeId || !currentInstance) return;
    
    const fileName = file.name;
    addMessage({ sender: 'user', type: 'text', content: `קובץ הועלה: ${fileName}` });
    
    const nodesList = currentInstance.getNodes() || [];
    const node = nodesList.find((n: any) => n.id === currentNodeId);
    if (node && node.data.variableName) updateParam(node.data.variableName, fileName);
    
    if (simulatorFileInputRef.current) simulatorFileInputRef.current.value = '';
    
    await processNext(findNextNodeId(currentNodeId, currentInstance), currentInstance, 0, executionStack);
  };

  const handleMenuSelect = async (option: string, index: number, optionValue?: string) => {
    if (!currentNodeId || !currentInstance) return;
    const nodesList = currentInstance.getNodes() || [];
    const node = nodesList.find((n: any) => n.id === currentNodeId);
    addMessage({ sender: 'user', type: 'text', content: option });
    if (isWaitingForWebserviceResponse && node.type === NodeType.ACTION_WEB_SERVICE) {
      const cmd = optionValue || option; setCurrentCommand(cmd);
      await processNext(currentNodeId, currentInstance, 0, executionStack, { string: option, number: null }, cmd);
    } else {
      setLastUserValue({ string: option, number: null });
      await processNext(findNextNodeId(currentNodeId, currentInstance, `option-${index}`), currentInstance, 0, executionStack);
    }
  };

  const SimulatorUI = (
    <div className={`flex flex-col h-full bg-white text-right ${isStandalone ? 'w-full' : ''}`}>
      <input type="file" ref={simulatorFileInputRef} className="hidden" onChange={handleFileSelect} />
      <div className="p-6 bg-slate-900 text-white flex items-center justify-between shadow-xl flex-row-reverse relative">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg"><Bot size={24} /></div>
          <div className="text-right">
            <h2 className="font-bold text-xs uppercase tracking-widest">InforUMobile API</h2>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">סימולטור פעיל</span>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          {!isStandalone && (
            <div className="flex gap-2">
              <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
              <div className="relative">
                <button 
                  onClick={() => setShowShareOptions(!showShareOptions)} 
                  className={`p-2.5 rounded-xl transition-all ${copySuccess ? 'bg-green-500 text-white' : (showShareOptions ? 'bg-white/20' : 'hover:bg-white/10')}`} 
                  title="שיתוף קישור"
                >
                  {copySuccess ? <Check size={20} /> : <Share2 size={20} />}
                </button>
                
                <AnimatePresence>
                  {showShareOptions && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">בחר גרסה לשיתוף</h4>
                        <p className="text-[10px] text-slate-400">הקישור יציג את התזרים של הגרסה הנבחרת</p>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        <button 
                          onClick={() => copyShareLink()}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50"
                        >
                          <Globe size={14} className="text-blue-500" />
                          <div className="text-right flex-1 mr-3">
                            <span className="block text-[11px] font-bold text-slate-900">טיוטה נוכחית (Live)</span>
                            <span className="block text-[9px] text-slate-400">המצב הנוכחי של העורך</span>
                          </div>
                        </button>
                        
                        {versions.length === 0 ? (
                          <div className="p-4 text-center text-[10px] text-slate-300 font-bold uppercase italic">אין גרסאות שמורות</div>
                        ) : versions.map((v) => (
                          <button 
                            key={v.id}
                            onClick={() => copyShareLink(v.id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <History size={14} className="text-indigo-500" />
                            <div className="text-right flex-1 mr-3">
                              <span className="block text-[11px] font-bold text-slate-900 truncate">{v.name}</span>
                              <span className="block text-[9px] text-slate-400">
                                {new Date(v.created_at).toLocaleDateString('he-IL')} {new Date(v.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={openInNewWindow} className="p-2.5 hover:bg-white/10 rounded-xl transition-all" title="פתח בחלון חדש"><Maximize2 size={20} /></button>
            </div>
          )}
          <button onClick={resetChat} className="p-2.5 hover:bg-white/10 rounded-xl transition-all" title="אפס צ'אט"><RotateCcw size={20} /></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-[#fcfcfc] space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 flex-row-reverse w-full`}>
            {msg.type === 'carousel' ? <Carousel items={msg.carouselItems || []} onSelect={handleMenuSelect} /> : (
              <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'bot' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-md ${msg.sender === 'bot' ? 'bg-white text-black border border-slate-100' : 'bg-blue-600 text-white'}`}>
                  {msg.sender === 'bot' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className={`p-4 rounded-3xl shadow-sm text-sm font-bold text-right ${msg.sender === 'bot' ? 'bg-white text-black border border-slate-100 rounded-tr-none' : 'bg-blue-600 text-white rounded-tl-none'}`}>
                  {msg.type === 'text' && <div className="whitespace-pre-wrap">{msg.content}</div>}
                  {msg.type === 'image' && <img src={msg.url} className="rounded-xl w-full h-auto mt-2" alt="Bot message" />}
                  {msg.type === 'link' && (
                    <div className="space-y-2">
                      <p>{msg.content}</p>
                      <a href={msg.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline font-bold text-xs">{msg.url} <ExternalLink size={14} /></a>
                    </div>
                  )}
                  {msg.type === 'menu' && (
                    <div className="space-y-4 min-w-[180px]">
                      <p className="font-bold text-slate-400 text-[10px] uppercase tracking-widest text-right">{msg.content}</p>
                      <div className="flex flex-col gap-2">
                        {msg.options?.map((opt, i) => (
                          <button key={i} onClick={() => handleMenuSelect(opt, i, msg.optionValues?.[i])} className="w-full text-right p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-blue-600 hover:text-white transition-all text-xs font-bold uppercase flex items-center gap-3 flex-row-reverse">
                            {msg.optionImages?.[i] && <img src={msg.optionImages[i]} className="w-8 h-8 rounded-lg object-cover" alt="" />}
                            <span className="flex-1">{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.type === 'input_file' && (
                    <div className="flex flex-col items-end gap-3">
                       <div className="flex items-center justify-end gap-2 italic text-slate-400">{msg.content} <FileText size={16} /></div>
                       <button 
                         onClick={() => simulatorFileInputRef.current?.click()}
                         className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                       >
                         <Upload size={14} /> בחר קובץ להעלאה
                       </button>
                    </div>
                  )}
                  {msg.type.startsWith('input_') && msg.type !== 'input_file' && <div className="flex items-center justify-end gap-2 italic text-slate-400">{msg.content} <FileText size={16} /></div>}
                </div>
              </div>
            )}
          </div>
        ))}
        {isBotTyping && (
          <div className="flex gap-2 bg-white border border-slate-100 p-4 rounded-3xl rounded-tr-none shadow-sm w-fit mr-12 ml-auto">
            <div className="flex space-x-1.5"><div className="w-2 h-2 bg-blue-600/30 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-blue-600/60 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div></div>
          </div>
        )}
      </div>
      <div className="p-6 bg-white border-t border-slate-50">
        <div className="flex items-center gap-3 bg-slate-50 rounded-[1.5rem] p-2.5 pr-6 border border-slate-100 flex-row-reverse">
          <input type="text" placeholder="הקלד תשובה..." className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black h-10 text-right" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend} disabled={!userInput.trim()} className={`p-3 rounded-2xl transition-all ${userInput.trim() ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-200 text-slate-400'}`}><Send size={20} className="transform rotate-180" /></button>
        </div>
      </div>
    </div>
  );

  if (!isOpen && !isStandalone) return null;
  if (isStandalone) return SimulatorUI;

  return (
    <AnimatePresence>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 w-[420px] h-full bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">{SimulatorUI}</motion.div>
    </AnimatePresence>
  );
};

export default Simulator;
