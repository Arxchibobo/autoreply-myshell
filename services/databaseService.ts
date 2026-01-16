
import { DatabaseTicket } from "../types";

export class DatabaseService {
  private mockDelay = 800;

  async fetchTicketsByDate(date: string): Promise<DatabaseTicket[]> {
    console.log(`[DB_SERVICE] Fetching from RDS for date: ${date}`);
    await new Promise(resolve => setTimeout(resolve, this.mockDelay));

    return [
      {
        id: `db_99812`,
        user_id: "882731",
        email: "customer.db@example.com",
        subject: "[TECHNICAL] API Error 500 during voice synthesis",
        payment_method: "Stripe",
        proof_of_payment: ["https://placehold.co/600x400/f8fafc/6366f1?text=Error+Log+Screenshot"],
        status: 'pending',
        created_date: `${date}T10:30:00Z`,
        updated_date: `${date}T10:30:00Z`,
        agentNotes: "Backend investigation: User was hitting rate limits due to high frequency calls from a single IP. We have manually cleared the cache for this UID."
      },
      {
        id: `db_99813`,
        user_id: "772102",
        email: "payer@gmail.com",
        subject: "Stripe payment verified but no Pro status",
        payment_method: "Stripe",
        proof_of_payment: ["https://placehold.co/600x400/f8fafc/10b981?text=Stripe+Receipt+Mock"],
        status: 'pending',
        created_date: `${date}T14:45:00Z`,
        updated_date: `${date}T14:45:00Z`,
        agentNotes: "Backend investigation: Transaction TXN_99283 found. It was stuck in 'Pending' status. Now manually set to 'Succeeded'. Pro status should be active now."
      }
    ];
  }
}

export const dbService = new DatabaseService();
