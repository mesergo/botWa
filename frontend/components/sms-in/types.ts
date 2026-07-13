/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id_: string;
  dest: string;      // The receiver gateway number (e.g., "972559379631")
  phone: string;     // The sender designation/number (e.g., "testtest", "0557707702", "WIGBOX")
  date: string;      // Formatted date (e.g., "14:03:54 08/03/26" or ISO)
  message: string;   // The SMS body
}

export interface DestSetting {
  dest: string;
  /** Stable MongoDB user ids assigned to this dest line */
  assignedClients: string[];
  /** Denormalized display name for the assigned customer */
  assignedClientName?: string;
  googleSheetsUrl: string;  // Google Sheets Apps Script URL — all messages routed here
  webhookUrl: string;       // Optional generic webhook URL (can also point to Google Sheets)
  isActive: boolean;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes?: string;
  createdAt: string;
  /** Present when loaded from MongoDB User accounts */
  botCount?: number;
  accountType?: string | null;
  status?: string | null;
  role?: string | null;
}

export interface User {
  username: string;
  role: 'admin' | 'viewer';
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  dest: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
  response?: string;
}
