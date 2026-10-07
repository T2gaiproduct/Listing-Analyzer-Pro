import { LifeBuoy } from "lucide-react";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { SupportTicketInbox } from "@/components/support-ticket-inbox";

export default function SupportTicketPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-orange-500" />
          Support Ticket
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit a ticket, read replies from our team, and continue the conversation here. We also email your account address.
        </p>
      </div>
      <SupportTicketForm />
      <SupportTicketInbox />
    </div>
  );
}
