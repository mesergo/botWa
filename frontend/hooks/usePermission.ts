import { useCallback } from 'react';
import { User, UserTypePermissions } from '../types';

/**
 * Returns a permission-check function for the current user.
 * Usage:  const can = usePermission(currentUser);
 *         {can('bots.create') && <button>צור בוט</button>}
 *
 * Falls back gracefully when permissions object is absent
 * (e.g. admin / user loaded from an old session without permissions).
 */
export function usePermission(currentUser: User | null) {
  const check = useCallback((key: string): boolean => {
    if (!currentUser) return false;
  
    const perms = currentUser.permissions as UserTypePermissions | undefined;
    if (!perms) {
      // Fallback: derive from role for backward-compat
      return roleDefaultCheck(currentUser.role, key);
    }
    const [section, action] = key.split('.');
    const sectionPerms = (perms as any)?.[section];
    // If a newer permission section is missing from an older UserType doc, fall back to role defaults
    if (sectionPerms == null) {
      return roleDefaultCheck(currentUser.role, key);
    }
    return !!sectionPerms?.[action];
  }, [currentUser]);

  return check;
}

function roleDefaultCheck(role: string | undefined, key: string): boolean {
  // admin has all permissions — fallback for old sessions without a permissions object
  if (role === 'admin') return true;
  const managerKeys = [
    'bots.view_tab','bots.create','bots.edit','bots.delete','bots.settings','bots.publish',
    'sessions.view','sessions.add','sessions.view_all','sessions.templates_as_manager',
    'contacts.view','contacts.add','contacts.edit','contacts.delete','contacts.import_excel',
    'groups.view','groups.create','groups.add_contact','groups.send_message','groups.remove_contact',
    // 'sms_in.view' intentionally excluded: shown only per-user via the admin checkbox (User.sms_in_enabled)
    'settings.view','settings.edit_profile',
    'users.view','users.add','users.edit','users.delete',
    'rep_groups.view','rep_groups.add','rep_groups.delete'
  ];
  const repManagerKeys = [
    'sessions.view','sessions.add','sessions.view_all','sessions.templates_as_manager',
    'contacts.view','contacts.add','contacts.edit',
    'groups.view','groups.send_message',
    'settings.view','settings.edit_profile'
  ];
  const repKeys = [
    'sessions.view','sessions.view_assigned_only','sessions.templates_as_rep',
    'contacts.view',
    'groups.view',
    'settings.view','settings.edit_profile'
  ];
  if (role === 'user')        return managerKeys.includes(key);
  if (role === 'rep_manager') return repManagerKeys.includes(key);
  if (role === 'rep')         return repKeys.includes(key);
  return false;
}
