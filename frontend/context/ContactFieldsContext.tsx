import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ContactFieldDef } from '../types';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

interface ContactFieldsContextValue {
  fields: ContactFieldDef[];
  loading: boolean;
  reload: () => void;
}

const ContactFieldsContext = createContext<ContactFieldsContextValue>({
  fields: [],
  loading: false,
  reload: () => {},
});

export const ContactFieldsProvider: React.FC<{ token: string | null; children: React.ReactNode }> = ({ token, children }) => {
  const [fields, setFields] = useState<ContactFieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const reload = useCallback(async () => {
    if (!tokenRef.current) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contact-fields`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFields(data);
      }
    } catch (e) {
      console.error('Failed to load contact fields', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) reload();
    else setFields([]);
  }, [token, reload]);

  return (
    <ContactFieldsContext.Provider value={{ fields, loading, reload }}>
      {children}
    </ContactFieldsContext.Provider>
  );
};

export const useContactFields = () => useContext(ContactFieldsContext);
