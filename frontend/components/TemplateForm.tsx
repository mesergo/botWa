import React, { useState } from 'react';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { PredefinedTemplate } from '../types';

interface TemplateFormProps {
  template: PredefinedTemplate;
  onSubmit: (values: Record<string, string>) => void;
  onBack: () => void;
}

const TemplateForm: React.FC<TemplateFormProps> = ({ template, onSubmit, onBack }) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (id: string, val: string) => {
    setValues(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-y-auto">
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 flex-row-reverse">
        <h2 className="text-xl font-black text-slate-900">התאמת תבנית: {template.name}</h2>
        <button onClick={onBack} className="p-3 text-slate-400 hover:text-blue-600 transition-all"><ArrowLeft size={22} /></button>
      </nav>

      <div className="max-w-2xl mx-auto w-full p-12">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
          <div className="flex items-center justify-end gap-3 mb-8">
            <h1 className="text-2xl font-black text-slate-900">מילוי פרטים ראשוניים</h1>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Sparkles size={24} /></div>
          </div>
          
          <p className="text-slate-400 text-sm mb-10 font-bold leading-relaxed">
            הזן את הפרטים הבאים כדי שנוכל להטמיע אותם באופן אוטומטי בתוך התזרים שלך.
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {template.fields.map((field) => (
              <div key={field.id} className="space-y-3">
                <label className="block text-sm font-black text-slate-900 mr-1">{field.label}</label>
                <input 
                  required
                  type={field.type}
                  value={values[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder || `הזן ${field.label.toLowerCase()}...`}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-bold text-right"
                />
              </div>
            ))}

            <div className="flex gap-4 pt-6">
              <button 
                type="button"
                onClick={onBack} 
                className="flex-1 py-5 border border-slate-200 text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all"
              >
                חזור
              </button>
              <button 
                type="submit"
                className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
              >
                <Save size={20} />
                צור תזרים מוכן
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TemplateForm;