import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface FileUploaderProps {
  value?: string; // Current file URL
  onChange: (url: string) => void;
  accept?: string; // e.g., "image/*", "video/*"
  label?: string;
  mediaType?: 'image' | 'video' | 'document';
  token: string; // Auth token for upload
  apiBase?: string;
}

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;

export const FileUploader: React.FC<FileUploaderProps> = ({
  value,
  onChange,
  accept = '*/*',
  label = 'קובץ',
  mediaType = 'image',
  token,
  apiBase = API_BASE
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        // Try to parse as JSON, fallback to text if HTML
        let errorMessage = 'העלאה נכשלה';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = `שגיאת שרת: ${response.status}`;
            console.error('[FileUploader] Server returned HTML:', text.substring(0, 200));
          }
        } catch (parseErr) {
          console.error('[FileUploader] Failed to parse error:', parseErr);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err: any) {
      console.error('[FileUploader] Error:', err);
      setError(err.message || 'העלאת הקובץ נכשלה');
    } finally {
      setUploading(false);
    }
  };

  const renderPreview = () => {
    if (!value) return null;

    if (mediaType === 'image') {
      return <img src={value} alt="Preview" className="w-full h-full object-contain" />;
    } else if (mediaType === 'video') {
      return <video src={value} className="w-full h-full object-contain" />;
    } else {
      return (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
          <Upload size={40} />
          <span className="text-sm">קובץ הועלה</span>
        </div>
      );
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm w-full h-32 bg-slate-50 flex items-center justify-center">
          {renderPreview()}
          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="p-2.5 bg-white text-slate-900 rounded-lg shadow-xl hover:bg-slate-100 transition-all outline-none disabled:opacity-50"
            >
              <Upload size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }}
              className="p-2.5 bg-red-500 text-white rounded-lg shadow-xl hover:bg-red-600 transition-all outline-none"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/30 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">מעלה...</span>
            </>
          ) : (
            <>
              <Upload size={28} strokeWidth={1.5} />
              <span className="text-xs font-semibold uppercase tracking-wider">העלה {label}</span>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
        disabled={uploading}
      />
    </div>
  );
};
