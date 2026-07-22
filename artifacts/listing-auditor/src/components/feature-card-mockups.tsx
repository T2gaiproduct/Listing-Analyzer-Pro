/** Decorative UI previews shown at the bottom of homepage feature cards when no CMS image is set. */

export function FeatureCardMockup({ index }: { index: number }) {
  switch (index) {
    case 1:
      return <AuditListingMockup />;
    case 2:
      return <BuildBrandMockup />;
    case 3:
      return <CreateGraphicsMockup />;
    case 4:
      return <CreateVideosMockup />;
    case 5:
      return <ManageAdsMockup />;
    default:
      return null;
  }
}

function AuditListingMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-[8px] leading-tight shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-slate-800">Listing Score</span>
        <span className="font-bold text-orange-500 text-[10px]">85/100</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
          <p className="text-[7px] text-slate-500 mb-1">Score Breakdown</p>
          <div className="w-8 h-8 mx-auto rounded-full border-4 border-orange-400 border-r-slate-200 border-b-emerald-400" />
        </div>
        <div className="rounded bg-slate-50 p-1.5 border border-slate-100 space-y-0.5">
          <p className="text-[7px] text-slate-500">Top Issues</p>
          <div className="h-1 rounded-full bg-red-300 w-full" />
          <div className="h-1 rounded-full bg-amber-300 w-4/5" />
          <div className="h-1 rounded-full bg-emerald-300 w-3/5" />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[7px] text-slate-500">
        <span>12 Recommendations</span>
        <span className="text-emerald-600 font-medium">↑ +18%</span>
      </div>
    </div>
  );
}

function BuildBrandMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-[8px] shadow-sm">
      <p className="font-semibold text-slate-800 mb-1.5">Brand Kit</p>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center text-orange-600 font-bold">S</div>
        <div>
          <p className="font-medium text-slate-700">Aa Poppins</p>
          <div className="flex gap-0.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-slate-900" />
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="w-2 h-2 rounded-full bg-orange-300" />
          </div>
        </div>
      </div>
      <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[7px] text-slate-500 text-center">
        Brand Guidelines
      </div>
    </div>
  );
}

function CreateGraphicsMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
      <div className="grid grid-cols-2 gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="aspect-square rounded bg-gradient-to-br from-amber-50 to-orange-100 border border-orange-100 flex items-center justify-center"
          >
            <div className="w-3 h-5 rounded-sm bg-white/80 shadow-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateVideosMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
          <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-orange-500 ml-0.5" />
        </div>
      </div>
      <div className="px-1.5 py-1 bg-slate-50">
        <div className="h-0.5 rounded-full bg-slate-200">
          <div className="h-full w-1/3 rounded-full bg-orange-500" />
        </div>
        <div className="flex gap-0.5 mt-1">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1 h-3 rounded-sm bg-slate-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ManageAdsMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-[8px] shadow-sm">
      <p className="font-semibold text-slate-800 mb-1">Ad Performance</p>
      <div className="grid grid-cols-3 gap-1 mb-1.5 text-center">
        <div className="rounded bg-slate-50 p-1">
          <p className="text-[7px] text-slate-500">Spend</p>
          <p className="font-bold text-slate-800">$2.4k</p>
        </div>
        <div className="rounded bg-slate-50 p-1">
          <p className="text-[7px] text-slate-500">Sales</p>
          <p className="font-bold text-slate-800">$10.5k</p>
        </div>
        <div className="rounded bg-orange-50 p-1">
          <p className="text-[7px] text-orange-600">ROAS</p>
          <p className="font-bold text-orange-600">4.38</p>
        </div>
      </div>
      <div className="h-6 flex items-end gap-0.5 mb-1.5">
        {[40, 55, 45, 70, 60, 85].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-orange-200" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="rounded bg-orange-500 text-white text-[7px] font-medium text-center py-1">
        View All Campaigns
      </div>
    </div>
  );
}
