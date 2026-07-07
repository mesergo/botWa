
import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, NodeToolbar, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { Trash2, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { NodeType } from '../../types';

const NODE_TYPE_LABELS: Record<string, string> = {
  [NodeType.INPUT_TEXT]:               'קלט: טקסט',
  [NodeType.INPUT_DATE]:               'קלט: תאריך',
  [NodeType.INPUT_FILE]:               'קלט: קובץ',
  [NodeType.OUTPUT_TEXT]:              'הודעת טקסט',
  [NodeType.OUTPUT_IMAGE]:             'תמונה/מדיה',
  [NodeType.OUTPUT_LINK]:              'קישור',
  [NodeType.OUTPUT_MENU]:              'תפריט',
  [NodeType.ACTION_WEB_SERVICE]:       'שירות אינטרנט',
  [NodeType.ACTION_WAIT]:              'המתנה',
  [NodeType.ACTION_TIME_ROUTING]:      'ניתוב לפי זמן',
  [NodeType.ACTION_ADD_TO_GROUP]:      'ניהול קבוצה',
  [NodeType.ACTION_REMOVE_FROM_GROUP]: 'הסרה מקבוצה',
  [NodeType.ACTION_TRANSFER_TO_AGENT]: 'העברה לנציג',
  [NodeType.ACTION_SET_PARAMETER]:     'הגדרת פרמטר',
  [NodeType.FIXED_PROCESS]:            'תת-תזרים',
  [NodeType.AUTOMATIC_RESPONSES]:      'תגובות אוטומטיות',
  [NodeType.START]:                    'התחלה',
};

interface BaseNodeProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  type: NodeType;
  selected?: boolean;
  onDelete?: (id: string) => void;
  serialId?: string;
  isSimulatorActive?: boolean;
  searchQuery?: string;
  isCurrentMatch?: boolean;
  isSearchMatch?: boolean;
}

const BaseNode: React.FC<BaseNodeProps> = ({ id, title, icon, children, type, selected, onDelete, serialId, isSimulatorActive, searchQuery, isCurrentMatch, isSearchMatch }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isSourceHovered, setIsSourceHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<'incoming' | 'outgoing' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setEdges, getViewport, setCenter, setNodes } = useReactFlow();
  const edges = useEdges();
  const allNodes = useNodes();

  // Compute connected nodes from the live edge/node state
  const getNodePreview = (d: any, nodeType: string): string | undefined => {
    let raw: string | undefined;
    switch (nodeType) {
      case NodeType.OUTPUT_TEXT:
      case NodeType.OUTPUT_MENU:
        raw = d?.content;
        break;
      case NodeType.OUTPUT_IMAGE:
        raw = d?.caption;
        break;
      case NodeType.OUTPUT_LINK:
        raw = d?.linkLabel;
        break;
      case NodeType.ACTION_WEB_SERVICE:
        raw = d?.url;
        break;
      default:
        raw = d?.label;
    }
    if (!raw) return undefined;
    const words = String(raw).trim().split(/\s+/);
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '…' : '');
  };

  const incomingNodes = edges
    .filter(e => e.target === id)
    .map(e => {
      const src = allNodes.find(n => n.id === e.source);
      const d = src?.data as any;
      return src ? { id: src.id, serialId: d?.serialId as string | undefined, type: src.type ?? '', label: getNodePreview(d, src.type ?? '') } : null;
    })
    .filter(Boolean) as Array<{ id: string; serialId?: string; type: string; label?: string }>;

  const outgoingNodes = edges
    .filter(e => e.source === id)
    .map(e => {
      const tgt = allNodes.find(n => n.id === e.target);
      const d = tgt?.data as any;
      return tgt ? { id: tgt.id, serialId: d?.serialId as string | undefined, type: tgt.type ?? '', label: getNodePreview(d, tgt.type ?? '') } : null;
    })
    .filter(Boolean) as Array<{ id: string; serialId?: string; type: string; label?: string }>;

  const navigateToNode = (nodeId: string) => {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;
    const x = node.position.x + (node.width ?? 300) / 2;
    const y = node.position.y + (node.height ?? 150) / 2;
    const { zoom } = getViewport();
    setCenter(x, y, { zoom, duration: 500 });
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isFlashing: true } } : n));
    setTimeout(() => {
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isFlashing: false } } : n));
    }, 900);
  };

  // Close dropdown when node is deselected
  useEffect(() => {
    if (!selected) setDropdownOpen(null);
  }, [selected]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);
  const isStart = type === NodeType.START;
  const isAutomaticResponses = type === NodeType.AUTOMATIC_RESPONSES;
  const isTerminal = type === NodeType.ACTION_TRANSFER_TO_AGENT;
  const isBranchingNode = type === NodeType.OUTPUT_MENU || type === NodeType.ACTION_WEB_SERVICE || type === NodeType.AUTOMATIC_RESPONSES || type === NodeType.ACTION_TIME_ROUTING;
  const isMediaNode = type === NodeType.OUTPUT_IMAGE;

  const isFlashing = (allNodes.find(n => n.id === id)?.data as any)?.isFlashing ?? false;

  const hasSourceEdge = !isBranchingNode && !isTerminal && edges.some(e => e.source === id);

  const handleDeleteSourceEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.filter(edge => edge.source !== id));
    setIsSourceHovered(false);
  };

  const getNodeTheme = (nodeType: NodeType) => {
    switch (nodeType) {
      case NodeType.INPUT_TEXT:
      case NodeType.INPUT_DATE:
      case NodeType.INPUT_FILE:
        return { bar: 'bg-blue-500', iconColor: 'text-blue-600', ring: 'ring-blue-600/10' };
      case NodeType.OUTPUT_TEXT:
      case NodeType.OUTPUT_IMAGE:
      case NodeType.OUTPUT_LINK:
      case NodeType.OUTPUT_MENU:
        return { bar: 'bg-emerald-500', iconColor: 'text-emerald-600', ring: 'ring-emerald-600/10' };
      case NodeType.ACTION_WEB_SERVICE:
      case NodeType.ACTION_WAIT:
      case NodeType.ACTION_TIME_ROUTING:
      case NodeType.ACTION_ADD_TO_GROUP:
      case NodeType.ACTION_TRANSFER_TO_AGENT:
        return { bar: 'bg-orange-500', iconColor: 'text-orange-600', ring: 'ring-orange-600/10' };
      case NodeType.FIXED_PROCESS:
        return { bar: 'bg-indigo-500', iconColor: 'text-indigo-600', ring: 'ring-indigo-600/10' };
      case NodeType.AUTOMATIC_RESPONSES:
        return { bar: 'bg-slate-700', iconColor: 'text-slate-900', ring: 'ring-slate-900/10' };
      default:
        return { bar: 'bg-slate-500', iconColor: 'text-slate-900', ring: 'ring-slate-900/10' };
    }
  };

  const theme = getNodeTheme(type);

  const handleNavClick = (dir: 'incoming' | 'outgoing', list: Array<{ id: string; serialId?: string; type: string; label?: string }>) => {
    if (list.length === 1) {
      navigateToNode(list[0].id);
      setDropdownOpen(null);
    } else {
      setDropdownOpen(prev => prev === dir ? null : dir);
    }
  };

  return (
    <>
      <NodeToolbar isVisible={!!selected && !!(incomingNodes?.length || outgoingNodes?.length)} position={Position.Top} className="nodrag">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl shadow-xl px-2 py-1.5 relative" ref={dropdownRef}>
          {/* Incoming (sources → this node) */}
          {incomingNodes && incomingNodes.length > 0 && (
            <div className="relative">
              <button
                onClick={() => handleNavClick('incoming', incomingNodes)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all"
                title="נווט לרכיב המקור"
              >
                <ChevronRight size={13} />
                <span>{incomingNodes.length > 1 ? `${incomingNodes.length} רכיבים קודמים` : 'רכיב קודם'}</span>
              </button>
              {dropdownOpen === 'incoming' && (
                <div className="absolute top-full mt-1.5 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] min-w-[200px] overflow-hidden" dir="rtl">
                  {incomingNodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => { navigateToNode(node.id); setDropdownOpen(null); }}
                      className="w-full text-right flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-b-0 transition-colors"
                    >
                      {node.serialId && <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">#{node.serialId}</span>}
                      <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{NODE_TYPE_LABELS[node.type] ?? node.type}</span>
                      {node.label && <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{node.label}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {incomingNodes && incomingNodes.length > 0 && outgoingNodes && outgoingNodes.length > 0 && (
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
          )}

          {/* Outgoing (this node → targets) */}
          {outgoingNodes && outgoingNodes.length > 0 && (
            <div className="relative">
              <button
                onClick={() => handleNavClick('outgoing', outgoingNodes)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all"
                title="נווט לרכיב הבא"
              >
                <span>{outgoingNodes.length > 1 ? `${outgoingNodes.length} רכיבים הבאים` : 'רכיב הבא'}</span>
                <ChevronLeft size={13} />
              </button>
              {dropdownOpen === 'outgoing' && (
                <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] min-w-[200px] overflow-hidden" dir="rtl">
                  {outgoingNodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => { navigateToNode(node.id); setDropdownOpen(null); }}
                      className="w-full text-right flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-50 border-b border-slate-50 last:border-b-0 transition-colors"
                    >
                      {node.serialId && <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">#{node.serialId}</span>}
                      <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{NODE_TYPE_LABELS[node.type] ?? node.type}</span>
                      {node.label && <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{node.label}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </NodeToolbar>
    
    <div
      className={`${isMediaNode ? 'min-w-[380px] max-w-[450px]' : 'min-w-[280px]'} bg-white border-2 rounded-[2.5rem] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.06)] transition-all duration-400 ${
        isFlashing
          ? 'ring-4 ring-green-300/40 !border-green-300'
          : isSimulatorActive
          ? 'border-green-400 ring-8 ring-green-400/25 shadow-[0_0_28px_6px_rgba(34,197,94,0.35)] scale-[1.03]'
          : selected
            ? `ring-8 ${theme.ring} !border-slate-400 scale-[1.01] border-slate-200`
            : 'border-slate-200'
      }`}
      onMouseEnter={() => {
        setIsHovered(true);
        setEdges(eds => eds.map(e => {
          if (e.source === id) return { ...e, data: { ...e.data, nodeHoverType: 'source' } };
          if (e.target === id) return { ...e, data: { ...e.data, nodeHoverType: 'target' } };
          return e;
        }));
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setEdges(eds => eds.map(e => {
          if (e.source === id || e.target === id) return { ...e, data: { ...e.data, nodeHoverType: null } };
          return e;
        }));
      }}
    >
      {/* Top indicator bar with rounded corners to match the parent */}
      <div className={`h-1.5 w-full ${theme.bar} rounded-t-[2.5rem]`} />
      
      {!isStart && !isAutomaticResponses && (
        <Handle
          type="target"
          position={Position.Left}
          className={`w-5 h-5 border-2 border-white rounded-full -left-[10px] shadow-lg transition-colors duration-200 ${isHovered ? 'bg-blue-500' : 'bg-slate-400'}`}
        />
      )}
      
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          {serialId && (
            <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg border transition-colors ${
              searchQuery?.startsWith('#') && isCurrentMatch
                ? 'bg-yellow-400 border-yellow-400 text-slate-900'
                : searchQuery?.startsWith('#') && isSearchMatch
                  ? 'bg-yellow-200 border-yellow-200 text-slate-900'
                  : `bg-slate-50 border-slate-100 ${theme.iconColor}`
            }`}>
              {serialId}
            </span>
          )}
          <div className={theme.iconColor}>{icon}</div>
          <span className="text-[18px] font-bold text-slate-900 uppercase tracking-tight">{title}</span>
        </div>
        {!isStart && !isAutomaticResponses && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
            className="text-slate-200 hover:text-red-500 transition-all p-2 rounded-xl hover:bg-red-50 nodrag"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="p-6 bg-white rounded-b-[2.5rem]">
        {children}
      </div>
      
      {!isBranchingNode && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            className={`w-5 h-5 border-2 border-white rounded-full -right-[10px] shadow-lg transition-colors duration-200 ${isSourceHovered ? 'bg-red-500' : isHovered ? 'bg-emerald-500' : 'bg-slate-400'} ${isTerminal ? 'hidden' : ''}`}
          />
          {hasSourceEdge && (
            <div
              className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer rounded-full"
              style={{ zIndex: 1000 }}
              onMouseEnter={() => setIsSourceHovered(true)}
              onMouseLeave={() => setIsSourceHovered(false)}
              onClick={handleDeleteSourceEdge}
            >
              {isSourceHovered && (
                <X size={12} className="text-white pointer-events-none" strokeWidth={3} />
              )}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
};

export default memo(BaseNode);
