
import React from 'react';
import { 
  Type, 
  Calendar, 
  Upload, 
  MessageSquare, 
  Image as ImageIcon, 
  ExternalLink, 
  List, 
  Globe, 
  Clock, 
  PlayCircle
} from 'lucide-react';
import { NodeType } from './types';

export const COMPONENT_GROUPS = [
  {
    title: 'קלט (משתמש)',
    items: [
      { type: NodeType.INPUT_TEXT, label: 'שדה טקסט', icon: <Type size={18} /> },
      { type: NodeType.INPUT_DATE, label: 'בחירת תאריך', icon: <Calendar size={18} /> },
      { type: NodeType.INPUT_FILE, label: 'העלאת קובץ', icon: <Upload size={18} /> },
    ]
  },
  {
    title: 'פלט (בוט)',
    items: [
      { type: NodeType.OUTPUT_TEXT, label: 'הודעת טקסט', icon: <MessageSquare size={18} /> },
      { type: NodeType.OUTPUT_IMAGE, label: 'הודעת תמונה', icon: <ImageIcon size={18} /> },
      { type: NodeType.OUTPUT_LINK, label: 'קישור חיצוני', icon: <ExternalLink size={18} /> },
      { type: NodeType.OUTPUT_MENU, label: 'תפריט בחירה', icon: <List size={18} /> },
    ]
  },
  {
    title: 'פעולות מערכת',
    items: [
      { type: NodeType.ACTION_WEB_SERVICE, label: 'קריאת API', icon: <Globe size={18} /> },
      { type: NodeType.ACTION_WAIT, label: 'המתנה', icon: <Clock size={18} /> },
    ]
  }
];

export const START_NODE_DATA = {
  type: NodeType.START,
  data: { label: 'תחילת תזרים' },
  position: { x: 800, y: 400 }, // Standardized even further for zoomed-out perspective
};
