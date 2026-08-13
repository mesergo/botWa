import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Matches the `w-72` Tailwind class used on the dropdown below (18rem = 288px at the default root font size).
const DROPDOWN_WIDTH = 288;
const VIEWPORT_MARGIN = 8;

interface AnchoredDropdownProps {
  /** Ref to the trigger element (e.g. the avatar button's wrapper) the dropdown is anchored below. */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Which edge of the anchor the dropdown's edge aligns to. Default 'left'. */
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

/**
 * Renders `children` in a portal on `document.body` with `position: fixed`, anchored below
 * `anchorRef`. Unlike a plain `absolute`-positioned dropdown, this is never clipped by an
 * ancestor's `overflow-hidden` (used throughout the page-level layout containers), and the
 * computed position is clamped to stay fully within the viewport (horizontally and vertically).
 */
const AnchoredDropdown: React.FC<AnchoredDropdownProps> = ({ anchorRef, open, onClose, align = 'left', className = '', children }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const computePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();

    // Horizontal: align to the anchor's left/right edge, then clamp so the dropdown never
    // overflows either side of the viewport.
    let left = align === 'right' ? rect.right - DROPDOWN_WIDTH : rect.left;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN);

    // Vertical: prefer below the anchor; flip above it if there isn't enough room below.
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? 0;
    let top = rect.bottom + 8;
    if (dropdownHeight && top + dropdownHeight > window.innerHeight - VIEWPORT_MARGIN) {
      const aboveTop = rect.top - 8 - dropdownHeight;
      top = aboveTop >= VIEWPORT_MARGIN ? aboveTop : Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - dropdownHeight);
    }

    setPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }
    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef, align]);

  // Content (e.g. the phone edit field or the sibling-accounts list) can change the dropdown's
  // height after it first mounts — re-run the vertical clamping once the real size is known.
  useLayoutEffect(() => {
    if (!open || !dropdownRef.current) return;
    const observer = new ResizeObserver(() => computePosition());
    observer.observe(dropdownRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, anchorRef, onClose]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      dir="rtl"
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
      className={`w-72 max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 py-2 ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};

export default AnchoredDropdown;