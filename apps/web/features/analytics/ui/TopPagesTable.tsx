const TOP_PAGES = [
  { path: '/dashboard', views: '42.1k', lcp: '1.1s', color: 'text-emerald-500' },
  { path: '/api/v2/docs', views: '38.4k', lcp: '0.9s', color: 'text-emerald-500' },
  { path: '/pricing', views: '12.5k', lcp: '2.4s', color: 'text-amber-500' },
  { path: '/blog/release-notes', views: '8.2k', lcp: '1.2s', color: 'text-emerald-500' },
];

export function TopPagesTable() {
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
            {TOP_PAGES.map((page, i) => (
              <tr key={i} className="border-b border-[#242424]/30 hover:bg-white/5 transition-colors">
                <td className="p-4">{page.path}</td>
                <td className="p-4 text-right">{page.views}</td>
                <td className={`p-4 text-right ${page.color}`}>{page.lcp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}