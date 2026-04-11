'use client';

import React, { useState } from 'react';

export default function BillingPage() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-body text-white selection:bg-primary-container selection:text-on-primary-container">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A] border-b border-zinc-800 flex justify-between items-center h-14 px-6">
        <div className="flex items-center gap-8">
          <span className="font-mono font-bold text-xl text-[#FF4500]">Pulse.Console</span>
          <div className="hidden md:flex gap-6">
            <a className="font-body uppercase tracking-wider text-[11px] font-medium text-[#FF4500] border-b-2 border-[#FF4500] pb-1 hover:text-white transition-colors duration-200" href="#">
              Project: Production-Alpha
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-700 bg-surface-container hover:ring-2 hover:ring-[#FF4500] transition-all cursor-pointer">
            <img alt="User Profile" src="https://api.dicebear.com/7.x/avataaars/svg?seed=PulseAdmin" />
          </div>
        </div>
      </nav>

      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-[#131313] border-r border-zinc-800 hidden md:flex flex-col pt-16">
        <div className="px-6 py-4 flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></div>
          <div>
            <p className="text-xs font-bold font-mono text-zinc-500 tracking-tighter uppercase">Edge_Node_01</p>
            <p className="text-[10px] text-zinc-600 font-mono">ap-south-1</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <a className="text-zinc-400 px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 hover:text-white transition-all" href="#">
            <span className="font-body text-sm tracking-tight">Overview</span>
          </a>
          <a className="text-zinc-400 px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 hover:text-white transition-all" href="#">
            <span className="font-body text-sm tracking-tight">Live Traffic</span>
          </a>
          <a className="bg-zinc-900 text-[#FF4500] border-l-2 border-[#FF4500] px-4 py-3 flex items-center gap-3 font-semibold" href="#">
            <span className="font-body text-sm tracking-tight">Billing & Usage</span>
          </a>
        </nav>
      </aside>

      {/* Main Content Canvas */}
      <main className="md:pl-64 pt-14 min-h-screen bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
          
          {/* Page Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">Billing & Usage</h1>
              <p className="text-zinc-500 mt-2 font-mono text-sm">Manage your enterprise data consumption and licensing.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#131313] border border-zinc-800 rounded">
              <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span>
              <span className="font-mono text-xs text-zinc-400">Current Plan:</span>
              <span className="font-mono text-xs font-bold text-white uppercase">Pro Plan</span>
            </div>
          </header>

          {/* Usage & Plan Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Usage Progress */}
            <div className="lg:col-span-8 bg-[#131313] border border-zinc-800 p-8 rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-zinc-600 transition-colors duration-300">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110">
                 {/* Decorative element */}
                 <div className="w-32 h-32 rounded-full border-[10px] border-[#FF4500]"></div>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Resource Consumption</h2>
                  <span className="text-xs font-mono text-zinc-500 italic">Resets in 12 days</span>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-6xl font-mono font-bold text-white leading-none tracking-tighter">75,000</span>
                  <span className="text-zinc-600 font-mono text-xl">/ 100,000</span>
                </div>
                <p className="text-zinc-400 text-sm font-medium">API Requests consumed this cycle</p>
              </div>
              
              <div className="mt-12 relative z-10">
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF4500] transition-all duration-1000 ease-out" style={{ width: '75%' }}></div>
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[10px] font-mono text-zinc-600 uppercase">Usage: 75.0%</span>
                  <span className="text-[10px] font-mono text-zinc-600 uppercase">Limit: 100k</span>
                </div>
              </div>
            </div>

            {/* Active Plan Summary */}
            <div className="lg:col-span-4 bg-[#FF4500] p-8 rounded-lg flex flex-col justify-between text-black group hover:bg-[#FF8C00] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,69,0,0.2)] cursor-pointer">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest mb-4 opacity-70">Active Subscription</h2>
                <h3 className="text-4xl font-extrabold tracking-tighter leading-tight">Pro Plan Enterprise</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold">✓</span>
                  <span className="text-sm font-bold">Unlimited Projects</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">✓</span>
                  <span className="text-sm font-bold">24/7 Node Monitoring</span>
                </div>
                <button className="w-full bg-black text-white py-3 font-bold text-xs uppercase tracking-widest mt-4 rounded-sm flex items-center justify-center gap-2 hover:bg-zinc-900 transition-colors">
                  Manage Subscription
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Tiers */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight border-l-4 border-[#FF4500] pl-4">Tier Selection</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Free Tier */}
              <div className="bg-[#131313] border border-zinc-800 p-6 rounded hover:border-zinc-600 hover:-translate-y-1 transition-all duration-300">
                <p className="text-xs font-mono text-zinc-500 uppercase mb-1">Entry</p>
                <h3 className="text-xl font-bold mb-4">Community</h3>
                <div className="mb-6">
                  <span className="text-3xl font-mono font-bold text-white tracking-tighter">₹0</span>
                  <span className="text-zinc-500 text-sm">/mo</span>
                </div>
                <button className="w-full border border-zinc-700 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white transition-all">Downgrade</button>
              </div>

              {/* Pro Tier (Active) */}
              <div className="bg-[#0e0e0e] border-2 border-[#FF4500] p-6 rounded relative overflow-hidden shadow-[0_0_20px_rgba(255,69,0,0.1)]">
                <div className="absolute -right-8 -top-8 bg-[#FF4500] text-black font-black text-[10px] py-10 px-10 rotate-45 uppercase tracking-widest">Active</div>
                <p className="text-xs font-mono text-[#FF4500] uppercase mb-1">Standard</p>
                <h3 className="text-xl font-bold mb-4">Pro Plan</h3>
                <div className="mb-6">
                  <span className="text-3xl font-mono font-bold text-white tracking-tighter">₹7,999</span>
                  <span className="text-zinc-500 text-sm">/mo</span>
                </div>
                <button className="w-full bg-[#FF4500] py-2 text-xs font-bold uppercase tracking-widest text-black hover:bg-[#FF8C00] transition-colors">Current Plan</button>
              </div>

              {/* Enterprise Tier */}
              <div className="bg-[#131313] border border-zinc-800 p-6 rounded hover:border-zinc-600 hover:-translate-y-1 transition-all duration-300">
                <p className="text-xs font-mono text-zinc-500 uppercase mb-1">Scale</p>
                <h3 className="text-xl font-bold mb-4">Enterprise</h3>
                <div className="mb-6">
                  <span className="text-3xl font-mono font-bold text-white tracking-tighter">Custom</span>
                </div>
                <button className="w-full border border-zinc-700 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white transition-all">Contact Sales</button>
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight border-l-4 border-[#FF4500] pl-4">Payment Method</h2>
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#FF4500]/20 transition-all duration-500"></div>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-zinc-800 rounded flex items-center justify-center">
                    <span className="text-xs font-black italic text-zinc-500">VISA</span>
                  </div>
                  <div>
                    <p className="text-sm font-mono font-bold text-white">•••• •••• •••• 8842</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-mono mt-1">Expires 04/26</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#FF4500] hover:text-[#FF8C00] transition-colors underline underline-offset-4"
                >
                  Update
                </button>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Interactive Payment Modal Dialog */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#131313] border border-zinc-800 p-8 rounded-lg w-full max-w-md transform scale-100 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-xl font-bold mb-2">Update Payment Method</h3>
            <p className="text-sm text-zinc-500 mb-6">Enter your new card details below.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Card Number</label>
                <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-[#0A0A0A] border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#FF4500] transition-colors" />
              </div>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Expiry</label>
                  <input type="text" placeholder="MM/YY" className="w-full bg-[#0A0A0A] border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#FF4500] transition-colors" />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-mono text-zinc-400 mb-1">CVC</label>
                  <input type="text" placeholder="123" className="w-full bg-[#0A0A0A] border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#FF4500] transition-colors" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-[#FF4500] text-black text-xs font-bold uppercase tracking-widest rounded hover:bg-[#FF8C00] transition-colors shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_25px_rgba(255,69,0,0.5)]">
                Save Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}