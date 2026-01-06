
export enum SupportCategory {
  SUBSCRIPTION_MISSING_INFO = 'SUBSCRIPTION_MISSING_INFO', // 订阅充值-缺信息 (Template 1)
  SUBSCRIPTION_VERIFIED = 'SUBSCRIPTION_VERIFIED', // 订阅充值-信息全 (Ready for backend)
  NSFW_ISSUE = 'NSFW_ISSUE', // NSFW产品相关 (Template 2)
  ACCOUNT_USAGE_ERROR = 'ACCOUNT_USAGE_ERROR', // 账号报错/使用相关 (Template 3)
  ACCOUNT_DELETION = 'ACCOUNT_DELETION', // 删除账号 (Template 4)
  POST_DELETION_BILLING = 'POST_DELETION_BILLING', // 删除后仍扣款 (Template 5)
  BOT_POWER_ISSUE = 'BOT_POWER_ISSUE', // Bot多扣电量 (Template 6)
  OTHER = 'OTHER'
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
  extracted_metadata: TicketMetadata;
}

export interface Email {
  id: string;
  threadId: string;
  messageId: string; // 用于回复的唯一消息标识
  sender: string;
  senderName: string;
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  status: 'new' | 'in_progress' | 'info_missing' | 'resolved';
  attachments: Attachment[];
  aiResult?: AIClassificationResult;
  imageAnalysis?: ImageAnalysisResult;
  agentNotes?: string;
  history?: string[];
  messageCount?: number;
  selected?: boolean;
}

export interface Customer {
  email: string;
  name: string;
  userId: string;
  latestCategory: string; // The category of the most recent email
  tags: string[]; // Derived tags (e.g. "VIP", "Paid", "Risk")
  threads: {
    id: string;
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
  new: number;
  inProgress: number;
  resolved: number;
  infoMissing: number;
  metrics: {
    uidCount: number;
    paymentMethodCount: number;
    proofCount: number;
    perfectCount: number;
  }
}
