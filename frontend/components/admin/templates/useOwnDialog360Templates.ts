import { useState } from 'react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface UseOwnDialog360TemplatesOptions {
  token: string | null;
  onSuccess: () => void;
}

// Self-service equivalent of useAdminCustomerTemplates: lets the logged-in customer
// add/edit/duplicate/delete their OWN WhatsApp message templates (Dashboard Settings →
// הודעות תבנית → תבניות WhatsApp), gated server-side by `wa_templates_manage_enabled`.
// On success, calls back into `onSuccess()` so the caller can re-fetch the templates list.
export const useOwnDialog360Templates = ({ token, onSuccess }: UseOwnDialog360TemplatesOptions) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (action: 'add' | 'edit' | 'delete', body: any) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/dialog360-templates/${action}`, {
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
      onSuccess();
      return true;
    } catch (err) {
      setError('שגיאת רשת בביצוע הפעולה');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = (payload: { name: string; category: string; language: string; components: any[] }) =>
    call('add', payload);

  const editTemplate = (payload: { template_id: string; category: string; components: any[] }) =>
    call('edit', payload);

  const deleteTemplate = (name: string) =>
    call('delete', { name });

  return { saving, error, setError, addTemplate, editTemplate, deleteTemplate };
};
