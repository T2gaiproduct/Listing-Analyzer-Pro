import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LISTING_CURRENCY_OPTIONS,
  formatListingMoney,
  normalizeListingCurrency,
} from "@/lib/listing-currencies";
import {
  computeRevenueCalculator,
  defaultReferralFeePercentForCategory,
} from "@/lib/revenue-calculator";

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
  currency: currencyProp,
}: {
  productName?: string;
  category?: string | null;
  initialSellingPrice?: number | null;
  currency?: string | null;
}) {
  const defaultReferral = defaultReferralFeePercentForCategory(category);
  const resolvedCurrency = normalizeListingCurrency(currencyProp);

  const [currency, setCurrency] = useState(resolvedCurrency);
  const [sellingPrice, setSellingPrice] = useState(
    () => (initialSellingPrice != null && initialSellingPrice > 0 ? String(initialSellingPrice) : ""),
  );
  const [cogs, setCogs] = useState("");
  const [referralPercent, setReferralPercent] = useState(String(defaultReferral));
  const [closingFee, setClosingFee] = useState("0");
  const [fbaFee, setFbaFee] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [unitsPerMonth, setUnitsPerMonth] = useState("30");

  useEffect(() => {
    setCurrency(normalizeListingCurrency(currencyProp));
  }, [currencyProp]);

  useEffect(() => {
    if (initialSellingPrice != null && initialSellingPrice > 0) {
      setSellingPrice(String(initialSellingPrice));
    }
  }, [initialSellingPrice]);

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

  const money = (value: number) => formatListingMoney(value, currency);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
          <Calculator className="w-4 h-4 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Revenue calculator</h3>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="rc-currency" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Currency
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="rc-currency" className="h-8 w-[5.5rem] text-[11px] font-mono px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code} className="text-xs font-mono">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Estimate fees and profit per unit{productName ? ` for ${productName}` : ""}.
            Uses your listing currency ({currency}); adjust fees for your marketplace and category.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id="rc-price" label={`Selling price (${currency})`} value={sellingPrice} onChange={setSellingPrice} />
        <Field id="rc-cogs" label={`Cost of goods / COGS (${currency})`} value={cogs} onChange={setCogs} />
        <Field
          id="rc-referral"
          label="Referral fee (%)"
          hint={category ? `Suggested default for ${category} — edit for your marketplace` : "Edit to match your marketplace category"}
          value={referralPercent}
          onChange={setReferralPercent}
        />
        <Field id="rc-closing" label={`Closing fee flat (${currency})`} value={closingFee} onChange={setClosingFee} />
        <Field id="rc-fba" label={`FBA / fulfillment fee (${currency})`} value={fbaFee} onChange={setFbaFee} />
        <Field id="rc-other" label={`Other costs per unit (${currency})`} value={otherCosts} onChange={setOtherCosts} />
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
            <ResultRow label="Referral fee" value={money(result.referralFee)} />
            <ResultRow label="Total fees + other" value={money(result.totalFees)} />
            <ResultRow
              label="Net profit per unit"
              value={money(result.netProfitPerUnit)}
              highlight={profitHighlight}
            />
            <ResultRow
              label="Margin"
              value={`${result.marginPercent.toFixed(1)}%`}
              highlight={profitHighlight}
            />
            <ResultRow label="Break-even price" value={money(result.breakEvenPrice)} />
            <ResultRow
              label="Est. monthly profit"
              value={money(result.estimatedMonthlyProfit)}
              highlight={profitHighlight}
            />
          </>
        )}
      </div>

      <p className="text-[9px] text-slate-400 text-center px-2">
        Estimates only — not tax advice. Confirm live fees in your marketplace Seller Central / seller dashboard.
      </p>
    </div>
  );
}
