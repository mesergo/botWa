import React, { useState } from 'react';
import { Plus, Bot, ArrowLeft, Trash2, Calendar, LogOut } from 'lucide-react';
import { BotFlow } from '../types';

interface DashboardProps {
  bots: BotFlow[];
  onEnterBot: (bot: BotFlow) => void;
  onCreateBot: (name: string) => void;
  onDeleteBot: (id: string) => void;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ bots, onEnterBot, onCreateBot, onDeleteBot, onLogout }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');

  const handleCreate = () => {
    if (!newBotName.trim()) return;
    onCreateBot(newBotName);
    setNewBotName('');
    setIsModalOpen(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString('he-IL');
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toLocaleDateString('he-IL') : date.toLocaleDateString('he-IL');
  };

  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col font-medium text-right overflow-hidden">
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 z-20">
        <div className="flex items-center gap-4">
          <img src="/images/mesergo-logo.png" alt="Logo" className="h-10 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"><LogOut size={22} /></button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10 flex-row-reverse">
            <h1 className="text-3xl font-black text-slate-900">הבוטים שלי</h1>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all scale-100 active:scale-95"
            >
              <Plus size={20} /> צור תזרים חדש
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div 
                key={bot.id}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between h-[280px]"
                onClick={() => onEnterBot(bot)}
              >
                <div>
                  <div className="flex items-center justify-between mb-6 flex-row-reverse">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Bot size={28} />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteBot(bot.id); }}
                      className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 truncate">{bot.name}</h3>
                  <p className="text-slate-400 text-sm font-bold flex items-center justify-end gap-2 uppercase tracking-widest">
                    <span>{formatDate(bot.created_at)}</span>
                    <Calendar size={14} />
                  </p>
                </div>
                
                <div className="flex items-center justify-end gap-2 text-blue-600 font-black text-sm group-hover:gap-4 transition-all mt-6">
                  <span>כניסה לעריכה</span>
                  <ArrowLeft size={18} />
                </div>
              </div>
            ))}
            
            {bots.length === 0 && (
              <div className="col-span-full py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-slate-300">
                <Bot size={64} strokeWidth={1} />
                <p className="text-xl font-bold">אין לך בוטים עדיין. בוא ניצור את הראשון!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6 text-right">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mr-0"><Plus size={32} /></div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 text-right">בוט חדש</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed text-right">הזן שם עבור תזרים הזרימה החדש שלך.</p>
            <div className="space-y-6">
              <input 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-sm font-bold text-right" 
                placeholder="שם הבוט (למשל: שירות לקוחות)..." 
                value={newBotName} 
                onChange={e => setNewBotName(e.target.value)} 
                autoFocus 
              />
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs uppercase hover:bg-slate-50">ביטול</button>
                <button onClick={handleCreate} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700">יצירה</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;