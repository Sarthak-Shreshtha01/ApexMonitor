type TopPage = {
  path: string;
  page_views: number;
  avg_lcp_ms: number;
};

type TopPagesTableProps = {
  rows: TopPage[];
};

const formatCompact = (value: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function TopPagesTable({ rows }: TopPagesTableProps) {
  return (
    <div className="bg-[#131313] border border-[#242424] overflow-hidden rounded-lg">
      <div className="p-6 border-b border-[#242424]">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Pages</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-zinc-500 border-b border-[#242424]">
              <th className="p-4 font-normal">PATH</th>
              <th className="p-4 font-normal text-right">VIEWS</th>
              <th className="p-4 font-normal text-right">LCP</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {rows.map((page, i) => (
              <tr key={i} className="border-b border-[#242424]/30 hover:bg-white/5 transition-colors">
                <td className="p-4">{page.path}</td>
                <td className="p-4 text-right">{formatCompact(page.page_views)}</td>
                <td className={`p-4 text-right ${page.avg_lcp_ms <= 2500 ? 'text-emerald-500' : page.avg_lcp_ms <= 4000 ? 'text-amber-500' : 'text-error'}`}>
                  {(page.avg_lcp_ms / 1000).toFixed(2)}s
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 text-zinc-500" colSpan={3}>No page analytics for selected range.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}