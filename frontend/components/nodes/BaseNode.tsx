
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { NodeType } from '../../types';

interface BaseNodeProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  type: NodeType;
  selected?: boolean;
  onDelete?: (id: string) => void;
  serialId?: string;
}

const BaseNode: React.FC<BaseNodeProps> = ({ id, title, icon, children, type, selected, onDelete, serialId }) => {
  const isStart = type === NodeType.START;
  const isAutomaticResponses = type === NodeType.AUTOMATIC_RESPONSES;
  const isBranchingNode = type === NodeType.OUTPUT_MENU || type === NodeType.ACTION_WEB_SERVICE || type === NodeType.AUTOMATIC_RESPONSES;

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

  return (
    <div className={`min-w-[280px] bg-white border-2 border-slate-200 rounded-[2.5rem] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.06)] transition-all duration-400 ${
      selected ? `ring-8 ${theme.ring} !border-slate-400 scale-[1.01]` : ''
    }`}>
      {/* Top indicator bar with rounded corners to match the parent */}
      <div className={`h-1.5 w-full ${theme.bar} rounded-t-[2.5rem]`} />
      
      {!isStart && !isAutomaticResponses && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 bg-slate-400 border-2 border-white rounded-full -left-[8px] shadow-lg"
        />
      )}
      
      <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          {serialId && (
            <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 ${theme.iconColor}`}>
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
        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 bg-slate-400 border-2 border-white rounded-full -right-[8px] shadow-lg"
        />
      )}
    </div>
  );
};

export default memo(BaseNode);
