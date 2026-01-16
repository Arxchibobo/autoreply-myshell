
export enum SupportCategory {
  SUBSCRIPTION_MISSING_INFO = 'SUBSCRIPTION_MISSING_INFO', 
  SUBSCRIPTION_VERIFIED = 'SUBSCRIPTION_VERIFIED', 
  NSFW_ISSUE = 'NSFW_ISSUE', 
  ACCOUNT_USAGE_ERROR = 'ACCOUNT_USAGE_ERROR', 
  ACCOUNT_DELETION = 'ACCOUNT_DELETION', 
  POST_DELETION_BILLING = 'POST_DELETION_BILLING', 
  BOT_POWER_ISSUE = 'BOT_POWER_ISSUE', 
  OTHER = 'OTHER'
}

export interface Template {
  id: string;
  name: string;
  content: string;
  rulePrompt?: string; // AI 匹配该模板的规则描述
  category?: SupportCategory;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string;
}

export interface ImageAnalysisResult {
  summary: string;
  detected_issues: string[];
  recommendation: string;
  extracted_uid?: string;
  extracted_payment_platform?: 'Stripe' | 'PayPal' | 'Other';
}

export interface TicketMetadata {
  user_id?: string;
  payment_method?: string;
  payment_channel?: string; 
  has_payment_proof: boolean;
  is_info_complete: boolean;
  missing_fields: string[];
  branch_path: string[];
}

export interface AIClassificationResult {
  category: SupportCategory;
  confidence: number;
  should_auto_send: boolean;
  reply_email: string;
  reasoning_summary: string;
  chinese_summary?: string;
  extracted_metadata: TicketMetadata;
  selected_template_id: string; // 记录 AI 选中的模板 ID
}

export interface LinkedUserProfile {
  uid: string;
  status: 'Pro' | 'Basic' | 'Free';
  last_order_date?: string;
  last_order_amount?: string;
  energy_balance: number;
  is_verified: boolean;
  // Database table counts (last 30 days)
  stripe_orders_count: number;
  subscriptions_count: number;
  art_tasks_count: number;
  energy_logs_count: number;
  // Detailed JSON Data from RDS
  stripe_orders_json?: any[];
  subscriptions_json?: any[];
  art_tasks_json?: any[];
  energy_logs_json?: any[];
}

export interface Email {
  id: string;
  threadId: string;
  messageId: string;
  sender: string;
  senderName: string;
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  status: 'new' | 'in_progress' | 'info_missing' | 'resolved' | 'ready_to_resolve';
  attachments: Attachment[];
  aiResult?: AIClassificationResult;
  linkedProfile?: LinkedUserProfile;
  agentNotes?: string;
  selected?: boolean;
  sentReply?: string; 
}

export interface DatabaseTicket {
  id: string;
  user_id: string;
  email: string;
  subject: string;
  payment_method: string;
  proof_of_payment: string[];
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  created_date: string;
  updated_date: string;
  aiResult?: AIClassificationResult;
  agentNotes?: string;
}

export interface Customer {
  email: string;
  name: string;
  userId: string;
  latestCategory: string;
  tags: string[];
  threads: {
    id: string;
    source: 'gmail' | 'database';
    subject: string;
    status: string;
    timestamp: string;
    category?: string;
  }[];
  totalTickets: number;
  lastActive: string;
  resolvedCount: number;
}

export interface SupportStats {
  total: number;
  gmailCount: number;
  dbCount: number;
  new: number;
  resolved: number;
  metrics: {
    uidCount: number;
    paymentMethodCount: number;
    proofCount: number;
    perfectCount: number;
  }
}
