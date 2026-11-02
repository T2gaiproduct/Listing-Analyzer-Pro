import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  computeRevenueCalculator,
  defaultReferralFeePercentForCategory,
} from "@/lib/revenue-calculator";

function formatMoney(value: number, currency: string): string {
  if (currency === "INR") {
    return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function parseNum(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-[11px]"
      />
      {hint && <p className="text-[9px] text-slate-400">{hint}</p>}
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          highlight === "positive" && "text-emerald-700",
          highlight === "negative" && "text-red-600",
          (!highlight || highlight === "neutral") && "text-slate-800",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ProductRevenueCalculatorPanel({
  productName,
  category,
  initialSellingPrice,
  currency = "INR",
}: {
  productName?: string;
  category?: string | null;
  initialSellingPrice?: number | null;
  currency?: string;
}) {
  const defaultReferral = defaultReferralFeePercentForCategory(category);

  const [sellingPrice, setSellingPrice] = useState(
    () => (initialSellingPrice != null && initialSellingPrice > 0 ? String(initialSellingPrice) : ""),
  );
  const [cogs, setCogs] = useState("");
  const [referralPercent, setReferralPercent] = useState(String(defaultReferral));
  const [closingFee, setClosingFee] = useState("0");
  const [fbaFee, setFbaFee] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [unitsPerMonth, setUnitsPerMonth] = useState("30");

  const result = useMemo(() => computeRevenueCalculator({
    sellingPrice: parseNum(sellingPrice),
    cogs: parseNum(cogs),
    referralFeePercent: parseNum(referralPercent),
    closingFee: parseNum(closingFee),
    fbaFee: parseNum(fbaFee),
    otherCosts: parseNum(otherCosts),
    unitsPerMonth: parseNum(unitsPerMonth),
  }), [sellingPrice, cogs, referralPercent, closingFee, fbaFee, otherCosts, unitsPerMonth]);

  const profitHighlight = result
    ? (result.netProfitPerUnit > 0 ? "positive" : result.netProfitPerUnit < 0 ? "negative" : "neutral")
    : undefined;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
          <Calculator className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Revenue calculator</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Estimate fees and profit per unit{productName ? ` for ${productName}` : ""}. Amazon India-style fees; adjust percentages to match your category.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="rc-price" label="Selling price" value={sellingPrice} onChange={setSellingPrice} />
        <Field id="rc-cogs" label="Cost of goods (COGS)" value={cogs} onChange={setCogs} />
        <Field
          id="rc-referral"
          label="Referral fee (%)"
          hint={category ? `Default for ${category}` : undefined}
          value={referralPercent}
          onChange={setReferralPercent}
        />
        <Field id="rc-closing" label="Closing fee (flat)" value={closingFee} onChange={setClosingFee} />
        <Field id="rc-fba" label="FBA / fulfillment fee" value={fbaFee} onChange={setFbaFee} />
        <Field id="rc-other" label="Other costs per unit" value={otherCosts} onChange={setOtherCosts} />
        <Field
          id="rc-units"
          label="Units per month (estimate)"
          value={unitsPerMonth}
          onChange={setUnitsPerMonth}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2">
        {!result ? (
          <p className="text-[11px] text-slate-500 py-3 text-center">Enter a selling price to see profit estimates.</p>
        ) : (
          <>
            <ResultRow label="Referral fee" value={formatMoney(result.referralFee, currency)} />
            <ResultRow label="Total fees + other" value={formatMoney(result.totalFees, currency)} />
            <ResultRow
              label="Net profit per unit"
              value={formatMoney(result.netProfitPerUnit, currency)}
              highlight={profitHighlight}
            />
            <ResultRow
              label="Margin"
              value={`${result.marginPercent.toFixed(1)}%`}
              highlight={profitHighlight}
            />
            <ResultRow label="Break-even price" value={formatMoney(result.breakEvenPrice, currency)} />
            <ResultRow
              label="Est. monthly profit"
              value={formatMoney(result.estimatedMonthlyProfit, currency)}
              highlight={profitHighlight}
            />
          </>
        )}
      </div>

      <p className="text-[9px] text-slate-400 text-center px-2">
        Estimates only — not tax or GST advice. Use Seller Central fee previews for live listings.
      </p>
    </div>
  );
}
