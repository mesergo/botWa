/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DestSetting, Client } from './types';

export const INITIAL_CLIENTS: Client[] = [];

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
