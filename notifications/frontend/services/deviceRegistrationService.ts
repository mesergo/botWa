/**
 * Device registration service — sends FID + bot-line prefs to backend.
 * Never sends userId / tenantId.
 */

import type { BotLineOption, RegisterDeviceRequest } from '../types';

export interface DeviceRegistrationServiceOptions {
  apiBaseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

async function authHeaders(getAccessToken: DeviceRegistrationServiceOptions['getAccessToken']): Promise<HeadersInit> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function createDeviceRegistrationService(options: DeviceRegistrationServiceOptions) {
  const fetchImpl = options.fetchImpl || fetch;
  const base = options.apiBaseUrl.replace(/\/$/, '');

  return {
    async listBotLines(): Promise<BotLineOption[]> {
      const res = await fetchImpl(`${base}/bot-lines`, {
        method: 'GET',
        headers: await authHeaders(options.getAccessToken),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`List bot lines failed (${res.status}): ${text || res.statusText}`);
      }
      const data = await res.json();
      return Array.isArray(data.botLines) ? data.botLines : [];
    },

    async register(body: RegisterDeviceRequest): Promise<{ success: boolean; registration?: unknown }> {
      const res = await fetchImpl(`${base}/registrations`, {
        method: 'POST',
        headers: await authHeaders(options.getAccessToken),
        body: JSON.stringify({
          fid: body.fid,
          userAgent: body.userAgent,
          platform: body.platform || 'web',
          allBotLines: body.allBotLines !== false,
          botLineIds: body.botLineIds || [],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Device register failed (${res.status}): ${text || res.statusText}`);
      }
      return res.json();
    },

    async unregister(fid: string): Promise<{ success: boolean; deactivated?: boolean }> {
      const res = await fetchImpl(`${base}/registrations/${encodeURIComponent(fid)}`, {
        method: 'DELETE',
        headers: await authHeaders(options.getAccessToken),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Device unregister failed (${res.status}): ${text || res.statusText}`);
      }
      return res.json();
    },

    async sendTest(): Promise<{ success: boolean; reason?: string; sentCount?: number }> {
      const res = await fetchImpl(`${base}/test`, {
        method: 'POST',
        headers: await authHeaders(options.getAccessToken),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Test push failed (${res.status}): ${text || res.statusText}`);
      }
      return res.json();
    },
  };
}

export type DeviceRegistrationService = ReturnType<typeof createDeviceRegistrationService>;
