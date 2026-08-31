/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WebhookLog } from '../types';
import { Copy, Check, Terminal, ExternalLink, HelpCircle, ArrowLeft, Trash2, Send } from 'lucide-react';
import { GOOGLE_SHEETS_APPS_SCRIPT } from '../googleSheetsScript';
import { Trans, useTranslation } from 'react-i18next';

interface WebhookSimulatorProps {
  logs: WebhookLog[];
  onClearLogs: () => void;
  defaultWebhookUrl: string;
}

export default function WebhookSimulator({ logs, onClearLogs, defaultWebhookUrl }: WebhookSimulatorProps) {
  const { t } = useTranslation('smsIn');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_SHEETS_APPS_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-start">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900">{t('webhook.title')}</h2>
        <p className="text-sm text-slate-400 font-semibold mt-0.5">{t('webhook.subtitle')}</p>
      </div>

      {/* Grid Guide & Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Step Guide Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-xl">
              <HelpCircle size={18} />
            </div>
            <h3 className="font-black text-slate-900 text-base">{t('webhook.instructions')}</h3>
          </div>

          <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed font-medium">
            <div className="flex gap-2.5 items-start">
              <span className="flex items-center justify-center font-bold bg-sky-100 text-sky-800 rounded-lg w-5 h-5 text-xs shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-bold text-slate-800">{t('webhook.steps.one.title')}</p>
                <p className="mt-0.5"><Trans ns="smsIn" i18nKey="webhook.steps.one.description" components={[<a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline inline-flex items-center gap-0.5" />, <ExternalLink size={10} />]} /></p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <span className="flex items-center justify-center font-bold bg-sky-100 text-sky-800 rounded-lg w-5 h-5 text-xs shrink-0 mt-0.5">2</span>
              <div>
                <p className="font-bold text-slate-800">{t('webhook.steps.two.title')}</p>
                <p className="mt-0.5"><Trans ns="smsIn" i18nKey="webhook.steps.two.description" components={[<b />, <b />]} /></p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <span className="flex items-center justify-center font-bold bg-sky-100 text-sky-800 rounded-lg w-5 h-5 text-xs shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-bold text-slate-800">{t('webhook.steps.three.title')}</p>
                <p className="mt-0.5"><Trans ns="smsIn" i18nKey="webhook.steps.three.description" components={[<kbd className="bg-slate-100 px-1 rounded font-mono" />, <kbd className="bg-slate-100 px-1 rounded font-mono" />]} /></p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <span className="flex items-center justify-center font-bold bg-sky-100 text-sky-800 rounded-lg w-5 h-5 text-xs shrink-0 mt-0.5">4</span>
              <div>
                <p className="font-bold text-slate-800">{t('webhook.steps.four.title')}</p>
                <p className="mt-0.5"><Trans ns="smsIn" i18nKey="webhook.steps.four.description" components={[<b />, <br />, <b />, <br />, <br />, <i />, <b />, <br />, <i />, <b />, <span className="text-red-500 font-bold" />]} /></p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <span className="flex items-center justify-center font-bold bg-sky-100 text-sky-800 rounded-lg w-5 h-5 text-xs shrink-0 mt-0.5">5</span>
              <div>
                <p className="font-bold text-slate-800">{t('webhook.steps.five.title')}</p>
                <p className="mt-0.5"><Trans ns="smsIn" i18nKey="webhook.steps.five.description" components={[<b />]} /></p>
              </div>
            </div>
          </div>
        </div>

        {/* Script copy panel */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between shadow-sm" dir="ltr">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 font-semibold">
              <Terminal size={14} className="text-sky-400" /> google-apps-script.js
            </span>
            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          
          <pre className="text-[10px] text-slate-300 font-mono overflow-auto max-h-[350px] whitespace-pre-wrap flex-1 scrollbar-thin">
            {GOOGLE_SHEETS_APPS_SCRIPT}
          </pre>
        </div>
      </div>

      {/* Webhook Activity Logs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="font-bold text-slate-900 text-sm">{t('webhook.logs.title')}</h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer hover:bg-rose-50 px-2 py-1 rounded"
            >
              <Trash2 size={13} />
              {t('webhook.logs.clear')}
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 font-bold rounded-sm ${
                    log.status === 'success' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : log.status === 'failed'
                      ? 'bg-rose-50 text-rose-700 border border-rose-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    {log.status === 'success' ? '200 OK' : log.status === 'failed' ? t('webhook.logs.failed') : t('webhook.logs.pending')}
                  </span>
                  <span className="font-medium text-slate-400">{log.timestamp}</span>
                </div>
                <div className="text-slate-500">
                  {t('webhook.logs.destination')}: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">{log.dest}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="ltr">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-[10px] font-mono text-slate-600">
                  <span className="text-[9px] font-bold text-slate-400 block mb-1">PAYLOAD SENT:</span>
                  <pre className="overflow-auto max-h-32 scrollbar-none whitespace-pre-wrap">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-[10px] font-mono text-slate-600 text-end">
                  <span className="text-[9px] font-bold text-slate-400 block mb-1">RESPONSE:</span>
                  <p className="whitespace-pre-line text-slate-700 mt-1">
                    {log.response || '(No response received - trigger executed in bypass)'}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="p-10 text-center text-slate-400">
              <p className="text-sm font-medium">{t('webhook.logs.emptyTitle')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('webhook.logs.emptyDescription')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
