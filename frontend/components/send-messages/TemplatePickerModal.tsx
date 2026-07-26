import React from 'react';
import { Search, X } from 'lucide-react';

interface TemplatePickerModalProps {
  show: boolean;
  onClose: () => void;
  templateSearch: string;
  setTemplateSearch: (v: string) => void;
  templatesLoading: boolean;
  filteredTemplates: any[];
  onPickTemplate: (t: any) => void;
}

const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  show, onClose, templateSearch, setTemplateSearch,
  templatesLoading, filteredTemplates, onPickTemplate,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">

        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-xl font-black text-slate-900">בחר תבנית</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="relative mb-4">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="חפש תבנית..."
              className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-purple-600/10 focus:border-purple-600"
            />
          </div>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-300">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-purple-500 rounded-full" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-center py-10 text-sm font-bold text-slate-300">לא נמצאו תבניות</p>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((t: any, i: number) => (
                <button
                  key={t.id || i}
                  onClick={() => onPickTemplate(t)}
                  className="w-full text-right p-4 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-2xl transition-colors"
                >
                  <p className="text-sm font-black text-slate-900">
                    {t.name || t.elementName || t.template_name}
                  </p>
                  {(t.components || []).map((comp: any, ci: number) =>
                    comp.type === 'BODY' && comp.text ? (
                      <p key={ci} className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                        {comp.text}
                      </p>
                    ) : null
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TemplatePickerModal;
