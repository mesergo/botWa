
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
  PlayCircle,
  Users,
  UserMinus, 
  UserCheck,
  Zap
} from 'lucide-react';
import { NodeType } from './types';
 
export const COMPONENT_GROUPS = [
  {
    title: 'קלט (משתמש)',
    titleKey: 'palette.groups.input',
    items: [
      { type: NodeType.INPUT_TEXT, label: 'שדה טקסט', labelKey: 'palette.items.inputText', icon: <Type size={18} /> },
      { type: NodeType.INPUT_DATE, label: 'בחירת תאריך/שעה', labelKey: 'palette.items.inputDate', icon: <Calendar size={18} /> },
      { type: NodeType.INPUT_FILE, label: 'העלאת קובץ', labelKey: 'palette.items.inputFile', icon: <Upload size={18} /> },
    ]
  },
  {
    title: 'פלט (בוט)',
    titleKey: 'palette.groups.output',
    items: [
      { type: NodeType.OUTPUT_TEXT, label: 'הודעת טקסט', labelKey: 'palette.items.outputText', icon: <MessageSquare size={18} /> },
      { type: NodeType.OUTPUT_IMAGE, label: 'הודעת מדיה', labelKey: 'palette.items.outputMedia', icon: <ImageIcon size={18} /> },
      { type: NodeType.OUTPUT_LINK, label: 'קישור חיצוני', labelKey: 'palette.items.outputLink', icon: <ExternalLink size={18} /> },
      { type: NodeType.OUTPUT_MENU, label: 'תפריט בחירה', labelKey: 'palette.items.outputMenu', icon: <List size={18} /> },
    ]
  },
  {
    title: 'פעולות מערכת',
    titleKey: 'palette.groups.actions',
    items: [
      { type: NodeType.ACTION_WEB_SERVICE, label: 'קריאת API', labelKey: 'palette.items.api', icon: <Globe size={18} /> },
      { type: NodeType.ACTION_WAIT, label: 'המתנה', labelKey: 'palette.items.wait', icon: <Clock size={18} /> },
      { type: NodeType.ACTION_TIME_ROUTING, label: 'ניתוב לפי שעה/תאריך/יום', labelKey: 'palette.items.timeRouting', icon: <Clock size={18} /> },
      { type: NodeType.ACTION_ADD_TO_GROUP, label: 'הוספה/הסרה מקבוצה', labelKey: 'palette.items.groupMembership', icon: <Users size={18} /> },
      { type: NodeType.ACTION_TRANSFER_TO_AGENT, label: 'נציגים', labelKey: 'palette.items.agents', icon: <UserCheck size={18} /> },
      { type: NodeType.ACTION_SET_PARAMETER, label: 'הגדרת פרמטר', labelKey: 'palette.items.setParameter', icon: <Zap size={18} /> },
    ]
  }
];

export const START_NODE_DATA = {
  type: NodeType.START,
  data: { label: 'תחילת תזרים' },
  position: { x: 800, y: 400 }, // Standardized even further for zoomed-out perspective
};
