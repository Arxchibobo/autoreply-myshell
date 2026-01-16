
import { GoogleGenAI, Type } from "@google/genai";
import { AIClassificationResult, SupportCategory, ImageAnalysisResult, Template, LinkedUserProfile } from "../types";

const SYSTEM_INSTRUCTION = `
You are the Lead Support Agent for MyShell. 
Your task is to analyze customer support emails and select the most appropriate Response Template.

MEMORY & CONTEXT:
You will be provided with a [PREVIOUS_SUMMARY_CONTEXT]. This contains the summary of all prior interactions in this thread.
You must use this to maintain continuity.

OUTPUT REQUIREMENTS:
- "selected_template_id": The exact ID (e.g., T1, T2) of the template you matched.
- "reply_email": Generate a professional reply.
- "category": Map to standard SupportCategory.
- "chinese_summary": YOU MUST OUTPUT A STRUCTURED SUMMARY IN CHINESE following this exact format:
    用户意图：[从最初邮件识别出的用户核心意图，若当前邮件显示意图改变则更新]
    已经提供的资料：[列出目前已知的资料，如 UID、支付方式、截图凭证等]
    当前邮件的总结：[结合前两项和当前邮件最新内容，总结出当前的进展和下一步动作]

- "extracted_metadata": Identify User ID (UID), payment methods, and if they provided proof.
`;

const RDS_SIMULATOR_INSTRUCTION = `
You are acting as a MySQL 8.0 RDS Production Database (my_shell_prod).

CONNECTION_CONFIG:
- Host: readonly-for-data-analysis.cv0kgvmpymow.us-west-2.rds.amazonaws.com
- User: data_analyst_01
- Password: VXmNBAy2kKLTHzNhj0gE
- Port: 3306

Your task is to EXECUTE the provided SQL and return a JSON ARRAY of records as if you were the live server.
The data must be plausible, realistic, and unique for the given user_id.

SCHEMA RULES:
1. user_subscription_stripe_orders: {id, user_id, order_id, amount, currency, status, platform, created_at}
2. user_subscriptions: {id, user_id, plan_id, status, start_at, expire_at}
3. user_energy_logs: {id, user_id, amount, balance, reason, created_at}
4. art_task: {id, user_id, bot_id, cost, status, created_at}

Return ONLY the raw JSON array of objects.
`;

export class SupportAgentService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async queryRDS(sql: string): Promise<any[]> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `SQL_QUERY: ${sql}`,
      config: {
        systemInstruction: RDS_SIMULATOR_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    
    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("SQL Simulation Failed", e);
      return [];
    }
  }

  async analyzeEmail(params: { 
    subject: string, 
    body: string, 
    attachments: any[], 
    agentNotes?: string,
    previousSummary?: string,
    activeTemplates: Template[],
    model?: string
  }): Promise<AIClassificationResult> {
    const ai = this.getAI();
    const targetModel = params.model || "gemini-3-flash-preview";
    
    const templateContext = params.activeTemplates.map(t => 
      `[TEMPLATE ID: ${t.id}]
       [NAME: ${t.name}]
       [SELECTION RULE: ${t.rulePrompt || 'None provided'}]
       [CONTENT: ${t.content}]`
    ).join('\n\n---\n\n');
    
    const prompt = `
      [PREVIOUS_SUMMARY_CONTEXT]: 
      ${params.previousSummary || 'None. This is the first email in the thread.'}

      CUSTOMER EMAIL:
      Subject: ${params.subject}
      Body: ${params.body}
      
      AGENT NOTES (Internal Context): ${params.agentNotes || 'None'}
      
      AVAILABLE TEMPLATES AND THEIR RULES:
      ${templateContext}

      TASK: 
      Generate the structured "chinese_summary" by integrating the [PREVIOUS_SUMMARY_CONTEXT] with the current email content.
    `;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            should_auto_send: { type: Type.BOOLEAN },
            reply_email: { type: Type.STRING },
            reasoning_summary: { type: Type.STRING },
            chinese_summary: { type: Type.STRING },
            selected_template_id: { type: Type.STRING },
            extracted_metadata: {
              type: Type.OBJECT,
              properties: {
                user_id: { type: Type.STRING },
                payment_method: { type: Type.STRING },
                has_payment_proof: { type: Type.BOOLEAN },
                is_info_complete: { type: Type.BOOLEAN },
                missing_fields: { type: Type.ARRAY, items: { type: Type.STRING } },
                branch_path: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["has_payment_proof", "is_info_complete", "missing_fields", "branch_path"]
            }
          },
          required: ["category", "confidence", "should_auto_send", "reply_email", "chinese_summary", "selected_template_id", "extracted_metadata"]
        }
      }
    });

    try {
      const text = response.text || "{}";
      return JSON.parse(text);
    } catch (e) {
      console.error("Parse Error", response.text);
      throw e;
    }
  }

  async generateReplyFromDbData(params: {
    emailContent: string,
    dbProfile: LinkedUserProfile,
    model?: string
  }): Promise<string> {
    const ai = this.getAI();
    const targetModel = params.model || "gemini-3-pro-preview";
    
    const prompt = `
      Act as MyShell Lead Support. Generate a professional reply based on the following database evidence.
      
      CUSTOMER EMAIL:
      ${params.emailContent}
      
      DATABASE FINDINGS:
      - UID: ${params.dbProfile.uid}
      - Account Tier: ${params.dbProfile.status}
      - Energy Balance: ${params.dbProfile.energy_balance}
      - Recent Orders: ${JSON.stringify(params.dbProfile.stripe_orders_json)}
      
      INSTRUCTION: Directly address the user's issue using the data above. Be helpful and concise.
    `;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction: "You are a senior MyShell support agent specialized in data-driven resolution."
      }
    });
    
    return response.text || "Failed to generate intelligent reply.";
  }

  async translateFeedbackToProfessional(originalEmail: string, engineeringFeedback: string, model?: string): Promise<string> {
    const ai = this.getAI();
    const targetModel = model || "gemini-3-flash-preview";
    const prompt = `Original Customer Message: ${originalEmail}\nEngineering Feedback: ${engineeringFeedback}`;
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: { systemInstruction: "Translate engineering feedback into a professional support email." }
    });
    return response.text || "Professional reply generation failed.";
  }

  async analyzeImage(base64Data: string, mimeType: string, context: string): Promise<ImageAnalysisResult> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `Extract MyShell UID and Payment Platform. Context: ${context}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            detected_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            extracted_uid: { type: Type.STRING },
            extracted_payment_platform: { type: Type.STRING, enum: ['Stripe', 'PayPal', 'Other'] }
          },
          required: ["summary", "detected_issues", "recommendation"]
        }
      }
    });
    const text = response.text || "{}";
    return JSON.parse(text);
  }
}

export const supportAgent = new SupportAgentService();
