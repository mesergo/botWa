import React from 'react';
import { Bot, Calendar, ShoppingCart, Info, UserCheck, ArrowLeft, Zap, Layers } from 'lucide-react';
import { PredefinedTemplate } from '../types';

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

const TemplateSelection: React.FC<{ onSelect: (template: PredefinedTemplate | null) => void, onBack: () => void }> = ({ onSelect, onBack }) => {
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

          {/* Predefined Templates */}
          {TEMPLATES.map((tpl) => (
            <div 
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-[200px] justify-between group"
            >
              <div>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 mr-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  {getIcon(tpl.id)}
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{tpl.name}</h3>
                <p className="text-slate-500 text-xs leading-snug">{tpl.description}</p>
              </div>
              <div className="flex items-center justify-end gap-2 text-blue-600 font-black text-xs group-hover:gap-3 transition-all">
                <span>בחר תבנית</span>
                <ArrowLeft size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelection;