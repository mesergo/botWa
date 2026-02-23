export enum NodeType {
  // Inputs
  INPUT_TEXT = 'input_text',
  INPUT_DATE = 'input_date',
  INPUT_FILE = 'input_file',
  // Outputs
  OUTPUT_TEXT = 'output_text',
  OUTPUT_IMAGE = 'output_image',
  OUTPUT_LINK = 'output_link',
  OUTPUT_MENU = 'output_menu',
  // Actions
  ACTION_WEB_SERVICE = 'action_web_service',
  ACTION_WAIT = 'action_wait',
  ACTION_TIME_ROUTING = 'action_time_routing',
  // Special
  START = 'start',
  FIXED_PROCESS = 'fixed_process',
  AUTOMATIC_RESPONSES = 'automatic_responses'
}

export interface NodeData {
  label: string;
  variableName?: string;
  content?: string;
  url?: string;
  linkLabel?: string;
  mediaType?: 'image' | 'video' | 'pdf';
  caption?: string;
  waitTime?: number;
  options?: string[];
  optionOperators?: string[];
  optionImages?: string[];
  timeRanges?: Array<{ fromHour: number; toHour: number; }>;
  processId?: string;
  onChange?: (data: Partial<NodeData>) => void;
  onDelete?: () => void;
  searchQuery?: string;
  isCurrentMatch?: boolean;
  serialId?: string;
}

export interface BotFlow {
  id: string;
  name: string;
  user_id: string;
  public_id: string;
  created_at: string;
  is_default?: boolean;
}

export interface FixedProcess {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
}

export interface Version {
  id: string;
  name: string;
  created_at: string;
  isLocked?: boolean;
  data: {
    nodes: any[];
    edges: any[];
  };
}

export interface RestorableVersionsData {
  count: number;
  versionPrice: number;
  versions: Array<{
    id: string;
    name: string;
    created_at: string;
    isLocked: boolean;
  }>;
}

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'image' | 'url' | 'tel';
  placeholder?: string;
}

export interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'user';
  public_id: string;
  account_type: 'Trial' | 'Basic' | 'Premium';
  status: 'active' | 'inActive' | 'pause';
  password?: string;
  trial_expires_at?: string | null;
  isImpersonating?: boolean;
  impersonatedBy?: string;
}

export interface CarouselItem {
  title?: string;
  subtitle?: string;
  image?: string;
  url?: string;
  options?: { text: string; value: string }[];
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  type: 'text' | 'image' | 'video' | 'document' | 'link' | 'menu' | 'input_text' | 'input_date' | 'input_file' | 'carousel' | 'Options';
  content?: string;
  url?: string;
  options?: string[];
  optionValues?: string[];
  optionImages?: string[];
  carouselItems?: CarouselItem[];
  timestamp: Date;
}