
import { GoogleGenAI, Type } from "@google/genai";
import { AIClassificationResult, SupportCategory, ImageAnalysisResult } from "../types";

// ------------------------------------------------------------------
// TEMPLATE LIBRARY (STRICT VERBATIM)
// ------------------------------------------------------------------
const REPLY_TEMPLATES = {
  // Template 1A: Subscription - Missing Info
  T1_MISSING_INFO: `Dear Customer,

Thank you for contacting us.

To help us investigate and resolve your issue as efficiently as possible, could you please provide the following information:

- Your user ID
- The payment method used (e.g., PayPal or Stripe)
- Proof of payment (such as a receipt or screenshot)

Once we receive these details, our technical team will review your case and assist you promptly.

Thank you for your cooperation. We appreciate your patience and look forward to resolving this for you soon.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 1B: Subscription - All Info Verified (Wait 1 Week)
  T1_VERIFIED: `Dear Customer,

Thank you for providing the requested details.

We have successfully verified your User ID, Payment Method, and Payment Proof. Your case has been escalated to our billing team for manual review and processing.

Please allow up to **one week** for us to complete this request. We will notify you as soon as it is resolved.

Thank you for your patience and understanding.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 2: NSFW / Basic Plan
  T2_NSFW_PROMO: `Dear Customer,

Thank you for your patience. We understand how this change may feel, especially if you were using these features before.

At the moment, **NSFW products are available to Pro members only**.

Since we’re currently running a **Christmas promotion**, you can upgrade to the **Pro Yearly plan at 50% off** using the code below:

**UPGRADEPRO**

Upgrading will give you immediate access to all Pro features, including NSFW tools.

If you have any questions or need help, please feel free to let us know. We’re here to help.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 3: Account Error / Usage (Case Investigation)
  T3_ERROR_REPORT: `Dear Customer,

Thank you for contacting us.

We’ve received your message and have forwarded your case to the relevant team for further investigation. Our engineering team is currently reviewing the issue and working on a resolution.

**To help our engineers investigate and resolve this faster, could you please provide the following details:**

- **Your User ID:** (You can find this in your Profile/Settings section)
- **Platform Used:** (Web or IOS)
- **Additional Screenshots/Video:** (Optional, If you have any further visual details of the issue)

Please note that the investigation process may take up to **72 hours**. We’ll follow up with you as soon as we have an update.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 4: Account Deletion Request
  T4_DELETE_ACCOUNT: `Dear Customer,

Thank you for contacting us regarding your request.

You can delete your MyShell account and associated data directly by following these steps:

1. Log in to your MyShell account
2. Click on your profile avatar in the top-right corner
3. Go to **My Profile**
4. Scroll to the bottom of the page and select **Delete My Account**

Once the deletion is completed, your account and related personal data will be permanently removed in accordance with applicable data protection regulations.

If you experience any issues during this process or have further questions, please feel free to reply to this email and we’ll be happy to assist.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 5: Post-Deletion Billing (Cancel PayPal/Stripe)
  T5_CANCEL_SUB: `Dear Customer,

Please note that after deleting your account, you must cancel the subscription directly in PayPal or Stripe to avoid future charges.

Thank you for your understanding.

Best regards,
MyShell Support Team
MyShell AI`,

  // Template 6: Bot Power Deduction
  T6_POWER_DEDUCTION: `Dear Customer,

We understand that the recent change in how power usage is displayed may feel confusing, and we truly appreciate your patience.

The website has recently implemented a **dynamic power deduction system**. Power usage is calculated after each task is completed, so the deducted amount is not shown beforehand. Once the task finishes, the deduction will appear in the top-right corner as a reduction in your total power balance. This is expected behavior under the new system.

We are continuing to improve transparency around power usage and plan to roll out detailed power consumption reports later this week. This will allow you to clearly review your usage and understand how much power each bot consumes.

Thank you for your understanding and continued support. If you have any further questions, please feel free to contact us.

Best regards,
MyShell Support Team
MyShell AI`
};

const SYSTEM_INSTRUCTION = `
You are the decision-making engine for MyShell Support. 
You must analyze the email and Agent Notes to select the exact path from the decision tree below.

--- DECISION TREE LOGIC ---

BRANCH 1: SUBSCRIPTION / RECHARGE ISSUES
- Trigger: User claims payment failed, subscription not active, or missing credits.
- Check 3 Mandatory Items: 
   1. User ID (UID)
   2. Payment Method
   3. Payment Proof (Screenshot)
- IF (Any Item Missing):
   - Category: SUBSCRIPTION_MISSING_INFO
   - Action: Use Template T1A (Ask for missing info).
- IF (All Items Present):
   - Category: SUBSCRIPTION_VERIFIED
   - Action: Use Template T1B (Inform user to wait 1 week).

BRANCH 2: NSFW PRODUCT
- Trigger: User complains about NSFW censorship, "cant use bot", or mentions Basic Plan limitations regarding NSFW.
- Action: Use Template T2 (Christmas Promo).
- Category: NSFW_ISSUE

BRANCH 3: ACCOUNT ERROR / USAGE
- Trigger: "Error message", "Bug", "Not working", "Login failed".
- Action: Use Template T3 (Ask for UID/Platform/Screenshots, mention 72h).
- Category: ACCOUNT_USAGE_ERROR

BRANCH 4: ACCOUNT DELETION
- Trigger: "Delete my account", "Remove data", "GDPR".
- Action: Use Template T4 (Self-service instructions).
- Category: ACCOUNT_DELETION

BRANCH 5: POST-DELETION BILLING
- Trigger: "I deleted account but still got charged", "Cancel subscription after delete".
- Action: Use Template T5 (Cancel in PayPal/Stripe).
- Category: POST_DELETION_BILLING

BRANCH 6: BOT POWER / ENERGY
- Trigger: "Deducted too much energy", "Power usage wrong", "Cost issue".
- Action: Use Template T6 (Dynamic power deduction system).
- Category: BOT_POWER_ISSUE

--- INPUT HANDLING ---
- "AGENT NOTES" are overrides. If the agent types a UID, consider it PRESENT.
- "Attachments": If the email has image attachments, consider "Payment Proof" potentially PRESENT (subject to your analysis).

--- OUTPUT ---
Return JSON only.
fill 'reply_email' with the EXACT text from the selected template.
`;

export class SupportAgentService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private parseJSONResponse(text: string | undefined): any {
    if (!text) return {};
    try {
      const cleanJson = text.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("AI JSON Parse Failed:", text);
      return {
        category: SupportCategory.OTHER,
        confidence: 0,
        should_auto_send: false,
        reply_email: "Error parsing AI response.",
        extracted_metadata: { has_payment_proof: false, is_info_complete: false, missing_fields: [], branch_path: [] }
      };
    }
  }

  async analyzeEmail(email: { subject: string, body: string, attachments: any[], agentNotes?: string }): Promise<AIClassificationResult> {
    const ai = this.getAI();
    
    // Pass the templates to the model context so it can copy them perfectly
    const prompt = `
      EMAIL ANALYSIS TASK:
      
      SUBJECT: ${email.subject}
      BODY: ${email.body}
      HAS_ATTACHMENTS: ${email.attachments.length > 0}
      AGENT_NOTES_OVERRIDE: ${email.agentNotes || 'None'}

      AVAILABLE TEMPLATES (DO NOT MODIFY CONTENT, USE VERBATIM):
      T1A: ${REPLY_TEMPLATES.T1_MISSING_INFO}
      T1B: ${REPLY_TEMPLATES.T1_VERIFIED}
      T2: ${REPLY_TEMPLATES.T2_NSFW_PROMO}
      T3: ${REPLY_TEMPLATES.T3_ERROR_REPORT}
      T4: ${REPLY_TEMPLATES.T4_DELETE_ACCOUNT}
      T5: ${REPLY_TEMPLATES.T5_CANCEL_SUB}
      T6: ${REPLY_TEMPLATES.T6_POWER_DEDUCTION}
      
      INSTRUCTION:
      1. Classify the email based on the Decision Tree in System Instructions.
      2. If it is a Subscription issue, strictly check for UID, Method, and Proof.
      3. IF missing info -> Use T1A.
      4. IF all info present -> Use T1B.
      5. Select the correct template code for other cases.
      6. Return the full template text in 'reply_email'.
      7. Extract metadata (user_id, payment_method, etc).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
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
          required: ["category", "confidence", "should_auto_send", "reply_email", "extracted_metadata"]
        }
      }
    });

    return this.parseJSONResponse(response.text);
  }

  async analyzeImage(base64Data: string, mimeType: string, context: string): Promise<ImageAnalysisResult> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `Analyze this MyShell support attachment. Extract UID, Transaction ID, Payment Platform (Stripe/PayPal), and Status. Context: ${context}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            detected_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING }
          },
          required: ["summary", "detected_issues", "recommendation"]
        }
      }
    });
    return this.parseJSONResponse(response.text);
  }
}

export const supportAgent = new SupportAgentService();
