export interface ContactFieldDef {
  _id: string;
  label: string;
  key: string;
  order: number;
  createdAt?: string;
}

export type InternalDataFieldType = 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone' | 'json';
export type InternalDataSourceType = 'google_sheet' | 'excel_url' | 'manual';
export type InternalDataSyncMode = 'replace' | 'upsert' | 'append';
export type InternalDataOutputFormat = 'json_array' | 'single_object' | 'fields_only' | 'key_value' | 'csv' | 'xml' | 'bot_actions';

export interface InternalDataField {
  key: string;
  label: string;
  type: InternalDataFieldType;
  required?: boolean;
  order?: number;
}

export interface InternalDataSyncConfig {
  enabled: boolean;
  source_type: 'google_sheet' | 'excel_url' | null;
  source_url: string;
  interval_minutes: number;
  mode: InternalDataSyncMode;
  unique_key_field: string;
  last_synced_at: string | null;
  last_sync_status: 'success' | 'error' | null;
  last_sync_error: string;
  next_sync_at: string | null;
}

export interface InternalDataApiConfig {
  enabled: boolean;
  key: string;
  total_calls: number;
  last_called_at: string | null;
}

export interface InternalDataTable {
  _id: string;
  user_id: string;
  name: string;
  description?: string;
  slug: string;
  source_type: InternalDataSourceType;
  fields: InternalDataField[];
  sync: InternalDataSyncConfig;
  api: InternalDataApiConfig;
  recordCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternalDataRow {
  _id: string;
  table_id: string;
  user_id: string;
  values: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternalDataSyncLog {
  id: string;
  collectionId: string;
  timestamp: string;
  trigger: 'manual' | 'scheduled' | 'initial_upload';
  status: 'success' | 'failed';
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsDeleted: number;
  durationMs: number;
  message: string;
  errorDetails?: string;
}

export interface InternalDataStats {
  totalCollections: number;
  totalRecords: number;
  totalEndpoints: number;
  totalApiCalls: number;
  activeSchedules: number;
}

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
  // Actions (continued)
  ACTION_SET_PARAMETER = 'action_set_parameter',
  ACTION_RETURN_TO_MAIN_MENU = 'action_return_to_main_menu',
  // Special
  START = 'start',
  FIXED_PROCESS = 'fixed_process',
  AUTOMATIC_RESPONSES = 'automatic_responses'
}

export type TimeRoutingCondition =
  | { kind: 'time'; fromHour: number; fromMinute?: number; toHour: number; toMinute?: number }
  | { kind: 'date'; fromDate: string; toDate: string }
  | { kind: 'weekday'; fromDay: number; toDay: number };

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
  /** Menu conditional-option target values (parallel to menuConditionOperators); unused/empty for 'eq' */
  menuConditionOptions?: string[];
  /** Menu conditional-option operators: 'eq' | 'contains' | 'contains_any' | 'contains_all' */
  menuConditionOperators?: string[];
  dateTimeMode?: 'date' | 'time' | 'datetime';
  timeRoutingBranches?: Array<{ conditions: TimeRoutingCondition[] }>;
  groupId?: string;
  removeFromGroupMode?: 'specific' | 'all';
  removeGroupId?: string;
  /** Reason text recorded in the group-removal log when the bot removes a contact from a group */
  removalReason?: string;
  /** For action_transfer_to_agent: which RepGroup the conversation is assigned to */
  repGroupId?: string;
  /** For action_transfer_to_agent: which action to perform */
  repActionType?: 'transfer' | 'close' | 'extend_30m';
  /** For action_transfer_to_agent: 'any' rep from the group, or a 'specific' rep */
  repAssignmentMode?: 'any' | 'specific';
  /** For action_transfer_to_agent: the specific rep user id (when mode='specific') */
  repUserId?: string; 
  /** Unified add/remove group component: which action to perform */
  groupActionMode?: 'add' | 'remove';
  /** For automatic_responses: optional system trigger condition */
  systemTriggerType?: 'case2_waiting_30m';
  /** For action_set_parameter: the parameter name to set */
  parameterName?: string;
  /** For action_set_parameter: the value to assign (supports --varName-- syntax) */
  parameterValue?: string;
  /** For action_return_to_main_menu: phrase matched against the automatic_responses node's options */
  returnMenuText?: string;
  processId?: string;
  onChange?: (data: Partial<NodeData>) => void;
  onDelete?: () => void;
  searchQuery?: string;
  isCurrentMatch?: boolean;
  serialId?: string;
  /** Nodes whose outgoing edge connects to this node (populated at render time) */
  incomingNodes?: Array<{ id: string; serialId?: string; type: string; label?: string }>;
  /** Nodes this node connects to (populated at render time) */
  outgoingNodes?: Array<{ id: string; serialId?: string; type: string; label?: string }>;
  /** Navigate the canvas to a node by id */
  onNavigateToNode?: (nodeId: string) => void;
  /** Whether to save the captured value to the contact's custom_field_values */
  saveToContact?: boolean;
  /** Where to store the value when saveToContact is true: 'full_name' | 'email' (fixed Contact fields) or a ContactFieldDef._id (custom field) */
  contactFieldKey?: string;
  /** For action_web_service: HTTP method (default: POST) */
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** For action_web_service: custom request headers */
  apiHeaders?: Array<{ key: string; value: string }>;
  /** For action_web_service: raw JSON body string; if empty, standard bot payload is used */
  apiBody?: string;
  /** Auth token injected by App.tsx so node components can call authenticated APIs (e.g. file upload) */
  token?: string | null;
}

export interface BotFlow {
  id: string;
  name: string;
  user_id: string;
  public_id: string;
  created_at: string;
  is_default?: boolean;
  display_phone_number?: string;
  /** Provider for connected WhatsApp number: 'facebook' or 'dialog360' */
  whatsapp_provider?: 'facebook' | 'dialog360';
  /** Dialog360 webhook link */
  dialog360_link?: string;
  /** Parameter values filled by the user when this bot was created from a template */
  botParams?: Record<string, string>;
  /** External endpoint identifier */
  endpoint?: string;
  /** Global keyword that resets the conversation from anywhere */
  restart_keyword?: string;
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

/** Internal (self-authored) template ("תבניות פנימיות") - a text + optional single
 *  header attachment sent as a regular WhatsApp message (not the WA Template API).
 *  Supports numbered placeholders like {{1}}, {{2}} in `body`.
 */
export interface InternalTemplate {
  _id: string;
  userId: string;
  name: string;
  body: string;
  mediaType: 'image' | 'video' | 'document' | null;
  mediaUrl: string;
  createdAt?: string;
  updatedAt?: string;
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
  facebook_connect: { view: boolean };
  send_messages: { view: boolean; send: boolean };
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
  phone?: string;
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
  active_contacts_count?: number;
  active_contacts_quota_exceeded?: boolean;
  limits_in_effect?: { maxActiveContacts?: number; [k: string]: any };
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
  dateTimeMode?: 'date' | 'time' | 'datetime';
}