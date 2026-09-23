import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

const LazyDonut = lazyWithRetry(() =>
  import("./dashboard-donut-chart-inner").then((m) => ({ default: m.DashboardDonutChartInner })),
);

type CreditSlice = {
  key: string;
  label: string;
  balance: number;
  pct: number;
  color: string;
};

export function DashboardDonutChart({
  data,
  total,
}: {
  data: CreditSlice[];
  total: number;
}) {
  return (
    <Suspense
      fallback={
        <div className="relative h-40 sm:h-52 flex items-center justify-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
      }
    >
      <LazyDonut data={data} total={total} />
    </Suspense>
  );
}
