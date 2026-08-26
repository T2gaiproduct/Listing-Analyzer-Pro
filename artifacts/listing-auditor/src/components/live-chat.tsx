import { CheckCircle2, Loader2, MessageCircle, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PUBLIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/about",
  "/blog",
  "/tutorials",
  "/contact",
  "/help",
  "/enterprise",
  "/terms",
  "/privacy",
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function buildTicketSubject(message: string): string {
  const preview = message.trim().replace(/\s+/g, " ");
  if (!preview) return "Live chat question";
  return preview.length > 60 ? `Live chat: ${preview.slice(0, 57)}...` : `Live chat: ${preview}`;
}

export function LiveChatWidget() {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");

  const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const signedInName = user?.fullName?.trim() || undefined;

  const isPublicPage = PUBLIC_PATHS.some(
    (path) => window.location.pathname === path || window.location.pathname.endsWith(path),
  );

  useEffect(() => {
    if (isLoaded && signedInEmail) {
      setEmail(signedInEmail);
    }
  }, [isLoaded, signedInEmail]);

  if (!isPublicPage) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail) {
      setError("Please enter your email so we can reply.");
      return;
    }
    if (!trimmedMessage) {
      setError("Please enter your question.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "support",
          email: trimmedEmail,
          name: signedInName,
          data: {
            subject: buildTicketSubject(trimmedMessage),
            message: trimmedMessage,
          },
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to send message");
      }

      setSubmitted(true);
      setSentMessage(trimmedMessage);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError("");
      if (submitted) {
        setSubmitted(false);
        setSentMessage("");
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(!open)}
        className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-[5.5rem] right-4 sm:bottom-24 sm:right-6 z-40 w-[min(100vw-2rem,20rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col max-h-[min(32rem,calc(100dvh-7rem))]">
          <div className="bg-slate-900 text-white p-4 shrink-0">
            <h3 className="font-semibold text-sm">Need help?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Send a message — our team will reply by email.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              Hi there! How can we help you with your Amazon listings today?
            </div>

            {submitted && (
              <div className="space-y-2">
                <div className="ml-auto max-w-[90%] rounded-lg bg-orange-500 text-white px-3 py-2 text-sm">
                  {sentMessage}
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-100 p-3 text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Thanks! We received your message and will reply to {email.trim()} shortly.</span>
                </div>
              </div>
            )}

            {!submitted && (
              <>
                <div className="space-y-2">
                  <Link
                    href="/help"
                    onClick={() => handleOpenChange(false)}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
                  >
                    Browse Help Center
                  </Link>
                  <Link
                    href="/tutorials"
                    onClick={() => handleOpenChange(false)}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
                  >
                    Watch Tutorials
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => handleOpenChange(false)}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
                  >
                    Send us an email
                  </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2 pt-1">
                  {!signedInEmail && (
                    <Input
                      type="email"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-sm"
                      required
                      disabled={submitting}
                    />
                  )}
                  <Textarea
                    placeholder="Type your question…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[72px] resize-none text-sm"
                    required
                    disabled={submitting}
                  />
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send message
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <p className="text-xs text-slate-400 text-center">
              Messages create a support ticket for our team.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
