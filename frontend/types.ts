
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
  waitTime?: number;
  options?: string[]; // For menu
  optionOperators?: string[]; // Operators for Web Service branching
  optionImages?: string[]; // Images for menu options
  processId?: string; // For FixedProcess nodes
  onChange?: (data: Partial<NodeData>) => void;
  onDelete?: () => void;
  // Search properties
  searchQuery?: string;
  isCurrentMatch?: boolean;
  serialId?: string; // Added for serial identification (#1, B1 etc)
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
  type: 'text' | 'image' | 'link' | 'menu' | 'input_text' | 'input_date' | 'input_file' | 'carousel';
  content?: string;
  url?: string;
  options?: string[];
  optionValues?: string[]; 
  optionImages?: string[];
  carouselItems?: CarouselItem[]; // Added for carousel support
  timestamp: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  public_id: string;
  password?: string;
  account_type: 'Basic' | 'Premium';
  status: 'active' | 'inActive' | 'pause';
}
export interface EditorProps {
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
}

