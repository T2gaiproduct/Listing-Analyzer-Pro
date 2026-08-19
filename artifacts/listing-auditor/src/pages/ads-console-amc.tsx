import { AdsConsoleLayout } from "@/components/ads-console-layout";
import { AdsConsoleToolbar } from "@/components/ads-console-toolbar";

export default function AdsAmcAudiencesPage() {
  return (
    <AdsConsoleLayout>
      <AdsConsoleToolbar
        title="AMC Audiences"
        compare={false}
        onCompareChange={() => {}}
        selectedCount={0}
        showBulk={false}
      />
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-800">Amazon Marketing Cloud audiences</p>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          AMC audience management requires Amazon Marketing Cloud setup. This view will list AMC audiences when your account is linked.
        </p>
      </div>
    </AdsConsoleLayout>
  );
}
