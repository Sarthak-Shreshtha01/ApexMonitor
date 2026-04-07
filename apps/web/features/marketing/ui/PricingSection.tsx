import { CheckCircle2 } from 'lucide-react';

export function PricingSection() {
  return (
    <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 border-t border-outline-variant/10">
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
        <div className="max-w-xl">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Precision pricing for high-scale teams.</h2>
          <p className="text-on-surface-variant">Scale your observability without scaling your complexity. Simple, predictable, powerful.</p>
        </div>
        <div className="bg-surface-container-high p-1 rounded-xl flex">
          <button className="px-6 py-2 rounded-lg bg-surface-container-highest text-primary text-sm font-bold">Monthly</button>
          <button className="px-6 py-2 rounded-lg text-on-surface-variant text-sm font-medium">Yearly (-20%)</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Free Tier */}
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col hover:border-primary/30 transition-colors">
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-1">Free</h3>
            <p className="text-on-surface-variant text-sm">For side projects & hackers.</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black">$0</span>
            <span className="text-on-surface-variant text-sm">/mo</span>
          </div>
          <ul className="space-y-4 mb-12 flex-grow">
            {['100k requests / month', '3-day data retention', 'Basic alerts'].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-on-surface-variant">
                <CheckCircle2 className="text-secondary w-5 h-5" /> {feature}
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-lg border border-outline-variant/20 hover:bg-surface-container-high font-bold text-sm transition-all">
            Get Started
          </button>
        </div>

        {/* Pro Tier */}
        <div className="p-8 rounded-2xl bg-surface-container-lowest border-2 border-primary/50 flex flex-col relative shadow-[0_0_30px_-5px_rgba(255,69,0,0.15)]">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest">
            Most Popular
          </div>
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-1 text-primary">Pro</h3>
            <p className="text-on-surface-variant text-sm">For growing startups.</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black">$49</span>
            <span className="text-on-surface-variant text-sm">/mo</span>
          </div>
          <ul className="space-y-4 mb-12 flex-grow">
            {['5M requests / month', '30-day data retention', 'Custom dashboards', 'Team RBAC'].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="text-secondary w-5 h-5" /> {feature}
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-lg bg-primary text-on-primary font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            Go Pro
          </button>
        </div>

        {/* Enterprise Tier */}
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col hover:border-primary/30 transition-colors">
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-1">Enterprise</h3>
            <p className="text-on-surface-variant text-sm">For massive scale.</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black">Custom</span>
          </div>
          <ul className="space-y-4 mb-12 flex-grow">
            {['Unlimited requests', '2-year retention', 'Dedicated support', 'White-label portal'].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-on-surface-variant">
                <CheckCircle2 className="text-secondary w-5 h-5" /> {feature}
              </li>
            ))}
          </ul>
          <button className="w-full py-3 rounded-lg bg-surface-container-high border border-outline-variant/20 hover:border-white font-bold text-sm transition-all">
            Contact Sales
          </button>
        </div>
      </div>
    </section>
  );
}