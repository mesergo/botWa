import React from 'react';
import { Download } from 'lucide-react';

interface ChatImageProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Renders an image with a hover-visible download button.
 * Used everywhere a chat/session message of type "image" is displayed,
 * so the user can save the image locally.
 */
export const ChatImage: React.FC<ChatImageProps> = ({ src, alt = 'תמונה', className = '' }) => {
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <div className="relative group/img">
      <img src={src} alt={alt} className={className} />
      <button
        type="button"
        onClick={handleDownload}
        title="הורד תמונה"
        className="absolute top-1.5 left-1.5 p-1.5 bg-black/55 hover:bg-black/75 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
      >
        <Download size={14} />
      </button>
    </div>
  );
};

export default ChatImage;
