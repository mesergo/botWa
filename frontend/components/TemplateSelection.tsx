import React, { useState, useEffect } from 'react';
import { Bot, Calendar, ShoppingCart, Info, UserCheck, ArrowLeft, Zap, Layers, Shield, CreditCard, Globe, Copy, X, Wallet } from 'lucide-react';
import { PredefinedTemplate } from '../types';

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : `${window.location.origin}/api`;

const TEMPLATES: PredefinedTemplate[] = [
  {
    id: 'customer_service',
    name: 'שרות לקוחות',
    description: 'תזרים למענה על שאלות נפוצות וניתוב פניות למוקד אנושי.',
    fields: [
      { id: 'comp_name', label: 'שם המוקד / החברה', type: 'text' },
      { id: 'opening_hours', label: 'שעות פעילות', type: 'text' }
    ]
  },
  {
    id: 'appointments',
    name: 'תאום פגישה',
    description: 'איסוף פרטים מהלקוח וקביעת תור ביומן.',
    fields: [
      { id: 'meeting_types', label: 'סוגי פגישות (מופרד בפסיק)', type: 'text' },
      { id: 'location', label: 'כתובת הפגישה', type: 'text' }
    ]
  },
  {
    id: 'product_order',
    name: 'הזמנת מוצרים',
    description: 'חנות קטנה בתוך הבוט עם אפשרות לבחירת מוצרים.',
    fields: [
      { id: 'catalog_link', label: 'קישור לקטלוג (אם יש)', type: 'url' },
      { id: 'delivery_price', label: 'עלות משלוח', type: 'text' }
    ]
  },
  {
    id: 'order_status',
    name: 'ברור מצב הזמנה',
    description: 'מתממשק עם ה-API שלכם ומציג ללקוח איפה החבילה שלו.',
    fields: [
      { id: 'api_url', label: 'כתובת API לבדיקת סטטוס', type: 'url' }
    ]
  },
  {
    id: 'about_us',
    name: 'אודותינו',
    description: 'כרטיס ביקור דיגיטלי הכולל פרטי קשר, כתובת ומידע כללי.',
    fields: [
      { id: 'comp_name', label: 'שם החברה', type: 'text' },
      { id: 'comp_address', label: 'כתובת החברה', type: 'text' },
      { id: 'comp_phone', label: 'טלפון החברה', type: 'tel' },
      { id: 'comp_website', label: 'קישור לאתר', type: 'url' },
      { id: 'comp_logo', label: 'קישור ללוגו (URL)', type: 'url' }
    ]
  }
];

interface DBTemplate {
  _id: string;
  template_id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  type?: 'public' | 'public_paid' | 'admin';
  price?: number;
}

interface UserBot {
  id: string;
  name: string;
  created_at: string;
}

const TemplateSelection: React.FC<{ 
  onSelect: (template: PredefinedTemplate | null) => void; 
  onBack: () => void; 
  token?: string | null;
  selectedBotId?: string | null;
  currentUser?: any;
}> = ({ onSelect, onBack, token, selectedBotId, currentUser }) => {
  const [dbTemplates, setDbTemplates] = useState<DBTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Clone from bot state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [userBots, setUserBots] = useState<UserBot[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);
  const [cloningBotId, setCloningBotId] = useState<string | null>(null);

  // Paid template state
  const [paidConfirmTemplate, setPaidConfirmTemplate] = useState<DBTemplate | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/templates/public`, { headers });
        const data = await res.json();
        setDbTemplates(data);
      } catch (e) {
        console.error('Failed to fetch templates', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [token]);

  const fetchUserBots = async () => {
    if (!token) return;
    setLoadingBots(true);
    try {
      const res = await fetch(`${API_BASE}/bots`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setUserBots((data as UserBot[]).filter((b: UserBot) => b.id !== selectedBotId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBots(false);
    }
  };

  const handleCloneFromBot = async (sourceBotId: string) => {
    if (!token || !selectedBotId) return;
    setCloningBotId(sourceBotId);
    try {
      const res = await fetch(`${API_BASE}/templates/clone-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sourceBotId, targetBotId: selectedBotId })
      });
      if (res.ok) {
        setShowCloneModal(false);
        onSelect(null); // Navigate to editor
      } else {
        alert('שגיאה בשכפול הבוט');
      }
    } catch (e) {
      alert('שגיאה בתקשורת עם השרת');
    } finally {
      setCloningBotId(null);
    }
  };

  const handleSelectDBTemplate = (tpl: DBTemplate) => {
    const resolvedType = tpl.type || (tpl.isPublic ? 'public' : 'admin');
    if (resolvedType === 'public_paid') {
      setPaidConfirmTemplate(tpl);
      return;
    }
    onSelect({ id: tpl._id, name: tpl.name, description: tpl.description || '', fields: [] } as PredefinedTemplate);
  };

  const handleConfirmPaidTemplate = () => {
    if (!paidConfirmTemplate) return;
    onSelect({ id: paidConfirmTemplate._id, name: paidConfirmTemplate.name, description: paidConfirmTemplate.description || '', fields: [] } as PredefinedTemplate);
    setPaidConfirmTemplate(null);
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'customer_service': return <Bot size={24} />;
      case 'appointments': return <Calendar size={24} />;
      case 'product_order': return <ShoppingCart size={24} />;
      case 'order_status': return <UserCheck size={24} />;
      case 'about_us': return <Info size={24} />;
      default: return <Layers size={24} />;
    }
  };

  // Separate templates by type
  const adminTemplates = dbTemplates.filter(t => (t.type || 'public') === 'admin');
  const paidTemplates = dbTemplates.filter(t => (t.type || 'public') === 'public_paid');
  const publicDbTemplates = dbTemplates.filter(t => !t.type || t.type === 'public');

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-y-auto">
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 flex-row-reverse">
        <h2 className="text-xl font-black text-slate-900">בחירת תסריט</h2>
        <button onClick={onBack} className="p-3 text-slate-400 hover:text-blue-600 transition-all"><ArrowLeft size={22} /></button>
      </nav>

      <div className="max-w-6xl mx-auto w-full p-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-4">בוא נתחיל לבנות</h1>
          <p className="text-slate-500 text-lg">בחר תבנית מוכנה או התחל מתזרים ריק</p>
        </div>

        {/* Admin-only templates section */}
        {adminTemplates.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-violet-600" />
              <h2 className="text-sm font-black text-violet-700 uppercase tracking-wider">תסריטי מנהל</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTemplates.map((tpl) => (
                <div
                  key={tpl._id}
                  onClick={() => handleSelectDBTemplate(tpl)}
                  className="bg-white border border-violet-100 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-[200px] justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all">
                        <Shield size={20} />
                      </div>
                      <span className="text-[10px] font-black text-violet-500 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">מנהל</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">{tpl.name}</h3>
                    <p className="text-slate-500 text-xs leading-snug">{tpl.description || 'תבנית מנהל'}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-violet-600 font-black text-xs group-hover:gap-3 transition-all">
                    <span>בחר תבנית</span>
                    <ArrowLeft size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Blank Template */}
          <div 
            onClick={() => onSelect(null)}
            className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-600 hover:bg-blue-50/30 transition-all group"
          >
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Zap size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900">תזרים ריק</h3>
            <p className="text-slate-400 text-center text-xs font-bold">התחל מאפס ובנה הכל לבד</p>
          </div>

          {/* Clone from existing bot */}
          {token && selectedBotId && (
            <div
              onClick={() => { fetchUserBots(); setShowCloneModal(true); }}
              className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group"
            >
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Copy size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">שכפל מבוט קיים</h3>
              <p className="text-slate-400 text-center text-xs font-bold">בחר בוט שלך ושכפל את כל התסריט שלו</p>
            </div>
          )}

          {/* Public DB Templates */}
          {publicDbTemplates.map((tpl) => (
            <div 
              key={tpl._id}
              onClick={() => handleSelectDBTemplate(tpl)}
              className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-[200px] justify-between group"
            >
              <div>
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Layers size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{tpl.name}</h3>
                <p className="text-slate-500 text-xs leading-snug">{tpl.description || 'תבנית מותאמת אישית'}</p>
              </div>
              <div className="flex items-center justify-end gap-2 text-indigo-600 font-black text-xs group-hover:gap-3 transition-all">
                <span>בחר תבנית</span>
                <ArrowLeft size={14} />
              </div>
            </div>
          ))}

          {/* Paid DB Templates */}
          {paidTemplates.map((tpl) => (
            <div
              key={tpl._id}
              onClick={() => handleSelectDBTemplate(tpl)}
              className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-[200px] justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Layers size={20} />
                  </div>
                  <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                    <CreditCard size={10} />
                    {tpl.price ? `${tpl.price}₪` : 'בתשלום'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{tpl.name}</h3>
                <p className="text-slate-500 text-xs leading-snug">{tpl.description || 'תבנית פרימיום'}</p>
              </div>
              <div className="flex items-center justify-end gap-2 text-blue-600 font-black text-xs group-hover:gap-3 transition-all">
                <span>בחר תבנית</span>
                <ArrowLeft size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clone from bot modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-right">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Copy size={24} />
              </div>
              <button onClick={() => setShowCloneModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">שכפל מבוט קיים</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">בחר את הבוט שממנו תרצה לשכפל. כל הרכיבים יועתקו לבוט החדש.</p>

            {loadingBots ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-600"></div>
              </div>
            ) : userBots.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Bot size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">אין בוטים קיימים לשכפול</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userBots.map(bot => (
                  <button
                    key={bot.id}
                    onClick={() => handleCloneFromBot(bot.id)}
                    disabled={!!cloningBotId}
                    className="w-full flex items-center gap-4 p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all text-right group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                      {cloningBotId === bot.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-200 border-t-emerald-600"></div>
                      ) : (
                        <Bot size={18} />
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-bold text-slate-800 text-sm">{bot.name}</p>
                      <p className="text-xs text-slate-400">{new Date(bot.created_at).toLocaleDateString('he-IL')}</p>
                    </div>
                    <ArrowLeft size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paid template confirmation modal */}
      {paidConfirmTemplate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6">
              <Wallet size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">תבנית בתשלום</h3>
            <p className="text-slate-500 text-sm mb-4 font-medium leading-relaxed">
              תבנית <span className="font-black text-slate-800">{paidConfirmTemplate.name}</span> דורשת תשלום לפני השימוש.
            </p>
            {paidConfirmTemplate.price && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-center">
                <span className="text-2xl font-black text-blue-700">{paidConfirmTemplate.price}₪</span>
                <p className="text-xs text-blue-500 mt-1 font-medium">תשלום חד פעמי</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmPaidTemplate}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
              >
                אשר ושלם {paidConfirmTemplate.price ? `${paidConfirmTemplate.price}₪` : ''}
              </button>
              <button
                onClick={() => setPaidConfirmTemplate(null)}
                className="w-full py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSelection;
