import { useState } from 'react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface UseAdminCustomerTemplatesOptions {
  token: string | null;
  onSuccess: (userId: string) => void;
}

// Encapsulates the add/edit/delete write actions for a customer's Dialog360 WhatsApp
// templates (admin acting on the customer's behalf). On success, calls back into
// `onSuccess(userId)` so the caller can re-fetch the read-only templates list.
export const useAdminCustomerTemplates = ({ token, onSuccess }: UseAdminCustomerTemplatesOptions) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (userId: string, action: 'add' | 'edit' | 'delete', body: any) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/dialog360-templates/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setError(data.error || 'שגיאה בביצוע הפעולה');
        return false;
      }
      onSuccess(userId);
      return true;
    } catch (err) {
      setError('שגיאת רשת בביצוע הפעולה');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = (userId: string, payload: { name: string; category: string; language: string; components: any[] }) =>
    call(userId, 'add', payload);

  const editTemplate = (userId: string, payload: { template_id: string; category: string; components: any[] }) =>
    call(userId, 'edit', payload);

  const deleteTemplate = (userId: string, name: string) =>
    call(userId, 'delete', { name });

  return { saving, error, setError, addTemplate, editTemplate, deleteTemplate };
};
