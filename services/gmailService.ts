
import { Email, Attachment } from "../types";

export class GmailApiService {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  private decodeBase64(base64url: string): string {
    try {
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const binStr = atob(base64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) { return ""; }
  }

  private cleanHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || doc.body.innerText || "";
  }

  private parseMessagePart(part: any): string {
    let body = "";
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += this.decodeBase64(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      body += this.cleanHtml(this.decodeBase64(part.body.data));
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        body += this.parseMessagePart(subPart);
      }
    }
    return body;
  }

  private extractAttachments(part: any, list: Attachment[] = []) {
    if (part.body?.attachmentId) {
      list.push({
        id: part.body.attachmentId,
        filename: part.filename || "unnamed_attachment",
        mimeType: part.mimeType,
        size: part.body.size || 0
      });
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        this.extractAttachments(subPart, list);
      }
    }
    return list;
  }

  async fetchAttachmentData(messageId: string, attachmentId: string): Promise<string> {
    if (!this.accessToken) return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    if (response.status === 401) throw new Error("AUTH_EXPIRED");
    const data = await response.json();
    return data.data.replace(/-/g, '+').replace(/_/g, '/');
  }

  async fetchMessages(maxResults: number = 50): Promise<Email[]> {
    if (!this.accessToken) return [];
    
    // Updated query: fetch from last 30 days instead of 7 days.
    const query = encodeURIComponent("label:INBOX -category:promotions -category:social newer_than:30d"); 
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${query}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    
    if (listResponse.status === 401) throw new Error("AUTH_EXPIRED");
    const listData = await listResponse.json();
    if (!listData.messages) return [];

    const emailPromises = listData.messages.map(async (msg: { id: string }) => {
      try {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const detail = await detailResponse.json();
        const headers = detail.payload.headers;
        
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
        const fromRaw = headers.find((h: any) => h.name === "From")?.value || "";
        const messageId = headers.find((h: any) => h.name === "Message-ID")?.value || "";
        
        const fromMatch = fromRaw.match(/(.*)<(.*)>/);
        const senderName = fromMatch ? fromMatch[1].trim() : fromRaw;
        const senderEmail = fromMatch ? fromMatch[2].trim() : fromRaw;

        const body = this.parseMessagePart(detail.payload) || detail.snippet || "";
        const attachments = this.extractAttachments(detail.payload);
        const labels = detail.labelIds || [];

        return {
          id: detail.id,
          threadId: detail.threadId,
          messageId: messageId,
          sender: senderEmail,
          senderName: senderName.replace(/^"|"$/g, ''),
          subject: subject,
          body: body,
          timestamp: new Date(parseInt(detail.internalDate)).toISOString(),
          isRead: !labels.includes("UNREAD"),
          status: labels.includes("UNREAD") ? 'new' : 'in_progress',
          attachments: attachments
        } as Email;
      } catch (e) { return null; }
    });

    const results = await Promise.all(emailPromises);
    return results.filter(item => item !== null) as Email[];
  }

  async sendReply(to: string, subject: string, threadId: string, originalMessageId: string, body: string) {
    if (!this.accessToken) return true;

    const utf8Encode = (str: string) => {
      return `=?utf-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`;
    };

    const emailSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    
    const lines = [
      `To: ${to}`,
      `Subject: ${utf8Encode(emailSubject)}`,
      `In-Reply-To: ${originalMessageId}`,
      `References: ${originalMessageId}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(body)))
    ];

    const raw = btoa(unescape(encodeURIComponent(lines.join('\r\n'))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw, threadId }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Send failed");
    }
    return true;
  }
}

export const gmailApi = new GmailApiService();
