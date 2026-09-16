import { LifeBuoy } from "lucide-react";
import { SupportTicketForm } from "@/components/support-ticket-form";

export default function SupportTicketPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-orange-500" />
          Support Ticket
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us what you need help with. Replies go to the email on your account.
        </p>
      </div>
      <SupportTicketForm />
    </div>
  );
}
