import { useLocation } from "wouter";
import { XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-9 h-9 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment cancelled</h1>
        <p className="text-slate-500 text-sm mb-6">
          No worries — you can try again or choose a different plan anytime.
        </p>
        <div className="flex flex-col gap-3">
          <Button className="bg-orange-500 hover:bg-orange-600 w-full" onClick={() => setLocation("/onboarding")}>
            <RotateCcw className="w-4 h-4 mr-2" /> Try again
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/pricing")}>
            View all plans <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
