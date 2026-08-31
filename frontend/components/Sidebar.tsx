
import React, { useRef, useEffect, useState } from 'react';
import { COMPONENT_GROUPS } from '../constants';
import { Plus, Layers, Edit, Eye, Trash2, CheckCircle2, History, RotateCcw, CloudUpload, Lock, Unlock, Archive, MoreVertical } from 'lucide-react';
import { FixedProcess, Version, RestorableVersionsData } from '../types';
import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '../i18n';

interface SidebarProps {
  fixedProcesses: FixedProcess[];
  versions: Version[];
  restorableVersions?: RestorableVersionsData | null;
  activeProcessId?: string | null;
  onAddFixedProcess: () => void;
  onEditFixedProcess: (id: string) => void;
  onViewFixedProcess: (id: string) => void;
  onDeleteFixedProcess: (id: string, name: string) => void;
  onRestoreVersion: (version: Version) => void;
  onDeleteVersion: (id: string) => void;
  onToggleVersionLock: (id: string, isLocked: boolean) => void;
  onOpenPublishModal: () => void;
  onRestoreArchivedVersion?: (versionId: string, versionPrice: number) => void;
  isReadOnly?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  fixedProcesses, 
  versions,
  restorableVersions,
  activeProcessId,
  onAddFixedProcess, 
  onEditFixedProcess, 
  onViewFixedProcess, 
  onDeleteFixedProcess,
  onRestoreVersion,
  onDeleteVersion,
  onToggleVersionLock,
  onOpenPublishModal,
  onRestoreArchivedVersion,
  isReadOnly
}) => {
  const { t, i18n } = useTranslation('builder');
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'components' | 'versions'>('components');
  const [restorableHeight, setRestorableHeight] = useState(80); // גובה התחלתי ב-px
  const [isDragging, setIsDragging] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Scroll active process into view when it changes
  useEffect(() => {
    if (activeProcessId && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeProcessId]);

  // Handle resizable divider
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const sidebar = document.querySelector('aside');
      if (!sidebar) return;
      
      const sidebarRect = sidebar.getBoundingClientRect();
      const newHeight = sidebarRect.bottom - e.clientY - 60; // 60px for footer
      
      // הגבלת גובה מינימלי ומקסימלי
      const minHeight = 0; // אפשר להקטין עד 0 - רק הכותרת תיראה
      const maxHeight = 300;
      setRestorableHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Close process menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = () => setOpenMenuId(null);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

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
    const locale = getFormatLocale(i18n.resolvedLanguage);
    return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-64 bg-white border-e border-slate-100 h-full flex flex-col z-10 text-start shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-all">
      {/* Tab Switcher */}
      <div className="flex p-2 bg-slate-50/50 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('versions')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'versions' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <History size={14} /> {t('sidebar.tabs.versions')}
        </button>
        <button 
          onClick={() => setActiveTab('components')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'components' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Layers size={14} /> {t('sidebar.tabs.components')}
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
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 ms-1 flex items-center justify-end gap-2">
                    {t(group.titleKey)}
                    <div className={`w-1.5 h-1.5 ${theme.dot} rounded-full`}></div>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => (
                      <div
                        key={item.type}
                        className={`flex flex-col items-center justify-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl cursor-grab ${theme.border} hover:shadow-md hover:-translate-y-0.5 transition-all group text-center`}
                        onDragStart={(event) => onDragStart(event, item.type, { name: item.label })}
                        draggable
                      >
                        <div className={`p-2 ${theme.bg} rounded-xl ${theme.text} ${theme.icon} group-hover:text-white transition-all`}>
                          {item.icon}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 tracking-tight leading-tight">{t(item.labelKey)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Custom Processes */}
            <div>
              <div className="flex items-center justify-between mb-4 ms-1">
                {!isReadOnly && (
                  <button onClick={onAddFixedProcess} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                    <Plus size={14} />
                  </button>
                )}
                <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2">
                  {t('sidebar.myProcesses')}
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {fixedProcesses.length === 0 && (
                  <div className="col-span-2 text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center p-6 border-2 border-dashed border-slate-50 rounded-2xl">
                    {t('sidebar.noProcesses')}
                  </div>
                )}
                {fixedProcesses.map((proc) => {
                  const isActive = activeProcessId?.toString() === proc.id.toString();
                  const isMenuOpen = openMenuId === proc.id.toString();
                  return (
                    <div
                      key={proc.id}
                      ref={isActive ? activeItemRef : null}
                      className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all group cursor-pointer border text-center ${
                        isActive 
                          ? 'bg-indigo-50 border-indigo-500 shadow-sm scale-[1.01] z-10' 
                          : 'bg-white border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/30'
                      }`}
                      onClick={() => { if (isMenuOpen) { setOpenMenuId(null); return; } if (!isActive) onEditFixedProcess(proc.id); }}
                      onDragStart={(event) => { onDragStart(event, 'fixed_process', { id: proc.id, name: proc.name }); }}
                      draggable={!isReadOnly}
                    >
                      {/* Three-dots menu button */}
                      <div className={`absolute top-1 end-1 transition-all ${isActive || isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : proc.id.toString()); }}
                          className={`p-1 rounded-md ${isActive ? 'text-indigo-600 bg-white' : 'text-slate-400 hover:text-indigo-600'}`}
                        >
                          <MoreVertical size={12} />
                        </button>
                        {isMenuOpen && (
                          <div
                            className="absolute top-full end-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[120px] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => { setOpenMenuId(null); onViewFixedProcess(proc.id); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors text-start"
                            >
                              <Eye size={12} className="flex-shrink-0" /> {t('sidebar.view')}
                            </button>
                            {!isReadOnly && (
                              <button
                                onClick={() => { setOpenMenuId(null); onDeleteFixedProcess(proc.id, proc.name); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors text-start border-t border-slate-100"
                              >
                                <Trash2 size={12} className="flex-shrink-0" /> {t('sidebar.delete')}
                              </button>
                            )}
                          </div>
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
          <div className="h-full flex flex-col">
            <button 
              onClick={onOpenPublishModal}
              className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all mb-6"
            >
              <CloudUpload size={18} /> {t('sidebar.publishNewVersion')}
            </button>
            
            {/* היסטוריית גרסאות - Scrollable Section */}
            <div className="flex-1 min-h-0 flex flex-col">
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2 mb-3">
                {t('sidebar.versionHistory')}
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
              </h3>

              <div className="overflow-y-auto space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent ps-1">
              {versions.length === 0 ? (
                <div className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center p-6 border-2 border-dashed border-slate-50 rounded-2xl">
                  {t('sidebar.noSavedVersions')}
                </div>
              ) : versions.map((v) => (
                <div 
                  key={v.id}
                  className={`px-2 py-2 bg-white border rounded-2xl transition-all group relative overflow-hidden ${v.isLocked ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 hover:border-indigo-400'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-start flex-1 min-w-0 ps-1">
                      <div className="flex items-center justify-end gap-1 mb-0.5">
                        {v.isLocked && <Lock size={10} className="text-amber-500" />}
                        <span className="block text-[11px] font-bold text-slate-900 truncate leading-tight">{v.name}</span>
                      </div>
                      <span className="block text-[9px] text-slate-400 font-medium">{formatDate(v.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center gap-0.5 ms-auto">
                      <button 
                        onClick={() => onRestoreVersion(v)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        title={t('sidebar.restoreVersion')}
                      >
                        <RotateCcw size={12} />
                      </button>
                      
                      <button 
                        onClick={() => onToggleVersionLock(v.id, !v.isLocked)}
                        className={`p-1.5 rounded-lg transition-all shadow-sm ${v.isLocked ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-400 hover:bg-amber-500 hover:text-white'}`}
                        title={v.isLocked ? t('sidebar.unlockVersion') : t('sidebar.lockVersion')}
                      >
                        {v.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      
                      <button 
                        onClick={() => onDeleteVersion(v.id)}
                        className="p-1.5 bg-rose-50 text-rose-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                        title={t('sidebar.deleteVersion')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* Restorable Versions Section - Fixed at Bottom */}
            {restorableVersions && restorableVersions.count > 0 && onRestoreArchivedVersion && (
              <div className="flex flex-col mt-4">
                {/* Resizable Divider */}
                <div 
                  onMouseDown={handleMouseDown}
                  className={`relative py-2 cursor-ns-resize select-none group ${isDragging ? 'bg-slate-100' : 'hover:bg-slate-50'} transition-colors`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-0.5 bg-slate-300 rounded group-hover:bg-slate-400 transition-colors"></div>
                      <div className="text-slate-300 text-xs group-hover:text-slate-400">⟷</div>
                      <div className="w-8 h-0.5 bg-slate-300 rounded group-hover:bg-slate-400 transition-colors"></div>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2 mb-3 mt-2">
                 {t('sidebar.restorableVersions', { count: restorableVersions.count })}
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                </h3>
                <div 
                  className="overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent ps-1"
                  style={{ maxHeight: `${restorableHeight}px` }}
                >
                  {restorableVersions.versions.map((v) => (
                    <div 
                      key={v.id}
                      className="px-2 py-2 bg-white border border-slate-100 rounded-2xl transition-all hover:border-slate-300 group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-start flex-1 min-w-0 ps-1">
                          <span className="block text-[11px] font-bold text-slate-700 truncate leading-tight">{v.name}</span>
                          <span className="block text-[9px] text-slate-400 font-medium">{formatDate(v.created_at)}</span>
                        </div>
                        
                        <button 
                          onClick={() => onRestoreArchivedVersion(v.id, restorableVersions.versionPrice)}
                          className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                          title={t('sidebar.restoreArchivedVersion', { price: restorableVersions.versionPrice })}
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 bg-slate-50/50 border-t border-slate-100">
        <div className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-widest leading-tight">
          {isReadOnly ? t('sidebar.footer.readOnly') : (activeTab === 'components' ? t('sidebar.footer.dragComponents') : t('sidebar.footer.manageVersions'))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
