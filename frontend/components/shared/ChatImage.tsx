import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ZoomIn } from 'lucide-react';

interface ChatImageProps {
  src: string;
  alt?: string;
  className?: string;
}

const downloadImage = async (src: string, e?: React.MouseEvent) => {
  e?.preventDefault();
  e?.stopPropagation();
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
 * Fullscreen lightbox shown when a chat image is clicked, with download and close actions.
 * Rendered via a portal so it isn't clipped by overflow/scroll containers of the chat bubble.
 */
const ImageLightbox: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => downloadImage(src, e)}
          title="הורד תמונה"
          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-md transition-colors"
        >
          <Download size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="סגור"
          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-md transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
};

/**
 * Renders an image with hover-visible zoom and download buttons.
 * Used everywhere a chat/session message of type "image" is displayed,
 * so the user can view it enlarged or save it locally.
 */
export const ChatImage: React.FC<ChatImageProps> = ({ src, alt = 'תמונה', className = '' }) => {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="relative group/img">
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onClick={() => setZoomed(true)}
      />
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setZoomed(true)}
          title="הגדל תמונה"
          className="p-1.5 bg-black/55 hover:bg-black/75 text-white rounded-lg shadow-md"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => downloadImage(src, e)}
          title="הורד תמונה"
          className="p-1.5 bg-black/55 hover:bg-black/75 text-white rounded-lg shadow-md"
        >
          <Download size={14} />
        </button>
      </div>
      {zoomed && <ImageLightbox src={src} alt={alt} onClose={() => setZoomed(false)} />}
    </div>
  );
};

export default ChatImage;
