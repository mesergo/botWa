import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';

interface ChatImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** Extra classes for the wrapper div — use to make it fill a sized parent (e.g. "w-full h-full") */
  wrapperClassName?: string;
}

const downloadImage = async (src: string) => {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    let filename = 'image.jpg';
    try {
      filename = decodeURIComponent(src.split('/').pop()?.split('?')[0] || filename) || filename;
    } catch {
      // keep default filename
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback (e.g. CORS blocked the fetch) — just open the image in a new tab
    window.open(src, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Renders an image with a hover-visible download button and a click-to-enlarge
 * fullscreen viewer (with its own download button). Used everywhere a chat/session
 * message of type "image" is displayed.
 */
export const ChatImage: React.FC<ChatImageProps> = ({ src, alt = 'תמונה', className = '', wrapperClassName = '' }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    downloadImage(src);
  };

  return (
    <div className={`relative group/img ${wrapperClassName}`}>
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onClick={() => setIsFullscreen(true)}
      />
      <button
        type="button"
        onClick={handleDownload}
        title="הורד תמונה"
        className="absolute top-1.5 left-1.5 p-1.5 bg-black/55 hover:bg-black/75 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
      >
        <Download size={14} />
      </button>

      {isFullscreen && createPortal(
        <div
          className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-6 animate-in fade-in duration-150"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadImage(src); }}
              title="הורד תמונה"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-md transition-colors"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
              title="סגור"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-md transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ChatImage;
