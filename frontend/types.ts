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
  urlVariable?: string;   // variable name whose value is used as the URL (e.g. "link_var")
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
  /** Parameter values filled by the user when this bot was created from a template */
  botParams?: Record<string, string>;
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

/** A parameter definition stored on a template - the admin defines label + variableName.
 *  Users fill the value; the value is saved as botParams and shown via --variableName-- in nodes.
 */
export interface TemplateParam {
  label: string;        // Display label shown to user, e.g. "שם החברה"
  variableName: string; // Placeholder key used in content as --variableName--, e.g. "comp_name"
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
  type: 'text' | 'image' | 'video' | 'document' | 'link' | 'menu' | 'input_text' | 'input_date' | 'input_file' | 'carousel' | 'Options' | 'separator';
  content?: string;
  url?: string;
  options?: string[];
  optionValues?: string[];
  optionImages?: string[];
  carouselItems?: CarouselItem[];
  timestamp: Date;
  sourceNodeId?: string;
}