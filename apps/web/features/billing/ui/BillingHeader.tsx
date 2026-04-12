export function BillingHeader() {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter text-white">Billing & Usage</h1>
        <p className="text-zinc-500 mt-2 font-mono text-xs sm:text-sm">Manage your enterprise data consumption and licensing.</p>
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#131313] border border-zinc-800 rounded w-fit">
        <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span>
        <span className="font-mono text-xs text-zinc-400">Current Plan:</span>
        <span className="font-mono text-xs font-bold text-white uppercase">Pro Plan</span>
      </div>
    </header>
  );
}
