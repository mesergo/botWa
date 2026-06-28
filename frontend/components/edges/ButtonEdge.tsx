
import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';

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

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });


  
  return (
    <path
      id={id}
      style={pathStyle}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
}
