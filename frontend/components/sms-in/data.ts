/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message, DestSetting, Client } from './types';

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'WIGBOX - פנאי לילדים',
    contactPerson: 'רחל גולדברג',
    phone: '052-1112233',
    email: 'info@wigbox.co.il',
    notes: 'לקוח מוביל - מנוי שנתי לחבילות SMS פרימיום',
    createdAt: '2026-01-10'
  },
  {
    id: 'c2',
    name: 'מסר חדש - הפקות',
    contactPerson: 'אהרון שלמה',
    phone: '054-9876543',
    email: 'new-meser@gmail.com',
    notes: 'משווק הודעות רוחניות ומועדי קריאת שמע',
    createdAt: '2026-02-15'
  },
  {
    id: 'c3',
    name: 'סטודיו אולימפוס',
    contactPerson: 'משה פרידמן',
    phone: '050-4445556',
    email: 'moshe@olympus.co.il',
    notes: 'עוסק בהדרכות ויחסי ציבור',
    createdAt: '2026-03-01'
  },
  {
    id: 'c4',
    name: 'פיצה דלוקס ירושלים',
    contactPerson: 'יוסי דהן',
    phone: '054-2223344',
    email: 'yossi@pizza-deluxe.co.il',
    notes: 'סניף מרכזי רחוב יפו',
    createdAt: '2026-04-18'
  }
];

export const INITIAL_DEST_SETTINGS: DestSetting[] = [];

export function normalizeDestSetting(raw: Partial<DestSetting> & { dest: string }): DestSetting {
  const hasNewFormat = 'googleSheetsUrl' in raw;
  return {
    dest: raw.dest,
    assignedClients: raw.assignedClients ?? [],
    assignedClientName: raw.assignedClientName ?? '',
    googleSheetsUrl: hasNewFormat ? (raw.googleSheetsUrl ?? '') : (raw.webhookUrl ?? ''),
    webhookUrl: hasNewFormat ? (raw.webhookUrl ?? '') : '',
    isActive: raw.isActive ?? false,
    notes: raw.notes,
  };
}
