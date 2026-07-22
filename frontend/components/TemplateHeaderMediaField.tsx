import React, { useEffect, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { FileUploader } from './FileUploader';

interface TemplateHeaderMediaFieldProps {
  mediaType: 'image' | 'video' | 'document';
  value: string;
  onChange: (url: string) => void;
  token: string;
  /** Example media URL taken from the Dialog360 template definition (fallback preview). */
  sampleUrl?: string;
  /** Default media URL the admin configured for this specific template, if any. */
  defaultUrl?: string;
}

const mediaLabel = (mediaType: 'image' | 'video' | 'document') =>
  mediaType === 'image' ? 'תמונה' : mediaType === 'video' ? 'וידאו' : 'מסמך';

/**
 * Header media picker used when sending a WhatsApp template that requires a
 * media header (image/video/document).
 *
 * - If the admin configured a default media file for this template, the agent
 *   can choose between using that default or uploading a different file.
 * - If no default was configured, only the file upload option is shown.
 */
export const TemplateHeaderMediaField: React.FC<TemplateHeaderMediaFieldProps> = ({
  mediaType,
  value,
  onChange,
  token,
  sampleUrl,
  defaultUrl,
}) => {
  const hasDefault = !!defaultUrl;
  const [mode, setMode] = useState<'default' | 'upload'>(hasDefault ? 'default' : 'upload');

  // Keep the selected value in sync with the chosen mode
  useEffect(() => {
    if (hasDefault && mode === 'default' && value !== defaultUrl) {
      onChange(defaultUrl!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDefault, mode, defaultUrl]);

  if (!hasDefault) {
    return (
      <FileUploader
        value={value}
        onChange={onChange}
        accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'}
        label={mediaLabel(mediaType)}
        mediaType={mediaType}
        token={token}
        sampleUrl={sampleUrl}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMode('default')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors ${
            mode === 'default' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ImageIcon size={14} />
          תמונת ברירת מחדל
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors border-r border-slate-200 ${
            mode === 'upload' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Upload size={14} />
          העלה קובץ אחר
        </button>
      </div>

      {mode === 'default' ? (
        <div className="rounded-xl overflow-hidden border border-slate-200 w-full h-32 bg-slate-50 flex items-center justify-center">
          {mediaType === 'image' ? (
            <img src={defaultUrl} alt="ברירת מחדל" className="w-full h-full object-contain" />
          ) : mediaType === 'video' ? (
            <video src={defaultUrl} className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-sm">
              <Upload size={28} />
              קובץ ברירת מחדל
            </div>
          )}
        </div>
      ) : (
        <FileUploader
          value={value === defaultUrl ? '' : value}
          onChange={onChange}
          accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'}
          label={mediaLabel(mediaType)}
          mediaType={mediaType}
          token={token}
          sampleUrl={sampleUrl}
        />
      )}
    </div>
  );
};

export default TemplateHeaderMediaField;
