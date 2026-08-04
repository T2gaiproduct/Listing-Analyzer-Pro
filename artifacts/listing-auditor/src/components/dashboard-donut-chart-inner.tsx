import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type CreditSlice = {
  key: string;
  label: string;
  balance: number;
  pct: number;
  color: string;
};

export function DashboardDonutChartInner({
  data,
  total,
}: {
  data: CreditSlice[];
  total: number;
}) {
  const chartData = data.filter((d) => d.balance > 0);
  const display = chartData.length > 0 ? chartData : data;

  return (
    <div className="relative h-40 sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={display}
            dataKey="balance"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="48%"
            outerRadius="68%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {display.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xl sm:text-2xl font-bold text-slate-900">{total.toLocaleString()}</p>
        <p className="text-[10px] sm:text-xs text-slate-500">Total Credits</p>
      </div>
    </div>
  );
}
