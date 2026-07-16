import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Users, Bot } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface Stats {
  sessions: { today: number; month: number; active: number; total: number };
  messages: { today: number; week: number; month: number };
  bots: number;
  contacts: number;
}

// Hook: animates from 0 → target over `duration` ms using easeOut
function useCountUp(target: number, duration = 900, enabled = true): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || target === 0) { setDisplay(target); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, enabled]);

  return display;
}

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  loading: boolean;
  animate: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, iconBg, iconColor, loading, animate }) => {
  const displayed = useCountUp(value, 900, animate && !loading);
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse mb-1" />
        ) : (
          <p className="text-3xl font-black text-slate-900 leading-none">{displayed.toLocaleString()}</p>
        )}
        <p className="text-slate-500 text-sm font-semibold mt-1.5 leading-snug">{label}</p>
        {sub && !loading && (
          <p className="text-slate-400 text-xs mt-0.5 leading-snug">{sub}</p>
        )}
      </div>
    </div>
  );
};

const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('flowbot_token') || sessionStorage.getItem('flowbot_token');
    if (!token) { setLoading(false); return; }

    fetch(`${API_BASE}/sessions/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Stats) => { setStats(data); setAnimate(true); })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'שיחות היום',
      value: stats?.sessions.today ?? 0,
      sub: `${stats?.sessions.month ?? 0} החודש`,
      icon: <MessageSquare size={26} strokeWidth={2} />,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'הודעות שנשלחו היום',
      value: stats?.messages.today ?? 0,
      sub: `${stats?.messages.week ?? 0} השבוע · ${stats?.messages.month ?? 0} החודש`,
      icon: <Send size={26} strokeWidth={2} />,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'אנשי קשר',
      value: stats?.contacts ?? 0,
      icon: <Users size={26} strokeWidth={2} />,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'בוטים',
      value: stats?.bots ?? 0,
      icon: <Bot size={26} strokeWidth={2} />,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
  ];

  return (
    <section className="w-full mb-8">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">סקירה כללית</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map(card => (
          <StatCard key={card.label} {...card} loading={loading} animate={animate} />
        ))}
      </div>
    </section>
  );
};

export default DashboardStats;
