import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Search, Check } from 'lucide-react';

export interface PaymentCountry {
  /** International dialing (calling) code prefix, digits only, e.g. "972" */
  code: string;
  /** ISO 3166-1 alpha-2 code, used to derive the flag emoji */
  iso: string;
  /** Hebrew display name */
  name: string;
}

// Converts an ISO 3166-1 alpha-2 code to its flag emoji (regional indicator symbols).
const isoToFlag = (iso: string): string =>
  iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// Full list of international dialing (calling) codes, matched to the primary
// country/territory using that code, with Hebrew display names. Used for the
// admin "קידומות מדינה מותרות לתשלום" multi-select (connected-numbers tabs).
export const PAYMENT_COUNTRIES: PaymentCountry[] = [
  { code: '1', iso: 'US', name: 'ארה"ב / קנדה' },
  { code: '7', iso: 'RU', name: 'רוסיה / קזחסטן' },
  { code: '20', iso: 'EG', name: 'מצרים' },
  { code: '27', iso: 'ZA', name: 'דרום אפריקה' },
  { code: '30', iso: 'GR', name: 'יוון' },
  { code: '31', iso: 'NL', name: 'הולנד' },
  { code: '32', iso: 'BE', name: 'בלגיה' },
  { code: '33', iso: 'FR', name: 'צרפת' },
  { code: '34', iso: 'ES', name: 'ספרד' },
  { code: '36', iso: 'HU', name: 'הונגריה' },
  { code: '39', iso: 'IT', name: 'איטליה' },
  { code: '40', iso: 'RO', name: 'רומניה' },
  { code: '41', iso: 'CH', name: 'שוויץ' },
  { code: '43', iso: 'AT', name: 'אוסטריה' },
  { code: '44', iso: 'GB', name: 'בריטניה' },
  { code: '45', iso: 'DK', name: 'דנמרק' },
  { code: '46', iso: 'SE', name: 'שוודיה' },
  { code: '47', iso: 'NO', name: 'נורווגיה' },
  { code: '48', iso: 'PL', name: 'פולין' },
  { code: '49', iso: 'DE', name: 'גרמניה' },
  { code: '51', iso: 'PE', name: 'פרו' },
  { code: '52', iso: 'MX', name: 'מקסיקו' },
  { code: '53', iso: 'CU', name: 'קובה' },
  { code: '54', iso: 'AR', name: 'ארגנטינה' },
  { code: '55', iso: 'BR', name: 'ברזיל' },
  { code: '56', iso: 'CL', name: 'צ\'ילה' },
  { code: '57', iso: 'CO', name: 'קולומביה' },
  { code: '58', iso: 'VE', name: 'ונצואלה' },
  { code: '60', iso: 'MY', name: 'מלזיה' },
  { code: '61', iso: 'AU', name: 'אוסטרליה' },
  { code: '62', iso: 'ID', name: 'אינדונזיה' },
  { code: '63', iso: 'PH', name: 'פיליפינים' },
  { code: '64', iso: 'NZ', name: 'ניו זילנד' },
  { code: '65', iso: 'SG', name: 'סינגפור' },
  { code: '66', iso: 'TH', name: 'תאילנד' },
  { code: '81', iso: 'JP', name: 'יפן' },
  { code: '82', iso: 'KR', name: 'דרום קוריאה' },
  { code: '84', iso: 'VN', name: 'וייטנאם' },
  { code: '86', iso: 'CN', name: 'סין' },
  { code: '90', iso: 'TR', name: 'טורקיה' },
  { code: '91', iso: 'IN', name: 'הודו' },
  { code: '92', iso: 'PK', name: 'פקיסטן' },
  { code: '93', iso: 'AF', name: 'אפגניסטן' },
  { code: '94', iso: 'LK', name: 'סרי לנקה' },
  { code: '95', iso: 'MM', name: 'מיאנמר' },
  { code: '98', iso: 'IR', name: 'איראן' },
  { code: '211', iso: 'SS', name: 'דרום סודן' },
  { code: '212', iso: 'MA', name: 'מרוקו' },
  { code: '213', iso: 'DZ', name: 'אלג\'יריה' },
  { code: '216', iso: 'TN', name: 'תוניסיה' },
  { code: '218', iso: 'LY', name: 'לוב' },
  { code: '220', iso: 'GM', name: 'גמביה' },
  { code: '221', iso: 'SN', name: 'סנגל' },
  { code: '222', iso: 'MR', name: 'מאוריטניה' },
  { code: '223', iso: 'ML', name: 'מאלי' },
  { code: '224', iso: 'GN', name: 'גינאה' },
  { code: '225', iso: 'CI', name: 'חוף השנהב' },
  { code: '226', iso: 'BF', name: 'בורקינה פאסו' },
  { code: '227', iso: 'NE', name: 'ניז\'ר' },
  { code: '228', iso: 'TG', name: 'טוגו' },
  { code: '229', iso: 'BJ', name: 'בנין' },
  { code: '230', iso: 'MU', name: 'מאוריציוס' },
  { code: '231', iso: 'LR', name: 'ליבריה' },
  { code: '232', iso: 'SL', name: 'סיירה לאון' },
  { code: '233', iso: 'GH', name: 'גאנה' },
  { code: '234', iso: 'NG', name: 'ניגריה' },
  { code: '235', iso: 'TD', name: 'צ\'אד' },
  { code: '236', iso: 'CF', name: 'הרפובליקה המרכז אפריקאית' },
  { code: '237', iso: 'CM', name: 'קמרון' },
  { code: '238', iso: 'CV', name: 'כף ורדה' },
  { code: '239', iso: 'ST', name: 'סאו טומה ופרינסיפה' },
  { code: '240', iso: 'GQ', name: 'גינאה המשוונית' },
  { code: '241', iso: 'GA', name: 'גבון' },
  { code: '242', iso: 'CG', name: 'קונגו (ברזאויל)' },
  { code: '243', iso: 'CD', name: 'קונגו (קינשאסה)' },
  { code: '244', iso: 'AO', name: 'אנגולה' },
  { code: '245', iso: 'GW', name: 'גינאה ביסאו' },
  { code: '248', iso: 'SC', name: 'איי סיישל' },
  { code: '249', iso: 'SD', name: 'סודן' },
  { code: '250', iso: 'RW', name: 'רואנדה' },
  { code: '251', iso: 'ET', name: 'אתיופיה' },
  { code: '252', iso: 'SO', name: 'סומליה' },
  { code: '253', iso: 'DJ', name: 'ג\'יבוטי' },
  { code: '254', iso: 'KE', name: 'קניה' },
  { code: '255', iso: 'TZ', name: 'טנזניה' },
  { code: '256', iso: 'UG', name: 'אוגנדה' },
  { code: '257', iso: 'BI', name: 'בורונדי' },
  { code: '258', iso: 'MZ', name: 'מוזמביק' },
  { code: '260', iso: 'ZM', name: 'זמביה' },
  { code: '261', iso: 'MG', name: 'מדגסקר' },
  { code: '263', iso: 'ZW', name: 'זימבבואה' },
  { code: '264', iso: 'NA', name: 'נמיביה' },
  { code: '265', iso: 'MW', name: 'מלאווי' },
  { code: '266', iso: 'LS', name: 'לסוטו' },
  { code: '267', iso: 'BW', name: 'בוצואנה' },
  { code: '268', iso: 'SZ', name: 'אסוואטיני' },
  { code: '269', iso: 'KM', name: 'קומורו' },
  { code: '291', iso: 'ER', name: 'אריתריאה' },
  { code: '297', iso: 'AW', name: 'ארובה' },
  { code: '298', iso: 'FO', name: 'איי פארו' },
  { code: '299', iso: 'GL', name: 'גרינלנד' },
  { code: '350', iso: 'GI', name: 'גיברלטר' },
  { code: '351', iso: 'PT', name: 'פורטוגל' },
  { code: '352', iso: 'LU', name: 'לוקסמבורג' },
  { code: '353', iso: 'IE', name: 'אירלנד' },
  { code: '354', iso: 'IS', name: 'איסלנד' },
  { code: '355', iso: 'AL', name: 'אלבניה' },
  { code: '356', iso: 'MT', name: 'מלטה' },
  { code: '357', iso: 'CY', name: 'קפריסין' },
  { code: '358', iso: 'FI', name: 'פינלנד' },
  { code: '359', iso: 'BG', name: 'בולגריה' },
  { code: '370', iso: 'LT', name: 'ליטא' },
  { code: '371', iso: 'LV', name: 'לטביה' },
  { code: '372', iso: 'EE', name: 'אסטוניה' },
  { code: '373', iso: 'MD', name: 'מולדובה' },
  { code: '374', iso: 'AM', name: 'ארמניה' },
  { code: '375', iso: 'BY', name: 'בלארוס' },
  { code: '376', iso: 'AD', name: 'אנדורה' },
  { code: '377', iso: 'MC', name: 'מונקו' },
  { code: '378', iso: 'SM', name: 'סן מרינו' },
  { code: '380', iso: 'UA', name: 'אוקראינה' },
  { code: '381', iso: 'RS', name: 'סרביה' },
  { code: '382', iso: 'ME', name: 'מונטנגרו' },
  { code: '383', iso: 'XK', name: 'קוסובו' },
  { code: '385', iso: 'HR', name: 'קרואטיה' },
  { code: '386', iso: 'SI', name: 'סלובניה' },
  { code: '387', iso: 'BA', name: 'בוסניה והרצגובינה' },
  { code: '389', iso: 'MK', name: 'מקדוניה הצפונית' },
  { code: '420', iso: 'CZ', name: 'צ\'כיה' },
  { code: '421', iso: 'SK', name: 'סלובקיה' },
  { code: '423', iso: 'LI', name: 'ליכטנשטיין' },
  { code: '500', iso: 'FK', name: 'איי פוקלנד' },
  { code: '501', iso: 'BZ', name: 'בליז' },
  { code: '502', iso: 'GT', name: 'גואטמלה' },
  { code: '503', iso: 'SV', name: 'אל סלוודור' },
  { code: '504', iso: 'HN', name: 'הונדורס' },
  { code: '505', iso: 'NI', name: 'ניקרגואה' },
  { code: '506', iso: 'CR', name: 'קוסטה ריקה' },
  { code: '507', iso: 'PA', name: 'פנמה' },
  { code: '509', iso: 'HT', name: 'האיטי' },
  { code: '590', iso: 'GP', name: 'גוואדלופ' },
  { code: '591', iso: 'BO', name: 'בוליביה' },
  { code: '592', iso: 'GY', name: 'גיאנה' },
  { code: '593', iso: 'EC', name: 'אקוודור' },
  { code: '594', iso: 'GF', name: 'גיאנה הצרפתית' },
  { code: '595', iso: 'PY', name: 'פרגוואי' },
  { code: '596', iso: 'MQ', name: 'מרטיניק' },
  { code: '597', iso: 'SR', name: 'סורינאם' },
  { code: '598', iso: 'UY', name: 'אורוגוואי' },
  { code: '599', iso: 'CW', name: 'קוראסאו' },
  { code: '670', iso: 'TL', name: 'טימור-לסטה' },
  { code: '673', iso: 'BN', name: 'ברוניי' },
  { code: '674', iso: 'NR', name: 'נאורו' },
  { code: '675', iso: 'PG', name: 'פפואה גינאה החדשה' },
  { code: '676', iso: 'TO', name: 'טונגה' },
  { code: '677', iso: 'SB', name: 'איי שלמה' },
  { code: '678', iso: 'VU', name: 'ונואטו' },
  { code: '679', iso: 'FJ', name: 'פיג\'י' },
  { code: '680', iso: 'PW', name: 'פלאו' },
  { code: '681', iso: 'WF', name: 'ואליס ופוטונה' },
  { code: '682', iso: 'CK', name: 'איי קוק' },
  { code: '685', iso: 'WS', name: 'סמואה' },
  { code: '686', iso: 'KI', name: 'קיריבטי' },
  { code: '687', iso: 'NC', name: 'קלדוניה החדשה' },
  { code: '688', iso: 'TV', name: 'טובאלו' },
  { code: '689', iso: 'PF', name: 'פולינזיה הצרפתית' },
  { code: '690', iso: 'TK', name: 'טוקלאו' },
  { code: '691', iso: 'FM', name: 'מיקרונזיה' },
  { code: '692', iso: 'MH', name: 'איי מרשל' },
  { code: '850', iso: 'KP', name: 'צפון קוריאה' },
  { code: '852', iso: 'HK', name: 'הונג קונג' },
  { code: '853', iso: 'MO', name: 'מקאו' },
  { code: '855', iso: 'KH', name: 'קמבודיה' },
  { code: '856', iso: 'LA', name: 'לאוס' },
  { code: '880', iso: 'BD', name: 'בנגלדש' },
  { code: '886', iso: 'TW', name: 'טייוואן' },
  { code: '960', iso: 'MV', name: 'האיים המלדיביים' },
  { code: '961', iso: 'LB', name: 'לבנון' },
  { code: '962', iso: 'JO', name: 'ירדן' },
  { code: '963', iso: 'SY', name: 'סוריה' },
  { code: '964', iso: 'IQ', name: 'עיראק' },
  { code: '965', iso: 'KW', name: 'כווית' },
  { code: '966', iso: 'SA', name: 'ערב הסעודית' },
  { code: '967', iso: 'YE', name: 'תימן' },
  { code: '970', iso: 'PS', name: 'פלסטין' },
  { code: '971', iso: 'AE', name: 'איחוד האמירויות' },
  { code: '972', iso: 'IL', name: 'ישראל' },
  { code: '973', iso: 'BH', name: 'בחריין' },
  { code: '974', iso: 'QA', name: 'קטאר' },
  { code: '975', iso: 'BT', name: 'בהוטן' },
  { code: '976', iso: 'MN', name: 'מונגוליה' },
  { code: '977', iso: 'NP', name: 'נפאל' },
  { code: '992', iso: 'TJ', name: 'טג\'יקיסטן' },
  { code: '993', iso: 'TM', name: 'טורקמניסטן' },
  { code: '994', iso: 'AZ', name: 'אזרבייג\'ן' },
  { code: '995', iso: 'GE', name: 'גאורגיה' },
  { code: '996', iso: 'KG', name: 'קירגיזסטן' },
  { code: '998', iso: 'UZ', name: 'אוזבקיסטן' }
];

interface PaymentCountriesSelectProps {
  /** Currently-selected dial-code prefixes, e.g. ["972", "1"] */
  selected: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

/**
 * Searchable multi-select for international dialing-code prefixes, rendered as
 * removable chips + a dropdown with a search box. Used by the admin
 * "קידומות מדינה מותרות לתשלום" control on the connected-numbers tabs.
 */
const PaymentCountriesSelect: React.FC<PaymentCountriesSelectProps> = ({ selected, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const addCode = (code: string) => {
    if (!selected.includes(code)) onChange([...selected, code]);
  };
  const removeCode = (code: string) => onChange(selected.filter(c => c !== code));

  const q = query.trim().toLowerCase();
  const filtered = PAYMENT_COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.code.includes(q));

  return (
    <div className="relative inline-flex flex-wrap items-center gap-1.5" ref={containerRef}>
      {selected.map(code => {
        const country = PAYMENT_COUNTRIES.find(c => c.code === code);
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg ps-2 pe-1.5 py-1 text-[11px] font-bold"
          >
            <span>{country ? isoToFlag(country.iso) : '🏳️'}</span>
            <span>{country ? country.name : code} ({code})</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="p-0.5 rounded-full hover:bg-blue-200/70 text-blue-500 hover:text-blue-800 transition-colors"
                aria-label={`הסר ${country?.name || code}`}
              >
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}

      {!disabled && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus size={12} /> הוסף מדינה
        </button>
      )}

      {open && (
        <div className="absolute top-full start-0 z-30 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search size={14} className="text-slate-300 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש לפי מדינה או קידומת..."
              className="w-full text-xs focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">לא נמצאו תוצאות</div>
            ) : filtered.map(c => {
              const isSelected = selected.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => (isSelected ? removeCode(c.code) : addCode(c.code))}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-start hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/70 font-bold text-blue-700' : 'text-slate-600'}`}
                >
                  <span>{isoToFlag(c.iso)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-slate-400" dir="ltr">+{c.code}</span>
                  {isSelected && <Check size={13} className="text-blue-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCountriesSelect;
