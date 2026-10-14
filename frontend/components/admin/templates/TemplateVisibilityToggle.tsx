import React from 'react';
import { EyeOff, UserCheck, Headphones } from 'lucide-react';

export type TemplateVisibility = 'hidden' | 'manager' | 'agent';

// Cycle order: hidden -> manager -> agent -> hidden
export const nextTemplateVisibility = (current: TemplateVisibility): TemplateVisibility =>
  ({ hidden: 'manager', manager: 'agent', agent: 'hidden' } as const)[current];

interface TemplateVisibilityToggleProps {
  value?: TemplateVisibility; 
  onChange: () => void;
  labels?: Partial<Record<TemplateVisibility, string>>;
}

const DEFAULT_LABELS: Record<TemplateVisibility, string> = {
  hidden: 'מוסתר לכולם — לחץ כדי לשנות',
  manager: 'מוצג למנהל משמרת — לחץ כדי לשנות',
  agent: 'מוצג גם לנציגים — לחץ כדי לשנות',
};

const TemplateVisibilityToggle: React.FC<TemplateVisibilityToggleProps> = ({ value = 'manager', onChange, labels }) => {
  const cfg = {
    hidden:  { icon: <EyeOff size={16} />,     cls: 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600' },
    manager: { icon: <UserCheck size={16} />,  cls: 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' },
    agent:   { icon: <Headphones size={16} />, cls: 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' },
  }[value];

  return (
    <button
      type="button"
      onClick={onChange}
      className={`p-2 rounded-lg transition-colors border ${cfg.cls}`}
      title={labels?.[value] ?? DEFAULT_LABELS[value]}
    >
      {cfg.icon}
    </button>
  );
};

export default TemplateVisibilityToggle;
