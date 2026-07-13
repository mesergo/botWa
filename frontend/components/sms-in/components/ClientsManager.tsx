/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Client } from '../types';
import { Plus, Trash2, Edit2, Check, X, ShieldAlert, Building, Mail, Phone, Calendar, User, Bot, Loader2 } from 'lucide-react';

interface ClientsManagerProps {
  clients: Client[];
  onAdd: (client: Client) => void;
  onDelete: (id: string) => void;
  onUpdate: (client: Client) => void;
  /** When true, clients come from MongoDB User accounts — view only */
  readOnly?: boolean;
  loading?: boolean;
}

export default function ClientsManager({
  clients,
  onAdd,
  onDelete,
  onUpdate,
  readOnly = false,
  loading = false,
}: ClientsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Edit states
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || readOnly) return;

    const newClient: Client = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      contactPerson: contactPerson.trim() || 'לא צוין',
      phone: phone.trim() || 'לא צוין',
      email: email.trim() || 'לא צוין',
      notes: notes.trim(),
      createdAt: new Date().toISOString().split('T')[0]
    };

    onAdd(newClient);
    resetForm();
    setShowAddForm(false);
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setNotes('');
  };

  const startEdit = (client: Client) => {
    if (readOnly) return;
    setEditingId(client.id);
    setEditName(client.name);
    setEditContact(client.contactPerson);
    setEditPhone(client.phone);
    setEditEmail(client.email);
    setEditNotes(client.notes || '');
  };

  const saveEdit = (id: string) => {
    if (!editName.trim() || readOnly) return;
    onUpdate({
      id,
      name: editName.trim(),
      contactPerson: editContact.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      notes: editNotes.trim(),
      createdAt: clients.find(c => c.id === id)?.createdAt || new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Overview Head */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">ניהול לקוחות קצה</h2>
          <p className="text-sm text-slate-500 mt-1">
            {readOnly
              ? 'לקוחות מחשבונות המערכת (MongoDB). שיוך קווי SMS ללקוחות אלו בלשונית "שיוך קווים".'
              : 'נהל את משתמשי הקצה של ה-SMS. לקוחות אלו ישוייכו לקווי ה-dest לקבלת ניתובים.'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            {showAddForm ? <X size={15} /> : <Plus size={15} />}
            <span>{showAddForm ? 'סגור טופס' : 'הוסף לקוח חדש'}</span>
          </button>
        )}
      </div>

      {/* Add Form Container */}
      {!readOnly && showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-indigo-100 rounded-xl p-5 shadow-xs space-y-4 max-w-2xl">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-2 mb-2">פרטי לקוח חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">שם חברה / לקוח <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="לדוגמה: פיצה דלוקס, WIGBOX..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">איש קשר</label>
              <input
                type="text"
                placeholder="שם איש קשר..."
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">טלפון ליצירת קשר</label>
              <input
                type="text"
                placeholder="05x-xxxxxxx..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">אימייל</label>
              <input
                type="email"
                placeholder="email@example.com..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white text-left"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">הערות ותיאור הלקוח</label>
            <textarea
              placeholder="רשום פרטים רלוונטיים על הלקוח, הגבלות, שימוש וכדומה..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2.5 text-xs pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              איפוס
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-xs hover:shadow-md transition-colors cursor-pointer"
            >
              שמור לקוח
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="animate-spin" size={22} />
          <span className="text-sm font-medium">טוען לקוחות מ-MongoDB...</span>
        </div>
      )}

      {/* Clients list Cards / Table */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => {
            const isEditing = !readOnly && editingId === client.id;
            return (
              <div
                key={client.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-sky-400 hover:shadow-sm transition-all"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-bold text-sky-600">עריכת לקוח</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveEdit(client.id)}
                          className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded cursor-pointer"
                          title="שמור"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer"
                          title="ביטול"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">שם לקוח</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">איש קשר</label>
                        <input
                          type="text"
                          value={editContact}
                          onChange={(e) => setEditContact(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">טלפון</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">אימייל</label>
                          <input
                            type="text"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">הערות</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={1}
                          className="w-full text-xs border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-slate-100 text-slate-600 rounded shrink-0">
                            <Building size={16} />
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{client.name}</h4>
                        </div>

                        {!readOnly && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(client)}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded transition-colors cursor-pointer"
                              title="ערוך לקוח"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => onDelete(client.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="מחק לקוח"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                        {readOnly && client.status && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            client.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {client.status === 'active' ? 'פעיל' : client.status}
                          </span>
                        )}
                      </div>

                      <div className="mt-3.5 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User size={13} className="text-slate-400" />
                          <span>איש קשר: <span className="font-medium text-slate-800">{client.contactPerson}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone size={13} className="text-slate-400" />
                          <span>טלפון: <span className="font-mono text-slate-800">{client.phone}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail size={13} className="text-slate-400" />
                          <span>אימייל: <span className="font-mono text-slate-800 text-left" dir="ltr">{client.email}</span></span>
                        </div>
                        {typeof client.botCount === 'number' && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Bot size={13} className="text-slate-400" />
                            <span>בוטים: <span className="font-medium text-slate-800">{client.botCount}</span></span>
                          </div>
                        )}

                        {client.notes && (
                          <p className="mt-2.5 p-2 bg-slate-50 border border-slate-100/80 rounded text-slate-500 leading-relaxed text-[11px]">
                            {client.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {client.createdAt ? `נוצר ב-${client.createdAt}` : '—'}
                      </span>
                      <span className="font-mono text-[9px] text-slate-300 truncate max-w-[40%]" title={client.id}>
                        ID: {client.id}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {clients.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
              <ShieldAlert className="mx-auto text-slate-300 mb-2" size={36} />
              <p className="text-sm font-semibold">לא נמצאו לקוחות.</p>
              <p className="text-xs text-slate-400 mt-1">
                {readOnly
                  ? 'אין חשבונות משתמשים במערכת, או שאין הרשאת אדמין לטעינה.'
                  : 'לחץ על הכפתור "הוסף לקוח חדש" בצד שמאל למעלה כדי להתחיל.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
