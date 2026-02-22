
import React, { useRef, useState } from 'react';
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
import { Wand2, Search, ChevronUp, ChevronDown, X, Copy, CloudUpload, AlertTriangle, Users, List } from 'lucide-react';

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
  onChangeTemplate: () => void;
  sidebarProps: any;
  isEditingTemplate?: boolean;
  onSaveTemplate?: (name: string, description: string, isPublic: boolean) => void;
  existingTemplateData?: { name: string; description: string; isPublic: boolean } | null;
  onOpenContacts?: () => void;
  onOpenSessions?: () => void;
}

const Editor: React.FC<EditorProps> = ({
  selectedBot, nodes, edges, fixedProcesses, versions, currentUser, token, viewMode, activeProcessId,
  searchQuery, searchResults, currentSearchIndex, reactFlowWrapper, nodeTypes, edgeTypes, isSimulatorOpen,
  onNodesChange, onEdgesChange, onConnect, onInit, onDrop, onSearchChange, onSearchNav, onTidy, onPublish,
  onCloseEditor, onHome, onSimulatorOpen, onSimulatorClose, onDuplicate, onChangeTemplate, sidebarProps,
  isEditingTemplate, onSaveTemplate, existingTemplateData, onOpenContacts, onOpenSessions
}) => {
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [templateName, setTemplateName] = React.useState(existingTemplateData?.name || '');
  const [templateDescription, setTemplateDescription] = React.useState(existingTemplateData?.description || '');
  const [templateIsPublic, setTemplateIsPublic] = React.useState(existingTemplateData?.isPublic ?? true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as unknown as globalThis.Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (existingTemplateData) {
      setTemplateName(existingTemplateData.name);
      setTemplateDescription(existingTemplateData.description);
      setTemplateIsPublic(existingTemplateData.isPublic);
    }
  }, [existingTemplateData]);

  const handleSaveTemplate = () => {
    if (onSaveTemplate && templateName.trim()) {
      onSaveTemplate(templateName, templateDescription, templateIsPublic);
      setShowSaveModal(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f8fafc] overflow-hidden text-black font-medium text-right">{isEditingTemplate && showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-slate-800">שמירת תבנית</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">שם התבנית</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="נא להזין שם לתבנית"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">תיאור קצר</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                  value={templateDescription}
                  onChange={e => setTemplateDescription(e.target.value)}
                  placeholder="תיאור מה התבנית עושה..."
                />
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isPublic"
                  checked={templateIsPublic}
                  onChange={e => setTemplateIsPublic(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300"
                />
                <label htmlFor="isPublic" className="text-sm font-bold text-slate-700">תבנית ציבורית (גלויה למשתמשים)</label>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex-1 font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  שמור תבנית
                </button>
                <button 
                  onClick={() => setShowSaveModal(false)}
                  className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-10 text-right">
          <div className="flex items-center cursor-pointer group" onClick={onHome}>
            <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto group-hover:scale-105 transition-all" />
          </div>
          <div className="relative">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              className="pr-14 pl-32 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm w-80 outline-none focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all text-right font-medium" 
              placeholder="חיפוש text או ID" 
              dir="rtl"
              value={searchQuery} 
              onChange={e => onSearchChange(e.target.value)} 
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  e.preventDefault();
                  onSearchNav('down');
                }
              }}
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
          {isEditingTemplate && onSaveTemplate ? (
            <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white border border-green-600 rounded-full text-xs font-bold shadow-sm hover:bg-green-700 transition-all">
              <CloudUpload size={16} /> שמור תבנית
            </button>
          ) : (
            <button onClick={onPublish} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white border border-indigo-600 rounded-full text-xs font-bold shadow-sm hover:bg-indigo-700 transition-all">
              <CloudUpload size={16} /> פרסם גרסה
            </button>
          )}
          {viewMode === 'main' && !isEditingTemplate && (
            <button onClick={onChangeTemplate} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-orange-500 text-orange-500 rounded-full text-xs font-bold shadow-sm hover:bg-orange-50 transition-all"><AlertTriangle size={16} /> החלף תסריט</button>
          )}
          <button onClick={onTidy} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-full text-xs font-bold shadow-sm hover:border-blue-600 hover:text-blue-600 transition-all"><Wand2 size={16} /> סדר הכל</button>
          <div className="h-8 w-px bg-slate-100 mx-1"></div>
          {/* User Avatar - dropdown menu */}
          {(onOpenContacts || onOpenSessions) && (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(v => !v)}
                title="תפריט פרופיל"
                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm hover:scale-110 transition-transform shadow-md select-none"
              >
                {(currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || '?').toUpperCase()}
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-12 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 min-w-[180px] overflow-hidden" dir="rtl">
                  {onOpenContacts && (
                    <button
                      onClick={() => { setProfileMenuOpen(false); onOpenContacts(); }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Users size={16} className="text-blue-500 flex-shrink-0" />
                      אנשי קשר
                    </button>
                  )}
                  {onOpenSessions && (
                    <button
                      onClick={() => { setProfileMenuOpen(false); onOpenSessions(); }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <List size={16} className="text-indigo-500 flex-shrink-0" />
                      שיחות שלי
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
              proOptions={{ hideAttribution: true }}
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
