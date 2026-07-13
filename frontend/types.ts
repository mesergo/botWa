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
  ACTION_ADD_TO_GROUP = 'action_add_to_group',
  ACTION_REMOVE_FROM_GROUP = 'action_remove_from_group',
  ACTION_TRANSFER_TO_AGENT = 'action_transfer_to_agent',
  // Special
  START = 'start',
  FIXED_PROCESS = 'fixed_process',
  AUTOMATIC_RESPONSES = 'automatic_responses'
}

export interface NodeData {
  label: string;
  variableName?: string;
  validationType?: 'email' | 'phone' | 'id' | 'url';
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
  routingMode?: 'time' | 'date';
  timeRanges?: Array<{ fromHour: number; toHour: number; }>;
  dateRanges?: Array<{ fromDate: string; toDate: string; }>;
  groupId?: string;
  removeFromGroupMode?: 'specific' | 'all';
  removeGroupId?: string;
  /** Reason text recorded in the group-removal log when the bot removes a contact from a group */
  removalReason?: string;
  /** For action_transfer_to_agent: which RepGroup the conversation is assigned to */
  repGroupId?: string;
  /** For action_transfer_to_agent: 'any' rep from the group, or a 'specific' rep */
  repAssignmentMode?: 'any' | 'specific';
  /** For action_transfer_to_agent: the specific rep user id (when mode='specific') */
  repUserId?: string;
  /** Unified add/remove group component: which action to perform */
  groupActionMode?: 'add' | 'remove';
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
  display_phone_number?: string;
  /** Parameter values filled by the user when this bot was created from a template */
  botParams?: Record<string, string>;
  /** External endpoint identifier */
  endpoint?: string;
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

export interface UserTypePermissions {
  bots:     { view_tab: boolean; create: boolean; edit: boolean; delete: boolean; settings: boolean; publish: boolean };
  sessions: { view: boolean; add: boolean; view_all: boolean; view_assigned_only: boolean; templates_as_rep: boolean; templates_as_manager: boolean };
  contacts: { view: boolean; add: boolean; edit: boolean; delete: boolean; import_excel: boolean };
  groups:   { view: boolean; create: boolean; add_contact: boolean; send_message: boolean; remove_contact: boolean };
  settings: { view: boolean; edit_profile: boolean };
  users:    { view: boolean; add: boolean; edit: boolean; delete: boolean };
  rep_groups: { view: boolean; add: boolean; delete: boolean };
  sms_in:   { view: boolean };
}

export interface UserType {
  _id: string;
  name: string;
  system_role: string | null;
  is_seeded: boolean;
  can_add_users: boolean;
  show_in_users_tab?: boolean;
  allowed_user_type_ids?: Array<{ _id: string; name: string; system_role: string | null }>;
  permissions: UserTypePermissions;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'admin' | 'user' | 'rep_manager' | 'rep';
  manager_id?: string | null;
  public_id: string;
  account_type: 'Trial' | 'Basic' | 'Premium';
  status: 'active' | 'inActive' | 'pause';
  availability_status?: 'available' | 'unavailable' | 'on_break';
  password?: string;
  trial_expires_at?: string | null;
  isImpersonating?: boolean;
  impersonatedBy?: string;
  user_type_id?: string | null;
  permissions?: UserTypePermissions;
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