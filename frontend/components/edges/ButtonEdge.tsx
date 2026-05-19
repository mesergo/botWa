
import React, { useState, useCallback } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { X } from 'lucide-react';

export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const nodeHoverType: string | null = data?.nodeHoverType ?? null;
  const strokeColor =
    nodeHoverType === 'source'
      ? '#10b981'  // emerald-500
      : nodeHoverType === 'target'
      ? '#3b82f6'  // blue-500 (brighter)
      : '#93c5fd'; // blue-300 (default)

  const pathStyle = {
    ...style,
    stroke: strokeColor,
    strokeWidth: nodeHoverType ? 3 : (style as any)?.strokeWidth ?? 2,
    transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
  };

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    const event = new CustomEvent('delete-edge', { detail: { id } });
    window.dispatchEvent(event);
  };

  return (
    <>
      <path
        id={id}
        style={pathStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* נתיב שקוף רחב לזיהוי hover לאורך כל הקשר */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            className={`w-5 h-5 bg-white border-2 border-red-500 text-red-500 rounded-full flex items-center justify-center shadow-md hover:bg-red-500 hover:text-white transition-all ${
              isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
            }`}
            onClick={onEdgeClick}
            title="מחיקת הקשר"
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
