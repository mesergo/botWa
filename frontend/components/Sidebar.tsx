
import React, { useRef, useEffect, useState } from 'react';
import { COMPONENT_GROUPS } from '../constants';
import { Plus, Layers, Edit, Eye, Trash2, CheckCircle2, History, RotateCcw, CloudUpload, Lock, Unlock } from 'lucide-react';
import { FixedProcess, Version } from '../types';

interface SidebarProps {
  fixedProcesses: FixedProcess[];
  versions: Version[];
  activeProcessId?: string | null;
  onAddFixedProcess: () => void;
  onEditFixedProcess: (id: string) => void;
  onViewFixedProcess: (id: string) => void;
  onDeleteFixedProcess: (id: string, name: string) => void;
  onRestoreVersion: (version: Version) => void;
  onDeleteVersion: (id: string) => void;
  onToggleVersionLock: (id: string, isLocked: boolean) => void;
  onOpenPublishModal: () => void;
  isReadOnly?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  fixedProcesses, 
  versions,
  activeProcessId,
  onAddFixedProcess, 
  onEditFixedProcess, 
  onViewFixedProcess, 
  onDeleteFixedProcess,
  onRestoreVersion,
  onDeleteVersion,
  onToggleVersionLock,
  onOpenPublishModal,
  isReadOnly
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'components' | 'versions'>('components');

  // Scroll active process into view when it changes
  useEffect(() => {
    if (activeProcessId && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeProcessId]);

  const onDragStart = (event: React.DragEvent, nodeType: string, extraData?: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (extraData) event.dataTransfer.setData('application/extra', JSON.stringify(extraData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const getGroupTheme = (title: string) => {
    if (title.includes('קלט')) return { border: 'hover:border-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', icon: 'group-hover:bg-blue-600', dot: 'bg-blue-400' };
    if (title.includes('פלט')) return { border: 'hover:border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'group-hover:bg-emerald-600', dot: 'bg-emerald-400' };
    if (title.includes('פעולות')) return { border: 'hover:border-orange-500', bg: 'bg-orange-50', text: 'text-orange-600', icon: 'group-hover:bg-orange-600', dot: 'bg-orange-400' };
    return { border: 'hover:border-slate-500', bg: 'bg-slate-50', text: 'text-slate-600', icon: 'group-hover:bg-slate-600', dot: 'bg-slate-400' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-64 bg-white border-l border-slate-100 h-full flex flex-col z-10 text-right shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-all">
      {/* Tab Switcher */}
      <div className="flex p-2 bg-slate-50/50 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('versions')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'versions' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <History size={14} /> גרסאות
        </button>
        <button 
          onClick={() => setActiveTab('components')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'components' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Layers size={14} /> רכיבים
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
        {activeTab === 'components' ? (
          <>
            {/* Core Components */}
            {!isReadOnly && COMPONENT_GROUPS.map((group) => {
              const theme = getGroupTheme(group.title);
              return (
                <div key={group.title}>
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 mr-1 flex items-center justify-end gap-2">
                    {group.title}
                    <div className={`w-1.5 h-1.5 ${theme.dot} rounded-full`}></div>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => (
                      <div
                        key={item.type}
                        className={`flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl cursor-grab ${theme.border} hover:shadow-md hover:-translate-y-0.5 transition-all group text-center`}
                        onDragStart={(event) => onDragStart(event, item.type)}
                        draggable
                      >
                        <div className={`p-2 ${theme.bg} rounded-xl ${theme.text} ${theme.icon} group-hover:text-white transition-all`}>
                          {item.icon}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 tracking-tight leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Custom Processes */}
            <div>
              <div className="flex items-center justify-between mb-4 mr-1">
                {!isReadOnly && (
                  <button onClick={onAddFixedProcess} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                    <Plus size={14} />
                  </button>
                )}
                <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2">
                  התהליכים שלי
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {fixedProcesses.length === 0 && (
                  <div className="col-span-2 text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center p-6 border-2 border-dashed border-slate-50 rounded-2xl">
                    אין תהליכים
                  </div>
                )}
                {fixedProcesses.map((proc) => {
                  const isActive = activeProcessId?.toString() === proc.id.toString();
                  return (
                    <div
                      key={proc.id}
                      ref={isActive ? activeItemRef : null}
                      className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all group cursor-pointer border text-center ${
                        isActive 
                          ? 'bg-indigo-50 border-indigo-500 shadow-sm scale-[1.01] z-10' 
                          : 'bg-white border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/30'
                      }`}
                      onClick={() => isActive ? null : onEditFixedProcess(proc.id)}
                      onDragStart={(event) => onDragStart(event, 'fixed_process', { id: proc.id, name: proc.name })}
                      draggable={!isReadOnly}
                    >
                      <div className={`absolute top-1 left-1 flex items-center gap-0.5 transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onViewFixedProcess(proc.id); }} 
                          className={`p-1 rounded-md ${isActive ? 'text-indigo-600 bg-white' : 'text-slate-400 hover:text-indigo-600'}`}
                        >
                          <Eye size={12} />
                        </button>
                        {!isReadOnly && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteFixedProcess(proc.id, proc.name); }} 
                            className="p-1 text-slate-400 hover:text-red-500 rounded-md"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                        <Layers size={14} />
                      </div>
                      <span className={`text-[10px] font-bold truncate w-full tracking-tight ${isActive ? 'text-indigo-700' : 'text-slate-900'}`}>
                        {proc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Versions Tab Content */
          <div className="space-y-4">
            <button 
              onClick={onOpenPublishModal}
              className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all mb-6"
            >
              <CloudUpload size={18} /> פרסם גרסה חדשה
            </button>
            
            <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2 mb-4">
              היסטוריית גרסאות
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
            </h3>

            <div className="space-y-2">
              {versions.length === 0 ? (
                <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center p-6 border-2 border-dashed border-slate-50 rounded-2xl">
                  אין גרסאות שמורות
                </div>
              ) : versions.map((v) => (
                <div 
                  key={v.id}
                  className={`px-4 py-3 bg-white border rounded-2xl transition-all group relative overflow-hidden ${v.isLocked ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 hover:border-indigo-400'}`}
                >
                  <div className="flex items-start justify-between flex-row-reverse mb-1">
                    <div className="text-right flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-end gap-1 mb-0.5">
                        {v.isLocked && <Lock size={10} className="text-amber-500" />}
                        <span className="block text-[11px] font-bold text-slate-900 truncate leading-tight">{v.name}</span>
                      </div>
                      <span className="block text-[9px] text-slate-400 font-medium">{formatDate(v.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => onRestoreVersion(v)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        title="שחזר גרסה זו"
                      >
                        <RotateCcw size={12} />
                      </button>
                      
                      <button 
                        onClick={() => onToggleVersionLock(v.id, !v.isLocked)}
                        className={`p-1.5 rounded-lg transition-all shadow-sm ${v.isLocked ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-400 hover:bg-amber-500 hover:text-white'}`}
                        title={v.isLocked ? "פתח נעילה" : "נעל גרסה"}
                      >
                        {v.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-1">
                    <button 
                      onClick={() => onDeleteVersion(v.id)}
                      className="p-1 text-slate-200 hover:text-red-500 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      title="מחק גרסה"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-slate-50/50 border-t border-slate-100">
        <div className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-widest leading-tight">
          {isReadOnly ? "מצב צפייה בלבד" : (activeTab === 'components' ? "גרור רכיבים לתזרים" : "נהל גרסאות וגיבויים")}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
