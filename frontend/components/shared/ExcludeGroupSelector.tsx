import React from 'react';

interface GroupOption {
  _id: string;
  name: string;
  contact_count: number;
}

interface ExcludeGroupSelectorProps {
  groups: GroupOption[];
  excludeGroupId: string;
  setExcludeGroupId: (id: string) => void;
  className?: string;
}

/**
 * Shared "exclude a distribution list from this broadcast" control.
 * Used by both GroupsPage (send-to-group modal) and SendMessagesPage
 * (custom multi-source audience) so the logic/UI only lives in one place.
 */
const ExcludeGroupSelector: React.FC<ExcludeGroupSelectorProps> = ({
  groups, excludeGroupId, setExcludeGroupId, className,
}) => {
  if (groups.length === 0) return null;

  return (
    <div className={`p-4 bg-orange-50 border border-orange-200 rounded-2xl ${className || ''}`}>
      <label className="text-xs font-black text-orange-700 mb-2 block">החרגת קבוצה (אופציונלי):</label>
      <select
        value={excludeGroupId}
        onChange={e => setExcludeGroupId(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm outline-none focus:border-orange-500"
      >
        <option value="">ללא החרגה — שלח לכולם</option>
        {groups.map(g => (
          <option key={g._id} value={g._id}>{g.name} ({g.contact_count} אנשי קשר)</option>
        ))}
      </select>
      {excludeGroupId && (
        <p className="text-xs text-orange-600 font-semibold mt-2">
          ⛔ אנשי קשר שנמצאים ב-&quot;{groups.find(g => g._id === excludeGroupId)?.name}&quot; לא יקבלו את ההודעה.
        </p>
      )}
    </div>
  );
};

export default ExcludeGroupSelector;
