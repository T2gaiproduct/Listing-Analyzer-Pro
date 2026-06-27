import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, FileText, Image, FileText as FileTextIcon, Download, Sparkles } from "lucide-react";

const steps = [
  { number: "1", icon: Upload, title: "Upload Product Information", desc: "Upload product data or click the picture" },
  { number: "2", icon: FileText, title: "Listing", desc: "AI generates compelling product titles, bullets & descriptions" },
  { number: "3", icon: Image, title: "Graphics", desc: "Create stunning product images and infographics" },
  { number: "4", icon: FileTextIcon, title: "A+ Content", desc: "Generate professional A+ content to boost conversions" },
  { number: "5", icon: Download, title: "Export", desc: "Export and publish your listing to your store" },
];

export default function AuditNew() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Create Product Listings{" "}
          <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Using AI</span>
          <Sparkles className="inline w-6 h-6 text-orange-400 ml-1 align-middle" />
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Turn product information into high-converting listings in minutes.
        </p>
        <Button
          size="lg"
          className="mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 rounded-xl shadow-lg shadow-orange-500/20"
          onClick={() => setLocation("/audits/workflow")}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Start Generating
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Works with Shopify, Walmart, eBay, and most product pages
        </p>
      </div>

      {/* How It Works */}
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-orange-300" />
          <span className="text-xs font-semibold text-orange-500 uppercase tracking-widest">How It Works</span>
          <div className="h-px w-8 bg-orange-300" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <Card className="border-border/60 hover:border-orange-300/50 transition-colors h-full">
                  <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{step.desc}</p>
                    </div>
                  </CardContent>
                </Card>
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 w-6 items-center justify-center z-10">
                    <ArrowRight className="w-4 h-4 text-orange-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects appear in sidebar recents only */}
    </div>
  );
}
