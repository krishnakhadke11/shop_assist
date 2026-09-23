'use client';

import { useEffect, useState } from 'react';
import { OrderDiffChange, OrderState } from '@/types';

export function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    function update() {
      const start = new Date(createdAt).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - start) / 1000));

      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      if (mins > 0) {
        setElapsed(`${mins}m ${secs.toString().padStart(2, '0')}s`);
      } else {
        setElapsed(`${secs}s`);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber">
      <span className="inline-block w-2 h-2 rounded-full bg-amber animate-pulse" aria-hidden="true" />
      {elapsed}
    </span>
  );
}

export function OrderStateChip({ state }: { state: OrderState | string }) {
  const normState = (state || 'pending').toLowerCase();

  switch (normState) {
    case 'placing':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-bg text-amber border border-amber/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" />
          Calling shop…
        </span>
      );
    case 'captured':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-bg text-amber border border-amber/30">
          Order Sent
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-bg text-amber border border-amber/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
          Shop Checking
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand/15 text-brand-strong border border-brand/30">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Confirmed
        </span>
      );
    case 'modified':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-bg text-amber border border-amber/40">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Modified by shop
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-error-bg text-error border border-error/30">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Rejected
        </span>
      );
    case 'unreachable':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-ink/70 border border-gray-200">
          Unreachable
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-ink">
          {state}
        </span>
      );
  }
}

export function DiffBlock({ changes }: { changes: OrderDiffChange[] }) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber/40 bg-amber-bg p-3.5 mb-4">
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber mb-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Shop modified your order:
      </div>
      <ul className="space-y-1.5 text-xs text-ink">
        {changes.map((change, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="font-semibold text-ink">{change.item || change.field}:</span>
            <span className="line-through text-ink/50 bg-white/60 px-1.5 py-0.5 rounded">{change.from}</span>
            <span className="text-amber font-bold">→</span>
            <span className="font-bold text-ink bg-white px-1.5 py-0.5 rounded shadow-sm">{change.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
