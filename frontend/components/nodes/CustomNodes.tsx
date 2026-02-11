
import React, { useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  Type, Calendar, Upload, MessageSquare, 
  Image as ImageIcon, ExternalLink, List, Globe, Clock, PlayCircle, Plus, Layers, X, GitBranch, Trash2, ChevronDown, Zap
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
  <BaseNode id={props.id} title="קלט: טקסט" icon={<Type size={20} />} type={NodeType.INPUT_TEXT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="שאלה מהבוט">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="מה השם שלך?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
    <InputFieldWrapper label="שם משתנה לאחסון">
      <SearchableInput value={props.data.variableName} onChange={(v: string) => props.data.onChange({ variableName: v })} placeholder="user_name" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const InputDateNode = (props: any) => (
  <BaseNode id={props.id} title="קלט: תאריך" icon={<Calendar size={20} />} type={NodeType.INPUT_DATE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="בקשת תאריך">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="מתי תרצה להגיע?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const InputFileNode = (props: any) => (
  <BaseNode id={props.id} title="קלט: קובץ" icon={<Upload size={20} />} type={NodeType.INPUT_FILE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="בקשת קובץ">
      <SearchableInput value={props.data.label} onChange={(v: string) => props.data.onChange({ label: v })} placeholder="אנא העלה תמונה" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const OutputTextNode = (props: any) => (
  <BaseNode id={props.id} title="הודעת בוט" icon={<MessageSquare size={20} />} type={NodeType.OUTPUT_TEXT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="תוכן ההודעה">
      <SearchableInput isTextArea value={props.data.content} onChange={(v: string) => props.data.onChange({ content: v })} placeholder="היי, איך אני יכול לעזור?" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const OutputImageNode = (props: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => props.data.onChange({ url: reader.result as string });
      reader.readAsDataURL(file);
    }
  };
  return (
    <BaseNode id={props.id} title="תמונת בוט" icon={<ImageIcon size={20} />} type={NodeType.OUTPUT_IMAGE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
      <InputFieldWrapper>
        <div className="space-y-3">
          {props.data.url ? (
            <div className="relative group rounded-2xl overflow-hidden border border-slate-100 shadow-sm w-full h-40 bg-slate-50 flex items-center justify-center">
              <img src={props.data.url} alt="Bot upload" className="max-w-full h-full object-contain" />
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white text-slate-900 rounded-xl shadow-xl hover:bg-slate-100 transition-all"><Upload size={18} /></button>
                <button onClick={() => props.data.onChange({ url: '' })} className="p-2.5 bg-red-500 text-white rounded-xl shadow-xl hover:bg-red-600 transition-all"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50/50 transition-all nodrag">
              <Upload size={32} strokeWidth={1.5} />
              <span className="text-[14px] font-bold uppercase tracking-widest">העלה מדיה</span>
            </button>
          )}
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      </InputFieldWrapper>
    </BaseNode>
  );
};

export const OutputLinkNode = (props: any) => (
  <BaseNode id={props.id} title="קישור חיצוני" icon={<ExternalLink size={20} />} type={NodeType.OUTPUT_LINK} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="טקסט הקישור">
      <SearchableInput value={props.data.linkLabel} onChange={(v: string) => props.data.onChange({ linkLabel: v })} placeholder="בקר באתר שלנו" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
    <InputFieldWrapper label="כתובת אינטרנט">
      <SearchableInput value={props.data.url} onChange={(v: string) => props.data.onChange({ url: v })} placeholder="https://example.com" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

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
    <BaseNode id={props.id} title="תפריט בחירה" icon={<List size={20} />} type={NodeType.OUTPUT_MENU} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
      <InputFieldWrapper label="הנחיית בחירה">
        <SearchableInput value={props.data.content} onChange={(v: string) => props.data.onChange({ content: v })} placeholder="בחר בבקשה מהרשימה:" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      <div className="space-y-4 relative text-right">
        <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">רשימת אפשרויות</label>
        {options.map((opt: string, i: number) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-2xl group/item relative transition-colors hover:bg-white hover:border-blue-100">
            <Handle type="source" position={Position.Right} id={`option-${i}`} style={{ top: '50%', right: -16 }} className="w-4 h-4 bg-slate-400 border-2 border-white rounded-full shadow-lg" />
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
    <BaseNode id={props.id} title="חיבור API" icon={<Globe size={20} />} type={NodeType.ACTION_WEB_SERVICE} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
      <InputFieldWrapper label="כתובת Webhook">
        <SearchableInput value={props.data.url} onChange={(v: string) => props.data.onChange({ url: v })} placeholder="https://api.yourdomain.com" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
      </InputFieldWrapper>
      <div className="space-y-3 mt-4 text-right">
        <div className="flex items-center justify-between mb-2 flex-row-reverse">
          <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">פיצול לפי תשובה (Return)</label>
          <button onClick={addBranch} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Plus size={16} /></button>
        </div>
        {branches.map((branch: string, i: number) => (
          <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl group/branch relative transition-colors hover:bg-white hover:border-blue-100">
            <Handle type="source" position={Position.Right} id={`option-${i}`} style={{ top: '50%', right: -16 }} className="w-4 h-4 bg-slate-400 border-2 border-white rounded-full shadow-lg" />
            
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
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter text-center py-2 border border-dashed border-slate-100 rounded-xl">ללא פיצול לוגי (ממשיך הלאה)</div>
        )}
      </div>
    </BaseNode>
  );
};

export const ActionWaitNode = (props: any) => (
  <BaseNode id={props.id} title="השהיית מערכת" icon={<Clock size={20} />} type={NodeType.ACTION_WAIT} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <InputFieldWrapper label="זמן המתנה (שניות)">
      <SearchableInput type="number" value={props.data.waitTime?.toString()} onChange={(v: string) => props.data.onChange({ waitTime: parseInt(v) || 0 })} placeholder="למשל: 3" searchQuery={props.data.searchQuery} isCurrentMatch={props.data.isCurrentMatch} />
    </InputFieldWrapper>
  </BaseNode>
);

export const FixedProcessNode = (props: any) => (
  <BaseNode id={props.id} title={`תת תזרים ${props.data.label}`} icon={<Layers size={20} />} type={NodeType.FIXED_PROCESS} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-[14px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-end gap-3 text-right">תת תזרים {props.data.label} <Layers size={20} className="text-slate-400" /></div>
  </BaseNode>
);

export const AutomaticResponsesNode = (props: any) => {
  const options = props.data.options || ['כניסה'];
  const operators = props.data.optionOperators || Array(options.length).fill('eq');

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
    <BaseNode id={props.id} title="תגובות אוטומטיות" icon={<Zap size={20} />} type={NodeType.AUTOMATIC_RESPONSES} selected={props.selected} onDelete={props.data.onDelete} serialId={props.data.serialId}>
      <div className="space-y-4 relative text-right">
        <label className="block text-[14px] font-bold text-slate-400 uppercase tracking-widest">מילות מפתח ופתיחים</label>
        {options.map((opt: string, i: number) => {
          const isDefault = i === 0;
          return (
            <div key={i} className={`flex items-center gap-2 p-2 border rounded-2xl group/item relative transition-colors ${isDefault ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-100'}`}>
              <Handle type="source" position={Position.Right} id={`option-${i}`} style={{ top: '50%', right: -16 }} className="w-4 h-4 bg-slate-400 border-2 border-white rounded-full shadow-lg" />
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
        <button onClick={addOption} className="w-full mt-2 py-4 text-[13px] font-bold bg-white text-slate-900 rounded-2xl border-2 border-dashed border-slate-200 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 transition-all nodrag uppercase tracking-wider">
          <Plus size={18} /> הוסף פתיח חדש
        </button>
      </div>
    </BaseNode>
  );
};
