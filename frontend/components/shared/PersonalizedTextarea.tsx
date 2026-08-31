import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { STD_FIELDS } from '../TemplateBodyParamsEditor';
import { useTranslation } from 'react-i18next';

interface ContactField {
  _id: string;
  label: string;
}

interface PersonalizedTextareaProps {
  value: string;
  onChange: (v: string) => void;
  contactFields: ContactField[];
  rows?: number;
  placeholder?: string;
  className?: string;
}

interface TokenDef {
  token: string;   // literal key used inside `$token$`
  label: string;
}

// Build the full list of insertable fields: standard fields + the user's custom contact
// fields, each carrying the literal `$token$` key that gets embedded in the message text.
const buildTokenDefs = (contactFields: ContactField[]): TokenDef[] => [
  ...STD_FIELDS.map(f => ({ token: f.token, label: f.label })),
  ...contactFields.map(f => ({ token: `field_${f._id}`, label: f.label })),
];

/**
 * Free-text textarea that lets the user type "#" to open a small menu of contact fields
 * (name, phone, email, custom fields...) and insert a `$token$` personalization
 * placeholder at the cursor (e.g. `$name$`, `$email$`, `$field_<id>$`). Multiple DIFFERENT
 * fields can be inserted into the same message — each keeps its own distinct token, so
 * e.g. `$name$` and `$email$` can both appear and each resolves to that recipient's own
 * value. The backend scans the message for these tokens and resolves them per-recipient
 * (session history) and/or forwards them to the external broadcast API so each token is
 * replaced with that field's value for each phone number.
 */
const PersonalizedTextarea: React.FC<PersonalizedTextareaProps> = ({
  value, onChange, contactFields, rows = 6, placeholder, className,
}) => {
  const { t } = useTranslation('builder');
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const hashPosRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tokenDefs = useMemo(() => buildTokenDefs(contactFields), [contactFields]);

  // Which of the known tokens are actually referenced in the current text right now —
  // shown as small removable badges so the user can see/undo what's been inserted.
  const usedTokens = useMemo(
    () => tokenDefs.filter(t => value.includes(`$${t.token}$`)),
    [tokenDefs, value]
  );

  useLayoutEffect(() => {
    if (!menuOpen || !textareaRef.current) return;
    const rect = textareaRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        textareaRef.current && !textareaRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '#') {
      const pos = textareaRef.current?.selectionStart ?? value.length;
      hashPosRef.current = pos - 1;
      setMenuOpen(true);
    } else if (e.key === 'Escape') {
      setMenuOpen(false);
    }
  };

  const insertToken = (tokenKey: string) => {
    const pos = hashPosRef.current ?? value.length;
    const before = value.slice(0, pos);
    const charAtPos = value[pos];
    const after = charAtPos === '#' ? value.slice(pos + 1) : value.slice(pos);
    const token = `$${tokenKey}$`;
    const newValue = `${before}${token}${after}`;
    onChange(newValue);
    setMenuOpen(false);
    const newCaret = before.length + token.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  const removeToken = (tokenKey: string) => {
    onChange(value.split(`$${tokenKey}$`).join(''));
  };

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyUp={handleKeyUp}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
        <p className="text-[11px] text-slate-400 font-semibold">
          {t('personalizedTextarea.hint')}
        </p>
        {usedTokens.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {usedTokens.map(t => (
              <button
                key={t.token}
                type="button"
                onClick={() => removeToken(t.token)}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold hover:bg-indigo-100 transition-colors flex-shrink-0"
                title={t('personalizedTextarea.removeParameter')}
              >
                {t.label} <X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
      {menuOpen && position && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: position.top, left: position.left }}
          className="bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 min-w-[180px] max-h-64 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-[11px] font-black text-slate-400">{t('personalizedTextarea.chooseParameter')}</div>
          {STD_FIELDS.map(f => (
            <button
              key={f.token}
              type="button"
              onClick={() => insertToken(f.token)}
              className="w-full text-start px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              {f.label}
            </button>
          ))}
          {contactFields.length > 0 && (
            <>
              <div className="px-3 py-1.5 mt-1 border-t border-slate-100 text-[11px] font-black text-slate-400">{t('personalizedTextarea.customFields')}</div>
              {contactFields.map(f => (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => insertToken(`field_${f._id}`)}
                  className="w-full text-start px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  {f.label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PersonalizedTextarea;

