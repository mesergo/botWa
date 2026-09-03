import React from 'react';
import {
  Phone, FileText, X, Calendar, Send,
  Image as ImageIcon, Video, File as FileLucide, Paperclip,
} from 'lucide-react';
import { FileUploader } from '../FileUploader';
import TemplateBodyParamsEditor from '../TemplateBodyParamsEditor';
import PersonalizedTextarea from '../shared/PersonalizedTextarea';
import { useTranslation } from 'react-i18next';

interface SendBot {
  id: string;
  name: string;
  display_phone_number: string;
  endpoint: string;
}

interface ComposerPanelProps {
  // bot selector
  sendBotsLoading: boolean;
  sendBots: SendBot[];
  selectedSendBotId: string;
  setSelectedSendBotId: (id: string) => void;
  // template
  selectedTemplate: any;
  setSelectedTemplate: (t: any) => void;
  templateParams: any;
  setTemplateParams: (v: any) => void;
  templateSampleUrl: string | undefined;
  templates: any[];
  fetchTemplates: () => void;
  setShowTemplatePicker: (v: boolean) => void;
  contactFields: any[];
  agentName?: string | null;
  // message
  messageText: string;
  setMessageText: (v: string) => void;
  // media
  mediaType: 'image' | 'video' | 'document' | null;
  setMediaType: (t: 'image' | 'video' | 'document' | null) => void;
  mediaUrl: string;
  setMediaUrl: (u: string) => void;
  mediaFilename: string;
  setMediaFilename: (f: string) => void;
  token: string | null;
  // send actions
  sending: boolean;
  canSubmit: boolean;
  onSendNow: () => void;
  onOpenSchedule: () => void;
}

const ComposerPanel: React.FC<ComposerPanelProps> = ({
  sendBotsLoading, sendBots, selectedSendBotId, setSelectedSendBotId,
  selectedTemplate, setSelectedTemplate, templateParams, setTemplateParams,
  templateSampleUrl, templates, fetchTemplates, setShowTemplatePicker, contactFields, agentName,
  messageText, setMessageText,
  mediaType, setMediaType, mediaUrl, setMediaUrl, mediaFilename, setMediaFilename,
  token, sending, canSubmit, onSendNow, onOpenSchedule,
}) => {
  const { t } = useTranslation('messages');
  const mediaLabel = (type: 'image' | 'video' | 'document') => t(`composer.media.types.${type}`);

  return (
    <div
      className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 180px)' }}
    >
      {/* ── Header ── */}
      <div className="p-5 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-lg font-black text-slate-900">{t('composer.title')}</h2>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">

        {/* Bot / phone selector */}
        {sendBotsLoading ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <div className="animate-spin w-4 h-4 border-2 border-slate-200 border-t-green-500 rounded-full" />
            {t('composer.bots.loading')}
          </div>
        ) : sendBots.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
            {t('composer.bots.empty')}
          </div>
        ) : sendBots.length === 1 ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700 flex items-center gap-2">
            <Phone size={14} /> {t('composer.bots.sendFrom', { phone: sendBots[0].display_phone_number, name: sendBots[0].name })}
          </div>
        ) : (
          <div>
            <label className="text-xs font-black text-slate-500 mb-2 block">{t('composer.bots.choose')}</label>
            <div className="space-y-2">
              {sendBots.map(bot => (
                <label
                  key={bot.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedSendBotId === bot.id ? 'bg-green-50 border-green-400' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sendBot"
                    checked={selectedSendBotId === bot.id}
                    onChange={() => setSelectedSendBotId(bot.id)}
                    className="accent-green-600"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone size={15} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-slate-900">{bot.display_phone_number}</span>
                    <span className="text-xs text-slate-400 truncate">— {bot.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Template chooser */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black text-slate-500">{t('composer.template.label')}</label>
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => { setSelectedTemplate(null); setTemplateParams({}); }}
                className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"
              >
                <X size={12} /> {t('composer.template.clear')}
              </button>
            )}
          </div>

          {selectedTemplate ? (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-purple-600" />
                <span className="text-sm font-black text-purple-900">
                  {selectedTemplate.name || selectedTemplate.elementName || selectedTemplate.template_name}
                </span>
                <span className="text-xs font-bold text-purple-500">({selectedTemplate.language || 'he'})</span>
              </div>

              {(selectedTemplate.components || []).map((comp: any, i: number) => (
                <div key={i} className="text-xs text-slate-600 mb-1">
                  {comp.type === 'BODY' && comp.text
                    ? <span className="whitespace-pre-wrap">{comp.text}</span>
                    : null}
                </div>
              ))}

              {templateParams.header && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    {templateParams.header.type === 'image' ? `🖼️ ${mediaLabel('image')}`
                      : templateParams.header.type === 'video' ? `🎥 ${mediaLabel('video')}` : `📄 ${mediaLabel('document')}`}
                  </label>
                  <FileUploader
                    value={templateParams.header.url || ''}
                    onChange={(url: string) =>
                      setTemplateParams((p: any) => ({ ...p, header: { ...p.header, url } }))
                    }
                    accept={
                      templateParams.header.type === 'image' ? 'image/*'
                        : templateParams.header.type === 'video' ? 'video/*' : '*/*'
                    }
                    label={
                      mediaLabel(templateParams.header.type)
                    }
                    mediaType={templateParams.header.type}
                    token={token || ''}
                    sampleUrl={templateSampleUrl}
                  />
                </div>
              )}

              <TemplateBodyParamsEditor
                templateParams={templateParams}
                setTemplateParams={setTemplateParams}
                contactFields={contactFields}
                agentName={agentName}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowTemplatePicker(true);
                if (templates.length === 0) fetchTemplates();
              }}
              className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-200 text-purple-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <FileText size={16} /> {t('composer.template.choose')}
            </button>
          )}
        </div>

        {/* Free text + media (only when no template selected) */}
        {!selectedTemplate && (
          <div>
            <label className="text-xs font-black text-slate-500 mb-2 block">{t('composer.freeText.label')}</label>
            <PersonalizedTextarea
              value={messageText}
              onChange={setMessageText}
              contactFields={contactFields}
              rows={3}
              placeholder={mediaType ? t('composer.freeText.mediaCaptionPlaceholder') : t('composer.freeText.placeholder')}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-green-600/10 focus:border-green-600 resize-none"
            />

            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-500">{t('composer.media.label')}</label>
                {(mediaType || mediaUrl) && (
                  <button
                    onClick={() => { setMediaType(null); setMediaUrl(''); setMediaFilename(''); }}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"
                  >
                    <X size={12} /> {t('composer.media.remove')}
                  </button>
                )}
              </div>

              {!mediaType ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setMediaType('image')}
                    className="flex flex-col items-center gap-1 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl text-blue-700 font-bold text-xs transition-colors"
                  >
                    <ImageIcon size={18} /> {mediaLabel('image')}
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    className="flex flex-col items-center gap-1 p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-rose-700 font-bold text-xs transition-colors"
                  >
                    <Video size={18} /> {mediaLabel('video')}
                  </button>
                  <button
                    onClick={() => setMediaType('document')}
                    className="flex flex-col items-center gap-1 p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl text-amber-700 font-bold text-xs transition-colors"
                  >
                    <FileLucide size={18} /> {mediaLabel('document')}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3 text-xs font-black text-slate-600">
                    <Paperclip size={14} />
                    {t(`composer.media.upload.${mediaType}`)}
                  </div>
                  <FileUploader
                    value={mediaUrl}
                    onChange={url => {
                      setMediaUrl(url);
                      try {
                        setMediaFilename(decodeURIComponent(url.split('/').pop() || ''));
                      } catch {
                        setMediaFilename('');
                      }
                    }}
                    accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'}
                    mediaType={mediaType}
                    label={mediaLabel(mediaType)}
                    token={token || ''}
                  />
                  {mediaUrl && (
                    <p className="mt-2 text-xs font-bold text-green-600 break-all">✓ {mediaFilename || mediaUrl}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      {/* ── End scrollable body ── */}

      {/* ── Sticky footer: send buttons ── */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 flex-shrink-0">
        <button
          onClick={onOpenSchedule}
          disabled={sending || !canSubmit}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
        >
          <Calendar size={15} /> {t('composer.actions.schedule')}
        </button>
        <button
          onClick={onSendNow}
          disabled={sending || !canSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm disabled:opacity-50"
        >
          <Send size={15} /> {sending ? t('composer.actions.starting') : t('composer.actions.sendNow')}
        </button>
      </div>

    </div>
  );
};

export default ComposerPanel;
