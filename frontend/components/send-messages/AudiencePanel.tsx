import React from 'react';
import { Search, Users, Layers, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AudienceTab = 'contacts' | 'groups' | 'phones';

interface ContactRecord {
  _id: string;
  phone: string;
  full_name?: string;
  whatsapp_name?: string;
  email?: string;
}

interface GroupSummary {
  _id: string;
  name: string;
  is_blocklist: boolean;
  contact_count: number;
}

interface AudiencePanelProps {
  // contacts
  contacts: ContactRecord[];
  contactsLoading: boolean;
  filteredContacts: ContactRecord[];
  selectedContactIds: Set<string>;
  toggleContact: (id: string) => void;
  toggleAllContacts: () => void;
  contactSearch: string;
  setContactSearch: (v: string) => void;
  showSelectedContactsOnly: boolean;
  setShowSelectedContactsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  // groups
  groups: GroupSummary[];
  groupsLoading: boolean;
  filteredGroups: GroupSummary[];
  selectedGroupIds: Set<string>;
  toggleGroup: (id: string) => void;
  toggleAllGroups: () => void;
  groupSearch: string;
  setGroupSearch: (v: string) => void;
  showSelectedGroupsOnly: boolean;
  setShowSelectedGroupsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  // phones
  manualPhonesText: string;
  setManualPhonesText: (v: string) => void;
  manualPhonesList: string[];
  // tabs
  audienceTab: AudienceTab;
  setAudienceTab: (tab: AudienceTab) => void;
  // preview
  previewLoading: boolean;
  previewTotal: number | null;
}

const AudiencePanel: React.FC<AudiencePanelProps> = ({
  contactsLoading, filteredContacts, selectedContactIds, toggleContact, toggleAllContacts,
  contactSearch, setContactSearch, showSelectedContactsOnly, setShowSelectedContactsOnly,
  groups, groupsLoading, filteredGroups, selectedGroupIds, toggleGroup, toggleAllGroups,
  groupSearch, setGroupSearch, showSelectedGroupsOnly, setShowSelectedGroupsOnly,
  manualPhonesText, setManualPhonesText, manualPhonesList,
  audienceTab, setAudienceTab,
  previewLoading, previewTotal,
}) => {
  const { t } = useTranslation('messages');
  const tabs: { key: AudienceTab; label: string; Icon: React.FC<{ size?: number }>; count: number }[] = [
    { key: 'contacts', label: t('audience.tabs.contacts'), Icon: Users, count: selectedContactIds.size },
    { key: 'groups',   label: t('audience.tabs.groups'),   Icon: Layers, count: selectedGroupIds.size },
    { key: 'phones',   label: t('audience.tabs.phones'), Icon: Phone, count: manualPhonesList.length },
  ];

  return (
    <div
      className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 180px)' }}
    >
      {/* ── Header + tabs ── */}
      <div className="p-5 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-lg font-black text-slate-900 mb-3">{t('audience.title')}</h2>
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setAudienceTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl font-bold text-xs transition-all ${
                audienceTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.Icon size={14} />
              {t.label}
              {t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable tab content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {audienceTab === 'contacts' && (
          <>
            <div className="p-4 border-b border-slate-100 space-y-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                <input
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder={t('audience.contacts.searchPlaceholder')}
                  className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-green-600/10 focus:border-green-600"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-green-600"
                    checked={filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.has(c._id))}
                    onChange={toggleAllContacts}
                  />
                  {t('audience.contacts.selectAll', { count: filteredContacts.length })}
                </label>
                <button
                  onClick={() => setShowSelectedContactsOnly(v => !v)}
                  className="font-bold text-green-600 hover:text-green-800"
                >
                  {showSelectedContactsOnly ? t('audience.showAll') : t('audience.contacts.showSelected')}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <div className="animate-spin w-7 h-7 border-4 border-slate-200 border-t-green-500 rounded-full" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <p className="text-center py-10 text-sm font-bold text-slate-300">{t('audience.contacts.empty')}</p>
              ) : (
                filteredContacts.map(c => (
                  <label
                    key={c._id}
                    className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl cursor-pointer transition-colors ${
                      selectedContactIds.has(c._id) ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-green-600"
                      checked={selectedContactIds.has(c._id)}
                      onChange={() => toggleContact(c._id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{c.full_name || c.phone}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.phone}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {audienceTab === 'groups' && (
          <>
            <div className="p-4 border-b border-slate-100 space-y-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                <input
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  placeholder={t('audience.groups.searchPlaceholder')}
                  className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-green-600/10 focus:border-green-600"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-green-600"
                    checked={filteredGroups.length > 0 && filteredGroups.every(g => selectedGroupIds.has(g._id))}
                    onChange={toggleAllGroups}
                  />
                  {t('audience.groups.selectAll', { count: filteredGroups.length })}
                </label>
                <button
                  onClick={() => setShowSelectedGroupsOnly(v => !v)}
                  className="font-bold text-green-600 hover:text-green-800"
                >
                  {showSelectedGroupsOnly ? t('audience.showAll') : t('audience.groups.showSelected')}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {groupsLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <div className="animate-spin w-7 h-7 border-4 border-slate-200 border-t-green-500 rounded-full" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <p className="text-center py-10 text-sm font-bold text-slate-300">{t('audience.groups.empty')}</p>
              ) : (
                filteredGroups.map(g => (
                  <label
                    key={g._id}
                    className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl cursor-pointer transition-colors ${
                      selectedGroupIds.has(g._id) ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-green-600"
                      checked={selectedGroupIds.has(g._id)}
                      onChange={() => toggleGroup(g._id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{g.name}</p>
                      <p className="text-xs text-slate-400">{t('audience.groups.contactCount', { count: g.contact_count })}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {audienceTab === 'phones' && (
          <div className="flex-1 flex flex-col p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              {t('audience.phones.instructions')}
            </p>
            <textarea
              value={manualPhonesText}
              onChange={e => setManualPhonesText(e.target.value)}
              placeholder={t('audience.phones.placeholder')}
              className="flex-1 min-h-[200px] w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-green-600/10 focus:border-green-600 resize-none font-mono"
            />
            {manualPhonesList.length > 0 && (
              <p className="mt-2 text-xs font-bold text-green-600">{t('audience.phones.entered', { count: manualPhonesList.length })}</p>
            )}
          </div>
        )}

      </div>

      {/* ── Footer: audience summary ── */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
        <p className="text-xs font-bold text-slate-600">
          {t('audience.summary', {
            groups: selectedGroupIds.size,
            contacts: selectedContactIds.size,
            phones: manualPhonesList.length,
          })}
        </p>
        <p className="text-xs font-semibold text-slate-400 mt-1">
          {previewLoading
            ? t('audience.preview.calculating')
            : previewTotal !== null
              ? t('audience.preview.total', { count: previewTotal })
              : t('audience.preview.prompt')}
        </p>
      </div>
    </div>
  );
};

export default AudiencePanel;
