
import React from 'react';
import ReactFlow, { 
  Background, 
  BackgroundVariant,
  Controls, 
  Edge, 
  Node,
  Panel,
  ReactFlowInstance,
  MarkerType
} from 'reactflow';

import Sidebar from './Sidebar';
import Simulator from './Simulator';
import { NodeType, FixedProcess, Version, User, BotFlow } from '../types';
import { Wand2, Search, ChevronUp, ChevronDown, X, Copy, CloudUpload, AlertTriangle } from 'lucide-react';

interface EditorProps {
  selectedBot: BotFlow | null;
  nodes: Node[];
  edges: Edge[];
  fixedProcesses: FixedProcess[];
  versions: Version[];
  currentUser: User | null;
  token: string | null;
  viewMode: 'main' | 'editing-process' | 'viewing-process';
  activeProcessId: string | null;
  searchQuery: string;
  searchResults: string[];
  currentSearchIndex: number;
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
  nodeTypes: any;
  edgeTypes: any;
  isSimulatorOpen: boolean;
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  onInit: (instance: ReactFlowInstance) => void;
  onDrop: (event: React.DragEvent) => void;
  onSearchChange: (q: string) => void;
  onSearchNav: (dir: 'up' | 'down') => void;
  onTidy: () => void;
  onPublish: () => void;
  onCloseEditor: () => void;
  onHome: () => void;
  onSimulatorOpen: () => void;
  onSimulatorClose: () => void;
  onDuplicate: () => void;
  sidebarProps: any;
}

const Editor: React.FC<EditorProps> = ({
  selectedBot, nodes, edges, fixedProcesses, versions, currentUser, token, viewMode, activeProcessId,
  searchQuery, searchResults, currentSearchIndex, reactFlowWrapper, nodeTypes, edgeTypes, isSimulatorOpen,
  onNodesChange, onEdgesChange, onConnect, onInit, onDrop, onSearchChange, onSearchNav, onTidy, onPublish,
  onCloseEditor, onHome, onSimulatorOpen, onSimulatorClose, onDuplicate, sidebarProps
}) => {
  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] overflow-hidden text-black font-medium text-right">
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-10 text-right">
          <div className="flex items-center cursor-pointer group" onClick={onHome}>
            <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto group-hover:scale-105 transition-all" />
          </div>
          <div className="relative">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              className="pr-14 pl-32 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm w-80 outline-none focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all text-right font-medium" 
              placeholder={`עריכת: ${selectedBot?.name || 'תזרים'}...`} 
              value={searchQuery} 
              onChange={e => onSearchChange(e.target.value)} 
            />
            {searchResults.length > 0 && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border border-slate-100 px-2 py-1 rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-blue-600 mr-1">{currentSearchIndex + 1}/{searchResults.length}</span>
                <button onClick={() => onSearchNav('up')} className="p-1 hover:bg-slate-100 rounded text-slate-400"><ChevronUp size={14} /></button>
                <button onClick={() => onSearchNav('down')} className="p-1 hover:bg-slate-100 rounded text-slate-400"><ChevronDown size={14} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onPublish} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white border border-indigo-600 rounded-full text-xs font-bold shadow-sm hover:bg-indigo-700 transition-all"><CloudUpload size={16} /> פרסם גרסה</button>
          <button onClick={onTidy} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-full text-xs font-bold shadow-sm hover:border-blue-600 hover:text-blue-600 transition-all"><Wand2 size={16} /> סדר הכל</button>
          <div className="h-8 w-px bg-slate-100 mx-1"></div>
          <button onClick={onHome} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><X size={22} /></button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full w-full">
          <Sidebar {...sidebarProps} isReadOnly={viewMode === 'viewing-process'} />
          <div className="flex-1 relative h-full bg-[#f8fafc]" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes} edges={edges} 
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onInit={onInit} onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              nodeTypes={nodeTypes} edgeTypes={edgeTypes} 
              fitView 
              fitViewOptions={{ padding: 6.0 }}
            >
              <Background variant={BackgroundVariant.Dots} color="#b9bdc1ff" gap={20} size={2} />
              <Controls className="!bg-white !shadow-xl !rounded-2xl !border-slate-100" />
              <Panel position="bottom-right">
                <div className="flex flex-col items-end gap-3 mb-6 mr-6">
                  {viewMode === 'main' ? (
                    <button 
                      onClick={onSimulatorOpen} 
                      title="בדיקת תזרים"
                      className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all overflow-hidden border-2 border-slate-100 group nodrag"
                    >
                      <img src="/images/go_favicon.png" alt="Simulator" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      {viewMode === 'editing-process' && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
                          <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-2xl text-[11px] font-bold text-amber-700 shadow-sm flex items-center gap-2">
                             <AlertTriangle size={14} className="flex-shrink-0" />
                             שים לב: השינויים כאן משפיעים על כל המופעים של התהליך
                             <button onClick={onDuplicate} className="px-6 py-2.5 bg-yellow-60 border border-amber-200 text-slate-900 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm hover:border-amber-700 hover:text-amber-700 transition-all">
                                <Copy size={16} /> שכפול תהליך
                             </button>
                          </div>
                        </div>
                      )}
                      <button onClick={onCloseEditor} className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-bold flex items-center gap-2 shadow-2xl"><X size={18} /> סגור עורך</button>
                    </div>
                  )}
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>

      <Simulator 
        isOpen={isSimulatorOpen} 
        onClose={onSimulatorClose} 
        flowInstance={null} 
        nodes={nodes}
        edges={edges}
        fixedProcesses={fixedProcesses} 
        versions={versions}
        token={token}
        currentUser={currentUser}
        flowId={selectedBot?.id}
      />
    </div>
  );
};

export default Editor;
