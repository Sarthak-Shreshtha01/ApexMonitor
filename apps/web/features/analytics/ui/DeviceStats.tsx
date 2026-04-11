type DeviceRow = {
  device_type: string;
  browser_name: string;
  page_views: number;
};

type DeviceStatsProps = {
  rows: DeviceRow[];
};

export function DeviceStats({ rows }: DeviceStatsProps) {
  const totalViews = Math.max(rows.reduce((sum, row) => sum + row.page_views, 0), 1);

  const byDevice = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.device_type.toUpperCase();
    acc[key] = (acc[key] ?? 0) + row.page_views;
    return acc;
  }, {});

  const byBrowser = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.browser_name;
    acc[key] = (acc[key] ?? 0) + row.page_views;
    return acc;
  }, {});

  const deviceRows = Object.entries(byDevice)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const browserRows = Object.entries(byBrowser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="bg-[#131313] border border-[#242424] p-6 flex flex-col gap-8 rounded-lg">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Device Distribution</h3>
        <div className="space-y-4">
          {deviceRows.map(([label, views], index) => {
            const percent = Math.round((views / totalViews) * 100);
            return (
              <div key={label}>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
                  <span>{label}</span><span>{percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className={index === 0 ? 'h-full bg-[#FF4500]' : index === 1 ? 'h-full bg-zinc-600' : 'h-full bg-zinc-800'} style={{ width: `${Math.max(percent, 2)}%` }}></div>
                </div>
              </div>
            );
          })}
          {deviceRows.length === 0 ? <p className="text-xs text-zinc-500">No device data.</p> : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Top Browsers</h3>
        <div className="space-y-4">
          {browserRows.map(([label, views], index) => {
            const percent = Math.round((views / totalViews) * 100);
            return (
              <div key={label} className="flex items-center gap-4">
                <span className="text-xs font-mono text-zinc-400 w-16 truncate">{label}</span>
                <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div className={index === 0 ? 'h-full bg-[#FF4500]' : index === 1 ? 'h-full bg-zinc-700' : 'h-full bg-zinc-800'} style={{ width: `${Math.max(percent, 2)}%` }}></div>
                </div>
                <span className="text-xs font-mono text-white">{percent}%</span>
              </div>
            );
          })}
          {browserRows.length === 0 ? <p className="text-xs text-zinc-500">No browser data.</p> : null}
        </div>
      </div>
    </div>
  );
}