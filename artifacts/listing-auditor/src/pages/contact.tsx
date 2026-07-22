import { useState, useMemo } from "react";
import { PageSeo } from "@/components/page-seo";
import { Mail, Phone, MapPin, Clock, Calendar, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/public-layout";
import { useCompanyContact } from "@/hooks/use-company-contact";
import { DEFAULT_SUPPORT_HOURS } from "@/lib/company-contact";

type FormType = "contact" | "demo" | "enterprise";

export default function Contact() {
  const { contact } = useCompanyContact();
  const [formType, setFormType] = useState<FormType>("contact");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactInfo = useMemo(() => [
    { icon: Mail, label: "Email", value: contact.supportEmail, href: `mailto:${contact.supportEmail}` },
    { icon: Phone, label: "Phone", value: contact.supportPhone, href: contact.supportPhone ? `tel:${contact.supportPhone.replace(/\s/g, "")}` : undefined },
    { icon: MapPin, label: "Address", value: contact.companyAddress },
    { icon: Clock, label: "Support Hours", value: DEFAULT_SUPPORT_HOURS },
  ].filter((item) => item.value?.trim()), [contact]);

  const [form, setForm] = useState({
    name: "", email: "", company: "", phone: "",
    subject: "", message: "", demoDate: "", teamSize: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  }

  const tabs: { key: FormType; label: string }[] = [
    { key: "contact", label: "General Inquiry" },
    { key: "demo", label: "Book a Demo" },
    { key: "enterprise", label: "Enterprise Sales" },
  ];

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <PageSeo
        pageSlug="contact"
        title="Contact Us"
        description="Get in touch with the SellerLens team for sales, support, or partnership inquiries."
      />
      <PublicNav />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-16 text-center">
        <Badge variant="outline" className="mb-6 border-orange-200 text-orange-600 bg-orange-50">
          Get in touch
        </Badge>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          We'd love to hear from you
        </h1>
        <p className="text-lg text-slate-500 max-w-lg mx-auto">
          Whether you have a question, want a demo, or need an enterprise solution — we're here.
        </p>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: contact info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Contact information</h2>
              <div className="space-y-4">
                {contactInfo.map((c) => (
                  <div key={c.label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <c.icon className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                      {c.href ? (
                        <a href={c.href} className="text-slate-700 text-sm font-medium hover:text-orange-600 transition-colors">
                          {c.value}
                        </a>
                      ) : (
                        <p className="text-slate-700 text-sm font-medium">{c.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
              <Calendar className="w-5 h-5 text-orange-500 mb-3" />
              <p className="font-semibold text-slate-900 text-sm mb-1">Book a live demo</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                See SellerLens in action with a 15-minute personalized walkthrough from our team.
              </p>
              <Button
                size="sm"
                className="mt-3 bg-orange-500 hover:bg-orange-600 text-white w-full"
                onClick={() => setFormType("demo")}
              >
                Schedule demo
              </Button>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setFormType(t.key); setSubmitted(false); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    formType === t.key
                      ? "bg-orange-500 text-white shadow"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Message sent!</h3>
                <p className="text-slate-500 max-w-sm">
                  Thanks for reaching out. Our team will get back to you within 1 business day.
                </p>
                <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(false); setForm({ name:"",email:"",company:"",phone:"",subject:"",message:"",demoDate:"",teamSize:"" }); }}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full name *</Label>
                    <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Sahil Verma" required className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email address *</Label>
                    <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required className="mt-1" />
                  </div>
                </div>

                {(formType === "demo" || formType === "enterprise") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company">Company name</Label>
                      <Input id="company" name="company" value={form.company} onChange={handleChange} placeholder="Acme Corp" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone number</Label>
                      <Input id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" className="mt-1" />
                    </div>
                  </div>
                )}

                {formType === "enterprise" && (
                  <div>
                    <Label htmlFor="teamSize">Team size</Label>
                    <select
                      id="teamSize"
                      name="teamSize"
                      value={form.teamSize}
                      onChange={handleChange}
                      className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="">Select team size</option>
                      <option>1–5</option>
                      <option>6–20</option>
                      <option>21–50</option>
                      <option>51–200</option>
                      <option>200+</option>
                    </select>
                  </div>
                )}

                {formType === "demo" && (
                  <div>
                    <Label htmlFor="demoDate">Preferred demo date</Label>
                    <Input id="demoDate" name="demoDate" type="date" value={form.demoDate} onChange={handleChange} className="mt-1" />
                  </div>
                )}

                {formType === "contact" && (
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input id="subject" name="subject" value={form.subject} onChange={handleChange} placeholder="How can we help?" required className="mt-1" />
                  </div>
                )}

                <div>
                  <Label htmlFor="message">
                    {formType === "enterprise" ? "Tell us about your needs *" : formType === "demo" ? "What would you like to see? *" : "Message *"}
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder={
                      formType === "enterprise"
                        ? "Describe your catalog size, team, and goals..."
                        : formType === "demo"
                        ? "Share your product category or any specific questions..."
                        : "Your message..."
                    }
                    required
                    rows={5}
                    className="mt-1"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  {loading ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {formType === "demo" ? "Request Demo" : formType === "enterprise" ? "Contact Sales" : "Send Message"}
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
