'use client';

import { useMemo, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

const PAYMENT_ID = '8210744067@ibl';
const PAYEE_NAME = 'ApexMonitor Support';
const AMOUNT_INR = '149';
const NOTE = 'Support ApexMonitor';

export function SupportQrCard() {
  const [copied, setCopied] = useState(false);

  const paymentUri = useMemo(() => {
    const params = new URLSearchParams({
      pa: PAYMENT_ID,
      pn: PAYEE_NAME,
      cu: 'INR',
      am: AMOUNT_INR,
      tn: NOTE,
    });

    return `upi://pay?${params.toString()}`;
  }, []);

  const qrSrc = useMemo(() => {
    const encoded = encodeURIComponent(paymentUri);
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`;
  }, [paymentUri]);

  const copyPaymentId = async () => {
    await navigator.clipboard.writeText(PAYMENT_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-neutral-800 bg-[#0f0f0f] p-4 sm:p-5 space-y-4">
      <h2 className="text-sm font-bold tracking-tight text-white">Support via QR</h2>

      <div className="rounded-md border border-neutral-800 bg-black p-3">
        <img src={qrSrc} alt="Payment QR code" className="mx-auto h-52 w-52 sm:h-56 sm:w-56 rounded-sm" loading="lazy" />
      </div>

      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#171717] px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-xs font-mono text-neutral-300">{PAYMENT_ID}</span>
        <button
          type="button"
          onClick={copyPaymentId}
          className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-200 hover:bg-neutral-800"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <a
        href={paymentUri}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#FF4500] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-black hover:bg-[#ff6b2f] transition-colors"
      >
        Open in App
        <ExternalLink className="h-4 w-4" />
      </a>

      <p className="text-[10px] leading-relaxed text-neutral-500">
        Voluntary support only. Payment is not required to use the platform.
      </p>
    </div>
  );
}
