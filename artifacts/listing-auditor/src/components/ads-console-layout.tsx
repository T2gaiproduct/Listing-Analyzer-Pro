/** Ads console content wrapper — navigation lives in the main sidebar Manage Ads dropdown. */
export function AdsConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-8rem)] -mx-1 sm:-mx-2">
      {children}
    </div>
  );
}
