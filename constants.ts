
import { SupportCategory } from './types';

export const MOCK_EMAILS: any[] = [
  // 会话链 A：测试从“信息缺失”到“信息补全”的流转 (David)
  {
    id: 'thread_a_1',
    threadId: 'thread_david',
    sender: 'david.verified@gmail.com',
    senderName: 'David Verified',
    subject: 'Help: My Pro subscription is not active',
    body: 'Hi Team, I just paid for the Pro plan but my account is still Basic. Can you help?',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'info_missing',
    aiResult: {
      category: SupportCategory.SUBSCRIPTION_MISSING_INFO,
      confidence: 0.95,
      should_auto_send: false,
      reply_email: "Dear David, we see your payment request but need your UID and receipt...",
      chinese_summary: "用户意图：咨询 Pro 会员未到账问题。\n已经提供的资料：无（缺少 UID、支付方式和截图）。\n当前邮件总结：用户反馈支付后仍为 Basic，需要引导其提供 UID 及支付凭证。",
      selected_template_id: 'T1',
      extracted_metadata: {
        has_payment_proof: false,
        is_info_complete: false,
        missing_fields: ['user_id', 'payment_proof', 'payment_method'],
        branch_path: ['Subscription', 'Payment Inquiry']
      }
    }
  },
  {
    id: 'thread_a_2',
    threadId: 'thread_david',
    sender: 'david.verified@gmail.com',
    senderName: 'David Verified',
    subject: 'Re: Help: My Pro subscription is not active',
    body: 'Sorry, I forgot to provide my info. My MyShell UID is 12345678. I used Stripe.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'info_missing',
    aiResult: {
      category: SupportCategory.SUBSCRIPTION_MISSING_INFO,
      confidence: 0.98,
      should_auto_send: false,
      reply_email: "Thanks David! We have your UID 12345678. Please provide the screenshot.",
      chinese_summary: "用户意图：补全会员未到账调查所需资料。\n已经提供的资料：UID (12345678), 支付渠道 (Stripe)。\n当前邮件总结：用户补全了核心 ID 和支付方式，但仍缺少截图凭证，需继续索取。",
      selected_template_id: 'T1',
      extracted_metadata: {
        user_id: '12345678',
        payment_method: 'Stripe',
        has_payment_proof: false,
        is_info_complete: false,
        missing_fields: ['payment_proof'],
        branch_path: ['Subscription', 'Info Recovery']
      }
    }
  },
  {
    id: 'thread_a_3',
    threadId: 'thread_david',
    sender: 'david.verified@gmail.com',
    senderName: 'David Verified',
    subject: 'Re: Help: My Pro subscription is not active',
    body: 'I have attached the screenshot of my Stripe receipt here. Please check as soon as possible.',
    timestamp: new Date().toISOString(),
    status: 'ready_to_resolve',
    attachments: [{ id: 'att_david_1', filename: 'stripe_receipt.png', mimeType: 'image/png', size: 204800 }],
    aiResult: {
      category: SupportCategory.SUBSCRIPTION_VERIFIED,
      confidence: 0.99,
      should_auto_send: true,
      reply_email: "Thank you! We have verified your Stripe receipt for UID 12345678. Your Pro status has been updated.",
      chinese_summary: "用户意图：提交支付凭证完成核实。\n已经提供的资料：UID (12345678), Stripe, 支付截图。\n当前邮件总结：资料已齐全。AI 建议：核实数据库后手动/自动发放权益并回复。",
      selected_template_id: 'T7',
      extracted_metadata: {
        user_id: '12345678',
        payment_method: 'Stripe',
        has_payment_proof: true,
        is_info_complete: true,
        missing_fields: [],
        branch_path: ['Subscription', 'Verified']
      }
    }
  },
  // 会话链 D：删除账号纠纷
  {
    id: 'thread_d_1',
    threadId: 'thread_angry',
    sender: 'unhappy.customer@gmail.com',
    senderName: 'Unhappy Customer',
    subject: 'REFUND ME - ALREADY DELETED ACCOUNT',
    body: 'I deleted my account last week but you still charged me $19 via PayPal. This is unacceptable!',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    status: 'in_progress',
    aiResult: {
      category: SupportCategory.POST_DELETION_BILLING,
      confidence: 0.92,
      should_auto_send: false,
      reply_email: "We understand your frustration. Deleting an account does not cancel PayPal recurring payments...",
      chinese_summary: "用户意图：因删除账号后仍扣费要求退款。\n已经提供的资料：扣费金额 $19, 支付渠道 PayPal。\n当前邮件总结：典型的后置计费纠纷。需告知用户手动在 PayPal 侧关闭自动续费，并核实退款可行性。",
      selected_template_id: 'T6',
      extracted_metadata: {
        payment_method: 'PayPal',
        has_payment_proof: false,
        is_info_complete: true,
        missing_fields: [],
        branch_path: ['Billing', 'Post-Deletion Dispute']
      }
    }
  },
  // 会话链 E：普通咨询
  {
    id: 'thread_e_1',
    threadId: 'thread_query',
    sender: 'newbie@gmail.com',
    senderName: 'Newbie User',
    subject: 'Is MyShell available in Japanese?',
    body: 'Hello, I want to know if I can use Japanese voices for my bots. Thanks!',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    status: 'ready_to_resolve',
    aiResult: {
      category: SupportCategory.OTHER,
      confidence: 0.99,
      should_auto_send: true,
      reply_email: "Yes, MyShell supports various Japanese voices including 'Sakura' and 'Kaito'...",
      chinese_summary: "用户意图：咨询是否支持日语语音。\n已经提供的资料：无。\n当前邮件总结：一般性功能咨询。AI 建议直接告知支持日语，并引导尝试相关 Bot。",
      selected_template_id: 'T7',
      extracted_metadata: {
        has_payment_proof: false,
        is_info_complete: true,
        missing_fields: [],
        branch_path: ['General Inquiry', 'Feature Request']
      }
    }
  }
];
