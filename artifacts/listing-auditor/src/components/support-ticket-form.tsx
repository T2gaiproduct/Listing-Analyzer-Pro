import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SupportTicketForm({ compact = false }: { compact?: boolean }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const { data: profileData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () =>
      fetchJson<{ profile: { fullName: string | null } | null }>(`${basePath}/api/profile`),
    enabled: isLoaded && isSignedIn,
    staleTime: 60_000,
  });

  const defaultName =
    profileData?.profile?.fullName?.trim()
    || user?.fullName?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
    || "";

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [concern, setConcern] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (defaultName && !name) setName(defaultName);
  }, [defaultName, name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) return;
    const trimmedSubject = subject.trim();
    const trimmedConcern = concern.trim();
    const trimmedName = name.trim();
    if (!trimmedName || !trimmedSubject || !trimmedConcern) {
      toast({
        title: "Missing fields",
        description: "Please fill in name, subject, and your concern.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson(`${basePath}/api/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "support",
          name: trimmedName,
          data: { subject: trimmedSubject, message: trimmedConcern },
        }),
      });
      toast({
        title: "Ticket submitted",
        description: `We will reply to ${accountEmail} within one business day.`,
      });
      setSubject("");
      setConcern("");
    } catch (err) {
      toast({
        title: "Could not submit ticket",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!isSignedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign in to submit a support ticket.
      </p>
    );
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="support-ticket-name">Name *</Label>
          <Input
            id="support-ticket-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-ticket-email">Email *</Label>
          <Input
            id="support-ticket-email"
            type="email"
            value={accountEmail}
            readOnly
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="support-ticket-subject">Subject *</Label>
        <Input
          id="support-ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary"
          required
          disabled={submitting}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="support-ticket-concern">Concern *</Label>
        <Textarea
          id="support-ticket-concern"
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          placeholder="Describe your issue in detail…"
          className="min-h-[140px] resize-y"
          required
          disabled={submitting}
        />
      </div>
      <Button
        type="submit"
        className="bg-orange-500 hover:bg-orange-600 text-white"
        disabled={submitting || !name.trim() || !subject.trim() || !concern.trim()}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit ticket"
        )}
      </Button>
    </form>
  );

  if (compact) return formBody;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-orange-500" />
          Submit a ticket
        </CardTitle>
        <CardDescription>
          Describe your issue and our team will email you at your account address.
        </CardDescription>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
