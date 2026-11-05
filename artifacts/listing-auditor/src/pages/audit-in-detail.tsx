import { FileSearch, LayoutDashboard } from "lucide-react";
import { FeatureProductHistoryTable } from "@/components/feature-product-history-table";

export default function AuditInDetail() {
  return (
    <div className="w-full min-w-0 py-10 space-y-12 animate-in fade-in duration-500">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
          Audit in <span className="text-orange-500">detail</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
          Open any listing audit to review the product overview, scores, and AI recommendations —
          the same experience as after you continue from import or audit listing.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium text-foreground">Product summary overview</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <FileSearch className="w-4 h-4 text-orange-600" />
            </div>
            <span className="font-medium text-foreground">Listing scores &amp; fixes</span>
          </div>
        </div>
      </div>

      <FeatureProductHistoryTable
        sourceType="audit"
        viewTarget="audit-detail"
        sectionTitle="Your audits"
        emptyTitle="No audits to open yet"
        emptyDescription="Start from Audit Listing to run an audit, then return here to open the full overview and results."
      />
    </div>
  );
}
