
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Layers } from 'lucide-react';
import BaseNode from './BaseNode';
import { NodeType } from '../../types';

export const FixedProcessNode = (props: any) => {
  return (
    <BaseNode 
      id={props.id} 
      title={`Process: ${props.data.label}`} 
      icon={<Layers size={16} />} 
      type={NodeType.FIXED_PROCESS} 
      selected={props.selected} 
      onDelete={props.data.onDelete}
    >
      <div className="bg-purple-50 p-2 rounded border border-purple-100 text-[10px] text-purple-700">
        This is a reusable sequence of blocks.
      </div>
      {/* Target handle on the Left */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white rounded-full -left-1.5"
      />
      {/* Source handle on the Right */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white rounded-full -right-1.5"
      />
    </BaseNode>
  );
};

export default memo(FixedProcessNode);
