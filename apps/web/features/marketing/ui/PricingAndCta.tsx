import { Check } from 'lucide-react';
import Link from 'next/link';

export function PricingAndCta() {
  return (
    <>
      <section className="py-32 relative bg-[#0D1117] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black mb-4 tracking-tighter text-white">Scale Without Limits</h2>
            <p className="text-slate-400 text-lg">Transparent pricing for engineering teams of all sizes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container/40 rounded-3xl p-10 border border-white/5 flex flex-col transition-all hover:border-indigo-500/30">
              <div className="mb-8">
                <h4 className="text-slate-500 text-[11px] uppercase tracking-widest font-bold mb-2">Developer</h4>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">$0</span>
                  <span className="text-slate-500 text-sm">/forever</span>
                </div>
              </div>
              <ul className="space-y-4 mb-12 flex-grow">
                {['100k requests/mo', '3-day retention', 'Community support'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="text-indigo-400 w-5 h-5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 rounded-xl border border-white/10 font-bold text-white hover:bg-white/5 transition-all">Get Started</button>
            </div>

            <div className="bg-indigo-600 rounded-3xl p-10 border-2 border-indigo-400 relative flex flex-col shadow-[0_20px_50px_-12px_rgba(99,102,241,0.5)] scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Recommended</div>
              <div className="mb-8">
                <h4 className="text-indigo-100 text-[11px] uppercase tracking-widest font-bold mb-2">Pro Team</h4>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-5xl font-black">$49</span>
                  <span className="text-indigo-200 text-sm">/mo</span>
                </div>
              </div>
              <ul className="space-y-4 mb-12 flex-grow text-white">
                {['10M requests/mo', '30-day data retention', 'Full PulseAI™ Suite', 'Custom Webhooks & Alerts'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium">
                    <Check className="w-5 h-5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 rounded-xl bg-white text-indigo-600 font-black hover:scale-[1.02] transition-all shadow-lg">Start Pro Trial</button>
            </div>

            <div className="bg-surface-container/40 rounded-3xl p-10 border border-white/5 flex flex-col transition-all hover:border-indigo-500/30">
              <div className="mb-8">
                <h4 className="text-slate-500 text-[11px] uppercase tracking-widest font-bold mb-2">Enterprise</h4>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-5xl font-black">Custom</span>
                </div>
              </div>
              <ul className="space-y-4 mb-12 flex-grow">
                {['Unlimited data throughput', '1-year data retention', 'Custom SLA & Dedicated Support'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <Check className="text-indigo-400 w-5 h-5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 rounded-xl border border-white/10 font-bold text-white hover:bg-white/5 transition-all">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-40 max-w-5xl mx-auto px-8 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] -z-10"></div>
        <h2 className="text-6xl font-black mb-8 tracking-tighter text-white">The command center you've been waiting for.</h2>
        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">Join thousands of developers who have eliminated blind spots and shipping anxiety.</p>
        <div className="flex justify-center gap-6">
          <Link href="/register" className="bg-indigo-600 text-white px-12 py-6 rounded-2xl text-2xl font-black transition-all hover:scale-[1.05] shadow-[0_0_50px_-10px_rgba(99,102,241,0.2)]">
            Deploy PulseAPI Now
          </Link>
        </div>
        <div className="mt-16 flex justify-center gap-12 text-slate-500 font-bold font-mono text-sm opacity-50">
          <span>TRUSTED BY TOP TEAMS</span>
        </div>
      </section>
    </>
  );
}