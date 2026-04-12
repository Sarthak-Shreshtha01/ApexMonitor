'use client';

import { useState } from 'react';

export function BillingPaymentSection() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  return (
    <section className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight border-l-4 border-[#FF4500] pl-4">Payment Method</h2>
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-8 rounded-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#FF4500]/20 transition-all duration-500"></div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-8 bg-zinc-800 rounded flex items-center justify-center shrink-0">
              <span className="text-xs font-black italic text-zinc-500">VISA</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-mono font-bold text-white truncate">•••• •••• •••• 8842</p>
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

      {isPaymentModalOpen ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#131313] border border-zinc-800 p-5 sm:p-8 rounded-lg w-full max-w-md transform scale-100 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-xl font-bold mb-2">Update Payment Method</h3>
            <p className="text-sm text-zinc-500 mb-6">Enter your new card details below.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Card Number</label>
                <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-[#0A0A0A] border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#FF4500] transition-colors" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Expiry</label>
                  <input type="text" placeholder="MM/YY" className="w-full bg-[#0A0A0A] border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#FF4500] transition-colors" />
                </div>
                <div>
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
      ) : null}
    </section>
  );
}
