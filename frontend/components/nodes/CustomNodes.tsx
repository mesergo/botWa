
import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, useEdges } from 'reactflow';
import { 
  Type, Calendar, Upload, MessageSquare, 
  Image as ImageIcon, ExternalLink, List, Globe, Clock, PlayCircle, Plus, Layers, X, GitBranch, Trash2, ChevronDown, Zap,
  Mail, Phone, CreditCard, Link, Users, UserMinus, UserCheck
} from 'lucide-react';
import BaseNode from './BaseNode';
import { NodeType } from '../../types';

const HighlightedText = ({ text, highlight, isCurrent }: { text: string; highlight: string; isCurrent: boolean }) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className={`${isCurrent ? 'bg-yellow-400' : 'bg-yellow-200'} text-slate-900 rounded-sm px-0.5`}>{part}</mark>
        ) : part
      )}
    </>
  );
};

const SearchableInput = ({ value, onChange, placeholder, type = "text", searchQuery, isCurrentMatch, isTextArea = false, disabled = false }: any) => {
  const [isFocused, setIsFocused] = React.useState(false);
  
  const fontStyles: React.CSSProperties = {
    fontFamily: 'Heebo, sans-serif',
    fontSize: '1rem',
    lineHeight: '1.5rem',
    textAlign: 'right',
    direction: 'rtl',
    boxSizing: 'border-box',
    display: 'block'
  };

  const showHighlight = !isFocused && searchQuery && value && value.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className={`relative w-full transition-all rounded-xl overflow-hidden ${isCurrentMatch ? 'ring-2 ring-blue-600 border-transparent shadow-md' : 'border border-slate-200'} ${disabled ? 'bg-slate-50 opacity-70 cursor-not-allowed' : ''}`}>
      {showHighlight && (
        <div 
          className="absolute inset-0 pointer-events-none pr-4 pl-4 pt-2.5 whitespace-pre-wrap break-words overflow-hidden bg-white z-0"
          style={fontStyles}
        >
          <HighlightedText text={value} highlight={searchQuery} isCurrent={isCurrentMatch} />
        </div>
      )}
      
      {isTextArea ? (
        <textarea
          disabled={disabled}
          className={`relative z-10 w-full border-none outline-none transition-all text-right focus:ring-2 focus:ring-blue-600 nodrag h-20 resize-none text-slate-900 px-4 py-2 ${showHighlight ? 'bg-transparent text-transparent' : (disabled ? 'bg-transparent' : 'bg-white')}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !disabled && setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          style={fontStyles}
        />
      ) : (
        <input
          disabled={disabled}
          type={type}
          className={`relative z-10 w-full border-none outline-none transition-all text-right focus:ring-2 focus:ring-blue-600 nodrag text-slate-900 h-12 px-4 ${showHighlight ? 'bg-transparent text-transparent' : (disabled ? 'bg-transparent' : 'bg-white')}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !disabled && setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          style={fontStyles}
        />
      )}
    </div>
  );
};

const DeletableHandle = ({ nodeId, handleId, style }: { nodeId: string; handleId: string; style?: React.CSSProperties }) => {
  const [hovered, setHovered] = useState(false);
  const { setEdges } = useReactFlow();
  const edges = useEdges();
  const hasEdge = edges.some(e => e.source === nodeId && e.sourceHandle === handleId);

  const deleteEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.filter(edge => !(edge.source === nodeId && edge.sourceHandle === handleId)));
    setHovered(false);
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: style?.top ?? '50%',
    right: typeof style?.right === 'number' ? style.right : -10,
    transform: 'translateY(-50%)',
    width: 20,
    height: 20,
    zIndex: 50,
  };

  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        id={handleId}
        style={style}
        className={`w-5 h-5 border-2 border-white rounded-full shadow-lg transition-colors duration-200 ${hovered && hasEdge ? 'bg-red-500' : 'bg-slate-400'}`}
      />
      <div
        style={overlayStyle}
        className={`flex items-center justify-center rounded-full nodrag ${hasEdge ? 'cursor-pointer' : 'pointer-events-none'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={hasEdge ? deleteEdge : undefined}
      >
        {hovered && hasEdge && (
          <X size={10} className="text-white pointer-events-none" strokeWidth={3} />
        )}
      </div>
    </>
  );
};

const InputFieldWrapper = ({ label, children }: any) => (
  <div className="mb-4 p-1 text-right">
    <label className="block text-[14px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
      {label}
    </label>
    {children}
  </div>
);

const RESPONSE_OPERATORS = [
  { id: 'eq', label: 'שווה', icon: '=' },
  { id: 'contains', label: 'מכיל מילה', icon: '≡' },
  { id: 'contains_any', label: 'מכיל אחת מהמילים', icon: '∈' },
  { id: 'contains_all', label: 'מכיל את כל המילים', icon: '∀' },
];

const ResponseOperatorSelector = ({ value, onChange, disabled = false }: { value: string, onChange: (op: string) => void, disabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentOp = RESPONSE_OPERATORS.find(o => o.id === value) || RESPONSE_OPERATORS[0];
  
  return (
    <div className="relative">
      <button 
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-all text-slate-900 font-bold nodrag ${disabled ? 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-100 hover:border-blue-600'}`}
        title={currentOp.label}
      >
        <span className="text-xs">{currentOp.icon}</span>
      </button>
      
      {!disabled && isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-100 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {RESPONSE_OPERATORS.map((op) => (
            <button
              key={op.id}
              onClick={() => { onChange(op.id); setIsOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-right ${value === op.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}
            >
              <span className="text-xs font-bold">{op.icon}</span>
              <span className="text-[11px] font-bold">{op.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const VALIDATION_TYPES = [
  { id: 'none',  label: 'ללא ולידציה',  icon: <X size={12} /> },
  { id: 'email', label: 'מייל',         icon: <Mail size={12} /> },
  { id: 'phone', label: 'טלפון',        icon: <Phone size={12} /> },
  { id: 'id',    label: 'ת.ז',          icon: <CreditCard size={12} /> },
  { id: 'url',   label: 'כתובת אתר',   icon: <Link size={12} /> },
];

const ValidationTypeSelector = ({ value, onChange, disabled = false }: { value?: string; onChange: (v: string) => void; disabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentType = VALIDATION_TYPES.find(t => t.id === (value || 'none')) || VALIDATION_TYPES[0];
  const hasValidation = value && value !== 'none';

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 h-8 border rounded-lg text-[11px] font-bold transition-all nodrag ${
          hasValidation
            ? 'bg-blue-50 border-blue-300 text-blue-600'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="סוג ולידציה"
      >
        {currentType.icon}
        <span>{hasValidation ? currentType.label : 'ולידציה'}</span>
        <ChevronDown size={10} />
      </button>

      {!disabled && isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-100 rounded-xl shadow-2xl z-[100] overflow-hidden">
          {VALIDATION_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange(t.id === 'none' ? '' : t.id); setIsOpen(false); }}
              className={`w-full flex items-center justify-end gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-right ${
                (value || 'none') === t.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              <span className="text-[11px] font-bold">{t.label}</span>
              {t.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const OPERATORS = [
  { id: 'eq', label: 'שווה', icon: '=' },
  { id: 'gt', label: 'גדול', icon: '<' },
  { id: 'gte', label: 'גדול או שווה', icon: '=<' },
  { id: 'lt', label: 'קטן', icon: '>' },
  { id: 'lte', label: 'קטן או שווה', icon: '=>' },
  { id: 'cont', label: 'מכיל מילה', icon: '≡' },
];

const OperatorSelector = ({ value, onChange }: { value: string, onChange: (op: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentOp = OPERATORS.find(o => o.id === value) || OPERATORS[0];
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-xl hover:border-blue-600 transition-all text-slate-900 font-bold nodrag"
        title={currentOp.label}
      >
        {currentOp.icon}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {OPERATORS.map((op) => (
            <button
              key={op.id}
              onClick={() => { onChange(op.id); setIsOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-right ${value === op.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}
            >
              <span className="text-base font-bold">{op.icon}</span>
              <span className="text-sm font-bold">{op.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const StartNode = (props: any) => (
  <div className={`bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden transition-all duration-400 w-[160px] ${
    props.selected ? 'ring-8 ring-slate-900/10 !border-slate-400 scale-[1.01]' : ''
  }`}>
    <div className="h-1.5 w-full bg-slate-900" />
    <div className="flex items-center justify-end gap-2 px-3 py-2 bg-white text-slate-900 border-b border-slate-100">
      <span className="text-[12px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-900">
        {props.data.serialId}
      </span>
      <span className="text-[16px] font-bold uppercase tracking-tight">התחלה</span>
      <PlayCircle size={16} className="text-blue-600" />
    </div>
    <div className="p-3 text-center">
      <p className="text-[12px] text-slate-400 font-bold">תחילת שיחה</p>
    </div>
    <Handle
      type="source"
      position={Position.Right}
      className="w-3 h-3 bg-slate-400 border-2 border-white rounded-full -right-[6px] shadow-md"
    />
  </div>
);

export const InputTextNode = (props: any) => (
  <BaseNode id={props.id} title="קלט: טקסט" icon={<Type size={20} />} type={NodeType.INPUT_TEXT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <InputFieldWrapper label="שאלה מהבוט">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="מה השם שלך?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
    <InputFieldWrapper label="שם משתנה לאחסון">
      <SearchableInput value={props.data.variableName} onChange={(v: string) => props.data.onChange({ variableName: v })} placeholder="user_name" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
    <div className="mb-3 p-1">
      <div className="flex items-center justify-between">
        <ValidationTypeSelector
          value={props.data.validationType}
          onChange={(v: string) => props.data.onChange({ validationType: v || undefined })}
        />
        <label className="text-[14px] font-bold text-slate-400 uppercase tracking-wider">סוג ולידציה</label>
      </div>
    </div>
    <div className="mb-2 p-1">
      <div className="flex items-center justify-end gap-2">
        <label className="text-[14px] font-bold text-slate-400 uppercase tracking-wider">שמור בפרטי איש קשר</label>
        <input
          type="checkbox"
          className="w-4 h-4 cursor-pointer accent-blue-500"
          checked={!!props.data.saveToContact}
          onChange={(e) => props.data.onChange({ saveToContact: e.target.checked })}
        />
      </div>
    </div>
  </BaseNode>
);

export const InputDateNode = (props: any) => (
  <BaseNode id={props.id} title="קלט: תאריך" icon={<Calendar size={20} />} type={NodeType.INPUT_DATE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <InputFieldWrapper label="בקשת תאריך">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="מתי תרצה להגיע?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
    <InputFieldWrapper label="שם משתנה לאחסון">
      <SearchableInput value={props.data.variableName} onChange={(v: string) => props.data.onChange({ variableName: v })} placeholder="selected_date" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const InputFileNode = (props: any) => (
  <BaseNode id={props.id} title="קלט: קובץ" icon={<Upload size={20} />} type={NodeType.INPUT_FILE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <InputFieldWrapper label="בקשת קובץ">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="אנא העלה תמונה" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const OutputTextNode = (props: any) => (
  <BaseNode id={props.id} title="הודעת טקסט" icon={<MessageSquare size={20} />} type={NodeType.OUTPUT_TEXT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <InputFieldWrapper label="תוכן ההודעה">
      <SearchableInput isTextArea value={props.data.content} onChange={(v: string) => props.data.onChange({ content: v })} placeholder="היי, איך אני יכול לעזור?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const OutputImageNode = (props: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>(props.data.url && !props.data.url.startsWith('data:') ? 'url' : 'file');
  
  const mediaType = props.data.mediaType || 'image';
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => props.data.onChange({ url: reader.result as string });
      reader.readAsDataURL(file);
    }
  };
  
  const getAcceptTypes = () => {
    switch(mediaType) {
      case 'image': return 'image/*';
      case 'video': return 'video/*';
      case 'pdf': return 'application/pdf';
      default: return 'image/*,video/*,application/pdf';
    }
  };
  
  const getMediaIcon = (type: string) => {
    switch(type) {
      case 'image': return <ImageIcon size={14} className="inline" />;
      case 'video': return <PlayCircle size={14} className="inline" />;
      case 'pdf': return <ExternalLink size={14} className="inline" />;
      default: return <ImageIcon size={14} className="inline" />;
    }
  };
  
  const renderMediaPreview = () => {
    if (!props.data.url) return null;
    
    if (mediaType === 'video') {
      return <video src={props.data.url} controls className="max-w-full h-full object-contain" />;
    } else if (mediaType === 'pdf') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
          <ExternalLink size={40} />
          <span className="text-sm">קובץ PDF</span>
        </div>
      );
    } else {
      return <img src={props.data.url} alt="Bot upload" className="max-w-full h-full object-contain" />;
    }
  };
  
  return (
    <BaseNode id={props.id} title="הודעת מדיה" icon={<ImageIcon size={20} />} type={NodeType.OUTPUT_IMAGE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="סוג מדיה">
        <div className="relative">
          <select 
            className="w-full appearance-none border border-slate-200 rounded-lg px-3.5 py-2 pr-9 text-right bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all nodrag cursor-pointer text-slate-700 text-[13px] font-medium shadow-sm hover:border-slate-300 hover:shadow"
            value={mediaType}
            onChange={(e) => props.data.onChange({ mediaType: e.target.value, url: '' })}
          >
            <option value="image">תמונה</option>
            <option value="video">וידאו</option>
            <option value="pdf">PDF</option>
          </select>
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown size={16} />
          </div>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            {getMediaIcon(mediaType)}
          </div>
        </div>
      </InputFieldWrapper>
      
      <InputFieldWrapper label="אופן העלאה">
        <div className="flex gap-1.5 mb-3 bg-slate-100/80 p-1.5 rounded-lg border border-slate-200/60">
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadMode('file'); }}
            className={`flex-1 px-2.5 py-1.5 rounded-md transition-all duration-150 font-medium text-[13px] nodrag select-none outline-none whitespace-nowrap ${
              uploadMode === 'file' 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            <Upload size={13} className="inline ml-1 -mt-0.5" />
            העלאת קובץ
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadMode('url'); }}
            className={`flex-1 px-2.5 py-1.5 rounded-md transition-all duration-150 font-medium text-[13px] nodrag select-none outline-none whitespace-nowrap ${
              uploadMode === 'url' 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
            }`}
          >
            <Globe size={13} className="inline ml-1 -mt-0.5" />
            הוספת קישור
          </button>
        </div>
        
        {uploadMode === 'url' ? (
          <SearchableInput 
            value={props.data.url} 
            onChange={(v: string) => props.data.onChange({ url: v })} 
            placeholder={`הכנס קישור ל${mediaType === 'image' ? 'תמונה' : mediaType === 'video' ? 'וידאו' : 'PDF'}`}
            searchQuery={props.data.searchQuery} 
            isCurrentMatch={props.data.isCurrentMatch} 
          />
        ) : (
          <div className="space-y-3">
            {props.data.url ? (
              <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm w-full h-40 bg-slate-50 flex items-center justify-center">
                {renderMediaPreview()}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} 
                    className="p-2.5 bg-white text-slate-900 rounded-lg shadow-xl hover:bg-slate-100 transition-all outline-none"
                  >
                    <Upload size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.data.onChange({ url: '' }); }} 
                    className="p-2.5 bg-red-500 text-white rounded-lg shadow-xl hover:bg-red-600 transition-all outline-none"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} 
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all nodrag outline-none"
              >
                <Upload size={28} strokeWidth={1.5} />
                <span className="text-xs font-semibold uppercase tracking-wider">העלה {mediaType === 'image' ? 'תמונה' : mediaType === 'video' ? 'וידאו' : 'PDF'}</span>
              </button>
            )}
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept={getAcceptTypes()} onChange={handleFileUpload} />
      </InputFieldWrapper>
      
      <InputFieldWrapper label="טקסט (אופציונלי)">
        <SearchableInput 
          value={props.data.caption} 
          onChange={(v: string) => props.data.onChange({ caption: v })} 
          placeholder="הוסף טקסט מתחת למדיה"
          searchQuery={props.data.searchQuery} 
          isCurrentMatch={props.data.isCurrentMatch}
          isTextArea={true}
        />
      </InputFieldWrapper>
    </BaseNode>
  );
};

export const OutputLinkNode = (props: any) => {
  const urlValue: string = props.data.url || '';
  const isVarSyntax = /--[^-]+--/.test(urlValue);

  return (
    <BaseNode id={props.id} title="קישור חיצוני" icon={<ExternalLink size={20} />} type={NodeType.OUTPUT_LINK} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="טקסט הקישור">
        <SearchableInput value={props.data.linkLabel} onChange={(v: string) => props.data.onChange({ linkLabel: v })} placeholder="בקר באתר שלנו" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      <InputFieldWrapper label="כתובת אינטרנט">
        <SearchableInput value={props.data.url} onChange={(v: string) => props.data.onChange({ url: v })} placeholder="https://example.com או --שם_משתנה--" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
    </BaseNode>
  );
};

export const OutputMenuNode = (props: any) => {
  const options = props.data.options || [''];
  const optionImages = props.data.optionImages || [];
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    props.data.onChange({ options: newOptions });
  };

  const handleOptionImageUpload = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...(props.data.optionImages || Array(options.length).fill(''))];
        newImages[index] = reader.result as string;
        props.data.onChange({ optionImages: newImages });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeOptionImage = (index: number) => {
    const newImages = [...(props.data.optionImages || [])];
    newImages[index] = '';
    props.data.onChange({ optionImages: newImages });
  };

  const addOption = () => {
    props.data.onChange({ 
      options: [...options, ''],
      optionImages: [...(props.data.optionImages || Array(options.length).fill('')), '']
    });
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) return;
    const newOptions = options.filter((_: any, i: number) => i !== index);
    const newImages = (props.data.optionImages || []).filter((_: any, i: number) => i !== index);
    props.data.onChange({ options: newOptions, optionImages: newImages });
  };

  return (
    <BaseNode id={props.id} title="תפריט בחירה" icon={<List size={20} />} type={NodeType.OUTPUT_MENU} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="הנחיית בחירה">
        <SearchableInput value={props.data.content} onChange={(v: string) => props.data.onChange({ content: v })} placeholder="בחר בבקשה מהרשימה:" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      <InputFieldWrapper label="שמור בחירה במשתנה (אופציונלי)">
        <SearchableInput value={props.data.variableName} onChange={(v: string) => props.data.onChange({ variableName: v })} placeholder="למשל: selected_option" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      <div className="space-y-4 relative text-right">
        <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">רשימת אפשרויות</label>
        {/* Default (catch-all) handle — always first */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-2xl relative">
          <DeletableHandle nodeId={props.id} handleId="option-default" style={{ top: '50%', right: -10 }} />
          <span className="flex-1 text-[12px] font-black text-slate-400 uppercase tracking-widest px-2 text-right">ברירת מחדל</span>
        </div>
        {options.map((opt: string, i: number) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-2xl group/item relative transition-colors hover:bg-white hover:border-blue-100">
            <DeletableHandle nodeId={props.id} handleId={`option-${i}`} style={{ top: '50%', right: -10 }} />
            <div className="flex-1">
              <SearchableInput value={opt} onChange={(v: string) => updateOption(i, v)} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} placeholder="הזן ערך" />
            </div>
            <div className="flex items-center gap-1.5 pl-1 pr-1">
              {optionImages[i] ? (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 group/thumb flex-shrink-0">
                  <img src={optionImages[i]} className="w-full h-full object-cover" alt="Option visual" />
                  <div 
                    onClick={() => removeOptionImage(i)}
                    className="absolute inset-0 bg-red-500/80 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm"
                  >
                    <Trash2 size={16} className="text-white" />
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => fileInputRefs.current[i]?.click()} 
                  className="w-12 h-12 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:border-blue-200 transition-all flex-shrink-0"
                  title="הוסף תמונה"
                >
                  <ImageIcon size={20} />
                </button>
              )}
              <button 
                onClick={() => removeOption(i)} 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 nodrag flex-shrink-0"
                title="מחק אפשרות"
              >
                <X size={18} />
              </button>
            </div>
            <input 
              type="file" 
              className="hidden" 
              ref={el => { fileInputRefs.current[i] = el; }} 
              accept="image/*" 
              onChange={(e) => handleOptionImageUpload(i, e)} 
            />
          </div>
        ))}
        <button onClick={addOption} className="w-full mt-2 py-4 text-[13px] font-bold bg-white text-blue-600 rounded-2xl border-2 border-dashed border-blue-100 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center gap-2 transition-all nodrag uppercase tracking-wider">
          <Plus size={18} /> הוסף אפשרות חדשה
        </button>
      </div>
    </BaseNode>
  );
};

export const ActionWebServiceNode = (props: any) => {
  const branches = props.data.options || [];
  const operators = props.data.optionOperators || Array(branches.length).fill('eq');

  const updateBranch = (index: number, value: string) => {
    const newBranches = [...branches];
    newBranches[index] = value;
    props.data.onChange({ options: newBranches });
  };

  const updateOperator = (index: number, op: string) => {
    const newOps = [...operators];
    newOps[index] = op;
    props.data.onChange({ optionOperators: newOps });
  };

  const addBranch = () => {
    props.data.onChange({ 
      options: [...branches, branches.length === 0 ? "1" : "0"],
      optionOperators: [...operators, 'eq']
    });
  };

  const removeBranch = (index: number) => {
    const newBranches = branches.filter((_: any, i: number) => i !== index);
    const newOps = operators.filter((_: any, i: number) => i !== index);
    props.data.onChange({ options: newBranches, optionOperators: newOps });
  };

  return (
    <BaseNode id={props.id} title="חיבור API" icon={<Globe size={20} />} type={NodeType.ACTION_WEB_SERVICE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="כתובת Webhook">
        <SearchableInput value={props.data.url} onChange={(v: string) => props.data.onChange({ url: v })} placeholder="https://api.yourdomain.com" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      
      <div className="space-y-3 mt-4 text-right">
        {/* Default exit - always present */}
        <div>
          <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest mb-2">יציאה ברירת מחדל</label>
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl relative">
            <DeletableHandle nodeId={props.id} handleId="default" style={{ top: '50%', right: -10 }} />
            <div className="flex-1 text-center">
              <span className="text-sm font-bold text-slate-600">default</span>
            </div>
          </div>
        </div>

        {/* Conditional exits based on Return value */}
        <div>
          <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest mb-2">יציאות מותנות לפי Return</label>
          {branches.map((branch: string, i: number) => (
            <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl group/branch relative transition-colors hover:bg-white hover:border-blue-100 mb-3">
              <DeletableHandle nodeId={props.id} handleId={`option-${i}`} style={{ top: '50%', right: -10 }} />
              
              <div className="flex items-center gap-2 flex-row-reverse">
                <OperatorSelector value={operators[i]} onChange={(op) => updateOperator(i, op)} />
                <div className="flex-1">
                  <SearchableInput value={branch} onChange={(v: string) => updateBranch(i, v)} placeholder="ערך להשוואה..." searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
                </div>
                <button onClick={() => removeBranch(i)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover/branch:opacity-100 transition-all nodrag"><X size={18} /></button>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter text-center py-2 border border-dashed border-slate-100 rounded-xl mb-3">ללא יציאות מותנות - רק ברירת מחדל</div>
          )}
          <button onClick={addBranch} className="w-full p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"><Plus size={16} /> הוסף תנאי</button>
        </div>
      </div>
    </BaseNode>
  );
};

export const ActionWaitNode = (props: any) => (
  <BaseNode id={props.id} title="השהיית מערכת" icon={<Clock size={20} />} type={NodeType.ACTION_WAIT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <InputFieldWrapper label="זמן המתנה (שניות)">
      <SearchableInput type="number" value={props.data.waitTime?.toString()} onChange={(v: string) => props.data.onChange({ waitTime: parseInt(v) || 0 })} placeholder="למשל: 3" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const FixedProcessNode = (props: any) => (
  <BaseNode id={props.id} title={`תת תזרים ${props.data.label}`} icon={<Layers size={20} />} type={NodeType.FIXED_PROCESS} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-[14px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-end gap-3 text-right">תת תזרים {props.data.label} <Layers size={20} className="text-slate-400" /></div>
  </BaseNode>
);

export const ActionTimeRoutingNode = (props: any) => {
  const routingMode = props.data.routingMode || 'time';
  const timeRanges = props.data.timeRanges || [];
  const dateRanges = props.data.dateRanges || [];
  const isDateMode = routingMode === 'date';

  const setMode = (mode: 'time' | 'date') => {
    props.data.onChange({ routingMode: mode });
  };

  // Time mode helpers
  const updateTimeRange = (index: number, field: 'fromHour' | 'toHour', value: any) => {
    const newRanges = [...timeRanges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    props.data.onChange({ timeRanges: newRanges });
  };

  const addTimeRange = () => {
    props.data.onChange({ timeRanges: [...timeRanges, { fromHour: 9, toHour: 17 }] });
  };

  const removeTimeRange = (index: number) => {
    props.data.onChange({ timeRanges: timeRanges.filter((_: any, i: number) => i !== index) });
  };

  // Date mode helpers
  const updateDateRange = (index: number, field: 'fromDate' | 'toDate', value: string) => {
    const newRanges = [...dateRanges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    props.data.onChange({ dateRanges: newRanges });
  };

  const addDateRange = () => {
    const today = new Date().toISOString().split('T')[0];
    props.data.onChange({ dateRanges: [...dateRanges, { fromDate: today, toDate: today }] });
  };

  const removeDateRange = (index: number) => {
    props.data.onChange({ dateRanges: dateRanges.filter((_: any, i: number) => i !== index) });
  };

  const nodeTitle = isDateMode ? 'ניתוב לפי תאריך' : 'ניתוב לפי שעות';

  return (
    <BaseNode id={props.id} title={nodeTitle} icon={<Clock size={20} />} type={NodeType.ACTION_TIME_ROUTING} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <div className="space-y-4 relative text-right">

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200">
          <button
            onClick={() => setMode('time')}
            className={`flex-1 py-2 text-sm font-bold nodrag transition-colors ${!isDateMode ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            לפי שעה
          </button>
          <button
            onClick={() => setMode('date')}
            className={`flex-1 py-2 text-sm font-bold nodrag transition-colors ${isDateMode ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            לפי תאריך
          </button>
        </div>

        <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">
          {isDateMode ? 'טווחי תאריכים' : 'טווחי שעות'}
        </label>

        {/* Default option */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl relative">
          <DeletableHandle nodeId={props.id} handleId="option-default" style={{ top: '50%', right: -10 }} />
          <div className="flex-1 text-center py-2">
            <span className="text-sm font-bold text-slate-600">
              {isDateMode ? 'ברירת מחדל (כל שאר התאריכים)' : 'ברירת מחדל (כל שאר השעות)'}
            </span>
          </div>
        </div>

        {/* Time ranges */}
        {!isDateMode && timeRanges.map((range: any, i: number) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl group/item relative transition-colors hover:bg-white hover:border-orange-100">
            <DeletableHandle nodeId={props.id} handleId={`option-${i}`} style={{ top: '50%', right: -10 }} />

            <div className="flex-1">
              <div className="flex gap-2 items-center justify-center py-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={range.toHour}
                  onChange={(e) => updateTimeRange(i, 'toHour', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-center nodrag font-bold"
                />
                <span className="text-sm font-bold text-slate-500">עד</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={range.fromHour}
                  onChange={(e) => updateTimeRange(i, 'fromHour', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-center nodrag font-bold"
                />
                <span className="text-sm font-bold text-slate-500">משעה</span>
              </div>
            </div>

            <button
              onClick={() => removeTimeRange(i)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 nodrag flex-shrink-0"
              title="מחק טווח"
            >
              <X size={18} />
            </button>
          </div>
        ))}

        {/* Date ranges */}
        {isDateMode && dateRanges.map((range: any, i: number) => (
          <div key={i} className="flex items-center gap-1 p-1.5 bg-slate-50 border border-slate-100 rounded-xl group/item relative transition-colors hover:bg-white hover:border-orange-100">
            <DeletableHandle nodeId={props.id} handleId={`option-${i}`} style={{ top: '50%', right: -10 }} />

            <div className="flex-1">
              <div className="flex gap-1 items-center" dir="rtl">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">מ</span>
                <input
                  type="date"
                  value={range.fromDate || ''}
                  onChange={(e) => updateDateRange(i, 'fromDate', e.target.value)}
                  className="flex-1 min-w-0 px-1 py-1 border border-slate-200 rounded-lg nodrag font-bold text-xs"
                />
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">עד</span>
                <input
                  type="date"
                  value={range.toDate || ''}
                  onChange={(e) => updateDateRange(i, 'toDate', e.target.value)}
                  className="flex-1 min-w-0 px-1 py-1 border border-slate-200 rounded-lg nodrag font-bold text-xs"
                />
              </div>
            </div>

            <button
              onClick={() => removeDateRange(i)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 nodrag flex-shrink-0"
              title="מחק טווח"
            >
              <X size={13} />
            </button>
          </div>
        ))}

        <button
          onClick={isDateMode ? addDateRange : addTimeRange}
          className="w-full mt-2 py-4 text-[13px] font-bold bg-white text-blue-600 rounded-2xl border-2 border-dashed border-blue-100 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center gap-2 transition-all nodrag uppercase tracking-wider"
        >
          <Plus size={18} /> {isDateMode ? 'הוסף טווח תאריכים' : 'הוסף טווח שעות'}
        </button>
      </div>
    </BaseNode>
  );
};

export const ActionAddToGroupNode = (props: any) => {
  const allGroups: Array<{ _id: string; name: string; is_blocklist?: boolean }> = props.data.groups || [];
  const mode: 'add' | 'remove' = props.data.groupActionMode || 'add';

  // For "add" mode show all groups; for remove hide the blocklist group (it's represented by the "הכל" option)
  const groups = mode === 'remove'
    ? allGroups.filter(g => !g.is_blocklist)
    : allGroups;

  const title = mode === 'remove' ? 'הסרה מקבוצה' : 'הוספה לקבוצה';
  const icon = mode === 'remove' ? <UserMinus size={20} /> : <Users size={20} />;

  // In remove mode the select value is either '__all__' (blocklist) or a specific group id.
  const removeSelectValue = mode === 'remove'
    ? ((props.data.removeFromGroupMode || 'specific') === 'all' ? '__all__' : (props.data.removeGroupId || ''))
    : '';

  const handleAddGroupChange = (value: string) => {
    props.data.onChange({ groupId: value });
  };

  const handleRemoveSelectChange = (value: string) => {
    if (value === '__all__') {
      props.data.onChange({ removeFromGroupMode: 'all', removeGroupId: '' });
    } else {
      props.data.onChange({ removeFromGroupMode: 'specific', removeGroupId: value });
    }
  };

  return (
    <BaseNode id={props.id} title={title} icon={icon} type={NodeType.ACTION_ADD_TO_GROUP} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="סוג פעולה">
        <div className="flex flex-col gap-2 nodrag">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
            <input
              type="radio"
              className="nodrag accent-orange-500"
              checked={mode === 'add'}
              onChange={() => props.data.onChange({ groupActionMode: 'add', removeGroupId: '', removeFromGroupMode: 'specific' })}
            />
            הוספה לקבוצה
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
            <input
              type="radio"
              className="nodrag accent-orange-500"
              checked={mode === 'remove'}
              onChange={() => props.data.onChange({ groupActionMode: 'remove', groupId: '' })}
            />
            הסרה מקבוצה
          </label>
        </div>
      </InputFieldWrapper>

      {mode === 'add' && (
        <InputFieldWrapper label="בחר קבוצה">
          <div className="relative">
            <select
              className="nodrag w-full h-12 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
              value={props.data.groupId || ''}
              onChange={(e) => handleAddGroupChange(e.target.value)}
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              <option value="">-- בחר קבוצה --</option>
              {groups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {!props.data.groupId && (
            <p className="mt-2 text-[12px] text-slate-400 text-right">בסימולטור הרכיב ידולג (אין waPhone)</p>
          )}
        </InputFieldWrapper>
      )}

      {mode === 'remove' && (
        <InputFieldWrapper label="בחר קבוצה">
          <div className="relative">
            <select
              className="nodrag w-full h-12 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
              value={removeSelectValue}
              onChange={(e) => handleRemoveSelectChange(e.target.value)}
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              <option value="">-- בחר קבוצה --</option>
              <option value="__all__">הכל (רשימת הסרה)</option>
              {groups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {removeSelectValue === '__all__' ? (
            <p className="mt-2 text-[12px] text-slate-500 text-right">מספר הטלפון יתווסף לרשימת ההסרה</p>
          ) : !removeSelectValue ? (
            <p className="mt-2 text-[12px] text-slate-400 text-right">בסימולטור הרכיב ידולג (אין waPhone)</p>
          ) : null}
        </InputFieldWrapper>
      )}

      {mode === 'remove' && removeSelectValue === '__all__' && (
        <InputFieldWrapper label={<span>סיבת ההסרה (תירשם בלוג ההסרות) <span className="text-red-500">*</span></span> as any}>
          <textarea
            className={`nodrag w-full min-h-[64px] px-3 py-2 border rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y ${!String(props.data.removalReason || '').trim() ? 'border-red-400' : 'border-slate-200'}`}
            value={props.data.removalReason || ''}
            onChange={(e) => props.data.onChange({ removalReason: e.target.value })}
            placeholder="למשל: הלקוח ביקש להסיר מהרשימה"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          />
          {!String(props.data.removalReason || '').trim() && (
            <p className="mt-2 text-[12px] font-bold text-red-500 text-right">יש להזין סיבת הסרה</p>
          )}
        </InputFieldWrapper>
      )}
    </BaseNode>
  );
};

export const ActionRemoveFromGroupNode = (props: any) => {
  const groups: Array<{ _id: string; name: string; is_blocklist?: boolean }> = (props.data.groups || []).filter((g: any) => !g.is_blocklist);
  const mode: 'specific' | 'all' = props.data.removeFromGroupMode || 'specific';

  return (
    <BaseNode id={props.id} title="הסר מקבוצה" icon={<UserMinus size={20} />} type={NodeType.ACTION_REMOVE_FROM_GROUP} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <InputFieldWrapper label="סוג הסרה">
        <div className="flex flex-col gap-2 nodrag">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
            <input
              type="radio"
              className="nodrag accent-orange-500"
              checked={mode === 'specific'}
              onChange={() => props.data.onChange({ removeFromGroupMode: 'specific', removeGroupId: '' })}
            />
            הסר מקבוצה מסויימת
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
            <input
              type="radio"
              className="nodrag accent-orange-500"
              checked={mode === 'all'}
              onChange={() => props.data.onChange({ removeFromGroupMode: 'all', removeGroupId: '' })}
            />
            הסר מכל הקבוצות (רשימת הסרה)
          </label>
        </div>
      </InputFieldWrapper>

      {mode === 'specific' && (
        <InputFieldWrapper label="בחר קבוצה">
          <div className="relative">
            <select
              className="nodrag w-full h-12 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
              value={props.data.removeGroupId || ''}
              onChange={(e) => props.data.onChange({ removeGroupId: e.target.value })}
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              <option value="">-- בחר קבוצה --</option>
              {groups.map(g => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {!props.data.removeGroupId && (
            <p className="mt-2 text-[12px] text-slate-400 text-right">בסימולטור הרכיב ידולג (אין waPhone)</p>
          )}
        </InputFieldWrapper>
      )}

      {mode === 'all' && (
        <p className="text-[12px] text-slate-500 text-right mt-1">מספר הטלפון יתווסף לרשימת ההסרה</p>
      )}

      {mode === 'all' && (
        <InputFieldWrapper label={<span>סיבת ההסרה (תירשם בלוג ההסרות) <span className="text-red-500">*</span></span> as any}>
          <textarea
            className={`nodrag w-full min-h-[64px] px-3 py-2 border rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y ${!String(props.data.removalReason || '').trim() ? 'border-red-400' : 'border-slate-200'}`}
            value={props.data.removalReason || ''}
            onChange={(e) => props.data.onChange({ removalReason: e.target.value })}
            placeholder="למשל: הלקוח ביקש להסיר מהרשימה"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          />
          {!String(props.data.removalReason || '').trim() && (
            <p className="mt-2 text-[12px] font-bold text-red-500 text-right">יש להזין סיבת הסרה</p>
          )}
        </InputFieldWrapper>
      )}
    </BaseNode>
  );
};

export const ActionTransferToAgentNode = (props: any) => {
  const repGroups: Array<{ id: string; name: string }> = props.data.repGroups || [];
  const repUsers: Array<{ id: string; name: string; email: string; repGroupIds: string[] }> = props.data.repUsers || [];
  const value = props.data.repGroupId || '';
  const mode: 'any' | 'specific' = props.data.repAssignmentMode === 'specific' ? 'specific' : 'any';
  const selectedRepUserId = props.data.repUserId || '';

  // Reps that belong to the currently selected group
  const repsInGroup = value
    ? repUsers.filter(r => (r.repGroupIds || []).includes(value))
    : [];

  const handleGroupChange = (newGroupId: string) => {
    // Changing the group clears the specific rep selection if it no longer belongs to the new group
    const stillValid = repUsers.some(r => r.id === selectedRepUserId && (r.repGroupIds || []).includes(newGroupId));
    props.data.onChange({
      repGroupId: newGroupId,
      repUserId: stillValid ? selectedRepUserId : ''
    });
  };

  return (
    <BaseNode
      id={props.id}
      title="העברה לנציג"
      icon={<UserCheck size={20} />}
      type={NodeType.ACTION_TRANSFER_TO_AGENT}
      selected={props.selected}
      onDelete={props.data.onDelete}
      serialId={props.data.serialId}
      isSimulatorActive={props.data?.isSimulatorActive}
      searchQuery={props.data.searchQuery}
      isCurrentMatch={props.data.isCurrentMatch}
      isSearchMatch={props.data.isSearchMatch}
    >
      <InputFieldWrapper label="קבוצת נציגים לשיוך">
        <div className="relative">
          <select
            className="nodrag w-full h-12 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
            value={value}
            onChange={(e) => handleGroupChange(e.target.value)}
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            <option value="">-- בחר קבוצת נציגים --</option>
            {repGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {repGroups.length === 0 && (
          <p className="mt-2 text-[12px] text-amber-600 text-right">
            לא הוגדרו קבוצות נציגים. ניתן להוסיף קבוצות במסך משתמשי משנה.
          </p>
        )}
      </InputFieldWrapper>

      {value && (
        <InputFieldWrapper label="אופן הקצאה">
          <div className="flex flex-col gap-2 nodrag">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
              <input
                type="radio"
                className="nodrag accent-orange-500"
                checked={mode === 'any'}
                onChange={() => props.data.onChange({ repAssignmentMode: 'any', repUserId: '' })}
              />
              כל נציג זמין מהקבוצה
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-sm font-medium">
              <input
                type="radio"
                className="nodrag accent-orange-500"
                checked={mode === 'specific'}
                onChange={() => props.data.onChange({ repAssignmentMode: 'specific' })}
              />
              נציג ספציפי מהקבוצה
            </label>
          </div>
        </InputFieldWrapper>
      )}

      {value && mode === 'specific' && (
        <InputFieldWrapper label="בחר נציג">
          <div className="relative">
            <select
              className="nodrag w-full h-12 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none"
              value={selectedRepUserId}
              onChange={(e) => props.data.onChange({ repUserId: e.target.value })}
              style={{ fontFamily: 'Heebo, sans-serif' }}
            >
              <option value="">-- בחר נציג --</option>
              {repsInGroup.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {repsInGroup.length === 0 && (
            <p className="mt-2 text-[12px] text-amber-600 text-right">
              אין נציגים בקבוצה הזו. הוסף נציגים במסך משתמשי משנה.
            </p>
          )}
        </InputFieldWrapper>
      )}

      <p className="mt-2 text-[12px] text-slate-500 text-right leading-relaxed">
        הרכיב יעביר את השיחה לנציג מהקבוצה שנבחרה.<br />
        הבוט יפסיק להגיב למשך 30 דקות (כמו בשיחה עם נציג).
      </p>
    </BaseNode>
  );
};

export const AutomaticResponsesNode = (props: any) => {
  const options = props.data.options || ['כניסה'];
  const operators = props.data.optionOperators || Array(options.length).fill('eq');
  // Persist isExpanded in node data so it survives remounts and re-entry
  const [isExpanded, setIsExpanded] = useState<boolean>(props.data.isExpanded ?? false);
  const MAX_VISIBLE = 5;
  const hasMore = options.length > MAX_VISIBLE;
  const visibleOptions = hasMore && !isExpanded ? options.slice(0, MAX_VISIBLE) : options;
  const { setEdges } = useReactFlow();

  // Apply edge visibility whenever isExpanded changes (handles toggle; initial load is handled by App.tsx)
  useEffect(() => {
    setEdges((eds) => eds.map((edge) => {
      if (edge.source !== props.id) return edge;
      const match = edge.sourceHandle?.match(/^option-(\d+)$/);
      if (!match) return edge;
      const idx = parseInt(match[1]);
      if (idx < MAX_VISIBLE) return edge;
      return { ...edge, hidden: !isExpanded };
    }));
  }, [isExpanded, props.id]);

  const updateOption = (index: number, value: string) => {
    if (index === 0) return; // Prevent changing the fixed "כניסה" option
    const newOptions = [...options];
    newOptions[index] = value;
    props.data.onChange({ options: newOptions });
  };

  const updateOperator = (index: number, op: string) => {
    if (index === 0) return; // Prevent changing the operator for "כניסה"
    const newOps = [...operators];
    newOps[index] = op;
    props.data.onChange({ optionOperators: newOps });
  };

  const addOption = () => {
    props.data.onChange({ 
      options: [...options, ''], // Empty string instead of "פתיח חדש"
      optionOperators: [...operators, 'eq']
    });
  };

  const removeOption = (index: number) => {
    if (index === 0) return; // Prevent deleting the fixed "כניסה" option
    const newOptions = options.filter((_: any, i: number) => i !== index);
    const newOps = operators.filter((_: any, i: number) => i !== index);
    props.data.onChange({ options: newOptions, optionOperators: newOps });
  };

  return (
    <BaseNode id={props.id} title="תגובות אוטומטיות" icon={<Zap size={20} />} type={NodeType.AUTOMATIC_RESPONSES} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId} isSimulatorActive={props.data?.isSimulatorActive} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} isSearchMatch={props.data.isSearchMatch}>
      <div className="space-y-4 relative text-right">
        <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">מילות מפתח ופתיחים</label>
        {/* Always render hidden handles for collapsed options so ReactFlow edges stay connected */}
        {hasMore && !isExpanded && options.slice(MAX_VISIBLE).map((_: string, j: number) => (
          <Handle key={`hidden-${MAX_VISIBLE + j}`} type="source" position={Position.Right} id={`option-${MAX_VISIBLE + j}`} style={{ opacity: 0, pointerEvents: 'none', top: '50%', right: -16 }} className="w-4 h-4" />
        ))}
        {visibleOptions.map((opt: string, i: number) => {
          const isDefault = i === 0;
          return (
            <div key={i} className={`flex items-center gap-2 p-2 border rounded-2xl group/item relative transition-colors ${isDefault ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-100'}`}>
              <DeletableHandle nodeId={props.id} handleId={`option-${i}`} style={{ top: '50%', right: -10 }} />
              <div className="flex-1">
                <SearchableInput value={opt} onChange={(v: string) => updateOption(i, v)} searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} disabled={isDefault} placeholder={!isDefault ? "הזן ערך" : ""} />
              </div>
              <div className="flex items-center gap-1.5 pl-1 pr-1 flex-row-reverse">
                {!isDefault ? (
                  <>
                    <ResponseOperatorSelector value={operators[i]} onChange={(op) => updateOperator(i, op)} disabled={isDefault} />
                    <button 
                      onClick={() => removeOption(i)} 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 nodrag flex-shrink-0"
                      title="מחק פתיח"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-slate-300 italic text-[10px] font-bold">
                    Default
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button
            onClick={() => {
              const next = !isExpanded;
              setIsExpanded(next);
              props.data.onChange({ isExpanded: next });
            }}
            className="w-full py-2 text-[12px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center gap-2 transition-all nodrag"
            title={isExpanded ? 'הצג פחות' : `הצג את כל ${options.length} האפשרויות`}
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            {isExpanded ? 'הצג פחות' : `עוד ${options.length - MAX_VISIBLE} אפשרויות`}
          </button>
        )}
        <button onClick={addOption} className="w-full mt-2 py-4 text-[13px] font-bold bg-white text-slate-900 rounded-2xl border-2 border-dashed border-slate-200 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 transition-all nodrag uppercase tracking-wider">
          <Plus size={18} /> הוסף פתיח חדש
        </button>
      </div>
    </BaseNode>
  );
};
