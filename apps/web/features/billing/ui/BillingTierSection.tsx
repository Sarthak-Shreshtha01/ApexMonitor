const TIERS = [
  {
    label: 'Entry',
    name: 'Community',
    price: '₹0',
    suffix: '/mo',
    action: 'Downgrade',
    active: false,
  },
  {
    label: 'Standard',
    name: 'Pro Plan',
    price: '₹7,999',
    suffix: '/mo',
    action: 'Current Plan',
    active: true,
  },
  {
    label: 'Scale',
    name: 'Enterprise',
    price: 'Custom',
    suffix: '',
    action: 'Contact Sales',
    active: false,
  },
];

export function BillingTierSection() {
  return (
    <section className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight border-l-4 border-[#FF4500] pl-4">Tier Selection</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={
              tier.active
                ? 'bg-[#0e0e0e] border-2 border-[#FF4500] p-6 rounded relative overflow-hidden shadow-[0_0_20px_rgba(255,69,0,0.1)]'
                : 'bg-[#131313] border border-zinc-800 p-6 rounded hover:border-zinc-600 hover:-translate-y-1 transition-all duration-300'
            }
          >
            {tier.active ? (
              <div className="absolute -right-8 -top-8 bg-[#FF4500] text-black font-black text-[10px] py-10 px-10 rotate-45 uppercase tracking-widest">Active</div>
            ) : null}
            <p className={`text-xs font-mono uppercase mb-1 ${tier.active ? 'text-[#FF4500]' : 'text-zinc-500'}`}>{tier.label}</p>
            <h3 className="text-xl font-bold mb-4">{tier.name}</h3>
            <div className="mb-6">
              <span className="text-3xl font-mono font-bold text-white tracking-tighter">{tier.price}</span>
              {tier.suffix ? <span className="text-zinc-500 text-sm">{tier.suffix}</span> : null}
            </div>
            <button
              className={
                tier.active
                  ? 'w-full bg-[#FF4500] py-2 text-xs font-bold uppercase tracking-widest text-black hover:bg-[#FF8C00] transition-colors'
                  : 'w-full border border-zinc-700 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white transition-all'
              }
            >
              {tier.action}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
